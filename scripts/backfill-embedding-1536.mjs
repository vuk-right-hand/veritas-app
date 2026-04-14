// Re-embed the existing verified catalog at 1536 dims via the Gemini REST API.
// Run: node --env-file=.env.local scripts/backfill-embedding-1536.mjs
//
// Idempotent and resumable: only picks up rows where embedding_1536 IS NULL.
// Rebuilds the same `cleanContentToEmbed` string as api/analyze/route.ts so
// vectors produced here match what the live path produces for new videos.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GOOGLE_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !GEMINI_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GOOGLE_API_KEY');
    process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function embed1536(text) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'models/gemini-embedding-001',
            content: { parts: [{ text }] },
            outputDimensionality: 1536,
        }),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '<no body>');
        throw new Error(`Gemini ${res.status}: ${body}`);
    }
    const data = await res.json();
    const values = data?.embedding?.values;
    if (!Array.isArray(values) || values.length !== 1536) {
        throw new Error(`Unexpected shape from Gemini (len=${values?.length})`);
    }
    return values;
}

function buildCleanContent(video, tags) {
    const tagsString = tags.map((t) => t.tag).join(' ');
    const takeaways = Array.isArray(video.summary_points)
        ? video.summary_points
        : (video.summary_points ? Object.values(video.summary_points) : []);
    return `Title: ${video.title ?? ''} | Category: ${video.category_tag ?? ''} | Key Insights: ${takeaways.join(', ')} | Topics: ${tagsString}`;
}

async function fetchTagsFor(videoId) {
    const { data, error } = await admin
        .from('video_tags')
        .select('tag')
        .eq('video_id', videoId);
    if (error) throw error;
    return data ?? [];
}

async function main() {
    const { count: totalNeeded, error: countErr } = await admin
        .from('videos')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'verified')
        .is('embedding_1536', null);
    if (countErr) throw countErr;

    console.log(`[backfill-embedding-1536] ${totalNeeded ?? 0} verified rows need embedding_1536`);
    if (!totalNeeded) return;

    const BATCH = 20;
    const SLEEP_MS = 200;
    let processed = 0;
    let failed = 0;
    // Track ids that threw so we don't re-query them forever. .is(null) would
    // otherwise pick a failing row up every batch → infinite loop on one bad id.
    const failedIds = new Set();

    while (true) {
        let q = admin
            .from('videos')
            .select('id, title, category_tag, summary_points')
            .eq('status', 'verified')
            .is('embedding_1536', null)
            .order('id', { ascending: true })
            .limit(BATCH);
        if (failedIds.size > 0) {
            // PostgREST .not('id','in',...) for skip-list. Safe: ids are YouTube charset.
            q = q.not('id', 'in', `(${[...failedIds].join(',')})`);
        }
        const { data: rows, error } = await q;
        if (error) throw error;
        if (!rows || rows.length === 0) break;

        for (const row of rows) {
            try {
                const tags = await fetchTagsFor(row.id);
                const text = buildCleanContent(row, tags);
                const vec = await embed1536(text);
                // pgvector columns round-trip as TEXT through PostgREST — send
                // the '[a,b,c]' literal explicitly. Sending a JS array can write
                // garbage/NULL depending on version of postgrest.
                const vecLiteral = '[' + vec.join(',') + ']';
                const { error: upErr } = await admin
                    .from('videos')
                    .update({ embedding_1536: vecLiteral })
                    .eq('id', row.id);
                if (upErr) throw upErr;
                processed += 1;
                process.stdout.write(`  [${processed}] ${row.id}  ok\n`);
            } catch (e) {
                failed += 1;
                failedIds.add(row.id);
                console.error(`  [fail] ${row.id}: ${e.message ?? e}`);
            }
            await new Promise((r) => setTimeout(r, SLEEP_MS));
        }
    }

    console.log(`\n[backfill-embedding-1536] done — processed=${processed} failed=${failed}`);
}

main().catch((e) => {
    console.error('[backfill-embedding-1536] fatal:', e);
    process.exit(1);
});

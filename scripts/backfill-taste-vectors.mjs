// One-time taste-vector backfill from watch_history.
// Run AFTER scripts/backfill-embedding-1536.mjs has completed.
// Run: node --env-file=.env.local scripts/backfill-taste-vectors.mjs
//
// For each distinct watch_history.user_id:
//   - join rows to videos.embedding_1536
//   - weight = 1.0 if watch_seconds >= 60, else skip (watch_history has no
//     duration column and videos has no duration_seconds column either — so
//     we cannot compute watchPct retrospectively. 60s is a conservative
//     substitute for the live path's 25% gate: anyone who watched at least
//     a minute was almost certainly past the 25% mark of a short/medium clip).
//   - compute unweighted sum of normalized video vectors, l2-normalize,
//     upsert into user_taste_vectors.
//
// watch_count = actual number of rows that passed the 60s threshold. We do
// NOT synthetically bump past the cold-start gate (< 3 → chronological).
//
// HARD GUARD: exits with non-zero if any verified video has null
// embedding_1536 — no silent partial backfill.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function l2Normalize(vec) {
    let sumSq = 0;
    for (const x of vec) sumSq += x * x;
    const norm = Math.sqrt(sumSq);
    if (norm === 0) return vec.slice();
    return vec.map((x) => x / norm);
}

function parseVector(raw) {
    // pgvector returns "[0.1,0.2,...]" as text via postgrest.
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        const inner = raw.trim().replace(/^\[|\]$/g, '');
        if (!inner) return null;
        return inner.split(',').map(Number);
    }
    return null;
}

async function preflight() {
    const { count, error } = await admin
        .from('videos')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'verified')
        .is('embedding_1536', null);
    if (error) throw error;
    if ((count ?? 0) > 0) {
        console.error(`[preflight] FAIL — ${count} verified videos still have embedding_1536 = NULL.`);
        console.error('           Run scripts/backfill-embedding-1536.mjs first.');
        process.exit(2);
    }
    console.log('[preflight] all verified videos have embedding_1536 ✓');
}

async function fetchDistinctUserIds() {
    // PostgREST has no DISTINCT — pull all rows and dedupe client-side. Fine
    // for a one-time backfill against current history volume.
    const ids = new Set();
    const PAGE = 1000;
    let from = 0;
    while (true) {
        // Stable order REQUIRED — PostgREST page boundaries are non-
        // deterministic without .order(), and a dataset with churn can skip
        // or duplicate rows across pages. Set dedupes duplicates, doesn't
        // recover skips.
        const { data, error } = await admin
            .from('watch_history')
            .select('user_id')
            .order('user_id', { ascending: true })
            .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) if (r.user_id) ids.add(r.user_id);
        if (data.length < PAGE) break;
        from += PAGE;
    }
    return [...ids];
}

async function fetchUserWatches(userId) {
    const { data, error } = await admin
        .from('watch_history')
        .select('video_id, watch_seconds, videos!inner(embedding_1536)')
        .eq('user_id', userId);
    if (error) throw error;
    return data ?? [];
}

async function main() {
    await preflight();

    const userIds = await fetchDistinctUserIds();
    console.log(`[backfill-taste-vectors] ${userIds.length} distinct users`);

    let upserted = 0;
    let skipped = 0;

    for (const userId of userIds) {
        try {
            const rows = await fetchUserWatches(userId);
            const weighted = new Array(1536).fill(0);
            let kept = 0;

            for (const r of rows) {
                const v = r.videos;
                if (!v?.embedding_1536) continue;
                if ((r.watch_seconds ?? 0) < 60) continue;

                const vec = parseVector(v.embedding_1536);
                if (!vec || vec.length !== 1536) continue;

                // Normalize each video vector first so one "long" embedding
                // doesn't dominate the sum (pgvector already stores unit
                // vectors for cosine, but we don't rely on that).
                let s = 0;
                for (let i = 0; i < 1536; i++) s += vec[i] * vec[i];
                const n = Math.sqrt(s) || 1;
                for (let i = 0; i < 1536; i++) weighted[i] += vec[i] / n;
                kept += 1;
            }

            if (kept === 0) {
                skipped += 1;
                continue;
            }

            const normalized = l2Normalize(weighted);
            // Serialize as pgvector text literal. Sending a JS array via
            // PostgREST is version-dependent and can silently write NULL —
            // the explicit '[a,b,c]' form always works.
            const embeddingLiteral = '[' + normalized.join(',') + ']';
            const { error: upErr } = await admin
                .from('user_taste_vectors')
                .upsert({
                    user_id: userId,
                    embedding: embeddingLiteral,
                    watch_count: kept,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id' });
            if (upErr) throw upErr;

            upserted += 1;
            if (upserted % 50 === 0) console.log(`  [${upserted}] upserted so far`);
        } catch (e) {
            console.error(`  [fail] ${userId}: ${e.message ?? e}`);
        }
    }

    console.log(`\n[backfill-taste-vectors] done — upserted=${upserted} skipped=${skipped}`);
}

main().catch((e) => {
    console.error('[backfill-taste-vectors] fatal:', e);
    process.exit(1);
});

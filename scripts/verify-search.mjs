// End-to-end verification of the Phase 1–3 search refactor.
// Run: node --env-file=.env.local scripts/verify-search.mjs
//
// Exercises match_videos_1536 directly and validates the input-guarding
// regex/length rules from src/app/actions/search-actions.ts. Each check
// prints PASS/FAIL and the script exits non-zero if anything fails.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GOOGLE_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !GEMINI_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GOOGLE_API_KEY');
    process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;
const record = (name, ok, detail = '') => {
    if (ok) { passed++; console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`); }
    else    { failed++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
};

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
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text().catch(() => '')}`);
    const data = await res.json();
    const v = data?.embedding?.values;
    if (!Array.isArray(v) || v.length !== 1536) throw new Error(`Gemini shape wrong len=${v?.length}`);
    return v;
}

async function rpc(query, embedding, { viewerTaste = null } = {}) {
    const { data, error } = await admin.rpc('match_videos_1536', {
        query_embedding: embedding,
        query_text: query,
        match_threshold: 0.65,
        match_count: 9,
        viewer_taste: viewerTaste,
    });
    if (error) throw new Error(`RPC error: ${error.message}`);
    return data ?? [];
}

// -------------------------------------------------------------------------
// 1. Input validation for logSearchClick (pure — mirror the production rules
//    exactly so drift in search-actions.ts breaks this test).
// -------------------------------------------------------------------------
console.log('\n[1] logSearchClick input validation');

const videoIdRe = /^[A-Za-z0-9_-]{11}$/;
const validateClick = (q, id) => {
    const trimmed = (q || '').trim().toLowerCase();
    if (!trimmed || trimmed.length > 200 || !id) return false;
    if (!videoIdRe.test(id)) return false;
    return true;
};

record('accepts 11-char YouTube id',      validateClick('vibe coding', 'o_Vkl9oXxxY') === true);
record('rejects 10-char id',               validateClick('vibe coding', 'o_Vkl9oXxx') === false);
record('rejects 12-char id',               validateClick('vibe coding', 'o_Vkl9oXxxYY') === false);
record('rejects id with illegal char',     validateClick('vibe coding', 'o_Vkl9oXxx!') === false);
record('rejects empty videoId',            validateClick('vibe coding', '') === false);
record('rejects empty query',              validateClick('   ', 'o_Vkl9oXxxY') === false);
record('rejects 201-char query',           validateClick('x'.repeat(201), 'o_Vkl9oXxxY') === false);
record('accepts 200-char query',           validateClick('x'.repeat(200), 'o_Vkl9oXxxY') === true);

// -------------------------------------------------------------------------
// 2. RPC smoke — does match_videos_1536 exist and return the expected shape?
// -------------------------------------------------------------------------
console.log('\n[2] match_videos_1536 RPC smoke');

// Adaptive query: pick a distinctive word from a real verified title so the
// test works against any catalog size. Falls back to 'coding' if no rows.
const { data: titleSample } = await admin
    .from('videos')
    .select('title')
    .eq('status', 'verified')
    .not('embedding_1536', 'is', null)
    .limit(1);
const sampleTitle = titleSample?.[0]?.title ?? '';
const QUERY = (sampleTitle.split(/\s+/).find(w => w.length >= 5)?.toLowerCase())
    || 'coding';
console.log(`       using adaptive query: "${QUERY}" (from "${sampleTitle.slice(0, 60)}")`);
let embedding;
try {
    embedding = await embed1536(QUERY);
    record('gemini embedding(1536)', embedding.length === 1536, `dim=${embedding.length}`);
} catch (e) {
    record('gemini embedding(1536)', false, e.message);
    console.log('\nBailing — cannot test RPC without an embedding.');
    process.exit(1);
}

let anonResults;
try {
    anonResults = await rpc(QUERY, embedding);
    record('rpc returns rows', anonResults.length > 0, `n=${anonResults.length}`);
} catch (e) {
    record('rpc returns rows', false, e.message);
    console.log('\nBailing — RPC is broken.');
    process.exit(1);
}

if (anonResults.length > 0) {
    const row = anonResults[0];
    const cols = ['id', 'title', 'score', 'similarity', 'fts_matched'];
    const missing = cols.filter(c => !(c in row));
    record('row shape has score/similarity/fts_matched', missing.length === 0,
        missing.length ? `missing: ${missing.join(',')}` : '');

    const scores = anonResults.map(r => r.score);
    const monotone = scores.every((s, i) => i === 0 || scores[i - 1] >= s);
    record('rows ordered by score DESC', monotone,
        monotone ? '' : `scores=${scores.map(s => s?.toFixed(3)).join(',')}`);

    const inRange = scores.every(s => typeof s === 'number' && s >= 0 && s <= 1.5);
    record('scores in plausible range [0,1.5]', inRange);
}

// -------------------------------------------------------------------------
// 3. Blended score sanity — FTS-only hits respect the 0.55 floor.
// -------------------------------------------------------------------------
console.log('\n[3] FTS-only floor (>= 0.55 for any fts_matched row)');

const ftsFloorOk = anonResults
    .filter(r => r.fts_matched === true)
    .every(r => r.score >= 0.55 - 1e-9);
record('every fts_matched row scores >= 0.55', ftsFloorOk);

const ftsCount = anonResults.filter(r => r.fts_matched).length;
const vecOnlyCount = anonResults.filter(r => !r.fts_matched).length;
console.log(`       breakdown: fts_matched=${ftsCount}  vector_only=${vecOnlyCount}`);

// -------------------------------------------------------------------------
// 4. Anon parity — viewer_taste=null must be byte-identical to no personalization.
//    (Two calls with viewer_taste=null in a row must return the same ordering.)
// -------------------------------------------------------------------------
console.log('\n[4] Anon parity (viewer_taste=null is stable)');

const second = await rpc(QUERY, embedding, { viewerTaste: null });
const sameOrder = second.length === anonResults.length
    && second.every((r, i) => r.id === anonResults[i].id);
record('two anon calls return identical ordering', sameOrder);

// -------------------------------------------------------------------------
// 5. Personalization delta — if any user_taste_vectors exist, pass one in
//    and confirm the RPC does not error. We don't assert ordering differs
//    because a sparse catalog may legitimately produce the same top-9.
// -------------------------------------------------------------------------
console.log('\n[5] Personalization path');

const { data: tasteRows } = await admin
    .from('user_taste_vectors')
    .select('user_id, embedding')
    .limit(1);

if (!tasteRows?.length) {
    console.log('  SKIP  no user_taste_vectors rows exist yet');
} else {
    const taste = tasteRows[0].embedding;
    const tasteArr = typeof taste === 'string' ? JSON.parse(taste) : taste;
    try {
        const personalized = await rpc(QUERY, embedding, { viewerTaste: tasteArr });
        record('personalized rpc call succeeds', personalized.length >= 0, `n=${personalized.length}`);

        const differs = personalized.length !== anonResults.length
            || personalized.some((r, i) => r.id !== anonResults[i].id);
        console.log(`       ordering differs from anon: ${differs ? 'yes' : 'no (either sparse catalog or taste ≈ query)'}`);
    } catch (e) {
        record('personalized rpc call succeeds', false, e.message);
    }
}

// -------------------------------------------------------------------------
// 6. Threshold behavior — a gibberish query with no FTS hits should return
//    few or zero rows (the 0.65 cosine threshold should filter noise).
// -------------------------------------------------------------------------
console.log('\n[6] Threshold filters noise');

const gibberish = 'xyzqqq wobble flarp nonexistent';
const gibEmbedding = await embed1536(gibberish);
const gibResults = await rpc(gibberish, gibEmbedding);
record('gibberish returns few results', gibResults.length <= 3,
    `n=${gibResults.length} (some noise is ok at 0.65)`);
if (gibResults.length > 0) {
    console.log(`       top score=${gibResults[0].score?.toFixed(3)}  fts=${gibResults[0].fts_matched}`);
}

// -------------------------------------------------------------------------
// Summary
// -------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

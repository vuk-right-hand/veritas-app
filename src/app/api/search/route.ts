import { NextResponse } from 'next/server';
import { generateEmbedding1536 } from '@/lib/gemini';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveViewerIdReadOnly } from '@/lib/viewer-identity';

export async function POST(req: Request) {
    try {
        const { query, temporalFilter } = await req.json();

        if (!query) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        const cleanQuery = query.trim().toLowerCase();
        if (!cleanQuery || cleanQuery.length > 200) {
            return NextResponse.json({ error: 'Query too long' }, { status: 400 });
        }
        let embedding: number[] = [];

        // 1. Check cache (keyed by query_text, vector(1536) column after 20260416 migration).
        // maybeSingle — a cache miss is the common path, not an error.
        const { data: cached } = await supabaseAdmin
            .from('search_cache')
            .select('embedding')
            .eq('query_text', cleanQuery)
            .maybeSingle();

        if (cached?.embedding) {
            console.log("🎯 Cache Hit for:", cleanQuery);
            embedding = typeof cached.embedding === 'string'
                ? JSON.parse(cached.embedding)
                : (cached.embedding as number[]);
        } else {
            console.log("💨 Cache Miss - Generating 1536-dim Gemini embedding...");
            embedding = await generateEmbedding1536(cleanQuery);

            // Fire-and-forget cache write. Upsert for concurrent-query race safety.
            // pgvector columns round-trip as TEXT through PostgREST — send the
            // '[a,b,c]' literal. Sending a JS array can silently write garbage
            // depending on postgrest version (see scripts/backfill-embedding-1536.mjs).
            const vecLiteral = '[' + embedding.join(',') + ']';
            const { error: cacheError } = await supabaseAdmin
                .from('search_cache')
                .upsert({
                    query_text: cleanQuery,
                    embedding: vecLiteral,
                }, { onConflict: 'query_text' });

            if (cacheError) console.error("Cache Write Error:", cacheError);
        }

        // 2. Resolve viewer and fetch taste vector for personalized re-rank.
        // Same cascade (resolveViewerIdReadOnly) as the write path at
        // api/watch-progress → recordWatchProgress → upsert_user_taste_vector,
        // so the id we read here matches the id the taste vector was written under.
        // RLS on user_taste_vectors has no SELECT policy by design — admin client required.
        // Normalize to number[] so it serializes identically to query_embedding —
        // passing one as a JS array and the other as a string literal through
        // supabase-js is the exact silent-cast footgun that caused this refactor.
        let viewerTaste: number[] | null = null;
        try {
            const viewerId = await resolveViewerIdReadOnly();
            if (viewerId) {
                const { data: taste } = await supabaseAdmin
                    .from('user_taste_vectors')
                    .select('embedding')
                    .eq('user_id', viewerId)
                    .maybeSingle();
                if (taste?.embedding) {
                    viewerTaste = typeof taste.embedding === 'string'
                        ? JSON.parse(taste.embedding)
                        : (taste.embedding as number[]);
                }
            }
        } catch (e) {
            // Personalization is best-effort. A failure here must not break search.
            console.error('[search] viewer_taste lookup failed:', (e as Error).message);
        }

        // 3. Hybrid search: blended (FTS + vector) + optional taste re-rank.
        const queryArgs: Record<string, unknown> = {
            query_embedding: embedding,
            query_text: cleanQuery,
            match_threshold: 0.65,
            match_count: 9,
            viewer_taste: viewerTaste,
        };

        if (temporalFilter && temporalFilter !== 'evergreen') {
            queryArgs.days_filter = parseInt(temporalFilter);
        }

        const { data: results, error: fetchError } = await supabaseAdmin.rpc('match_videos_1536', queryArgs);

        if (fetchError) {
            console.error("Supabase RPC Error:", fetchError);
            throw new Error(fetchError.message);
        }

        if (!results || results.length === 0) {
            return NextResponse.json({ success: true, matches: [] });
        }

        // Fire-and-forget analytics. Richer payload: Phase 3 threshold tuning
        // reads score/similarity/fts_matched/rank out of metadata.
        supabaseAdmin.from('analytics_events').insert(
            results.map((v: any, idx: number) => ({
                event_type: 'creator_search',
                target_id: v.id,
                metadata: {
                    query: cleanQuery,
                    channel_url: v.channel_url,
                    rank: idx,
                    score: v.score,
                    similarity: v.similarity,
                    fts_matched: v.fts_matched,
                },
            }))
        ).then(({ error }) => {
            if (error) console.error('Search event log error:', error);
        });

        console.log(`Found ${results.length} matches (threshold 0.65)`);
        if (results.length > 0) {
            const top = results[0];
            console.log(`Top: ${top.title} score=${top.score?.toFixed(3)} sim=${top.similarity?.toFixed(3)} fts=${top.fts_matched}`);
        }

        return NextResponse.json({ success: true, matches: results });

    } catch (error: any) {
        console.error("Search Error:", error.message);
        return NextResponse.json({
            error: error.message || "Search failed.",
        }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { generateEmbedding } from '@/lib/gemini';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
    try {
        const { query, temporalFilter } = await req.json();

        if (!query) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        const cleanQuery = query.trim().toLowerCase();
        let embedding: number[] = [];

        // 1. Check Cache First (Save $$$)
        const { data: cached } = await supabase
            .from('search_cache')
            .select('embedding')
            .eq('query_text', cleanQuery)
            .single();

        if (cached) {
            console.log("🎯 Cache Hit for:", cleanQuery);
            embedding = JSON.parse(cached.embedding as any); // Supabase returns vector as string sometimes, need to handle
            // Actually supabase-js handles vector parsed as string usually, but let's be safe if it's already an array
            if (typeof cached.embedding === 'string') {
                embedding = JSON.parse(cached.embedding);
            } else {
                embedding = cached.embedding;
            }
        } else {
            console.log("💨 Cache Miss - Generating Custom Embedding...");
            // 2. Generate Embedding via Gemini
            embedding = await generateEmbedding(cleanQuery);

            // 3. Save to Cache (Fire & Forget)
            // We use upsert to handle race conditions if two people search same thing at once
            const { error: cacheError } = await supabase
                .from('search_cache')
                .upsert({
                    query_text: cleanQuery,
                    embedding: embedding
                }, { onConflict: 'query_text' });

            if (cacheError) console.error("Cache Write Error:", cacheError);
        }

        // 4. Search Database using pgvector HNSW Index and RPC
        const queryArgs: any = {
            query_embedding: embedding,
            match_threshold: 0.5,
            match_count: 5
        };

        // Apply temporal filter if provided and not evergreen
        if (temporalFilter && temporalFilter !== 'evergreen') {
            const days = parseInt(temporalFilter);
            queryArgs.days_filter = days;
        }

        const { data: results, error: fetchError } = await supabase.rpc('match_videos', queryArgs);

        if (fetchError) {
            console.error("Supabase RPC Error:", fetchError);
            throw new Error(fetchError.message);
        }

        if (!results || results.length === 0) {
            return NextResponse.json({
                success: true,
                matches: []
            });
        }

        console.log(`Found ${results.length} matches above 0.5 threshold`);
        if (results.length > 0) {
            console.log('Top match:', results[0].title, 'similarity:', results[0].similarity.toFixed(3));
        }

        return NextResponse.json({
            success: true,
            matches: results
        });

    } catch (error: any) {
        console.error("Search Error:", error.message);
        return NextResponse.json({
            error: error.message || "Search failed."
        }, { status: 500 });
    }
}

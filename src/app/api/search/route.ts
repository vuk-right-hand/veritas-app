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

        // 4. Search Database - Bypassing RPC due to type issues, using direct SQL
        // Fetch all videos with embeddings and calculate similarity manually
        let supabaseQuery = supabase
            .from('videos')
            .select('id, title, human_score, embedding, summary_points, channel_title, channel_url, published_at, custom_description, custom_links')
            .not('embedding', 'is', null);

        // Apply temporal filter if provided and not evergreen
        if (temporalFilter && temporalFilter !== 'evergreen') {
            const days = parseInt(temporalFilter);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            supabaseQuery = supabaseQuery.gte('published_at', cutoffDate.toISOString());
        }

        const { data: allVideos, error: fetchError } = await supabaseQuery;

        if (fetchError) {
            console.error("Supabase Fetch Error:", fetchError);
            throw new Error(fetchError.message);
        }

        if (!allVideos || allVideos.length === 0) {
            return NextResponse.json({
                success: true,
                matches: []
            });
        }

        // Calculate cosine similarity for each video
        const results = allVideos.map(video => {
            // Parse embedding - Supabase stores vectors as strings
            let videoEmbedding: number[];
            if (typeof video.embedding === 'string') {
                videoEmbedding = JSON.parse(video.embedding);
            } else if (Array.isArray(video.embedding)) {
                videoEmbedding = video.embedding;
            } else {
                console.warn(`Unexpected embedding format for "${video.title}"`);
                return null;
            }

            // Cosine similarity calculation
            let dotProduct = 0;
            let normA = 0;
            let normB = 0;

            for (let i = 0; i < embedding.length; i++) {
                dotProduct += embedding[i] * videoEmbedding[i];
                normA += embedding[i] * embedding[i];
                normB += videoEmbedding[i] * videoEmbedding[i];
            }

            const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

            return {
                id: video.id,
                title: video.title,
                human_score: video.human_score,
                summary_points: video.summary_points || [],
                channel_title: video.channel_title,
                channel_url: video.channel_url,
                published_at: video.published_at,
                custom_description: video.custom_description,
                custom_links: video.custom_links,
                similarity
            };
        })
            .filter((v): v is NonNullable<typeof v> => v !== null && v.similarity > 0.3)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 5);

        console.log(`Found ${results.length} matches above 0.3 threshold`);
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

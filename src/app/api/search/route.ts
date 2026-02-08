import { NextResponse } from 'next/server';
import { generateEmbedding } from '@/lib/gemini';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
    try {
        const { query } = await req.json();

        if (!query) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        // 1. Generate Embedding for the User's Query
        // "I want to cure my laziness" -> [0.01, -0.05, ...]
        const embedding = await generateEmbedding(query);

        // 2. Search Database using Similarity
        // We call the 'match_videos' RPC function we made in SQL
        const { data: videos, error } = await supabase.rpc('match_videos', {
            query_embedding: embedding,
            match_threshold: 0.5, // Only return relevant matches
            match_count: 5 // Top 5
        });

        if (error) {
            console.error("Supabase Search Error:", error);
            throw new Error(error.message);
        }

        return NextResponse.json({
            success: true,
            matches: videos
        });

    } catch (error: any) {
        console.error("Search Error:", error.message);
        return NextResponse.json({
            error: error.message || "Search failed."
        }, { status: 500 });
    }
}

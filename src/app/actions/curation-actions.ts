'use server';

import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '@/lib/gemini';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function curateFeedForMission(missionId: string, goal: string, struggle: string) {
    console.log(`🧠 Curating feed for Mission: ${missionId}`);

    try {
        // 1. Generate Embedding for the Mission
        const queryText = `Help me ${goal} and overcome ${struggle}`;
        const embedding = await generateEmbedding(queryText);

        // 2. Fetch Videos and Calculate Similarity
        // Fetch all videos with embeddings (Optimization: call RPC if available, else manual)
        const { data: allVideos } = await supabase
            .from('videos')
            .select('id, title, embedding')
            .not('embedding', 'is', null);

        if (allVideos && allVideos.length > 0) {
            const scoredVideos = allVideos.map(video => {
                let videoEmbedding: number[] = [];
                if (typeof video.embedding === 'string') {
                    try {
                        videoEmbedding = JSON.parse(video.embedding);
                    } catch (e) {
                        return null;
                    }
                } else if (Array.isArray(video.embedding)) {
                    videoEmbedding = video.embedding;
                } else {
                    return null;
                }

                if (!videoEmbedding || videoEmbedding.length !== embedding.length) return null;

                // Cosine Similarity
                let dotProduct = 0;
                let normA = 0;
                let normB = 0;
                for (let i = 0; i < embedding.length; i++) {
                    dotProduct += embedding[i] * videoEmbedding[i];
                    normA += embedding[i] * embedding[i];
                    normB += videoEmbedding[i] * videoEmbedding[i];
                }
                const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
                return { id: video.id, similarity };
            })
                .filter((v): v is { id: string, similarity: number } => v !== null)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, 5); // Top 5

            // Select Top 3
            const selected = scoredVideos.slice(0, 3);

            if (selected.length > 0) {
                // Delete existing curations for this mission (if any)
                await supabase
                    .from('mission_curations')
                    .delete()
                    .eq('mission_id', missionId);

                const curations = selected.map(v => ({
                    mission_id: missionId,
                    video_id: v.id,
                    curation_reason: `AI Match (${(v.similarity * 100).toFixed(0)}% relevance) for Goal: "${goal}"`
                }));

                const { error: curationError } = await supabase
                    .from('mission_curations')
                    .insert(curations);

                if (curationError) {
                    console.error('⚠️ Failed to save curations:', curationError);
                    return { success: false, message: "Failed to save curations." };
                } else {
                    console.log(`✅ Linked ${curations.length} smart-curated videos.`);
                    return { success: true, count: curations.length };
                }
            }
        }
        return { success: true, count: 0, message: "No videos found." };

    } catch (curationErr: any) {
        console.error("Smart Curation Failed:", curationErr);
        return { success: false, message: curationErr.message };
    }
}

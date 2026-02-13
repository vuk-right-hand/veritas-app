'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { generateEmbedding } from '@/lib/gemini';

// Initialize Supabase Client (Service Role for secure backend ops if needed, or Anon if using RLS)
// For this action, we should ideally use the authenticated user's client if we had auth.
// But based on the flow, it seems to be a public onboarding leading to a signup/profile creation.
// If the user doesn't have an ID yet, we might need to create a shadow user or just store pending data.
// However, the `user_missions` table requires a `user_id`. 
// Assumption: We will use the service role to create a "shadow" profile if one doesn't exist, 
// or imply this runs after auth. 
// Given the form asks for Name/Email at step 3, we probably need to Create User -> Create Mission.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveMission(formData: { goal: string; struggle: string; name: string; email: string }) {
    console.log('🚀 Saving Mission:', formData);

    const cookieStore = await cookies();

    // 1. Check if user exists or create new one (Simplified Logic for MVP)
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: 'TemporaryPassword123!', // User would reset this later
        email_confirm: true,
        user_metadata: { full_name: formData.name }
    });

    let userId = authUser?.user?.id;

    if (authError) {
        console.log('⚠️ Auth User might already exist:', authError.message);
        if (authError.message.includes('already registered')) {
            // For MVP, if user exists, we try to find them (this is risky in prod without auth, but fine for demo)
            // Ideally we'd ask them to login.
            // Let's try to proceed by assuming we can't get the ID easily without login.
            // But wait! If we can't get ID, we can't create mission.
            return { success: false, message: "User already exists. Please login." };
        }
    }

    // 2. Create Mission
    if (userId) {
        const { data: mission, error: missionError } = await supabase
            .from('user_missions')
            .insert([{
                user_id: userId,
                goal: formData.goal,
                obstacle: formData.struggle,
                preferences: {},
                status: 'active'
            }])
            .select()
            .single();

        if (missionError) {
            console.error('❌ Mission Save Error:', missionError);
            return { success: false, message: "Failed to save mission." };
        }

        console.log(`✅ Mission Created: ${mission.id}`);

        // 3. SMART Curation Logic (Using Embeddings)
        try {
            // A. Generate Embedding for the Mission
            const queryText = `Help me ${formData.goal} and overcome ${formData.struggle}`;
            const embedding = await generateEmbedding(queryText);

            // B. Fetch Videos and Calculate Similarity
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
                    const curations = selected.map(v => ({
                        mission_id: mission.id,
                        video_id: v.id,
                        curation_reason: `AI Match (${(v.similarity * 100).toFixed(0)}% relevance) for Goal: "${formData.goal}"`
                    }));

                    const { error: curationError } = await supabase
                        .from('mission_curations')
                        .insert(curations);

                    if (curationError) {
                        console.error('⚠️ Failed to save curations:', curationError);
                    } else {
                        console.log(`✅ Linked ${curations.length} smart-curated videos.`);
                    }
                }
            }

        } catch (curationErr) {
            console.error("Smart Curation Failed, falling back:", curationErr);
            // Fallback logic could be here (random selection) but proceeding for now
        }


        // 4. Set Session Cookie
        cookieStore.set('veritas_user', mission.id, {
            path: '/',
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        return { success: true, missionId: mission.id };
    }

    return { success: false, message: "Could not create user." };
}

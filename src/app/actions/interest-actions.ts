"use server";

import { createClient } from '@supabase/supabase-js';

// Service role client — bypasses RLS for writing scores
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Record watch progress and update the user's Shadow Profile (interest scores).
 * 
 * Called when a user pauses, finishes, or leaves a video.
 * Uses segment-aware scoring: tags are only scored if the user actually watched
 * the portion of the video where that topic is discussed.
 * 
 * @param videoId - YouTube video ID
 * @param currentTime - How far the user watched (seconds)
 * @param duration - Total video duration (seconds)
 * @param userId - The user's profile UUID (from profiles table)
 */
export async function recordWatchProgress(
    videoId: string,
    currentTime: number,
    duration: number,
    userId?: string,
    reportedDelta: number = 0
) {
    try {
        // Must have a user and valid watch data
        if (!userId || !videoId || duration <= 0 || currentTime <= 0) {
            return { success: false, message: "Missing required data" };
        }

        const watchPct = Math.min(100, (currentTime / duration) * 100);

        // Taste-vector update — ranking path.
        // Gated at watchPct >= 25: a 5% bounce shouldn't define taste.
        // RPC SELECTs videos.embedding_1536 internally — we pass the id only so
        // no 1536-float array crosses the wire (serialization footgun).
        if (watchPct >= 25) {
            const weight = Math.min(watchPct / 100, 1);
            const { error: rpcError } = await supabase.rpc('upsert_user_taste_vector', {
                p_user_id: userId,
                p_video_id: videoId,
                p_weight: weight,
            });
            if (rpcError) {
                console.error('[Interest] upsert_user_taste_vector failed:', rpcError);
            } else {
                console.log(`🧠 Taste vector updated for ${userId} (watchPct=${Math.round(watchPct)}, weight=${weight.toFixed(2)})`);
            }
        }

        // 4. Update Creator Watch Time (Super-Fan Metric)
        // Frontend already enforces the 30s minimum threshold before sending
        if (reportedDelta > 0) {
            const { data: videoData } = await supabase
                .from('videos')
                .select('channel_id')
                .eq('id', videoId)
                .single();

            if (videoData?.channel_id) {
                const { data: statsData } = await supabase
                    .from('user_creator_stats')
                    .select('total_watch_seconds')
                    .eq('user_id', userId)
                    .eq('channel_id', videoData.channel_id)
                    .single();

                const currentSeconds = statsData?.total_watch_seconds || 0;
                const addedSeconds = Math.round(reportedDelta);

                const { error: upsertError } = await supabase
                    .from('user_creator_stats')
                    .upsert({
                        user_id: userId,
                        channel_id: videoData.channel_id,
                        total_watch_seconds: currentSeconds + addedSeconds,
                        last_watched_at: new Date().toISOString()
                    }, { onConflict: 'user_id,channel_id' });

                if (upsertError) {
                    console.error(`[Interest] Failed to update creator stats:`, upsertError);
                } else {
                    console.log(`[Interest] Added ${addedSeconds}s watch time to creator ${videoData.channel_id} for user ${userId}`);
                }
            } else {
                console.log(`[Interest] Skipped creator stats — video ${videoId} has no channel_id`);
            }
        }

        // 5. Upsert watch_history — powers /watch-history and profile preview
        {
            const { data: existing } = await supabase
                .from('watch_history')
                .select('watch_seconds')
                .eq('user_id', userId)
                .eq('video_id', videoId)
                .single();

            const prevSeconds = existing?.watch_seconds || 0;
            const addedSeconds = Math.round(reportedDelta);

            const { error: whError } = await supabase
                .from('watch_history')
                .upsert({
                    user_id: userId,
                    video_id: videoId,
                    watch_seconds: prevSeconds + addedSeconds,
                    last_watched_at: new Date().toISOString(),
                }, { onConflict: 'user_id,video_id' });

            if (whError) {
                console.error('[Interest] Failed to upsert watch_history:', whError);
            }
        }

        // 6. Also record the raw watch event in analytics_events for audit trail
        await supabase.from('analytics_events').insert({
            event_type: 'video_view',
            target_id: videoId,
            metadata: {
                user_id: userId,
                watch_pct: Math.round(watchPct),
                current_time: Math.round(currentTime),
                duration: Math.round(duration),
                reported_delta: Math.round(reportedDelta),
                timestamp: new Date().toISOString(),
            }
        });

        return {
            success: true,
            message: `Scored and tracked progress`,
        };

    } catch (err: any) {
        console.error("[Interest] Error in recordWatchProgress:", err);
        return { success: false, message: err.message || "Unknown error" };
    }
}

/**
 * Get a user's full interest profile (Shadow Profile).
 * Returns all tags sorted by score (highest first).
 */
export async function getUserInterestProfile(userId: string) {
    try {
        const { data, error } = await supabase
            .from('user_interest_scores')
            .select('tag, score, last_updated')
            .eq('user_id', userId)
            .order('score', { ascending: false });

        if (error) {
            console.error('[Interest] Failed to fetch profile:', error);
            return { success: false, data: [] };
        }

        return { success: true, data: data || [] };
    } catch (err: any) {
        console.error("[Interest] Error in getUserInterestProfile:", err);
        return { success: false, data: [] };
    }
}

/**
 * Get the Content DNA tags for a specific video.
 */
export async function getVideoTags(videoId: string) {
    try {
        const { data, error } = await supabase
            .from('video_tags')
            .select('tag, weight, segment_start_pct, segment_end_pct')
            .eq('video_id', videoId)
            .order('weight', { ascending: false });

        if (error) {
            console.error('[Interest] Failed to fetch video tags:', error);
            return { success: false, data: [] };
        }

        return { success: true, data: data || [] };
    } catch (err: any) {
        console.error("[Interest] Error in getVideoTags:", err);
        return { success: false, data: [] };
    }
}

/**
 * Record that a user opened a video — fires immediately on modal open.
 * Creates a watch_history row (or updates last_watched_at if re-opened).
 * Does NOT increment watch_seconds — that's handled by recordWatchProgress.
 */
export async function recordVideoOpen(videoId: string, userId: string) {
    if (!videoId || !userId) return;

    try {
        // Check if row already exists
        const { data: existing } = await supabase
            .from('watch_history')
            .select('id')
            .eq('user_id', userId)
            .eq('video_id', videoId)
            .single();

        if (existing) {
            // Re-opened — only bump timestamp, preserve accumulated watch_seconds
            await supabase
                .from('watch_history')
                .update({ last_watched_at: new Date().toISOString() })
                .eq('user_id', userId)
                .eq('video_id', videoId);
        } else {
            // First time — insert with watch_seconds = 0
            const { error } = await supabase
                .from('watch_history')
                .insert({
                    user_id: userId,
                    video_id: videoId,
                    watch_seconds: 0,
                    last_watched_at: new Date().toISOString(),
                });

            if (error) {
                console.error('[Interest] Failed to insert watch_history:', error);
            }
        }
    } catch (err: any) {
        console.error('[Interest] Error in recordVideoOpen:', err);
    }
}

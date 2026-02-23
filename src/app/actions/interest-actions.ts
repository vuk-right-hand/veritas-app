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
    userId?: string
) {
    try {
        // Must have a user and valid watch data
        if (!userId || !videoId || duration <= 0 || currentTime <= 0) {
            return { success: false, message: "Missing required data" };
        }

        const watchPct = Math.min(100, (currentTime / duration) * 100);

        // 1. Fetch Content DNA tags for this video
        const { data: tags, error: tagError } = await supabase
            .from('video_tags')
            .select('tag, weight, segment_start_pct, segment_end_pct')
            .eq('video_id', videoId);

        if (tagError) {
            console.error('[Interest] Failed to fetch video tags:', tagError);
            return { success: false, message: "Failed to fetch tags" };
        }

        if (!tags || tags.length === 0) {
            // Video hasn't been tagged yet — no scoring possible
            console.log(`[Interest] No tags found for video ${videoId}, skipping scoring`);
            return { success: true, message: "No tags for this video" };
        }

        // 2. Calculate score deltas using segment-aware logic
        const scoreDeltas: { tag: string; delta: number }[] = [];

        for (const tag of tags) {
            const { tag: tagName, weight, segment_start_pct, segment_end_pct } = tag;
            let delta = 0;

            if (watchPct >= segment_end_pct) {
                // User watched past the entire segment → full weight
                delta = weight;
            } else if (watchPct <= segment_start_pct) {
                // User quit before the segment started → 0
                delta = 0;
            } else {
                // User is somewhere in the middle of this segment → proportional
                const segmentLength = segment_end_pct - segment_start_pct;
                const watchedInSegment = watchPct - segment_start_pct;
                delta = Math.round(weight * (watchedInSegment / segmentLength));
            }

            if (delta > 0) {
                scoreDeltas.push({ tag: tagName, delta });
            }
        }

        if (scoreDeltas.length === 0) {
            console.log(`[Interest] User ${userId} didn't reach any tag segments in video ${videoId}`);
            return { success: true, message: "Watch time too short for any tags" };
        }

        // 3. Upsert each score using the RPC function
        console.log(`🧠 Scoring user ${userId}: ${scoreDeltas.map(s => `${s.tag}:+${s.delta}`).join(', ')}`);

        for (const { tag, delta } of scoreDeltas) {
            const { error: rpcError } = await supabase.rpc('upsert_user_interest', {
                p_user_id: userId,
                p_tag: tag,
                p_score_delta: delta,
            });

            if (rpcError) {
                console.error(`[Interest] Failed to upsert score for tag "${tag}":`, rpcError);
            }
        }

        // 4. Also record the raw watch event in analytics_events for audit trail
        await supabase.from('analytics_events').insert({
            event_type: 'video_view',
            target_id: videoId,
            metadata: {
                user_id: userId,
                watch_pct: Math.round(watchPct),
                current_time: Math.round(currentTime),
                duration: Math.round(duration),
                scores_applied: scoreDeltas,
                timestamp: new Date().toISOString(),
            }
        });

        return {
            success: true,
            message: `Scored ${scoreDeltas.length} tags`,
            scores: scoreDeltas,
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

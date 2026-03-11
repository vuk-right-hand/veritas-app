'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { unstable_noStore as noStore } from 'next/cache';

const RECOMMENDATION_COLS = 'id, title, human_score, category_tag, channel_title, channel_url, slug';

export interface RecommendedVideo {
    id: string;
    title: string;
    humanScore: number;
    channelTitle: string;
    slug: string | null;
    reason: string;
}

function formatTag(tag: string): string {
    return tag.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export async function getRecommendedVideo(
    currentVideoId: string,
    userId: string | null
): Promise<RecommendedVideo | null> {
    noStore();

    try {
        // === GATHER CONTEXT (parallel) ===
        const excludeIds = [currentVideoId];

        const [currentTagsRes, userInterestsRes, creatorAffinityRes, engagedRes] = await Promise.all([
            // Current video's tags
            supabaseAdmin
                .from('video_tags')
                .select('tag, weight')
                .eq('video_id', currentVideoId)
                .order('weight', { ascending: false }),

            // User's top interest tags
            userId
                ? supabaseAdmin
                    .from('user_interest_scores')
                    .select('tag, score')
                    .eq('user_id', userId)
                    .order('score', { ascending: false })
                    .limit(5)
                : Promise.resolve({ data: null }),

            // User's top creators by watch time
            userId
                ? supabaseAdmin
                    .from('user_creator_stats')
                    .select('channel_id')
                    .eq('user_id', userId)
                    .order('total_watch_seconds', { ascending: false })
                    .limit(3)
                : Promise.resolve({ data: null }),

            // Videos user already engaged with (quiz attempts) — cap at 200 to bound memory
            userId
                ? supabaseAdmin
                    .from('quiz_attempts')
                    .select('video_id')
                    .eq('user_id', userId)
                    .limit(200)
                : Promise.resolve({ data: null }),
        ]);

        const currentTags = currentTagsRes.data || [];
        const userTopTags = (userInterestsRes.data || []) as { tag: string; score: number }[];
        const topCreatorChannels = ((creatorAffinityRes.data || []) as { channel_id: string }[]).map(s => s.channel_id);

        // Build exclusion set
        if (engagedRes.data) {
            for (const row of engagedRes.data as { video_id: string }[]) {
                if (!excludeIds.includes(row.video_id)) {
                    excludeIds.push(row.video_id);
                }
            }
        }

        // === TIER 1: Tag-overlap scoring ===
        // TODO: Refactor Tier 1 to a Supabase RPC (Postgres function) for scale.
        // Currently scoring runs in JS memory which is fine for <500 videos but will
        // cause latency/timeout issues at 2k+ videos. Postgres can do array overlap
        // scoring orders of magnitude faster. Move the tag-match + weighted scoring
        // into a single SQL function: `recommend_video(p_video_id, p_user_id)`.
        const allRelevantTags = [
            ...currentTags.map((t: { tag: string }) => t.tag),
            ...userTopTags.map(t => t.tag),
        ];
        const uniqueTags = [...new Set(allRelevantTags)];

        if (uniqueTags.length > 0) {
            // Cap at 100 rows to bound serverless memory usage
            const { data: candidateTagRows } = await supabaseAdmin
                .from('video_tags')
                .select('video_id, tag, weight')
                .in('tag', uniqueTags)
                .limit(100);

            if (candidateTagRows && candidateTagRows.length > 0) {
                // Score each candidate video (in-memory — see TODO above)
                const videoScores: Record<string, { tagScore: number; bestTag: string }> = {};

                for (const row of candidateTagRows) {
                    // Skip excluded videos
                    if (excludeIds.includes(row.video_id)) continue;

                    if (!videoScores[row.video_id]) {
                        videoScores[row.video_id] = { tagScore: 0, bestTag: row.tag };
                    }

                    // Weight: tag weight × user interest multiplier
                    const userInterest = userTopTags.find(t => t.tag === row.tag);
                    const interestMultiplier = userInterest ? Math.min(userInterest.score / 10, 5) : 1;
                    const score = row.weight * interestMultiplier;

                    if (score > videoScores[row.video_id].tagScore) {
                        videoScores[row.video_id].bestTag = row.tag;
                    }
                    videoScores[row.video_id].tagScore += score;
                }

                // Get top 5 candidates by tag score
                const topCandidateIds = Object.entries(videoScores)
                    .sort((a, b) => b[1].tagScore - a[1].tagScore)
                    .slice(0, 5)
                    .map(e => e[0]);

                if (topCandidateIds.length > 0) {
                    const { data: candidates } = await supabaseAdmin
                        .from('videos')
                        .select(RECOMMENDATION_COLS)
                        .in('id', topCandidateIds)
                        .eq('status', 'verified');

                    if (candidates && candidates.length > 0) {
                        let best = candidates[0];
                        let bestScore = -1;
                        let bestReason = '';

                        for (const v of candidates) {
                            let score = videoScores[v.id]?.tagScore || 0;
                            score += (v.human_score || 0) / 20; // human_score contributes up to 5 points
                            if (topCreatorChannels.includes(v.channel_url)) score += 10;

                            if (score > bestScore) {
                                bestScore = score;
                                best = v;
                                const matchedTag = videoScores[v.id]?.bestTag;
                                // Use the current video's top tag as the reason (what they just watched)
                                const currentVideoTopTag = currentTags[0]?.tag;
                                const reasonTag = currentVideoTopTag || matchedTag;
                                if (topCreatorChannels.includes(v.channel_url)) {
                                    bestReason = 'From a creator you follow';
                                } else if (reasonTag) {
                                    bestReason = `Because you're interested in ${formatTag(reasonTag)}`;
                                } else {
                                    bestReason = 'Top rated in your area';
                                }
                            }
                        }

                        return {
                            id: best.id,
                            title: best.title,
                            humanScore: best.human_score || 0,
                            channelTitle: best.channel_title || 'Community Creator',
                            slug: best.slug || null,
                            reason: bestReason,
                        };
                    }
                }
            }
        }

        // === TIER 2: Same category fallback ===
        const { data: currentVideo } = await supabaseAdmin
            .from('videos')
            .select('category_tag')
            .eq('id', currentVideoId)
            .single();

        if (currentVideo?.category_tag) {
            const { data: sameCat } = await supabaseAdmin
                .from('videos')
                .select(RECOMMENDATION_COLS)
                .eq('status', 'verified')
                .eq('category_tag', currentVideo.category_tag)
                .not('id', 'in', `(${excludeIds.map(id => `"${id}"`).join(',')})`)
                .order('human_score', { ascending: false })
                .limit(1);

            if (sameCat && sameCat[0]) {
                return {
                    id: sameCat[0].id,
                    title: sameCat[0].title,
                    humanScore: sameCat[0].human_score || 0,
                    channelTitle: sameCat[0].channel_title || 'Community Creator',
                    slug: sameCat[0].slug || null,
                    reason: `More in ${formatTag(currentVideo.category_tag)}`,
                };
            }
        }

        // === TIER 3: Cold start — highest human_score ===
        const { data: topRated } = await supabaseAdmin
            .from('videos')
            .select(RECOMMENDATION_COLS)
            .eq('status', 'verified')
            .not('id', 'in', `(${excludeIds.map(id => `"${id}"`).join(',')})`)
            .order('human_score', { ascending: false })
            .limit(1);

        if (topRated && topRated[0]) {
            return {
                id: topRated[0].id,
                title: topRated[0].title,
                humanScore: topRated[0].human_score || 0,
                channelTitle: topRated[0].channel_title || 'Community Creator',
                slug: topRated[0].slug || null,
                reason: 'Top rated on Veritas',
            };
        }

        return null;
    } catch (err) {
        console.error('Recommendation engine error:', err);
        return null;
    }
}

"use server";

import { createClient } from '@supabase/supabase-js';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { cookies } from 'next/headers';

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key';

// Use Service Role for Creator actions to ensure we can read/write to protected tables
// In a real app, strict RLS + User Context is better, but for this specific "Creator Dashboard" 
// which is behind a verified login (effectively), we use admin to fetch their specific data 
// after verifying their identity via session/cookie in the future.
// For now, these actions assume the caller is authorized (we will check user in the component).
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function getCreatorStats(userId: string) {
    noStore();
    try {
        // 1. Get Creator Profile to find channel_url/id (Support multiple channels by getting latest)
        const { data: creator, error: creatorError } = await supabaseAdmin
            .from('creators')
            .select('id, channel_url, links, description, channel_name, human_score, avatar_url')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (creatorError || !creator) {
            console.error("Creator not found:", creatorError);
            return { success: false, error: "Creator profile not found" };
        }

        // 2. Get Analytics Stats
        // Count 'creator_search' events for this creator
        // Target ID for searches could be channel_name or channel_url. 
        // We'll assume we track by channel_url for uniqueness or creator_id. 
        // Let's assume we track by creator.id for direct lookups if we implement search tracking that way.
        // OR we track by channel_url associated with videos.

        // For 'total_views', we sum up 'video_view' events for all videos owned by this creator via channel_url matching.
        // This is a bit heavy for a simple query. 
        // Optimization: Creator should have 'channel_url' that videos have 'channel_url'.

        // Let's fetch all videos by this creator to get their IDs
        const { data: videos, error: videoError } = await supabaseAdmin
            .from('videos')
            .select('id, title, status, human_score, custom_links, published_at, custom_description')
            .eq('channel_url', creator.channel_url);

        if (videoError) {
            console.error("Video Fetch Error:", videoError);
            throw new Error(`Failed to fetch videos: ${videoError.message}`);
        }

        const videoIds = videos?.map(v => v.id) || [];

        // Count Views from Analytics (Real-time-ish)
        // Alternatively, we could just trust 'views_count' on video table if we update it periodically.
        // Let's count from analytics_events for 'today' or 'last 7 days' if needed, 
        // but for "Total Veritas Views" on dashboard, let's aggregate.

        const { count: searchCount, error: searchError } = await supabaseAdmin
            .from('analytics_events')
            .select('*', { count: 'exact', head: true })
            .eq('event_type', 'creator_search')
            .eq('target_id', creator.channel_url); // Assuming we log searches by channel url/name

        // Calculate total views from videos list (assuming we have a view counter on videos or we count events)
        // Let's do a count of all video_view events for these video IDs
        let totalViews = 0;

        if (videoIds.length > 0) {
            const { count: viewsCount } = await supabaseAdmin
                .from('analytics_events')
                .select('*', { count: 'exact', head: true })
                .eq('event_type', 'video_view')
                .in('target_id', videoIds);

            totalViews = viewsCount || 0;
        }

        // Calculate per-video view counts
        const perVideoViewCounts: Record<string, number> = {};
        if (videoIds.length > 0) {
            const { data: allViewEvents } = await supabaseAdmin
                .from('analytics_events')
                .select('target_id')
                .eq('event_type', 'video_view')
                .in('target_id', videoIds);

            allViewEvents?.forEach((event: any) => {
                const videoId = event.target_id;
                perVideoViewCounts[videoId] = (perVideoViewCounts[videoId] || 0) + 1;
            });
        }

        // Enrich videos with view counts
        const enrichedVideos = videos?.map(video => ({
            ...video,
            views_count: perVideoViewCounts[video.id] || 0
        })) || [];

        // 3. Traffic Insights (Filter usage)
        let trafficInsights = {
            last_14_days: 0,
            evergreen: 0,
            other: 0,
            total: 0
        };

        if (videoIds.length > 0) {
            const { data: viewEvents } = await supabaseAdmin
                .from('analytics_events')
                .select('metadata')
                .eq('event_type', 'video_view')
                .in('target_id', videoIds);

            viewEvents?.forEach((ev: any) => {
                const context = ev.metadata?.source_context || 'unknown';
                if (context.includes('14')) trafficInsights.last_14_days++;
                else if (context.includes('evergreen')) trafficInsights.evergreen++;
                else trafficInsights.other++;
                trafficInsights.total++;
            });
        }

        // 4. Opportunity Gaps
        const gaps = await getOpportunityGaps();

        return {
            success: true,
            stats: {
                totalViews,
                searches: searchCount || 0,
                videosPromoted: videos?.length || 0,
                humanScoreAvg: videos?.length > 0 ? creator.human_score : 0,
                trafficInsights,
                gaps
            },
            creator: {
                ...creator,
                links: creator.links || []
            },
            videos: enrichedVideos
        };

    } catch (e: any) {
        console.error("getCreatorStats Error:", e);
        return { success: false, error: e.message };
    }
}

// Fetch channel-level data (description + links) for all creators matching given channel URLs
// Used on the feed to display channel-level content separately from video-specific content
export async function getCreatorsByChannelUrls(channelUrls: string[]) {
    noStore();
    try {
        if (!channelUrls || channelUrls.length === 0) return {};

        // Deduplicate and filter empty
        const uniqueUrls = [...new Set(channelUrls.filter(u => u))];
        if (uniqueUrls.length === 0) return {};

        const { data: creators, error } = await supabaseAdmin
            .from('creators')
            .select('channel_url, description, links')
            .in('channel_url', uniqueUrls);

        if (error) {
            console.error('Error fetching creators for feed:', error);
            return {};
        }

        // Return as a map: channelUrl -> { description, links }
        const creatorMap: Record<string, { description: string; links: any[] }> = {};
        creators?.forEach((c: any) => {
            creatorMap[c.channel_url] = {
                description: c.description || '',
                links: c.links || []
            };
        });

        return creatorMap;
    } catch (e: any) {
        console.error('getCreatorsByChannelUrls error:', e);
        return {};
    }
}

export async function updateCreatorLinks(creatorId: string, links: any[], description?: string) {
    try {
        // First, get the creator to find their channel_url and user_id
        const { data: creator, error: creatorError } = await supabaseAdmin
            .from('creators')
            .select('id, user_id, channel_url')
            .eq('id', creatorId)
            .single();

        if (creatorError || !creator) {
            throw new Error('Creator not found');
        }

        // Update the creator's links and description
        const updateData: any = { links };
        if (description !== undefined) {
            updateData.description = description;
        }

        const { error: updateError } = await supabaseAdmin
            .from('creators')
            .update(updateData)
            .eq('id', creatorId);

        if (updateError) throw updateError;

        // Channel links and description stay ONLY on the creators table.
        // They are fetched at display time by joining videos with creators via channel_url.
        // We do NOT propagate to the videos table (that would overwrite video-specific data).

        revalidatePath('/creator-dashboard');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (e: any) {
        console.error('updateCreatorLinks error:', e);
        return { success: false, error: e.message };
    }
}

export async function updateVideoLinks(videoId: string, links: any[]) {
    try {
        const { error } = await supabaseAdmin
            .from('videos')
            .update({ custom_links: links })
            .eq('id', videoId);

        if (error) throw error;
        revalidatePath('/creator-dashboard');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getOpportunityGaps() {
    noStore();
    try {
        // 1. Get Demand (Search Terms)
        // Group by target_id (search term) and count
        const { data: searches, error: searchError } = await supabaseAdmin
            .from('analytics_events')
            .select('target_id')
            .eq('event_type', 'user_search');

        if (searchError) throw searchError;

        // Simple aggregation via JS (Supabase aggregation requires RPC or specialized query)
        const termCounts: Record<string, number> = {};
        searches?.forEach((s: any) => {
            const term = s.target_id;
            termCounts[term] = (termCounts[term] || 0) + 1;
        });

        // 2. Get Supply (Videos matching terms) - approximated
        // We will just check top 10 terms for now to save performance
        const topTerms = Object.entries(termCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const gaps: any[] = [];

        for (const [term, demand] of topTerms) {
            // Count videos with this term in title
            // ILIKE %term%
            const { count: supply, error: supplyError } = await supabaseAdmin
                .from('videos')
                .select('*', { count: 'exact', head: true })
                .ilike('title', `%${term}%`);

            const supplyCount = supply || 0;

            // Score = Demand / (Supply + 1)
            const score = demand / (supplyCount + 1);

            gaps.push({
                term,
                demand,
                supply: supplyCount,
                score
            });
        }

        return gaps.sort((a, b) => b.score - a.score);

    } catch (e: any) {
        console.error("getOpportunityGaps Error:", e);
        return [];
    }
}

export async function updateCreatorAvatar(creatorId: string, avatarUrl: string) {
    try {
        const { error } = await supabaseAdmin
            .from('creators')
            .update({ avatar_url: avatarUrl })
            .eq('id', creatorId);

        if (error) throw error;
        revalidatePath('/creator-dashboard');
        return { success: true };
    } catch (e: any) {
        console.error('updateCreatorAvatar error:', e);
        return { success: false, error: e.message };
    }
}

export async function checkIsCreator() {
    noStore();
    try {
        const cookieStore = await cookies();
        const missionId = cookieStore.get('veritas_user')?.value;

        if (!missionId) {
            return { isCreator: false };
        }

        // Get User ID from mission
        const { data: mission } = await supabaseAdmin
            .from('user_missions')
            .select('user_id')
            .eq('id', missionId)
            .single();

        if (!mission || !mission.user_id) {
            return { isCreator: false };
        }

        // Check if creator profile exists
        const { data: creator } = await supabaseAdmin
            .from('creators')
            .select('id')
            .eq('user_id', mission.user_id)
            .limit(1)
            .single();

        return { isCreator: !!creator };
    } catch (e) {
        console.error("checkIsCreator error:", e);
        return { isCreator: false };
    }
}

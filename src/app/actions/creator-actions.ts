"use server";

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { cookies } from 'next/headers';

// SECURITY: Resolves the authenticated caller's user_id from the Supabase session.
// Used to gate all mutating actions — never trust a client-supplied userId.
async function getCallerUserId(): Promise<string | null> {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key',
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
}

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';

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
        // maybeSingle() returns { data: null, error: null } when no rows exist,
        // avoiding the PGRST116 error that single() throws for empty results.
        const { data: creator, error: creatorError } = await supabaseAdmin
            .from('creators')
            .select('id, channel_url, links, description, channel_name, human_score, avatar_url, slug')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (creatorError || !creator) {
            if (creatorError) console.error("Creator query error:", creatorError);
            return { success: false, error: "Creator profile not found" };
        }

        // 2. Fetch all videos by this creator
        const { data: videos, error: videoError } = await supabaseAdmin
            .from('videos')
            .select('id, title, status, human_score, custom_links, published_at, custom_description, takeaways, summary_points, slug')
            .eq('channel_url', creator.channel_url);

        if (videoError) {
            console.error("Video Fetch Error:", videoError);
            throw new Error(`Failed to fetch videos: ${videoError.message}`);
        }

        const videoIds = videos?.map(v => v.id) || [];

        // 3. Fire all independent queries in parallel
        const [searchEventsRes, viewEventsRes, handshakeResult] = await Promise.all([
            // Search events — single query replaces count-then-fetch pattern
            videoIds.length > 0
                ? supabaseAdmin
                    .from('analytics_events')
                    .select('target_id')
                    .eq('event_type', 'creator_search')
                    .in('target_id', videoIds)
                : Promise.resolve({ data: [] as { target_id: string }[] }),
            // View events — single query gives both per-video counts and total
            videoIds.length > 0
                ? supabaseAdmin
                    .from('analytics_events')
                    .select('target_id')
                    .eq('event_type', 'video_view')
                    .in('target_id', videoIds)
                : Promise.resolve({ data: [] as { target_id: string }[] }),
            // Handshake count
            supabaseAdmin
                .from('handshakes')
                .select('*', { count: 'exact', head: true })
                .eq('creator_id', creator.id),
        ]);

        // Aggregate search events
        let searchCount = 0;
        let topSearchedVideos: { videoId: string; title: string; count: number }[] = [];
        const searchData = searchEventsRes.data ?? [];
        searchCount = searchData.length;
        if (searchCount > 0) {
            const countMap = new Map<string, number>();
            for (const row of searchData) {
                countMap.set(row.target_id, (countMap.get(row.target_id) ?? 0) + 1);
            }
            topSearchedVideos = [...countMap.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([id, count]) => {
                    const v = videos?.find((v: any) => v.id === id);
                    return { videoId: id, count, title: v?.title ?? '' };
                });
        }

        // Aggregate view events — per-video counts + total in one pass
        const perVideoViewCounts: Record<string, number> = {};
        const viewData = viewEventsRes.data ?? [];
        viewData.forEach((event: any) => {
            perVideoViewCounts[event.target_id] = (perVideoViewCounts[event.target_id] || 0) + 1;
        });
        const totalViews = viewData.length;
        const totalHandshakes = handshakeResult.count || 0;

        // Enrich videos with view counts and resolved takeaways
        const enrichedVideos = videos?.map(video => {
            const resolvedTakeaways: string[] =
                (video.takeaways && video.takeaways.some((t: string) => t.trim() !== ''))
                    ? video.takeaways
                    : (video.summary_points || []);
            return {
                ...video,
                views_count: perVideoViewCounts[video.id] || 0,
                takeaways: resolvedTakeaways,
            };
        }) || [];

        return {
            success: true,
            stats: {
                totalViews,
                totalHandshakes,
                searches: searchCount,
                videosPromoted: videos?.length || 0,
                humanScoreAvg: videos?.length > 0
                    ? Math.round(videos.reduce((sum: number, v: any) => sum + (v.human_score || 0), 0) / videos.length)
                    : 0,
                topSearchedVideos
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
            .select('channel_url, description, links, slug')
            .in('channel_url', uniqueUrls);

        if (error) {
            console.error('Error fetching creators for feed:', error);
            return {};
        }

        // Return as a map: channelUrl -> { description, links, slug }
        const creatorMap: Record<string, { description: string; links: any[]; slug: string | null }> = {};
        creators?.forEach((c: any) => {
            creatorMap[c.channel_url] = {
                description: c.description || '',
                links: c.links || [],
                slug: c.slug || null
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
        // SECURITY PATCH C3: Verify caller owns this creator profile
        const callerUserId = await getCallerUserId();
        if (!callerUserId) {
            return { success: false, error: 'Unauthorized: must be logged in' };
        }

        // First, get the creator to find their channel_url and user_id
        const { data: creator, error: creatorError } = await supabaseAdmin
            .from('creators')
            .select('id, user_id, channel_url')
            .eq('id', creatorId)
            .single();

        if (creatorError || !creator) {
            throw new Error('Creator not found');
        }

        if (creator.user_id !== callerUserId) {
            return { success: false, error: 'Forbidden: you do not own this creator profile' };
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
        // SECURITY PATCH C3: Same ownership check as updateVideoTakeaways
        const callerUserId = await getCallerUserId();
        if (!callerUserId) {
            return { success: false, error: 'Unauthorized: must be logged in' };
        }
        const { data: creator } = await supabaseAdmin
            .from('creators').select('channel_url').eq('user_id', callerUserId).single();
        const { data: video } = await supabaseAdmin
            .from('videos').select('channel_url').eq('id', videoId).single();
        if (!creator || !video || creator.channel_url !== video.channel_url) {
            return { success: false, error: 'Forbidden: video does not belong to your channel' };
        }

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
        // SECURITY PATCH C3: Verify caller owns this creator profile
        const callerUserId = await getCallerUserId();
        if (!callerUserId) {
            return { success: false, error: 'Unauthorized: must be logged in' };
        }
        const { data: creator } = await supabaseAdmin
            .from('creators').select('user_id').eq('id', creatorId).single();
        if (!creator || creator.user_id !== callerUserId) {
            return { success: false, error: 'Forbidden: you do not own this creator profile' };
        }

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

export async function updateVideoTakeaways(videoId: string, takeaways: string[]) {
    try {
        // SECURITY PATCH C3: Verify the caller owns a creator profile whose channel_url
        // matches this video's channel_url. Prevents cross-creator video tampering.
        const callerUserId = await getCallerUserId();
        if (!callerUserId) {
            return { success: false, error: 'Unauthorized: must be logged in' };
        }
        const { data: creator } = await supabaseAdmin
            .from('creators').select('channel_url').eq('user_id', callerUserId).single();
        const { data: video } = await supabaseAdmin
            .from('videos').select('channel_url').eq('id', videoId).single();
        if (!creator || !video || creator.channel_url !== video.channel_url) {
            return { success: false, error: 'Forbidden: video does not belong to your channel' };
        }

        const { error } = await supabaseAdmin
            .from('videos')
            .update({ takeaways })
            .eq('id', videoId);

        if (error) throw error;
        revalidatePath('/creator-dashboard');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function checkIsCreator() {
    noStore();
    try {
        const cookieStore = await cookies();

        // SECURITY PATCH H2: Check Supabase auth session FIRST (mirrors getCurrentUserProfile logic).
        // The old version only checked the viewer cookie, missing newly-upgraded creators who
        // have a Supabase session but haven't reloaded their veritas_user cookie mapping.
        let resolvedUserId: string | null = null;

        const supabaseSsr = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key',
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll()
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                cookieStore.set(name, value, options)
                            )
                        } catch {
                            // The `setAll` method was called from a Server Component.
                            // This can be ignored if you have middleware refreshing
                            // user sessions.
                        }
                    },
                },
            }
        );
        const { data: authData } = await supabaseSsr.auth.getUser();
        if (authData?.user?.id) {
            resolvedUserId = authData.user.id;
        }

        // Fallback: viewer cookie path
        if (!resolvedUserId) {
            const missionId = cookieStore.get('veritas_user')?.value;
            if (missionId) {
                const { data: mission } = await supabaseAdmin
                    .from('user_missions')
                    .select('user_id')
                    .eq('id', missionId)
                    .single();
                if (mission?.user_id) resolvedUserId = mission.user_id;
            }
        }

        if (!resolvedUserId) return { isCreator: false };

        const { data: creator } = await supabaseAdmin
            .from('creators')
            .select('id')
            .eq('user_id', resolvedUserId)
            .limit(1)
            .single();

        return { isCreator: !!creator };
    } catch (e) {
        console.error("checkIsCreator error:", e);
        return { isCreator: false };
    }
}

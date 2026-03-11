"use server";

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { unstable_noStore as noStore } from 'next/cache';

export async function getTopCreators(userId: string) {
    noStore();
    if (!userId) return [];

    // Step 1: fetch raw stats without a join — the FK to channels was dropped in
    // migration 20260223_fix_channel_id_stats_fk.sql to allow tracking unclaimed channels,
    // so PostgREST can no longer infer the join path automatically.
    const { data, error } = await supabaseAdmin
        .from('user_creator_stats')
        .select('total_watch_seconds, last_watched_at, channel_id')
        .eq('user_id', userId)
        .order('total_watch_seconds', { ascending: false })
        .limit(3);

    if (error) {
        console.error("Error fetching top creators:", error);
        return [];
    }

    if (!data || data.length === 0) return [];

    // Step 2: batch-fetch channel names + creator slugs in parallel
    const channelIds = data.map((s: any) => s.channel_id).filter(Boolean);
    const [channelsRes, creatorsRes] = await Promise.all([
        supabaseAdmin
            .from('channels')
            .select('youtube_channel_id, name')
            .in('youtube_channel_id', channelIds),
        supabaseAdmin
            .from('creators')
            .select('channel_id, slug')
            .in('channel_id', channelIds),
    ]);

    const channelNameMap: Record<string, string> = {};
    for (const ch of (channelsRes.data || []) as { youtube_channel_id: string; name: string }[]) {
        channelNameMap[ch.youtube_channel_id] = ch.name;
    }
    const creatorSlugMap: Record<string, string> = {};
    for (const cr of (creatorsRes.data || []) as { channel_id: string; slug: string }[]) {
        if (cr.slug) creatorSlugMap[cr.channel_id] = cr.slug;
    }

    return data.map((stat: any) => ({
        channelId: stat.channel_id,
        channelName: channelNameMap[stat.channel_id] || stat.channel_id,
        creatorSlug: creatorSlugMap[stat.channel_id] || null,
        watchSeconds: stat.total_watch_seconds,
        lastWatchedAt: stat.last_watched_at,
    }));
}

export async function getWatchHistory(userId: string) {
    noStore();
    if (!userId) return [];

    // Step 1: fetch watch_history rows (no join — FK may not exist yet)
    const { data, error } = await supabaseAdmin
        .from('watch_history')
        .select('id, video_id, last_watched_at, watch_seconds')
        .eq('user_id', userId)
        .order('last_watched_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error("Error fetching watch history:", error);
        return [];
    }

    if (!data || data.length === 0) return [];

    // Step 2: batch-fetch video metadata
    const videoIds = data.map((r: any) => r.video_id).filter(Boolean);
    const { data: videos } = await supabaseAdmin
        .from('videos')
        .select('id, title, slug, channel_title')
        .in('id', videoIds);

    const videoMap: Record<string, { title: string; slug: string | null; channel_title: string }> = {};
    for (const v of (videos || []) as any[]) {
        videoMap[v.id] = { title: v.title, slug: v.slug, channel_title: v.channel_title };
    }

    return data.map((item: any) => ({
        id: item.id,
        video_id: item.video_id,
        title: videoMap[item.video_id]?.title || 'Unknown Video',
        slug: videoMap[item.video_id]?.slug || null,
        channelTitle: videoMap[item.video_id]?.channel_title || 'Unknown Creator',
        watchedAt: item.last_watched_at,
        watchSeconds: item.watch_seconds,
    }));
}

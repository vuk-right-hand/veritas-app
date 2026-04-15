import { supabase } from '@/lib/supabaseClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { AnalysisResult } from '@/lib/analysis-prompt';
import { getYouTubeMetadata } from '@/lib/youtube-metadata';

export interface VideoMetadata {
    youtube_id: string;
    title: string;
    channel_name: string;
    channel_id: string; // Added field
    thumbnail_url: string;
    published_at: string | null;
}

/**
 * Fetches basic video metadata (Title, Channel, Thumbnail) using YouTube oEmbed.
 * No API Key required.
 */
export async function fetchVideoMeta(youtubeUrl: string): Promise<VideoMetadata | null> {
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${youtubeUrl}&format=json`;
        const res = await fetch(oembedUrl);

        if (!res.ok) {
            console.error("Failed to fetch oembed data");
            return null;
        }

        const data = await res.json();

        // Extract ID from URL (simple regex)
        const videoIdMatch = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w\-]{10,12})\b/);
        const videoId = videoIdMatch ? videoIdMatch[1] : '';

        // Extract Channel ID from author_url if available
        // Expected usage: author_url: "https://www.youtube.com/@ChannelName" or "https://www.youtube.com/channel/UC..."
        // oEmbed often gives 'author_url'.
        let channelId = data.author_name; // Fallback to name if ID extraction fails (unsafe for FK, handled below)

        // Try to find a channel ID structure
        // Note: oEmbed doesn't guaranteed return channel ID. 
        // We might need a separate lookup or just use a placeholder if we can't find it.
        // For MVP, we'll try to find it or generate a slug from the name.
        // ACTUALLY, if we can't get a real channel ID, we might fail the FK constraint.
        // Let's create a deterministic ID from the name if we can't get the regex.
        channelId = data.author_name.replace(/\s+/g, '-').toLowerCase();

        // Scrape publish date via shared helper. Falls back to null on
        // failure — never guess. Prompt handles the "publish date unknown"
        // case, feed readers tolerate NULL via NULLS LAST.
        let published_at: string | null = null;
        if (videoId) {
            const scraped = await getYouTubeMetadata(videoId);
            published_at = scraped.published_at;
        }

        return {
            youtube_id: videoId,
            title: data.title,
            channel_name: data.author_name,
            channel_id: channelId, // Temporary ID based on name if real one missing
            thumbnail_url: data.thumbnail_url,
            published_at,
        };

    } catch (e) {
        console.error("Error fetching video meta:", e);
        return null;
    }
}

/**
 * Saves the analyzed video and its embedding to Supabase.
 * Uses 'upsert' to update if the video already exists.
 */
export async function saveVideoAnalysis(
    meta: VideoMetadata,
    analysis: AnalysisResult,
    embedding: number[]
) {
    console.log(`Saving to DB: ${meta.title}`);

    // 1. Upsert Channel (to ensure FK exists)
    // Use admin client to bypass RLS
    const { error: channelError } = await supabaseAdmin
        .from('channels')
        .upsert({
            youtube_channel_id: meta.channel_id,
            name: meta.channel_name,
            status: 'pending' // Default status
        }, { onConflict: 'youtube_channel_id' });

    if (channelError) {
        console.error("Channel Save Error:", channelError);
        // Continue? If channel fails, video might fail due to FK.
    }

    // 2. Update Video with Analysis (don't touch existing metadata)
    // Use admin client to bypass RLS
    //
    // Classification branches:
    //   verdict='approve' → status='verified', classification_status='classified'
    //   verdict='reject'  → status='banned',   classification_status='rejected'
    //                       ('banned' so /suggested-videos Denied column surfaces
    //                       it; feed_category still written — override flow reads it)
    const isApproved = analysis.verdict === 'approve';
    const { data, error } = await supabaseAdmin
        .from('videos')
        .update({
            human_score: analysis.humanScore,
            summary_points: analysis.takeaways,
            category_tag: analysis.category,
            status: isApproved ? 'verified' : 'banned',
            classification_status: isApproved ? 'classified' : 'rejected',
            feed_category: analysis.feed_category,
            category_confidence: analysis.category_confidence,
            category_rationale: analysis.category_rationale,
            category_signals: analysis.category_signals,
            // pgvector text literal — sending a raw number[] via PostgREST
            // is version-dependent and can silently write NULL. Always '[a,b,c]'.
            embedding_1536: '[' + embedding.join(',') + ']'
        })
        .eq('id', meta.youtube_id.trim())
        .select()
        .maybeSingle(); // Handle case where video doesn't exist

    if (error) {
        console.error("Supabase Save Error:", error);
        throw new Error(error.message);
    }

    if (!data) {
        console.error("[SAVE] UPDATE affected 0 rows - video not found:", meta.youtube_id);
        // Return null instead of throwing to avoid crashing the whole request if one video is missing
        return null;
    }

    return data;
}

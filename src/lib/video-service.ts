import { supabase } from '@/lib/supabaseClient';

export interface VideoMetadata {
    youtube_id: string;
    title: string;
    channel_name: string;
    thumbnail_url: string;
}

export interface AnalysisResult {
    humanScore: number;
    humanScoreReason: string;
    takeaways: string[];
    category: string;
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

        return {
            youtube_id: videoId,
            title: data.title,
            channel_name: data.author_name,
            thumbnail_url: data.thumbnail_url
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

    const { data, error } = await supabase
        .from('videos')
        .upsert({
            youtube_id: meta.youtube_id,
            title: meta.title,
            channel_name: meta.channel_name,
            thumbnail_url: meta.thumbnail_url,
            human_score: analysis.humanScore,
            human_score_reason: analysis.humanScoreReason,
            takeaways: analysis.takeaways,
            category: analysis.category,
            embedding: embedding, // The text-embedding-004 vector
            created_at: new Date().toISOString()
        }, { onConflict: 'youtube_id' })
        .select()
        .single();

    if (error) {
        console.error("Supabase Save Error:", error);
        throw new Error(error.message);
    }

    return data;
}

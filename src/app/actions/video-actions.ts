"use server";

import { createClient } from '@supabase/supabase-js';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { cookies } from 'next/headers';

// Initialize Supabase Client (Prefer Service Role if available for Admin actions, fall back to Anon for now with RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use Service Role if available to bypass RLS for insertions
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

// Helper: Fetch YouTube video metadata via oEmbed + HTML Scrape
async function getYouTubeMetadata(videoId: string): Promise<{
    title: string;
    author_name: string;
    author_url: string;
    description: string;
    published_at: string | null;
}> {
    let title = "Unknown Title";
    let author_name = "Unknown Channel";
    let author_url = "";
    let description = "";
    let published_at: string | null = null;

    try {
        // 1. oEmbed for reliable Title/Author
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const response = await fetch(oembedUrl);
        if (response.ok) {
            const data = await response.json();
            title = data.title || title;
            author_name = data.author_name || author_name;
            author_url = data.author_url || author_url;
        }

        // 2. Scrape Page for Description + Publish Date
        const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
            }
        });
        const html = await pageResponse.text();

        // Extract description
        const descriptionMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
        if (descriptionMatch && descriptionMatch[1]) {
            description = descriptionMatch[1];
        }

        // Extract publish date - try multiple patterns
        let publishDateMatch = html.match(/<meta itemprop="uploadDate" content="([^"]+)">/);
        if (!publishDateMatch) {
            publishDateMatch = html.match(/"uploadDate":"([^"]+)"/);
        }
        if (!publishDateMatch) {
            publishDateMatch = html.match(/"publishDate":"([^"]+)"/);
        }
        if (publishDateMatch && publishDateMatch[1]) {
            published_at = publishDateMatch[1];
        }
    } catch (e) {
        console.error("Failed to fetch YouTube metadata:", e);
    }

    return { title, author_name, author_url, description, published_at };
}

// Ensure we can handle partial URLs or handles
function normalizeChannelUrl(url: string): string {
    if (url.startsWith('@')) return `https://www.youtube.com/${url}`;
    if (!url.startsWith('http')) return `https://www.youtube.com/c/${url}`; // Try clean URL pattern if no protocol
    return url;
}

export async function getChannelMetadata(channelUrl: string) {
    try {
        let normalizedUrl = channelUrl;
        if (!channelUrl.startsWith('http')) {
            if (channelUrl.startsWith('@')) {
                normalizedUrl = `https://www.youtube.com/${channelUrl}`;
            } else {
                normalizedUrl = `https://www.youtube.com/c/${channelUrl}`;
            }
        }

        const response = await fetch(normalizedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) return { title: "", description: "", success: false };

        const html = await response.text();

        // Extract Title
        const titleMatch = html.match(/<meta property="og:title" content="([^"]+)">/);
        const title = titleMatch ? titleMatch[1] : "Unknown Channel";

        // Extract Description
        const descMatch = html.match(/<meta name="description" content="([^"]+)">/);
        const description = descMatch ? descMatch[1] : "";

        return { title, description, success: true };
    } catch (e) {
        console.error("Failed to fetch channel metadata:", e);
        return { title: "", description: "", success: false };
    }
}

export async function verifyChannelOwnership(channelUrl: string, token: string) {
    const { title, description, success } = await getChannelMetadata(channelUrl);

    if (!success) {
        return { success: false, message: "Could not fetch channel details. Please check the URL." };
    }

    // Check if token exists in description
    if (description.includes(token)) {
        return { success: true, message: "Verification successful! Channel claimed.", channelTitle: title };
    }

    return { success: false, message: `Token not found in channel description. Found title: ${title}` };
}

export async function suggestVideo(videoUrl: string) {
    // 1. Extract Video ID
    let videoId = "";
    try {
        const url = new URL(videoUrl);
        if (url.hostname.includes('youtube.com')) {
            videoId = url.searchParams.get('v') || "";
        } else if (url.hostname.includes('youtu.be')) {
            videoId = url.pathname.slice(1);
        }
    } catch (e) {
        return { success: false, message: "Invalid URL format" };
    }

    if (!videoId) return { success: false, message: "Could not extract Video ID" };

    // 2. Check if video exists
    const { data: existing, error: fetchError } = await supabase
        .from('videos')
        .select('status, suggestion_count')
        .eq('id', videoId)
        .single();

    if (existing) {
        // INCREMENT SUGGESTION COUNT (Upvote)
        await supabase
            .from('videos')
            .update({ suggestion_count: (existing.suggestion_count || 1) + 1 })
            .eq('id', videoId);

        if (existing.status === 'banned') {
            return { success: false, message: "This video has been declined by the moderators." };
        }
        if (existing.status === 'verified') {
            return { success: true, message: "Video already valid! We added your vote." };
        }
        return { success: true, message: "Video already pending. We added your vote!" };
    }

    // 3. Fetch real metadata from YouTube
    const metadata = await getYouTubeMetadata(videoId);

    // 4. Insert new Pending Video
    const { error: insertError } = await supabase
        .from('videos')
        .insert({
            id: videoId,
            title: metadata.title,
            description: metadata.description, // Store the description
            channel_title: metadata.author_name,
            channel_url: metadata.author_url,
            published_at: metadata.published_at, // Store YouTube publish date
            status: 'pending',
            human_score: 50,
            suggestion_count: 1
        });

    if (insertError) {
        console.error("Insert Error:", insertError);
        // Fallback: Try inserting without new columns if it failed
        if (insertError.message.includes("column")) {
            // Retry without description/channel info if schema is old
            const { error: retryError } = await supabase
                .from('videos')
                .insert({
                    id: videoId,
                    title: metadata.title,
                    status: 'pending',
                    human_score: 50,
                    suggestion_count: 1
                });
            if (retryError) return { success: false, message: "Failed to submit video. " + retryError.message };
        } else {
            return { success: false, message: "Failed to submit video. " + insertError.message };
        }
    }

    revalidatePath('/founder-meeting');
    return { success: true, message: "Video submitted for verification!" };
}

export async function getPendingVideos() {
    noStore(); // Force dynamic fetch
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) return [];
    return data;
}

export async function moderateVideo(videoId: string, action: 'approve' | 'ban' | 'storage' | 'pending') {
    let newStatus = 'pending';
    if (action === 'approve') newStatus = 'verified';
    else if (action === 'ban') newStatus = 'banned';
    else if (action === 'storage') newStatus = 'storage';
    else newStatus = 'pending';

    console.log(`[moderateVideo] Attempting to set video ${videoId} to ${newStatus}`);

    const { data, error } = await supabase
        .from('videos')
        .update({ status: newStatus })
        .eq('id', videoId)
        .select();

    if (error) {
        console.error('[moderateVideo] Update Error:', error);
        return { success: false, message: error.message };
    }

    // Trigger analysis if approving (background)
    if (action === 'approve') {
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: videoUrl })
        }).catch(err => console.error('[moderateVideo] Analysis trigger error:', err));
    }

    revalidatePath('/dashboard');
    revalidatePath('/founder-meeting');

    return { success: true, message: `Video moved to ${newStatus}` };
}

export async function getVerifiedVideos(temporalFilter?: '14' | '28' | '60' | 'evergreen') {
    noStore();

    let query = supabase
        .from('videos')
        .select('*')
        .eq('status', 'verified')
        .or('channel_id.neq.UC_VERITAS_OFFICIAL,channel_id.is.null');

    // Apply temporal filter if not evergreen
    if (temporalFilter && temporalFilter !== 'evergreen') {
        const days = parseInt(temporalFilter);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        query = query.gte('published_at', cutoffDate.toISOString());
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) return [];
    return data;
}

export async function getDeniedVideos() {
    noStore();
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('status', 'banned')
        .order('created_at', { ascending: false });

    if (error) return [];
    return data;
}

export async function getStorageVideos() {
    noStore();
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('status', 'storage')
        .order('created_at', { ascending: false });

    if (error) return [];
    return data;
}

export async function deleteVideo(videoId: string) {
    console.log(`[deleteVideo] Deleting video: ${videoId}`);

    // First delete from mission_curations if any reference exists (though cascade might handle this, it's safer to be explicit or use cascade in DB)
    // Assuming DB has ON DELETE CASCADE for foreign keys, otherwise we need to delete relations first.
    // For now, let's try direct delete.

    const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

    if (error) {
        console.error('[deleteVideo] Error:', error);
        return { success: false, message: error.message };
    }

    revalidatePath('/dashboard');
    revalidatePath('/founder-meeting');

    return { success: true, message: "Video deleted successfully" };
}

export async function getUserMission(missionId: string) {
    noStore();
    const { data: mission, error } = await supabase
        .from('user_missions')
        .select(`
            *,
            mission_curations (
                curation_reason,
                videos (
                    *
                )
            )
        `)
        .eq('id', missionId)
        .single();

    if (error) {
        console.error("Error fetching mission:", error);
        return null;
    }
    return mission;
}

export async function getMyMission() {
    noStore();
    const cookieStore = await cookies();
    const missionId = cookieStore.get('veritas_user')?.value;

    if (!missionId) return null;
    return getUserMission(missionId);
}

export async function getComments(videoId: string, limit = 10, offset = 0) {
    noStore();
    const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('video_id', videoId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('Error fetching comments:', error);
        return [];
    }
    return data;
}

export async function postComment(videoId: string, text: string, userName = 'Community Member') {
    const { data, error } = await supabase
        .from('comments')
        .insert({
            video_id: videoId,
            text,
            user_name: userName
        })
        .select()
        .single();

    if (error) {
        console.error('Error posting comment:', error);
        return { success: false, message: error.message };
    }

    return { success: true, comment: data };
}

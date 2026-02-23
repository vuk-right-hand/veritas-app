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

        return { title, description, rawHtml: html, success: true };
    } catch (e) {
        console.error("Failed to fetch channel metadata:", e);
        return { title: "", description: "", rawHtml: "", success: false };
    }
}

export async function generateVerificationToken(email: string, channelUrl: string) {
    noStore(); // avoid caching
    const randomString = Math.random().toString(36).substring(2, 10).toUpperCase();
    const token = `VERITAS-${randomString}`;

    // Set expiration 15 minutes from now
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Limit spammers: Check how many pending requests for this email in last hour
    const { count } = await supabase
        .from('verification_requests')
        .select('*', { count: 'exact', head: true })
        .eq('email', email)
        .eq('verified', false)
        .gt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (count !== null && count > 10) {
        return { success: false, message: "Too many verification requests. Please try again later.", token: "" };
    }

    const { error } = await supabase
        .from('verification_requests')
        .insert({
            email,
            channel_url: channelUrl,
            token,
            expires_at: expiresAt.toISOString(),
            verified: false,
            attempts: 0
        });

    if (error) {
        console.error("Token Generation Error:", error);
        return { success: false, message: "Failed to generate token server-side.", token: "" };
    }

    return { success: true, token };
}

export async function verifyChannelOwnership(email: string, channelUrl: string, token: string) {
    noStore();

    // 1. Find the active Verification Request
    const { data: request, error: fetchError } = await supabase
        .from('verification_requests')
        .select('*')
        .eq('email', email)
        .eq('channel_url', Math.max(0, channelUrl.length) ? channelUrl : '')
        .eq('verified', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (fetchError || !request) {
        return { success: false, message: "No active verification session found. Please generate a token." };
    }

    if (new Date(request.expires_at) < new Date()) {
        return { success: false, message: "Verification token has expired. Please generate a new one." };
    }

    if (request.attempts >= 10) {
        return { success: false, message: "Too many failed attempts. Please restart the process." };
    }

    // Check if the provided token matches the requested token
    if (request.token !== token) {
        // Increment attempts (Rate Limiting check)
        await supabase
            .from('verification_requests')
            .update({ attempts: request.attempts + 1 })
            .eq('id', request.id);

        return { success: false, message: "Invalid token." };
    }

    // If token matches, we increment attempts anyway to prevent spamming youtube after guessing right token before placing it
    await supabase
        .from('verification_requests')
        .update({ attempts: request.attempts + 1 })
        .eq('id', request.id);

    // 2. Fetch Channel Metadata (YouTube)
    const { title, description, rawHtml, success } = await getChannelMetadata(channelUrl);

    if (!success) {
        return { success: false, message: "Could not fetch channel details. Please check the URL." };
    }

    // 3. Verify Token in Description (or anywhere in the raw HTML payload for robustness)
    if (description.includes(token) || (rawHtml && rawHtml.includes(token))) {
        // Mark as verified in DB
        await supabase
            .from('verification_requests')
            .update({ verified: true })
            .eq('id', request.id);

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

export async function recordVideoView(videoId: string, metadata: any = {}) {
    // Fire and forget - don't await in critical path if possible, or await but suppress errors
    try {
        await supabase
            .from('analytics_events')
            .insert({
                event_type: 'video_view',
                target_id: videoId,
                metadata
            });

        // Increment global counter
        await supabase.rpc('increment_video_view', { video_id_param: videoId });

    } catch (e) {
        console.error("Failed to record view:", e);
    }
}

export async function recordSearch(term: string) {
    try {
        await supabase
            .from('analytics_events')
            .insert({
                event_type: 'user_search',
                target_id: term.trim().toLowerCase(), // Normalize search term
                metadata: { timestamp: new Date().toISOString() }
            });
    } catch (e) {
        console.error("Failed to record search:", e);
    }
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

export async function getVerifiedVideos(temporalFilter?: '14' | '28' | '60' | 'evergreen', limit: number = 12, offset: number = 0) {
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

    const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

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

    // Fetch User Details (only if we have service capability)
    let userDetails = { name: '', email: '', avatar_url: '' };
    if (mission.user_id && supabaseServiceKey) {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(mission.user_id);
        if (userData && userData.user) {
            userDetails = {
                name: userData.user.user_metadata?.full_name || '',
                email: userData.user.email || '',
                avatar_url: userData.user.user_metadata?.avatar_url || ''
            };
        }
    }

    return { ...mission, userDetails };
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

export async function updateVideoDescription(videoId: string, description: string) {
    try {
        const { error } = await supabase
            .from('videos')
            .update({ custom_description: description })
            .eq('id', videoId);

        if (error) throw error;
        revalidatePath('/creator-dashboard');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function logWatchTime(videoId: string, seconds: number) {
    try {
        const { error } = await supabase.rpc('track_creator_watch_time', {
            p_video_id: videoId,
            p_seconds: seconds
        });

        if (error) {
            console.error('Error logging watch time:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (e: any) {
        console.error('Exception logging watch time:', e);
        return { success: false, error: e.message };
    }
}

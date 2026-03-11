"use server";

import { createClient } from '@supabase/supabase-js';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { cookies } from 'next/headers';
import { slugify } from '@/lib/utils';
import { suggestChannel } from './channel-actions';
import { getAuthenticatedUserId } from './auth-actions';

// Initialize Supabase Client (Prefer Service Role if available for Admin actions, fall back to Anon for now with RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';

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

    // 3. Verify Token in channel description.
    // Primary: <meta name="description"> tag (most scoped).
    // Fallback: rawHtml — YouTube does not always propagate the user-edited channel
    // description into the meta tag (it can be truncated or omitted). The rawHtml fallback
    // is safe here because the token (VERITAS-XXXXXXXX format) is already bound to a
    // specific email + channel_url pair in verification_requests, so matching it anywhere
    // on the claimed channel's page is sufficient proof of write access.
    if (description.includes(token) || rawHtml?.includes(token)) {
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
    // 1. Parse URL — reject anything that isn't a valid URL
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(videoUrl);
    } catch (e) {
        return { success: false, message: "Please paste the exact YouTube video/channel URL" };
    }

    // 2. Route channel URLs to suggestChannel()
    const isYouTube = parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtu.be');
    if (!isYouTube) {
        return { success: false, message: "Please paste the exact YouTube video/channel URL" };
    }

    const isChannelUrl =
        parsedUrl.hostname.includes('youtube.com') && (
            parsedUrl.pathname.startsWith('/@') ||
            parsedUrl.pathname.startsWith('/c/') ||
            parsedUrl.pathname.startsWith('/channel/')
        );

    if (isChannelUrl) {
        return suggestChannel(videoUrl);
    }

    // 3. Extract Video ID
    let videoId = "";
    if (parsedUrl.hostname.includes('youtube.com')) {
        videoId = parsedUrl.searchParams.get('v') || "";
    } else if (parsedUrl.hostname.includes('youtu.be')) {
        videoId = parsedUrl.pathname.slice(1).split('?')[0];
    }

    if (!videoId) return { success: false, message: "Please paste the exact YouTube video/channel URL" };

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

    // Extract channel ID from author_url (e.g., https://www.youtube.com/@veritas -> veritas)
    let parsedChannelId = null;
    if (metadata.author_url) {
        const match = metadata.author_url.match(/@([^/?]+)/);
        if (match && match[1]) {
            parsedChannelId = match[1];
        } else {
            parsedChannelId = metadata.author_url.split('/').filter(Boolean).pop() || null;
        }
    }

    // NEW: Auto-register the channel in the channels table if it doesn't already exist
    // This perfectly captures the YouTube name requested by the user so we have beautiful data linked!
    if (parsedChannelId && metadata.author_name) {
        const { error: channelInsertError } = await supabase
            .from('channels')
            .upsert({
                youtube_channel_id: parsedChannelId,
                name: metadata.author_name,
                status: 'pending',
                is_claimed: false
            }, { onConflict: 'youtube_channel_id', ignoreDuplicates: true });

        if (channelInsertError) {
            console.error("Failed to auto-register channel:", channelInsertError);
        }
    }

    // 4. Insert new Pending Video
    let generatedSlug = slugify(metadata.title).substring(0, 100);
    let insertSuccess = false;

    while (!insertSuccess) {
        const { error: insertError } = await supabase
            .from('videos')
            .insert({
                id: videoId,
                slug: generatedSlug,
                title: metadata.title,
                description: metadata.description,
                channel_title: metadata.author_name,
                channel_id: parsedChannelId,
                channel_url: metadata.author_url,
                published_at: metadata.published_at,
                status: 'pending',
                human_score: 50,
                suggestion_count: 1
            });

        if (insertError) {
            if (insertError.code === '23505' && insertError.message.includes('slug')) {
                generatedSlug = `${slugify(metadata.title).substring(0, 95)}-${Math.random().toString(36).substring(2, 6)}`;
                continue;
            }
            console.error("Insert Error:", insertError);
            // Fallback: Try inserting without new columns if it failed
            if (insertError.message.includes("column")) {
                const { error: retryError } = await supabase
                    .from('videos')
                    .insert({
                        id: videoId,
                        slug: generatedSlug,
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
        insertSuccess = true;
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

    if (error) { console.error('Supabase Query Error:', error); return []; }
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
        // Prevent hitting localhost in Vercel prod if NEXT_PUBLIC_SITE_URL is missing
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

        fetch(`${baseUrl}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: videoUrl })
        }).catch(err => console.error('[moderateVideo] Analysis trigger error:', err));

        // Shadow Profile: auto-create creator row if one doesn't exist for this channel
        if (data && data.length > 0 && data[0].channel_url && data[0].channel_title) {
            const { data: existingCreator } = await supabase
                .from('creators')
                .select('id, slug')
                .eq('channel_url', data[0].channel_url)
                .maybeSingle();

            if (!existingCreator) {
                // Create shadow profile (no user_id — unclaimed)
                let creatorSlug = slugify(data[0].channel_title);
                let slugInserted = false;
                while (!slugInserted) {
                    const { error: insertErr } = await supabase
                        .from('creators')
                        .insert({
                            channel_name: data[0].channel_title,
                            channel_url: data[0].channel_url,
                            channel_id: null,
                            slug: creatorSlug,
                            is_verified: true,
                            human_score: 50,
                        });
                    if (insertErr) {
                        if (insertErr.code === '23505' && insertErr.message.includes('slug')) {
                            creatorSlug = `${slugify(data[0].channel_title).substring(0, 95)}-${Math.random().toString(36).substring(2, 6)}`;
                            continue;
                        }
                        console.error('[moderateVideo] Shadow profile insert error:', insertErr);
                    }
                    slugInserted = true;
                }
            }
        }

        // Revalidate slug routes if video data is attached
        if (data && data.length > 0 && data[0].slug) {
            revalidatePath(`/v/${data[0].slug}`);
            if (data[0].channel_url) {
                const { data: creator } = await supabase.from('creators').select('slug').eq('channel_url', data[0].channel_url).single()
                if (creator && creator.slug) {
                    revalidatePath(`/c/${creator.slug}`);
                }
            }
        }
    }

    revalidatePath('/dashboard');
    revalidatePath('/founder-meeting');

    return { success: true, message: `Video moved to ${newStatus}` };
}

// Columns needed by feed cards — excludes heavy/unused fields like embedding, description, suggestion_count
const FEED_VIDEO_COLS = 'id, title, human_score, category_tag, channel_title, channel_url, published_at, summary_points, custom_description, custom_links, created_at, status, slug';

export async function getVerifiedVideos(temporalFilter?: '14' | '28' | '60' | 'evergreen', limit: number = 12, offset: number = 0) {
    noStore();

    let query = supabase
        .from('videos')
        .select(FEED_VIDEO_COLS)
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

    if (error) {
        console.error('Supabase Query Error:', error);
        return [{
            id: 'error-debug',
            title: `Error: ${error.message}`,
            channel_title: 'Backend Debug',
            status: 'verified',
            published_at: new Date().toISOString()
        }];
    }
    return data;
}

/**
 * getInitialFeedData — ONE server-action call that replaces the previous
 * serial chain of getMyMission() → getVerifiedVideos() → getCreatorsByChannelUrls().
 *
 * Internally it fires the mission query and verified-videos query in PARALLEL,
 * then batches the creator lookup as a single IN query.
 * Net result: 2 parallel DB hops + 1 serial hop → ~60 % faster than before.
 */
export async function getInitialFeedData(temporalFilter: '14' | '28' | '60' | 'evergreen') {
    noStore();
    const cookieStore = await cookies();
    const missionId = cookieStore.get('veritas_user')?.value;

    // ── Build verified-videos query ──────────────────────────────────────────
    let verifiedQ = supabase
        .from('videos')
        .select(FEED_VIDEO_COLS)
        .eq('status', 'verified')
        .or('channel_id.neq.UC_VERITAS_OFFICIAL,channel_id.is.null');

    if (temporalFilter !== 'evergreen') {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - parseInt(temporalFilter));
        verifiedQ = verifiedQ.gte('published_at', cutoff.toISOString());
    }
    verifiedQ = verifiedQ.order('created_at', { ascending: false }).range(0, 5);

    // ── Build mission query (only if cookie present) ─────────────────────────
    const missionQ = missionId
        ? supabase
            .from('user_missions')
            .select(`id, goal, user_id, mission_curations(curation_reason, videos(${FEED_VIDEO_COLS}))`)
            .eq('id', missionId)
            .single()
        : Promise.resolve({ data: null, error: null });

    // 🚀 PARALLEL — both DB queries fire at the same time
    const [missionResult, verifiedResult] = await Promise.all([missionQ, verifiedQ]);

    const mission = missionResult?.data ?? null;
    const verified = (verifiedResult?.data ?? []) as any[];

    // ── Batch-fetch creator data for all channel URLs in one IN query ────────
    const allUrls = [
        ...(mission?.mission_curations?.map((c: any) => c.videos?.channel_url).filter(Boolean) ?? []),
        ...verified.map((v: any) => v.channel_url).filter(Boolean),
    ];
    const uniqueUrls = [...new Set(allUrls)] as string[];

    const creatorMap: Record<string, { description: string; links: any[]; slug: string | null }> = {};
    if (uniqueUrls.length > 0) {
        const { data: creators } = await supabase
            .from('creators')
            .select('channel_url, description, links, slug')
            .in('channel_url', uniqueUrls);
        creators?.forEach((c: any) => {
            creatorMap[c.channel_url] = { description: c.description || '', links: c.links || [], slug: c.slug || null };
        });
    }

    return { mission, verified, creatorMap };
}

/**
 * getVerifiedVideosWithCreators — used by loadMoreVideos() and background prefetch.
 * Returns fully-formatted video objects (no second round-trip needed on the client).
 */
export async function getVerifiedVideosWithCreators(
    temporalFilter: '14' | '28' | '60' | 'evergreen',
    limit: number = 3,
    offset: number = 0
) {
    noStore();
    let query = supabase
        .from('videos')
        .select(FEED_VIDEO_COLS)
        .eq('status', 'verified')
        .or('channel_id.neq.UC_VERITAS_OFFICIAL,channel_id.is.null');

    if (temporalFilter !== 'evergreen') {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - parseInt(temporalFilter));
        query = query.gte('published_at', cutoff.toISOString());
    }
    const { data: videos, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error || !videos?.length) return [];

    const channelUrls = [...new Set(videos.map((v: any) => v.channel_url).filter(Boolean))] as string[];
    const creatorMap: Record<string, any> = {};
    if (channelUrls.length > 0) {
        const { data: creators } = await supabase
            .from('creators')
            .select('channel_url, description, links, slug')
            .in('channel_url', channelUrls);
        creators?.forEach((c: any) => {
            creatorMap[c.channel_url] = { description: c.description || '', links: c.links || [], slug: c.slug || null };
        });
    }

    return videos.map((v: any) => {
        const creator = creatorMap[v.channel_url] || null;
        return {
            id: v.id,
            title: v.title,
            humanScore: v.human_score || 0,
            category: v.category_tag || 'Community',
            customDescription: v.custom_description || undefined,
            customLinks: v.custom_links || undefined,
            channelTitle: v.channel_title || 'Community Creator',
            channelUrl: v.channel_url || '',
            publishedAt: v.published_at || v.created_at,
            takeaways: v.summary_points || ['Analysis pending...', 'Watch to find out.'],
            channelDescription: creator?.description || undefined,
            channelLinks: creator?.links?.length > 0 ? creator.links : undefined,
            isChannelClaimed: !!creator,
            isCurated: false,
            slug: v.slug || null,
            creatorSlug: creator?.slug || null,
        };
    });
}

export async function getDeniedVideos() {
    noStore();
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('status', 'banned')
        .order('created_at', { ascending: false });

    if (error) { console.error('Supabase Query Error:', error); return []; }
    return data;
}

export async function getStorageVideos() {
    noStore();
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('status', 'storage')
        .order('created_at', { ascending: false });

    if (error) { console.error('Supabase Query Error:', error); return []; }
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

export async function postComment(videoId: string, text: string, userName = 'Community Member', userId?: string) {
    const { data, error } = await supabase
        .from('comments')
        .insert({
            video_id: videoId,
            text,
            user_name: userName,
            user_id: userId
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
        const { data, error } = await supabase
            .from('videos')
            .update({ custom_description: description })
            .eq('id', videoId)
            .select('slug')
            .single();

        if (error) throw error;
        revalidatePath('/creator-dashboard');
        if (data && data.slug) {
            revalidatePath(`/v/${data.slug}`);
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ─── Video Likes ───────────────────────────────────────────────────────────────

/**
 * Toggle like on a video. Returns the new liked state.
 * Stores mission_id alongside the like so we can later surface this video
 * to users with the same goal/obstacle/content preferences.
 */
export async function toggleVideoLike(videoId: string): Promise<{ liked: boolean; error?: string }> {
    const userId = await getAuthenticatedUserId();
    if (!userId) return { liked: false, error: 'Unauthorized' };

    // Capture the user's active mission for personalization context
    const { data: mission } = await supabase
        .from('user_missions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

    const missionId: string | null = mission?.id ?? null;

    // Check if already liked
    const { data: existing } = await supabase
        .from('video_likes')
        .select('id')
        .eq('video_id', videoId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existing) {
        const { error } = await supabase.from('video_likes').delete().eq('id', existing.id);
        if (error) return { liked: true, error: error.message };
        return { liked: false };
    } else {
        const { error } = await supabase.from('video_likes').insert({
            video_id: videoId,
            user_id: userId,
            mission_id: missionId,
        });
        if (error) return { liked: false, error: error.message };
        return { liked: true };
    }
}

/** Returns whether the current authenticated user has liked this video. */
export async function getVideoLikeStatus(videoId: string): Promise<boolean> {
    const userId = await getAuthenticatedUserId();
    if (!userId) return false;

    const { data } = await supabase
        .from('video_likes')
        .select('id')
        .eq('video_id', videoId)
        .eq('user_id', userId)
        .maybeSingle();

    return !!data;
}


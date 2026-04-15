"use server";

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { cookies } from 'next/headers';
import { slugify } from '@/lib/utils';
import { suggestChannel } from './channel-actions';
import { getAuthenticatedUserId } from './auth-actions';
import { sendApprovalEmails, checkViewMilestone } from './email-actions';
import { resolveViewerIdReadOnly } from '@/lib/viewer-identity';
import { getYouTubeMetadata } from '@/lib/youtube-metadata';

type FeedCategory = 'pulse' | 'forge' | 'alchemy';
const FEED_CATEGORIES: FeedCategory[] = ['pulse', 'forge', 'alchemy'];

// Cookie-bound SSR client — carries the caller's JWT so auth.uid() resolves
// inside SECURITY DEFINER / INVOKER RPCs (e.g. get_personalized_feed).
// Service-role client stays for writes only.
async function getSSRClient() {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key',
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {}
                },
            },
        }
    );
}

// Server-session-only admin check. Never trust a caller-supplied email/id.
// Returns the admin user's id on success, or null if unauthorized.
async function assertAdminFromSession(): Promise<string | null> {
    const sb = await getSSRClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user?.email) return null;
    const { data: adminRole } = await supabase
        .from('admin_roles')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();
    if (!adminRole) return null;
    return user.id;
}

// Initialize Supabase Client (Prefer Service Role if available for Admin actions, fall back to Anon for now with RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';

// Use Service Role if available to bypass RLS for insertions
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

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

        // Record who suggested (for approval notification emails)
        const cookieStore = await cookies();
        const missionId = cookieStore.get('veritas_user')?.value || null;
        const userId = await getAuthenticatedUserId();
        if (missionId || userId) {
            await supabase.from('video_suggestions').insert({
                video_id: videoId,
                mission_id: missionId,
                user_id: userId,
            });
        }

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
                classification_status: 'pending',
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

    // Record who suggested (for approval notification emails)
    const cookieStore2 = await cookies();
    const suggestMissionId = cookieStore2.get('veritas_user')?.value || null;
    const suggestUserId = await getAuthenticatedUserId();
    if (suggestMissionId || suggestUserId) {
        await supabase.from('video_suggestions').insert({
            video_id: videoId,
            mission_id: suggestMissionId,
            user_id: suggestUserId,
        });
    }

    revalidatePath('/founder-meeting');
    return { success: true, message: "Video submitted for verification!" };
}

// Admin-only: suggests a video without recording who suggested it (no email automations on approval)
export async function adminSuggestVideo(videoUrl: string) {
    // 1. Parse URL
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(videoUrl);
    } catch (e) {
        return { success: false, message: "Please paste the exact YouTube video URL" };
    }

    const isYouTube = parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtu.be');
    if (!isYouTube) {
        return { success: false, message: "Please paste the exact YouTube video URL" };
    }

    // Reject channel URLs — admin should use the channels tab for those
    const isChannelUrl =
        parsedUrl.hostname.includes('youtube.com') && (
            parsedUrl.pathname.startsWith('/@') ||
            parsedUrl.pathname.startsWith('/c/') ||
            parsedUrl.pathname.startsWith('/channel/')
        );
    if (isChannelUrl) {
        return { success: false, message: "That looks like a channel URL. Use the Channels tab instead." };
    }

    // 2. Extract Video ID
    let videoId = "";
    if (parsedUrl.hostname.includes('youtube.com')) {
        videoId = parsedUrl.searchParams.get('v') || "";
    } else if (parsedUrl.hostname.includes('youtu.be')) {
        videoId = parsedUrl.pathname.slice(1).split('?')[0];
    }
    if (!videoId) return { success: false, message: "Could not extract video ID from URL" };

    // 3. Check if video already exists
    const { data: existing } = await supabase
        .from('videos')
        .select('status, suggestion_count')
        .eq('id', videoId)
        .single();

    if (existing) {
        await supabase
            .from('videos')
            .update({ suggestion_count: (existing.suggestion_count || 1) + 1 })
            .eq('id', videoId);

        // No video_suggestions insert — no emails will fire on approval

        if (existing.status === 'banned') {
            return { success: false, message: "This video has been declined by the moderators." };
        }
        if (existing.status === 'verified') {
            return { success: true, message: "Video already approved! Vote added." };
        }
        return { success: true, message: "Video already pending. Vote added!" };
    }

    // 4. Fetch metadata
    const metadata = await getYouTubeMetadata(videoId);

    let parsedChannelId = null;
    if (metadata.author_url) {
        const match = metadata.author_url.match(/@([^/?]+)/);
        if (match && match[1]) {
            parsedChannelId = match[1];
        } else {
            parsedChannelId = metadata.author_url.split('/').filter(Boolean).pop() || null;
        }
    }

    // Auto-register channel
    if (parsedChannelId && metadata.author_name) {
        await supabase
            .from('channels')
            .upsert({
                youtube_channel_id: parsedChannelId,
                name: metadata.author_name,
                status: 'pending',
                is_claimed: false
            }, { onConflict: 'youtube_channel_id', ignoreDuplicates: true });
    }

    // 5. Insert new pending video
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
                classification_status: 'pending',
                human_score: 50,
                suggestion_count: 1
            });

        if (insertError) {
            if (insertError.code === '23505' && insertError.message.includes('slug')) {
                generatedSlug = `${slugify(metadata.title).substring(0, 95)}-${Math.random().toString(36).substring(2, 6)}`;
                continue;
            }
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

    // No video_suggestions insert — no emails will fire on approval

    revalidatePath('/suggested-videos');
    return { success: true, message: "Video submitted for verification!" };
}

const MILESTONES = [100, 500, 1000, 3000, 5000, 10000];

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

        // Increment global counter — RPC returns new total (zero extra DB reads for milestones)
        const { data: newViewCount } = await supabase.rpc('increment_video_view', { video_id_param: videoId });

        // Only fire milestone check when count exactly hits a threshold
        if (typeof newViewCount === 'number' && MILESTONES.includes(newViewCount)) {
            checkViewMilestone(videoId, newViewCount).catch(err =>
                console.error('[recordVideoView] Milestone email error:', err)
            );
        }

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

export async function moderateVideo(
    videoId: string,
    action: 'approve' | 'ban' | 'storage' | 'pending',
    feedCategory?: FeedCategory
) {
    // Admin gate: derived from SSR session ONLY. Never from an argument.
    const adminUserId = await assertAdminFromSession();
    if (!adminUserId) return { success: false, message: 'Unauthorized' };

    // Whitelist category for approve. Other actions ignore it entirely.
    if (action === 'approve') {
        if (!feedCategory || !FEED_CATEGORIES.includes(feedCategory)) {
            return { success: false, message: 'Invalid category' };
        }
    }

    let newStatus = 'pending';
    if (action === 'approve') newStatus = 'verified';
    else if (action === 'ban') newStatus = 'banned';
    else if (action === 'storage') newStatus = 'storage';
    else newStatus = 'pending';

    console.log(`[moderateVideo] Attempting to set video ${videoId} to ${newStatus}`);

    const updatePayload: Record<string, unknown> = { status: newStatus };
    if (action === 'approve') updatePayload.feed_category = feedCategory;

    const { data, error } = await supabase
        .from('videos')
        .update(updatePayload)
        .eq('id', videoId)
        .select();

    if (error) {
        console.error('[moderateVideo] Update Error:', error);
        return { success: false, message: error.message };
    }

    // Trigger analysis if approving (background)
    if (action === 'approve') {
        // Telemetry — catches admin category bias in week-1 metrics
        supabase.from('analytics_events').insert({
            event_type: 'feed_category_assigned',
            payload: { admin_id: adminUserId, video_id: videoId, feed_category: feedCategory },
        }).then(({ error: telErr }) => {
            if (telErr) console.error('[moderateVideo] Telemetry error:', telErr);
        });

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

        // Fire approval notification emails (non-blocking)
        if (data && data.length > 0) {
            sendApprovalEmails(videoId, data[0]).catch(err =>
                console.error('[moderateVideo] Email notification error:', err)
            );
        }
    }

    revalidatePath('/dashboard');
    revalidatePath('/founder-meeting');

    return { success: true, message: `Video moved to ${newStatus}` };
}

/**
 * setFeedCategory — reclassify a legacy verified video whose feed_category is NULL.
 * Same admin gate + whitelist as moderateVideo. Does NOT change status.
 */
export async function setFeedCategory(videoId: string, feedCategory: FeedCategory) {
    const adminUserId = await assertAdminFromSession();
    if (!adminUserId) return { success: false, message: 'Unauthorized' };
    if (!FEED_CATEGORIES.includes(feedCategory)) {
        return { success: false, message: 'Invalid category' };
    }

    const { error } = await supabase
        .from('videos')
        .update({ feed_category: feedCategory })
        .eq('id', videoId);

    if (error) {
        console.error('[setFeedCategory] Update Error:', error);
        return { success: false, message: error.message };
    }

    supabase.from('analytics_events').insert({
        event_type: 'feed_category_assigned',
        payload: { admin_id: adminUserId, video_id: videoId, feed_category: feedCategory, reclassified: true },
    }).then(({ error: telErr }) => {
        if (telErr) console.error('[setFeedCategory] Telemetry error:', telErr);
    });

    revalidatePath('/dashboard');
    revalidatePath('/suggested-videos');
    return { success: true };
}

// Columns needed by feed cards — excludes heavy/unused fields like embedding, description, suggestion_count
const FEED_VIDEO_COLS = 'id, title, human_score, category_tag, feed_category, channel_title, channel_url, published_at, summary_points, custom_description, custom_links, created_at, status, slug';

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
export async function getInitialFeedData(feedCategory: FeedCategory, publishedAfter?: string) {
    noStore();
    if (!FEED_CATEGORIES.includes(feedCategory)) {
        return { mission: null, verified: [], creatorMap: {}, curationIds: [] };
    }
    const cookieStore = await cookies();
    const missionId = cookieStore.get('veritas_user')?.value;
    const PAGE_SIZE = 6;

    // ── PULSE: pure chronological, no curations, no RPC ──────────────────────
    if (feedCategory === 'pulse') {
        let pulseQ = supabase
            .from('videos')
            .select(FEED_VIDEO_COLS)
            .eq('status', 'verified')
            .eq('feed_category', 'pulse')
            .or('channel_id.neq.UC_VERITAS_OFFICIAL,channel_id.is.null');
        if (publishedAfter) pulseQ = pulseQ.gte('published_at', publishedAfter);
        const { data: verifiedData } = await pulseQ
            .order('published_at', { ascending: false, nullsFirst: false })
            .range(0, PAGE_SIZE - 1);

        const verified = (verifiedData ?? []) as any[];
        const creatorMap = await fetchCreatorMap(
            verified.map((v) => v.channel_url).filter(Boolean)
        );
        return { mission: null, verified, creatorMap, curationIds: [] as string[] };
    }

    // ── FORGE / ALCHEMY: curations (in-SQL filtered) + personalized RPC ─────
    const missionQ = missionId
        ? supabase
            .from('user_missions')
            .select(`id, goal, user_id, mission_curations(curation_reason, videos!inner(${FEED_VIDEO_COLS}))`)
            .eq('id', missionId)
            .eq('mission_curations.videos.feed_category', feedCategory)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

    const [missionResult] = await Promise.all([missionQ]);
    const mission = (missionResult as any)?.data ?? null;

    let curationVideos: any[] = (mission?.mission_curations ?? [])
        .map((c: any) => c.videos)
        .filter(Boolean);
    // Curations respect the temporal filter too — if the user picks "last 14
    // days" they don't want a 2-year-old video pinned at the top just because
    // an admin curated it. Keeps behavior consistent with the rest of the feed.
    if (publishedAfter) {
        const cutoff = new Date(publishedAfter).getTime();
        curationVideos = curationVideos.filter((v: any) => {
            const t = v.published_at ? new Date(v.published_at).getTime() : 0;
            return t >= cutoff;
        });
    }
    const curationIds: string[] = curationVideos.map((v: any) => v.id);

    // Service-role client only — RPC is NOT granted to anon/authenticated.
    // Read-only viewer id resolution (MUST NOT touch cookies in SSR render).
    const viewerId = await resolveViewerIdReadOnly();
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_personalized_feed', {
        p_user_id: viewerId,
        p_feed_category: feedCategory,
        p_limit: PAGE_SIZE,
        p_offset: 0,
        p_exclude_ids: curationIds,
        p_published_after: publishedAfter ?? null,
    });
    if (rpcErr) console.error('[getInitialFeedData] RPC error:', rpcErr);

    const verified = [...curationVideos, ...((rpcData ?? []) as any[])];
    const creatorMap = await fetchCreatorMap(
        verified.map((v: any) => v.channel_url).filter(Boolean)
    );

    return { mission, verified, creatorMap, curationIds };
}

async function fetchCreatorMap(urls: string[]) {
    const uniqueUrls = [...new Set(urls)] as string[];
    const creatorMap: Record<string, { id: string; description: string; links: any[]; slug: string | null }> = {};
    if (uniqueUrls.length === 0) return creatorMap;
    const { data: creators } = await supabase
        .from('creators')
        .select('id, channel_url, description, links, slug')
        .in('channel_url', uniqueUrls);
    creators?.forEach((c: any) => {
        creatorMap[c.channel_url] = { id: c.id, description: c.description || '', links: c.links || [], slug: c.slug || null };
    });
    return creatorMap;
}

/**
 * getVerifiedVideosWithCreators — used by loadMoreVideos() and background prefetch.
 * Returns fully-formatted video objects (no second round-trip needed on the client).
 */
export async function getVerifiedVideosWithCreators(
    feedCategory: FeedCategory,
    limit: number = 3,
    offset: number = 0,
    excludeIds: string[] = [],
    publishedAfter?: string
) {
    noStore();
    if (!FEED_CATEGORIES.includes(feedCategory)) return [];

    let videos: any[] = [];

    if (feedCategory === 'pulse') {
        // Pulse = pure chronological. No RPC, no personalization.
        let q = supabase
            .from('videos')
            .select(FEED_VIDEO_COLS)
            .eq('status', 'verified')
            .eq('feed_category', 'pulse')
            .or('channel_id.neq.UC_VERITAS_OFFICIAL,channel_id.is.null');
        if (publishedAfter) q = q.gte('published_at', publishedAfter);
        if (excludeIds.length > 0) {
            // PostgREST .not('id','in',...) only accepts a string list. Hard-validate
            // each id against the YouTube charset before interpolation — anything
            // outside [A-Za-z0-9_-] is dropped, so no PostgREST filter injection.
            const safeIds = excludeIds.filter((id) => /^[A-Za-z0-9_-]+$/.test(id));
            if (safeIds.length > 0) {
                q = q.not('id', 'in', `(${safeIds.join(',')})`);
            }
        }
        const { data, error } = await q
            .order('published_at', { ascending: false, nullsFirst: false })
            .range(offset, offset + limit - 1);
        if (error) { console.error('[getVerifiedVideosWithCreators] pulse error:', error); return []; }
        videos = data ?? [];
    } else {
        // Forge / Alchemy: RPC owns ranking + pagination + exclusion.
        // Service-role client only; RPC takes p_user_id explicitly and is not
        // granted to anon/authenticated (would leak taste profiles via ordering).
        // Personalized branch in the RPC ignores p_offset and relies on
        // p_exclude_ids — the frontend already accumulates seen IDs into excludeIds.
        const viewerId = await resolveViewerIdReadOnly();
        const { data, error } = await supabase.rpc('get_personalized_feed', {
            p_user_id: viewerId,
            p_feed_category: feedCategory,
            p_limit: limit,
            p_offset: offset,
            p_exclude_ids: excludeIds,
            p_published_after: publishedAfter ?? null,
        });
        if (error) { console.error('[getVerifiedVideosWithCreators] rpc error:', error); return []; }
        videos = (data ?? []) as any[];
    }

    if (!videos.length) return [];

    const channelUrls = [...new Set(videos.map((v: any) => v.channel_url).filter(Boolean))] as string[];
    const creatorMap: Record<string, any> = {};
    if (channelUrls.length > 0) {
        const { data: creators } = await supabase
            .from('creators')
            .select('id, channel_url, description, links, slug')
            .in('channel_url', channelUrls);
        creators?.forEach((c: any) => {
            creatorMap[c.channel_url] = { id: c.id, description: c.description || '', links: c.links || [], slug: c.slug || null };
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
            creatorId: creator?.id || null,
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

// -----------------------------------------------------------------------------
// Manual override: user clicked "Submit anyway" after classifier rejection.
// Pure DB flip — no re-classification round-trip. Gemini's best-guess
// feed_category is already persisted on the row from the original reject call;
// we just flip status + classification_status to make it visible.
// -----------------------------------------------------------------------------
export async function overrideClassificationReject(videoId: string) {
    const userId = await getAuthenticatedUserId();
    if (!userId) return { success: false, message: 'Unauthorized' };

    const { data: row, error: readErr } = await supabase
        .from('videos')
        .select('id, status, classification_status, feed_category')
        .eq('id', videoId)
        .single();

    if (readErr || !row) return { success: false, message: 'Video not found' };
    if (row.classification_status !== 'rejected') {
        return { success: false, message: 'Video is not in a rejected state' };
    }
    if (!row.feed_category) {
        return { success: false, message: 'No feed category available for override' };
    }

    const { error: updateErr } = await supabase
        .from('videos')
        .update({
            status: 'verified',
            classification_status: 'manual_override',
        })
        .eq('id', videoId);

    if (updateErr) return { success: false, message: updateErr.message };

    revalidatePath('/');
    return { success: true, feed_category: row.feed_category };
}

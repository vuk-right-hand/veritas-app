"use server";

import { resend, EMAIL_FROM } from '@/lib/resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { buildUnsubscribeUrl } from '@/app/api/unsubscribe/route';
import {
    videoApprovedUserEmail,
    videoApprovedUserEmail2,
    videoApprovedUserEmail3,
    videoApprovedUserEmail4,
    videoApprovedUserEmail5Plus,
    videoApprovedCreatorEmail,
    viewMilestoneEmail,
} from '@/lib/email-templates';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

// ─── Check if email is unsubscribed ─────────────────────────

async function isUnsubscribed(email: string): Promise<boolean> {
    const { data } = await supabaseAdmin
        .from('email_unsubscribes')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle();
    return !!data;
}

// ─── Low-level send wrapper ─────────────────────────────────

async function sendEmail(
    to: string,
    subject: string,
    html: string,
    unsubscribeUrl: string
): Promise<{ success: boolean; id?: string }> {
    // Check opt-out before sending
    if (await isUnsubscribed(to)) {
        console.log(`[sendEmail] Skipping unsubscribed recipient: ${to}`);
        return { success: false };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: EMAIL_FROM,
            to,
            subject,
            html,
            headers: {
                'List-Unsubscribe': `<${unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
        });
        if (error) {
            console.error('[sendEmail] Resend error:', error);
            return { success: false };
        }
        return { success: true, id: data?.id };
    } catch (err) {
        console.error('[sendEmail] Unexpected error:', err);
        return { success: false };
    }
}

// ─── Resolve email from user_id or mission_id ──────────────

async function resolveEmail(userId: string | null, missionId: string | null): Promise<string | null> {
    // Try auth user first (most reliable)
    if (userId) {
        const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (data?.user?.email) return data.user.email;
    }
    // Fallback to mission email
    if (missionId) {
        const { data } = await supabaseAdmin
            .from('user_missions')
            .select('email')
            .eq('id', missionId)
            .single();
        if (data?.email) return data.email;
    }
    return null;
}

// ─── Count monthly approval emails for a recipient ──────────

async function getMonthlyApprovalCount(email: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count } = await supabaseAdmin
        .from('email_notifications_log')
        .select('id', { count: 'exact', head: true })
        .eq('email_type', 'video_approved_user')
        .eq('recipient_email', email)
        .gte('created_at', startOfMonth);

    return count ?? 0;
}

// ─── Pick the right user email template based on monthly count ─

function pickUserApprovalTemplate(priorCount: number) {
    // priorCount = how many were already sent this month BEFORE this one
    // 0 prior = this is their 1st → original template
    // 1 prior = this is their 2nd → streak starter
    // 2 prior = this is their 3rd → taste maker
    // 3 prior = this is their 4th → top 1%
    // 4+ prior = this is their 5th+ → insider
    if (priorCount === 0) return videoApprovedUserEmail;
    if (priorCount === 1) return videoApprovedUserEmail2;
    if (priorCount === 2) return videoApprovedUserEmail3;
    if (priorCount === 3) return videoApprovedUserEmail4;
    return videoApprovedUserEmail5Plus;
}

// ─── Video Approval Emails ──────────────────────────────────

interface VideoData {
    id: string;
    slug?: string;
    title?: string;
    channel_title?: string;
    channel_url?: string;
}

export async function sendApprovalEmails(videoId: string, videoData: VideoData) {
    if (!videoData.slug || !videoData.title) {
        console.warn('[sendApprovalEmails] Missing slug or title, skipping emails');
        return;
    }

    const emailsSent: string[] = []; // Track to avoid sending both emails to same person

    // 1. Creator email — if channel has a claimed creator
    if (videoData.channel_url) {
        const { data: creator } = await supabaseAdmin
            .from('creators')
            .select('id, channel_name, user_id')
            .eq('channel_url', videoData.channel_url)
            .not('user_id', 'is', null)
            .maybeSingle();

        if (creator?.user_id) {
            const creatorEmail = await resolveEmail(creator.user_id, null);

            if (creatorEmail) {
                // Check dedup
                const { data: existing } = await supabaseAdmin
                    .from('email_notifications_log')
                    .select('id')
                    .eq('video_id', videoId)
                    .eq('email_type', 'video_approved_creator')
                    .eq('recipient_email', creatorEmail)
                    .maybeSingle();

                if (!existing) {
                    const unsubscribeUrl = buildUnsubscribeUrl(creatorEmail, SITE_URL);
                    const { subject, html } = videoApprovedCreatorEmail({
                        creatorName: creator.channel_name || 'Creator',
                        videoTitle: videoData.title,
                        videoSlug: videoData.slug,
                        siteUrl: SITE_URL,
                        unsubscribeUrl,
                    });

                    const result = await sendEmail(creatorEmail, subject, html, unsubscribeUrl);

                    await supabaseAdmin.from('email_notifications_log').insert({
                        email_type: 'video_approved_creator',
                        recipient_email: creatorEmail,
                        video_id: videoId,
                        metadata: { resend_id: result.id || null },
                    });

                    emailsSent.push(creatorEmail);
                }
            }
        }
    }

    // 2. User emails — everyone who suggested this video
    const { data: suggestions } = await supabaseAdmin
        .from('video_suggestions')
        .select('user_id, mission_id')
        .eq('video_id', videoId);

    if (!suggestions || suggestions.length === 0) return;

    // Deduplicate by resolved email
    const seenEmails = new Set(emailsSent);

    for (const suggestion of suggestions) {
        const email = await resolveEmail(suggestion.user_id, suggestion.mission_id);

        if (!email || seenEmails.has(email)) continue;
        seenEmails.add(email);

        // Check dedup in log
        const { data: existing } = await supabaseAdmin
            .from('email_notifications_log')
            .select('id')
            .eq('video_id', videoId)
            .eq('email_type', 'video_approved_user')
            .eq('recipient_email', email)
            .maybeSingle();

        if (existing) continue;

        // Resolve user name
        let userName = 'there';
        if (suggestion.mission_id) {
            const { data: mission } = await supabaseAdmin
                .from('user_missions')
                .select('name')
                .eq('id', suggestion.mission_id)
                .single();
            if (mission?.name) userName = mission.name;
        }

        const unsubscribeUrl = buildUnsubscribeUrl(email, SITE_URL);

        // Pick email template based on how many approval emails this user got this month
        const priorCount = await getMonthlyApprovalCount(email);
        const templateFn = pickUserApprovalTemplate(priorCount);
        const { subject, html } = templateFn({
            userName,
            videoTitle: videoData.title,
            videoSlug: videoData.slug,
            channelName: videoData.channel_title || 'the creator',
            siteUrl: SITE_URL,
            unsubscribeUrl,
        });

        const result = await sendEmail(email, subject, html, unsubscribeUrl);

        await supabaseAdmin.from('email_notifications_log').insert({
            email_type: 'video_approved_user',
            recipient_email: email,
            video_id: videoId,
            metadata: { resend_id: result.id || null },
        });
    }
}

// ─── View Milestone Check ───────────────────────────────────

export async function checkViewMilestone(videoId: string, milestone: number) {
    // 1. Try to claim this milestone (UNIQUE constraint = exactly-once)
    const { error: insertError } = await supabaseAdmin
        .from('view_milestones_sent')
        .insert({ video_id: videoId, milestone });

    if (insertError) {
        // Duplicate = another request already handled it
        if (insertError.code === '23505') return;
        console.error('[checkViewMilestone] Insert error:', insertError);
        return;
    }

    // 2. Get video data
    const { data: video } = await supabaseAdmin
        .from('videos')
        .select('slug, title, channel_url')
        .eq('id', videoId)
        .single();

    if (!video?.slug || !video?.title || !video?.channel_url) return;

    // 3. Find claimed creator
    const { data: creator } = await supabaseAdmin
        .from('creators')
        .select('channel_name, user_id')
        .eq('channel_url', video.channel_url)
        .not('user_id', 'is', null)
        .maybeSingle();

    if (!creator?.user_id) return;

    const creatorEmail = await resolveEmail(creator.user_id, null);
    if (!creatorEmail) return;

    // 4. Send milestone email
    const unsubscribeUrl = buildUnsubscribeUrl(creatorEmail, SITE_URL);
    const { subject, html } = viewMilestoneEmail({
        creatorName: creator.channel_name || 'Creator',
        videoTitle: video.title,
        videoSlug: video.slug,
        milestone,
        siteUrl: SITE_URL,
        unsubscribeUrl,
    });

    const result = await sendEmail(creatorEmail, subject, html, unsubscribeUrl);

    await supabaseAdmin.from('email_notifications_log').insert({
        email_type: 'view_milestone',
        recipient_email: creatorEmail,
        video_id: videoId,
        metadata: { milestone, resend_id: result.id || null },
    });
}

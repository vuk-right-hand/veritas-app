"use server";

import { createClient } from '@supabase/supabase-js';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

// Helper to fetch channel metadata and avatar
export async function fetchChannelData(channelUrl: string) {
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

        if (!response.ok) return { title: "", avatar_url: "", success: false };

        const html = await response.text();

        // Extract Title from og:title
        const titleMatch = html.match(/<meta property="og:title" content="([^"]+)">/);
        const title = titleMatch ? titleMatch[1] : "Unknown Channel";

        // Extract Avatar from og:image
        const imageMatch = html.match(/<meta property="og:image" content="([^"]+)">/);
        const avatar_url = imageMatch ? imageMatch[1] : "";

        return { title, avatar_url, success: true };
    } catch (e) {
        console.error("Failed to fetch channel metadata:", e);
        return { title: "", avatar_url: "", success: false };
    }
}

export async function suggestChannel(channelUrl: string) {
    // 1. Check if channel already exists
    const { data: existing, error: fetchError } = await supabase
        .from('channel_suggestions')
        .select('id, status, suggestion_count')
        .eq('channel_url', channelUrl)
        .single();

    if (existing) {
        // INCREMENT SUGGESTION COUNT (Upvote)
        await supabase
            .from('channel_suggestions')
            .update({ suggestion_count: (existing.suggestion_count || 1) + 1 })
            .eq('id', existing.id);

        if (existing.status === 'banned') {
            return { success: false, message: "This channel has been declined by the moderators." };
        }
        if (existing.status === 'approved') {
            return { success: true, message: "Channel is already approved! We added your vote." };
        }
        return { success: true, message: "Channel already pending. We added your vote!" };
    }

    // 2. Fetch metadata from YouTube
    const metadata = await fetchChannelData(channelUrl);

    // 3. Insert new Pending Channel
    const { error: insertError } = await supabase
        .from('channel_suggestions')
        .insert({
            channel_url: channelUrl,
            title: metadata.title,
            avatar_url: metadata.avatar_url,
            status: 'pending',
            suggestion_count: 1
        });

    if (insertError) {
        console.error("Insert Error:", insertError);
        return { success: false, message: "Failed to submit channel. " + insertError.message };
    }

    revalidatePath('/suggested-videos');
    return { success: true, message: "Channel submitted for verification!" };
}

export async function getPendingChannels() {
    noStore();
    const { data, error } = await supabase
        .from('channel_suggestions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) return [];
    return data;
}

export async function getApprovedChannels() {
    noStore();
    const { data, error } = await supabase
        .from('channel_suggestions')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

    if (error) return [];
    return data;
}

export async function getDeniedChannels() {
    noStore();
    const { data, error } = await supabase
        .from('channel_suggestions')
        .select('*')
        .eq('status', 'banned')
        .order('created_at', { ascending: false });

    if (error) return [];
    return data;
}

export async function getStorageChannels() {
    noStore();
    const { data, error } = await supabase
        .from('channel_suggestions')
        .select('*')
        .eq('status', 'storage')
        .order('created_at', { ascending: false });

    if (error) return [];
    return data;
}

export async function moderateChannel(channelId: string, action: 'approve' | 'ban' | 'storage' | 'pending') {
    let newStatus = 'pending';
    if (action === 'approve') newStatus = 'approved';
    else if (action === 'ban') newStatus = 'banned';
    else if (action === 'storage') newStatus = 'storage';
    else newStatus = 'pending';

    const { error } = await supabase
        .from('channel_suggestions')
        .update({ status: newStatus })
        .eq('id', channelId);

    if (error) {
        console.error('[moderateChannel] Update Error:', error);
        return { success: false, message: error.message };
    }

    revalidatePath('/suggested-videos');
    return { success: true, message: `Channel moved to ${newStatus}` };
}

export async function deleteChannel(channelId: string) {
    const { error } = await supabase
        .from('channel_suggestions')
        .delete()
        .eq('id', channelId);

    if (error) {
        console.error('[deleteChannel] Error:', error);
        return { success: false, message: error.message };
    }

    revalidatePath('/suggested-videos');
    return { success: true, message: "Channel deleted successfully" };
}

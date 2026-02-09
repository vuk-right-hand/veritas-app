"use server";

import { createClient } from '@supabase/supabase-js';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';

// Initialize Supabase Client (Prefer Service Role if available for Admin actions, fall back to Anon for now with RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use Service Role if available to bypass RLS for insertions
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

// Helper: Fetch YouTube video title via oEmbed (no API key needed)
async function getYouTubeVideoTitle(videoId: string): Promise<string> {
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const response = await fetch(oembedUrl);
        if (!response.ok) return "Unknown Title";
        const data = await response.json();
        return data.title || "Unknown Title";
    } catch (e) {
        console.error("Failed to fetch YouTube title:", e);
        return "Unknown Title";
    }
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

    // 3. Fetch real title from YouTube
    const videoTitle = await getYouTubeVideoTitle(videoId);

    // 4. Insert new Pending Video
    const { error: insertError } = await supabase
        .from('videos')
        .insert({
            id: videoId,
            title: videoTitle,
            status: 'pending',
            human_score: 50, // Default starting score until analyzed
            channel_id: null,
            suggestion_count: 1
        });

    if (insertError) {
        console.error("Insert Error:", insertError);
        return { success: false, message: "Failed to submit video. " + insertError.message };
    }

    revalidatePath('/founder-meeting'); // Refresh the admin list
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

export async function getVerifiedVideos() {
    noStore();
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('status', 'verified')
        .order('created_at', { ascending: false });

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

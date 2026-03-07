"use server";

import { createClient } from '@supabase/supabase-js';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';

const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

// Simplified meta fetcher for platform updates
async function getYouTubeMetadata(videoId: string) {
    let title = "Unknown Title";
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const response = await fetch(oembedUrl);
        if (response.ok) {
            const data = await response.json();
            title = data.title || title;
        }
    } catch (e) {
        console.error("Failed to fetch YouTube metadata:", e);
    }
    return { title };
}

export async function suggestPlatformUpdate(videoUrl: string) {
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

    // 2. Fetch metadata
    const metadata = await getYouTubeMetadata(videoId);

    // 3. Insert new Pending Update
    const { error: insertError } = await supabase
        .from('platform_updates')
        .insert({
            video_id: videoId,
            title: metadata.title,
            status: 'pending',
            suggestion_count: 1
        });

    if (insertError) {
        console.error("Insert Error:", insertError);
        return { success: false, message: "Failed to submit platform update. " + insertError.message };
    }

    // 4. Upsert the video into the videos table so comments FK constraint is satisfied
    await supabase
        .from('videos')
        .upsert({
            id: videoId,
            slug: videoId, // use videoId as slug fallback
            title: metadata.title,
            status: 'pending',
        }, { onConflict: 'id', ignoreDuplicates: true });

    revalidatePath('/suggested-videos');
    revalidatePath('/founder-meeting');
    return { success: true, message: "Platform update submitted!" };
}

export async function getPlatformUpdatesByStatus(status: string) {
    noStore();
    const { data, error } = await supabase
        .from('platform_updates')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Supabase Query Error:', error);
        return [];
    }
    return data;
}

export async function moderatePlatformUpdate(id: string, action: 'current' | 'previous' | 'storage' | 'pending') {
    // Implementing the specific constraint: only one 'current' update at a time.
    if (action === 'current') {
        const { error: demoteError } = await supabase
            .from('platform_updates')
            .update({ status: 'previous' })
            .eq('status', 'current');
            
        if (demoteError) {
            console.error('[moderatePlatformUpdate] Demote Error:', demoteError);
            return { success: false, message: "Failed to demote existing current update." };
        }
    }

    const { data: updated, error } = await supabase
        .from('platform_updates')
        .update({ status: action })
        .eq('id', id)
        .select('video_id, title')
        .single();

    if (error) {
        console.error('[moderatePlatformUpdate] Update Error:', error);
        return { success: false, message: error.message };
    }

    // Backfill: ensure the video exists in the videos table so comments FK is always satisfied
    if (updated?.video_id) {
        await supabase
            .from('videos')
            .upsert({
                id: updated.video_id,
                slug: updated.video_id,
                title: updated.title || 'Platform Update',
                status: 'pending',
            }, { onConflict: 'id', ignoreDuplicates: true });
    }

    revalidatePath('/suggested-videos');
    revalidatePath('/founder-meeting');
    return { success: true, message: `Update moved to ${action}` };
}

export async function updatePlatformMessage(id: string, message: string) {
    const { error } = await supabase
        .from('platform_updates')
        .update({ message })
        .eq('id', id);

    if (error) {
         console.error('[updatePlatformMessage] Error:', error);
         return { success: false, message: error.message };
    }

    revalidatePath('/suggested-videos');
    revalidatePath('/founder-meeting');
    return { success: true, message: "Message updated successfully" };
}

export async function deletePlatformUpdate(id: string) {
    const { error } = await supabase
        .from('platform_updates')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[deletePlatformUpdate] Error:', error);
        return { success: false, message: error.message };
    }

    revalidatePath('/suggested-videos');
    revalidatePath('/founder-meeting');
    return { success: true, message: "Update deleted successfully" };
}

// Posts a comment on a platform update, ensuring the video exists in the videos table first.
// This is required to satisfy the comments_video_id_fkey foreign key constraint.
export async function postPlatformComment(videoId: string, title: string, text: string, userName: string, userId?: string) {
    // 1. Guarantee the video row exists so the FK is satisfied
    await supabase
        .from('videos')
        .upsert({
            id: videoId,
            slug: videoId,
            title: title || 'Platform Update',
            status: 'pending',
        }, { onConflict: 'id', ignoreDuplicates: true });

    // 2. Insert the comment
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
        console.error('Error posting platform comment:', error);
        return { success: false, message: error.message };
    }

    return { success: true, comment: data };
}

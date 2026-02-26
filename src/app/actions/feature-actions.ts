"use server";

import { createClient } from '@supabase/supabase-js';

import { revalidatePath } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function submitFeatureRequest(content: string, userId?: string) {
    if (!content || content.trim().length === 0) {
        return { success: false, message: "Request cannot be empty." };
    }

    const { error } = await supabase
        .from('feature_requests')
        .insert([{ content, user_id: userId }]);

    if (error) {
        console.error("Feature Request Error:", error);
        return { success: false, message: "Failed to submit request." };
    }

    return { success: true, message: "Request received. Thank you!" };
}

export async function getFeatureRequestsByStatus(status: 'pending' | 'verified' | 'banned' | 'storage') {
    // Map Kanban status to feature_requests DB status
    const statusMap = {
        'pending': 'pending',
        'verified': 'approved',
        'banned': 'denied',
        'storage': 'storage'
    };

    const dbStatus = statusMap[status];

    const { data: requests, error } = await supabaseAdmin
        .from('feature_requests')
        .select('*')
        .eq('status', dbStatus)
        .order('created_at', { ascending: false });

    if (error || !requests) {
        console.error('Error fetching feature requests:', error);
        return [];
    }

    // Extract unique user IDs
    const userIds = [...new Set(requests.map(req => req.user_id).filter(Boolean))];

    // Fetch profiles for these users
    const profilesMap: Record<string, any> = {};
    if (userIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', userIds);

        if (profiles) {
            profiles.forEach(p => {
                profilesMap[p.id] = p;
            });
        }
    }

    // Map the results so they are easier to render in the UI
    return requests.map((req: any) => {
        const profile = req.user_id ? profilesMap[req.user_id] : null;
        return {
            id: req.id,
            title: req.content,
            created_at: req.created_at,
            user_id: req.user_id,
            username: profile?.username || 'Anonymous',
            avatar_url: profile?.avatar_url || null,
            suggestion_count: 1 // For the UI hexagon
        };
    });
}

export async function moderateFeatureRequest(id: string, action: 'approve' | 'ban' | 'storage' | 'pending') {
    const statusMap = {
        'pending': 'pending',
        'approve': 'approved',
        'ban': 'denied',
        'storage': 'storage'
    };

    const newStatus = statusMap[action];

    const { error } = await supabaseAdmin
        .from('feature_requests')
        .update({ status: newStatus })
        .eq('id', id);

    if (error) {
        console.error('Error moderating feature request:', error);
        return { success: false, message: error.message };
    }

    revalidatePath('/suggested-videos');
    return { success: true };
}

export async function deleteFeatureRequest(id: string) {
    const { error } = await supabaseAdmin
        .from('feature_requests')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting feature request:', error);
        return { success: false, message: error.message };
    }

    revalidatePath('/suggested-videos');
    return { success: true };
}

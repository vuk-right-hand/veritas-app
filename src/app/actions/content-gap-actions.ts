"use server";

import { createClient } from '@supabase/supabase-js';

import { revalidatePath } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function getContentGapsByStatus(status: 'pending' | 'verified' | 'banned' | 'storage') {
    // Map Kanban status to content_gaps DB status
    const statusMap = {
        'pending': 'pending',
        'verified': 'approved',
        'banned': 'denied',
        'storage': 'storage'
    };

    const dbStatus = statusMap[status];

    const { data: gaps, error } = await supabaseAdmin
        .from('content_gaps')
        .select('*')
        .eq('status', dbStatus)
        .order('created_at', { ascending: false });

    if (error || !gaps) {
        console.error('Error fetching content gaps:', error);
        return [];
    }

    // Extract unique user IDs
    const userIds = [...new Set(gaps.map(req => req.user_id).filter(Boolean))];

    // Fetch profiles for these users
    const profilesMap: Record<string, any> = {};
    if (userIds.length > 0) {
        // Fetch profiles (for avatar_url, username etc)
        const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', userIds);

        if (profiles) {
            profiles.forEach(p => {
                profilesMap[p.id] = { ...p };
            });
        }

        // Fetch user emails from auth.admin
        const authData = await Promise.all(
            userIds.map(id => supabaseAdmin.auth.admin.getUserById(id))
        );
        
        authData.forEach((res, i) => {
            if (res.data?.user) {
                const id = userIds[i];
                if (!profilesMap[id]) profilesMap[id] = {};
                profilesMap[id].email = res.data.user.email;
            }
        });
    }

    // Map the results so they are easier to render in the UI
    return gaps.map((gap: any) => {
        const profile = gap.user_id ? profilesMap[gap.user_id] : null;
        let displayName = profile?.username;
        if (!displayName && profile?.email) {
            displayName = profile.email.split('@')[0];
        }
        
        return {
            id: gap.id,
            title: gap.search_query, // mapping search_query to title for UI
            created_at: gap.created_at,
            user_id: gap.user_id,
            username: displayName || 'Anonymous',
            email: profile?.email || null,
            avatar_url: profile?.avatar_url || null,
            suggestion_count: 1 // For the UI hexagon (can group duplicates in future)
        };
    });
}

export async function moderateContentGap(id: string, action: 'approve' | 'ban' | 'storage' | 'pending') {
    const statusMap = {
        'pending': 'pending',
        'approve': 'approved',
        'ban': 'denied',
        'storage': 'storage'
    };

    const newStatus = statusMap[action];

    const { error } = await supabaseAdmin
        .from('content_gaps')
        .update({ status: newStatus })
        .eq('id', id);

    if (error) {
        console.error('Error moderating content gap:', error);
        return { success: false, message: error.message };
    }

    revalidatePath('/suggested-videos');
    return { success: true };
}

export async function deleteContentGap(id: string) {
    const { error } = await supabaseAdmin
        .from('content_gaps')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting content gap:', error);
        return { success: false, message: error.message };
    }

    revalidatePath('/suggested-videos');
    return { success: true };
}

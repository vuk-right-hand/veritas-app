import React from 'react';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import CreatorDashboardClient from './CreatorDashboardClient';
import { getCreatorStats } from '../actions/creator-actions';

// Initialize Supabase Client for Auth Check
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';

export default async function CreatorDashboard() {
    const cookieStore = await cookies();

    // 1. Get User Session via SSR client
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    )
                } catch {
                    // The `setAll` method was called from a Server Component.
                    // This can be ignored if you have middleware refreshing
                    // user sessions.
                }
            },
        },
    });

    const { data: { user } } = await supabase.auth.getUser();

    let stats = null;
    let creatorProfile = null;
    let videos: any[] = [];

    if (!user) {
        // SECURITY PATCH H1: No unauthenticated access — hard redirect.
        // The old demo fallback fetched the first creator's real data and rendered it
        // for any anonymous visitor. Removed entirely.
        redirect('/claim-channel');
    }

    const res = await getCreatorStats(user.id);
    if (res.success) {
        stats = res.stats;
        creatorProfile = res.creator;
        videos = res.videos || [];
    }

    if (!creatorProfile) {
        redirect('/claim-channel');
    }

    return (
        <>
            {creatorProfile ? (
                <CreatorDashboardClient
                    stats={stats!}
                    creator={creatorProfile}
                    videos={videos}
                />
            ) : (
                <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4">
                    <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
                    <p className="text-gray-400 mb-8">You need to be logged in as a Creator to view this dashboard.</p>
                    <a href="/claim-channel" className="px-6 py-3 bg-red-600 rounded-lg font-bold hover:bg-red-500">Claim Channel / Login</a>
                </div>
            )}
        </>
    );
}

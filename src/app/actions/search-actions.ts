"use server";

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
        '[search-actions] Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or ' +
        'SUPABASE_SERVICE_ROLE_KEY.'
    );
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export async function logPriorityRequest(query: string): Promise<{ success: boolean; message: string }> {
    // 1. Auth check via SSR cookie client
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key',
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch { }
                },
            },
        }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return { success: false, message: 'Unauthorized' };
    }

    // 2. Validate + normalize (lowercase for case-insensitive dedup)
    const trimmed = query.trim().toLowerCase();
    if (!trimmed || trimmed.length > 500) {
        return { success: false, message: 'Invalid query' };
    }

    // 3. Dedup — prevent same user logging same query twice
    const { data: existing } = await supabaseAdmin
        .from('content_gaps')
        .select('id')
        .eq('user_id', user.id)
        .eq('search_query', trimmed)
        .maybeSingle();

    if (existing) {
        return { success: true, message: 'Already requested' };
    }

    // 4. Insert
    const { error: insertError } = await supabaseAdmin
        .from('content_gaps')
        .insert({ user_id: user.id, search_query: trimmed });

    if (insertError) {
        console.error('[search-actions] logPriorityRequest insert error:', insertError);
        return { success: false, message: 'Failed to log request' };
    }

    return { success: true, message: 'Request logged' };
}

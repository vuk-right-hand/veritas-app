

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import Onboarding from './onboarding-client';

export default async function OnboardingWrapper() {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key',
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll() {
                    // Safe to ignore in Server Component wrapper
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();

    let oauthUser = null;
    if (user) {
        oauthUser = {
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        };
    }

    return (
        <Suspense>
            <Onboarding oauthUser={oauthUser} />
        </Suspense>
    );
}

import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export default async function SuggestedVideosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/dashboard');
  }

  // The Database Check: Query the admin_roles table
  // The RLS policy requires (auth.jwt() ->> 'email') = email
  const { data: adminRole, error } = await supabase
    .from('admin_roles')
    .select('id')
    .eq('email', user.email)
    .single();

  if (error || !adminRole) {
    // If no match is found, immediately redirect
    redirect('/dashboard');
  }

  return <>{children}</>;
}

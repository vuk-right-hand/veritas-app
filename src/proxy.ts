import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
    // ─────────────────────────────────────────────────────
    // 1. CREATE THE SUPABASE SSR CLIENT (cookie-aware)
    // ─────────────────────────────────────────────────────
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    // Forward cookies onto the request so Server Components see them
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({ request })
                    // Forward cookies onto the response so the browser stores them
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // ─────────────────────────────────────────────────────
    // 2. REFRESH SESSION (critical – do NOT skip this)
    //    getUser() validates the JWT with the Supabase server
    //    and refreshes the token if needed.
    // ─────────────────────────────────────────────────────
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname

    // ─────────────────────────────────────────────────────
    // 3. THE AUTH CALLBACK TRAP FIX
    //    /auth/callback must NEVER be redirected.
    //    The PKCE code exchange happens here. If we redirect
    //    before it completes, the session cookie is never set
    //    and we get an infinite loop back to /login.
    // ─────────────────────────────────────────────────────
    if (pathname.startsWith('/auth/')) {
        return supabaseResponse
    }

    // ─────────────────────────────────────────────────────
    // 4. ROUTE CLASSIFICATION
    // ─────────────────────────────────────────────────────
    const isAuthPage =
        pathname === '/' ||
        pathname === '/login' ||
        pathname === '/onboarding'

    const isPublicPage =
        pathname === '/dashboard' ||
        pathname === '/claim-channel' ||
        pathname === '/founder-meeting' ||
        pathname === '/privacy' ||
        pathname === '/terms' ||
        pathname === '/update-password' ||
        pathname.startsWith('/v/') ||
        pathname.startsWith('/c/') ||
        pathname.startsWith('/api/')

    // ─────────────────────────────────────────────────────
    // 5. BOUNCER LOGIC
    // ─────────────────────────────────────────────────────

    // Rule 1: Logged-in user hitting auth pages → Dashboard
    if (user && isAuthPage) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    // Rule 2: Logged-out user hitting protected pages → Login
    //         (but NOT public SEO pages like /v/ or /c/)
    if (!user && !isAuthPage && !isPublicPage) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // ─────────────────────────────────────────────────────
    // 6. DEFAULT: Let the request through
    //    IMPORTANT: always return supabaseResponse so
    //    refreshed cookies propagate to browser + server.
    // ─────────────────────────────────────────────────────
    return supabaseResponse
}

export const config = {
    matcher: [
        /*
         * Run proxy on all routes EXCEPT:
         * - _next/static (static files)
         * - _next/image  (image optimization)
         * - favicon.ico
         * - Any file with an extension (.svg, .png, .jpg, etc.)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}

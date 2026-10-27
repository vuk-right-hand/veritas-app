import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/keep-alive
 * Daily Vercel cron (see vercel.json). Runs one tiny real query so the
 * free-tier Supabase project never hits the 7-day inactivity pause.
 *
 * SECURITY: Vercel sends `Authorization: Bearer $CRON_SECRET` on cron calls.
 * Fails closed if CRON_SECRET is unset.
 */
export async function GET(req: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from('videos').select('id').limit(1);
    if (error) {
        console.error('[keep-alive] Supabase ping failed:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    }

    return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() });
}

import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import type { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================================
// LOAD-BEARING CASCADE ORDER — DO NOT REORDER
// ----------------------------------------------------------------------------
// Strategy 1 (mission cookie) > Strategy 2 (Supabase auth JWT) > Strategy 3
// (anon UUID, mint or null). The WRITE path (recordWatchProgress) and the
// READ path (feed RPC) both call through this module and MUST resolve the
// same id for the same user. Reordering either surface silently re-keys
// every user's taste vector and breaks personalization for everyone who
// straddles keyspaces (e.g. a creator who still has a legacy mission cookie).
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const PROJECT_REF = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const [, payload] = token.split('.');
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

async function resolveFromMissionCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const missionId = cookieStore.get('veritas_user')?.value;
  if (!missionId) return null;

  const { data: mission } = await supabaseAdmin
    .from('user_missions')
    .select('user_id')
    .eq('id', missionId)
    .single();

  if (mission?.user_id) return mission.user_id;
  // Mission exists but no linked user — use mission_id directly.
  return missionId;
}

async function resolveFromSupabaseAuthCookie(): Promise<string | null> {
  if (!PROJECT_REF) return null;
  const cookieStore = await cookies();

  const authCookieName = `sb-${PROJECT_REF}-auth-token`;
  const authCookieValue = cookieStore.get(authCookieName)?.value;

  if (authCookieValue) {
    let accessToken = authCookieValue;
    try {
      const parsed = JSON.parse(authCookieValue);
      if (Array.isArray(parsed)) accessToken = parsed[0];
      else if (parsed.access_token) accessToken = parsed.access_token;
    } catch { /* raw token */ }

    const payload = decodeJwtPayload(accessToken);
    if (payload?.sub) return payload.sub;
  }

  // Chunked cookie format.
  const chunk0 = cookieStore.get(`sb-${PROJECT_REF}-auth-token.0`)?.value;
  if (chunk0) {
    const payload = decodeJwtPayload(chunk0);
    if (payload?.sub) return payload.sub;
  }

  return null;
}

/**
 * Read-only viewer id resolution. Returns `null` on cold-start instead of
 * minting a cookie. MUST NOT touch response cookies — this is called during
 * SSR render on every anon pageload and we cannot set-cookie on reads.
 */
export async function resolveViewerIdReadOnly(): Promise<string | null> {
  // Strategy 1
  const missionId = await resolveFromMissionCookie();
  if (missionId) return missionId;

  // Strategy 2
  const authId = await resolveFromSupabaseAuthCookie();
  if (authId) return authId;

  // Strategy 3 (read-only): return existing anon cookie if present, never mint.
  const cookieStore = await cookies();
  const existingAnon = cookieStore.get('veritas_anon')?.value;
  return existingAnon ?? null;
}

/**
 * Read-write viewer id resolution. Mints and sets a persistent `veritas_anon`
 * cookie on the provided response if no id can be resolved via strategies 1-2.
 * Only called from the write path (watch-progress POST).
 */
export async function resolveOrMintViewerId(
  response: NextResponse
): Promise<{ userId: string; resolvedVia: string }> {
  // Strategy 1
  const missionId = await resolveFromMissionCookie();
  if (missionId) return { userId: missionId, resolvedVia: 'mission_cookie' };

  // Strategy 2
  const authId = await resolveFromSupabaseAuthCookie();
  if (authId) return { userId: authId, resolvedVia: 'supabase_auth_cookie' };

  // Strategy 3: mint persistent anon cookie if absent.
  const cookieStore = await cookies();
  let anonId = cookieStore.get('veritas_anon')?.value;
  if (!anonId) {
    anonId = randomUUID();
    response.cookies.set('veritas_anon', anonId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }
  return { userId: anonId, resolvedVia: 'anon_cookie' };
}

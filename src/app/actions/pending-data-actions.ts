'use server';

import { cookies } from 'next/headers';

const COOKIE_OPTIONS = {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 10, // 10 minutes — short-lived, only needed during OAuth round-trip
};

// --- Onboarding pending mission ---

export async function savePendingMission(goal: string, struggle: string) {
    const cookieStore = await cookies();
    cookieStore.set('veritas_pending_mission', JSON.stringify({ goal, struggle }), COOKIE_OPTIONS);
}

export async function getPendingMission(): Promise<{ goal: string; struggle: string } | null> {
    const cookieStore = await cookies();
    const raw = cookieStore.get('veritas_pending_mission')?.value;
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

export async function clearPendingMission() {
    const cookieStore = await cookies();
    try { cookieStore.delete('veritas_pending_mission'); } catch { /* noop */ }
}

// --- Claim-channel pending claim ---

export async function savePendingClaim(channelUrl: string, channelName: string) {
    const cookieStore = await cookies();
    cookieStore.set('veritas_pending_claim', JSON.stringify({ channelUrl, channelName }), COOKIE_OPTIONS);
}

export async function getPendingClaim(): Promise<{ channelUrl: string; channelName: string } | null> {
    const cookieStore = await cookies();
    const raw = cookieStore.get('veritas_pending_claim')?.value;
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

export async function clearPendingClaim() {
    const cookieStore = await cookies();
    try { cookieStore.delete('veritas_pending_claim'); } catch { /* noop */ }
}

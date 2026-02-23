import { NextResponse } from 'next/server';
import { generateVerificationToken, verifyChannelOwnership } from '../../actions/video-actions';
import { finalizeChannelClaim } from '../../actions/auth-actions';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    const logs: string[] = [];
    const log = (msg: string) => {
        logs.push(msg);
        console.log("==> " + msg);
    };

    log("🚨 STARTING RED TEAM CHAOS MONKEY SIMULATION 🚨");

    const attackerEmail = "attacker@hack.com";
    const victimEmail = "victim@real.com";
    const targetChannel = "https://www.youtube.com/@veritas";

    // --- SETUP ---
    await supabaseAdmin.from('verification_requests').delete().in('email', [attackerEmail, victimEmail]);
    await supabaseAdmin.auth.admin.deleteUser(attackerEmail).catch(() => { });

    // --- TEST 1: The Fakeout (Try to claim without verifying) ---
    log("\n[TEST 1: The Fakeout]");
    log("Attacker tries to call finalizeChannelClaim directly with a fake token.");
    const fakeoutResult = await finalizeChannelClaim(attackerEmail, "hacked123!", {
        url: targetChannel,
        title: "Target Channel",
        token: "VERITAS-FAKE123"
    });
    if (!fakeoutResult.success) {
        log(`🟢 BLOCKED: ${fakeoutResult.message}`);
    } else {
        log(`🔴 ALERT: Fakeout succeeded! Setup is vulnerable.`);
    }

    // --- TEST 2: The Spoof / Stolen Session ---
    log("\n[TEST 2: The Spoof (Stolen Session)]");
    log("Attacker tries to verify using Victim's token.");
    const victimTokenRes = await generateVerificationToken(victimEmail, targetChannel);
    const stolenToken = victimTokenRes.token;

    const spoofResult = await verifyChannelOwnership(attackerEmail, targetChannel, stolenToken || "");
    if (!spoofResult.success) {
        log(`🟢 BLOCKED (Using wrong email for token): ${spoofResult.message}`);
    } else {
        log(`🔴 ALERT: Spoof succeeded! Target verified with wrong email.`);
    }

    // --- TEST 3: The Expired Token ---
    log("\n[TEST 3: The Expired Token]");
    log("Attacker tries to use a 20-minute old token on their own attempt.");
    const expiredTokenRes = await generateVerificationToken(attackerEmail, targetChannel);
    // Manually expire the token in DB
    await supabaseAdmin.from('verification_requests')
        .update({ expires_at: new Date(Date.now() - 20 * 60000).toISOString() })
        .eq('token', expiredTokenRes.token);

    const expiredResult = await verifyChannelOwnership(attackerEmail, targetChannel, expiredTokenRes.token || "");
    if (!expiredResult.success) {
        log(`🟢 BLOCKED (Expired): ${expiredResult.message}`);
    } else {
        log(`🔴 ALERT: Expired token succeeded!`);
    }

    // --- TEST 4: The Load (Rate Limiting token generation) ---
    log("\n[TEST 4: The Load]");
    log("Attacker spams the generateToken endpoint 12 times.");
    let spamBlocked = false;
    for (let i = 0; i < 12; i++) {
        const res = await generateVerificationToken(attackerEmail, targetChannel);
        if (!res.success && res.message?.includes("Too many")) {
            spamBlocked = true; // We hit the rate limit!
            log(`🟢 BLOCKED at attempt #${i + 1}: ${res.message}`);
            break;
        }
    }
    if (!spamBlocked) {
        log(`🔴 ALERT: Rate Limiter failed to block 12 rapid requests.`);
    }

    // --- TEST 5: Bruteforce Verification (15 guessed tokens) ---
    log("\n[TEST 5: Bruteforce Verification Attempts]");
    log("Attacker tries 15 different guessed tokens for a valid request.");
    await supabaseAdmin.from('verification_requests').delete().eq('email', attackerEmail); // reset from test 4

    await generateVerificationToken(attackerEmail, targetChannel);
    let bruteforceBlocked = false;
    for (let i = 0; i < 12; i++) {
        const res = await verifyChannelOwnership(attackerEmail, targetChannel, `VERITAS-GUESS${i}`);
        if (!res.success && res.message.includes("Too many failed attempts")) {
            bruteforceBlocked = true;
            log(`🟢 BLOCKED at guess #${i + 1}: ${res.message}`);
            break;
        }
    }
    if (!bruteforceBlocked) {
        log(`🔴 ALERT: Bruteforce Rate Limiter failed.`);
    }

    log("\n✅ SIMULATION COMPLETE.");
    return NextResponse.json({ success: true, logs });
}

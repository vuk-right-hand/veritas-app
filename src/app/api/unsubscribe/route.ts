import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret';

/** Generate HMAC signature for an email address */
export function signEmail(email: string): string {
    return createHmac('sha256', SECRET).update(email.toLowerCase()).digest('hex').slice(0, 16);
}

/** Build the full unsubscribe URL for a given email */
export function buildUnsubscribeUrl(email: string, siteUrl: string): string {
    const encoded = Buffer.from(email.toLowerCase()).toString('base64url');
    const sig = signEmail(email);
    return `${siteUrl}/api/unsubscribe?e=${encoded}&sig=${sig}`;
}

// GET — renders a simple confirmation page, or processes one-click unsubscribe
export async function GET(req: NextRequest) {
    const e = req.nextUrl.searchParams.get('e');
    const sig = req.nextUrl.searchParams.get('sig');

    if (!e || !sig) {
        return new NextResponse('Invalid unsubscribe link.', { status: 400 });
    }

    let email: string;
    try {
        email = Buffer.from(e, 'base64url').toString('utf-8').toLowerCase();
    } catch {
        return new NextResponse('Invalid unsubscribe link.', { status: 400 });
    }

    // Verify signature
    if (signEmail(email) !== sig) {
        return new NextResponse('Invalid unsubscribe link.', { status: 403 });
    }

    // Show confirmation page
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Unsubscribe — VibeCodersHQ</title>
<style>
  body { margin:0; padding:40px 16px; background:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; display:flex; justify-content:center; }
  .card { max-width:420px; background:#fff; border-radius:12px; padding:32px; text-align:center; }
  h1 { font-size:20px; color:#18181b; margin:0 0 12px; }
  p { font-size:15px; color:#3f3f46; line-height:1.6; margin:0 0 24px; }
  form { display:inline; }
  button { background:#18181b; color:#fff; border:none; padding:12px 24px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; }
  button:hover { background:#27272a; }
  .done { color:#16a34a; }
</style>
</head>
<body>
  <div class="card">
    <h1>Unsubscribe from VibeCodersHQ</h1>
    <p>Click below to stop receiving emails at <strong>${email.replace(/</g, '&lt;')}</strong>.</p>
    <form method="POST" action="/api/unsubscribe">
      <input type="hidden" name="e" value="${e}">
      <input type="hidden" name="sig" value="${sig}">
      <button type="submit">Unsubscribe</button>
    </form>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}

// POST — actually processes the unsubscribe (form submit + RFC 8058 one-click)
export async function POST(req: NextRequest) {
    let e: string | null = null;
    let sig: string | null = null;

    // Support both form data (browser) and URL params (RFC 8058 one-click)
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await req.formData();
        e = formData.get('e') as string | null;
        sig = formData.get('sig') as string | null;
    } else {
        e = req.nextUrl.searchParams.get('e');
        sig = req.nextUrl.searchParams.get('sig');
    }

    if (!e || !sig) {
        return new NextResponse('Invalid request.', { status: 400 });
    }

    let email: string;
    try {
        email = Buffer.from(e, 'base64url').toString('utf-8').toLowerCase();
    } catch {
        return new NextResponse('Invalid request.', { status: 400 });
    }

    if (signEmail(email) !== sig) {
        return new NextResponse('Invalid request.', { status: 403 });
    }

    // Upsert into email_unsubscribes (idempotent)
    await supabaseAdmin
        .from('email_unsubscribes')
        .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Unsubscribed — VibeCodersHQ</title>
<style>
  body { margin:0; padding:40px 16px; background:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; display:flex; justify-content:center; }
  .card { max-width:420px; background:#fff; border-radius:12px; padding:32px; text-align:center; }
  h1 { font-size:20px; color:#18181b; margin:0 0 12px; }
  p { font-size:15px; color:#3f3f46; line-height:1.6; }
</style>
</head>
<body>
  <div class="card">
    <h1>You've been unsubscribed</h1>
    <p>You won't receive any more emails from VibeCodersHQ. If this was a mistake, just reply to any of our previous emails and we'll re-add you.</p>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}

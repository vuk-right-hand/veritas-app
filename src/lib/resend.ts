import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV !== 'production') {
        console.warn('[Resend] Missing RESEND_API_KEY env var');
    }
}

export const resend = new Resend(process.env.RESEND_API_KEY || '');

// Verified domain sender
// eslint-disable-next-line no-useless-escape
export const EMAIL_FROM = 'Admin at VibeCodersHQ <admin@vibecodershq.io>';

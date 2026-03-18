/**
 * Email templates for VibeCodersHQ marketing emails.
 * Plain HTML strings — no React Email dependency.
 */

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function baseLayout(content: string, unsubscribeUrl: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:#18181b;padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">VibeCodersHQ</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #e4e4e7;color:#a1a1aa;font-size:12px;line-height:1.6;">
          You're receiving this because you use VibeCodersHQ.<br>
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#a1a1aa;text-decoration:underline;">Unsubscribe</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
    return `<a href="${escapeHtml(url)}" style="display:inline-block;background:#18181b;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:8px 0;">${escapeHtml(text)}</a>`;
}

// ─── Video Approved: User Notification (The Trojan Horse) ───

interface UserApprovedParams {
    userName: string;
    videoTitle: string;
    videoSlug: string;
    channelName: string;
    siteUrl: string;
    unsubscribeUrl: string;
}

export function videoApprovedUserEmail(params: UserApprovedParams): { subject: string; html: string } {
    const { userName, videoTitle, videoSlug, channelName, siteUrl, unsubscribeUrl } = params;
    const videoUrl = `${siteUrl}/v/${videoSlug}`;

    const shareText = `Yo ${escapeHtml(channelName)}, I just passed the active recall quiz for your video on VibeCodersHQ: ${videoUrl}\nThe knowledge-retention is crazy when you actually have to earn it after watching. You have a verified profile up there now, you should claim it to update the links to your stuff.`;

    const content = `
        <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
          ${escapeHtml(userName)}, your taste is what we want on VibeCodersHQ.
        </p>
        <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
          The video you suggested has passed the verification engine and is officially live.
        </p>
        <p style="margin:0 0 8px;color:#18181b;font-size:16px;font-weight:600;">
          ${escapeHtml(videoTitle)} <span style="font-weight:400;color:#71717a;">by ${escapeHtml(channelName)}</span>
        </p>
        <p style="margin:0 0 24px;">
          ${ctaButton('Watch It Here & Take the Quiz', videoUrl)}
        </p>
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;">
        <p style="margin:0 0 8px;color:#18181b;font-size:15px;font-weight:600;">
          Your move?
        </p>
        <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
          Let them know. The fastest way to get your favorite creator's attention is to bring them a win. Drop them a DM on X or Instagram, or leave a comment under the video you promoted for them.
        </p>
        <p style="margin:0 0 8px;color:#3f3f46;font-size:14px;font-weight:600;">
          If you don't feel extra creative right now, just copy this:
        </p>
        <div style="background:#f4f4f5;border-radius:8px;padding:16px;font-size:13px;color:#3f3f46;line-height:1.6;white-space:pre-wrap;">${shareText}</div>
    `;

    return {
        subject: 'Your video pick is live (time to take the credit)',
        html: baseLayout(content, unsubscribeUrl),
    };
}

// ─── Video Approved: Creator Notification (The Ego Hook) ────

interface CreatorApprovedParams {
    creatorName: string;
    videoTitle: string;
    videoSlug: string;
    siteUrl: string;
    unsubscribeUrl: string;
}

export function videoApprovedCreatorEmail(params: CreatorApprovedParams): { subject: string; html: string } {
    const { creatorName, videoTitle, videoSlug, siteUrl, unsubscribeUrl } = params;
    const videoUrl = `${siteUrl}/v/${videoSlug}`;

    const content = `
        <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
          Hey ${escapeHtml(creatorName)},
        </p>
        <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
          Your video <strong>"${escapeHtml(videoTitle)}"</strong> was just verified and is now live on our feed.
        </p>
        <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
          Viewers can watch it and immediately take an active recall quiz custom-built around your frameworks, forcing them to actually retain what you're teaching.
        </p>
        <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
          As you already know... The sole purpose of the platform is to promote true experts and give viewers a place to learn without distractions, AI faceless bullcrap, Shorts, and cheap entertainment.<br>
          This is where your highest-intent audience lives.
        </p>
        <p style="margin:0 0 8px;color:#3f3f46;font-size:15px;line-height:1.6;">
          If you want to give your viewers a distraction-free place to watch and actually retain your material, here is your direct link:
        </p>
        <p style="margin:0 0 24px;">
          ${ctaButton('Your Video on VibeCodersHQ', videoUrl)}
        </p>
        <p style="margin:0;color:#3f3f46;font-size:15px;line-height:1.6;">
          And of course, log into your creator dashboard and suggest more of your videos we can promote.
        </p>
    `;

    return {
        subject: 'Your video is live on VibeCodersHQ.',
        html: baseLayout(content, unsubscribeUrl),
    };
}

// ─── View Milestone: Creator Notification (The Status Signal) ──

interface MilestoneParams {
    creatorName: string;
    videoTitle: string;
    videoSlug: string;
    milestone: number;
    siteUrl: string;
    unsubscribeUrl: string;
}

export function viewMilestoneEmail(params: MilestoneParams): { subject: string; html: string } {
    const { creatorName, videoTitle, videoSlug, milestone, siteUrl, unsubscribeUrl } = params;
    const videoUrl = `${siteUrl}/v/${videoSlug}`;

    const m = milestone.toLocaleString('en-US');

    const content = `
        <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
          Hey ${escapeHtml(creatorName)},
        </p>
        <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
          Your video just crossed <strong>${m} views</strong> on VibeCodersHQ.
        </p>
        <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
          That is ${m} humans visiting the platform to avoid the faceless AI bullcrap. ${m} humans who actually want to learn.
        </p>
        <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
          On YouTube, ${m} views might be serious people taking notes... but it also might be people falling asleep with autoplay on.
        </p>
        <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
          Here, that is ${m} people who stopped scrolling, engaged with your framework, and took the active recall quiz. That makes them exponentially more likely to engage with your future videos&#8212;and more importantly, your offers, newsletters, and private communities.
        </p>
        <p style="margin:0 0 8px;color:#3f3f46;font-size:15px;line-height:1.6;">
          If you want, share the video on your socials to boost the engagement even higher.
        </p>
        <p style="margin:0 0 24px;">
          ${ctaButton('Your Video', videoUrl)}
        </p>
        <p style="margin:0 0 24px;color:#3f3f46;font-size:15px;line-height:1.6;">
          And of course... send us more of your videos with this same quality. Let's get to the point where "views don't matter anymore".
        </p>
        <p style="margin:0;color:#18181b;font-size:15px;font-weight:600;">
          Vuk, Founder of VibeCodersHQ
        </p>
    `;

    return {
        subject: `${m} verified learners on: ${escapeHtml(videoTitle)}`,
        html: baseLayout(content, unsubscribeUrl),
    };
}

import { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────

export interface RssVideoEntry {
  videoId: string;
  title: string;
  published: string; // ISO date string
}

export interface PipelineJobUpdate {
  status?: string;
  error_message?: string;
  transcript_length?: number;
  duration_seconds?: number;
  processing_time_ms?: number;
}

// ─── Secret Validation ──────────────────────────────────

export function validatePipelineSecret(secret: string | null): boolean {
  const expected = process.env.PIPELINE_SECRET;
  if (!expected) {
    console.error('[Pipeline] PIPELINE_SECRET env var is not set');
    return false;
  }
  return secret === expected;
}

// ─── YouTube RSS Parsing ────────────────────────────────

export function parseYouTubeRss(xmlText: string, maxAgeDays: number): RssVideoEntry[] {
  const entries: RssVideoEntry[] = [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

  // YouTube Atom feed structure:
  // <entry>
  //   <yt:videoId>xxxxx</yt:videoId>
  //   <title>Video Title</title>
  //   <published>2026-03-01T12:00:00+00:00</published>
  // </entry>
  const entryBlocks = xmlText.split('<entry>').slice(1); // skip everything before first <entry>

  for (const block of entryBlocks) {
    const videoIdMatch = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = block.match(/<title>([^<]+)<\/title>/);
    const publishedMatch = block.match(/<published>([^<]+)<\/published>/);

    if (!videoIdMatch || !publishedMatch) continue;

    const published = publishedMatch[1];
    const publishedDate = new Date(published);

    // Filter by age
    if (publishedDate < cutoffDate) continue;

    entries.push({
      videoId: videoIdMatch[1],
      title: titleMatch ? titleMatch[1] : 'Untitled',
      published,
    });
  }

  // Sort oldest first so we process chronologically
  entries.sort((a, b) => new Date(a.published).getTime() - new Date(b.published).getTime());

  return entries;
}

// ─── Daily Rate Limit ───────────────────────────────────

export async function checkDailyLimit(
  supabaseAdmin: SupabaseClient,
  maxPerDay: number
): Promise<{ allowed: boolean; count: number }> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabaseAdmin
    .from('pipeline_jobs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart.toISOString())
    .not('status', 'like', 'skipped%');

  if (error) {
    console.error('[Pipeline] Error checking daily limit:', error);
    return { allowed: false, count: 0 };
  }

  const currentCount = count ?? 0;
  return { allowed: currentCount < maxPerDay, count: currentCount };
}

// ─── Pipeline Job Management ────────────────────────────

export async function createPipelineJob(
  supabaseAdmin: SupabaseClient,
  videoId: string,
  channelId: string | null
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('pipeline_jobs')
    .insert({
      video_id: videoId,
      channel_id: channelId,
      status: 'queued',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Pipeline] Error creating job:', error);
    return null;
  }

  return data.id;
}

export async function updatePipelineJob(
  supabaseAdmin: SupabaseClient,
  jobId: string,
  updates: PipelineJobUpdate
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('pipeline_jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) {
    console.error('[Pipeline] Error updating job:', error);
  }
}

// ─── YouTube Channel ID Resolution ─────────────────────

/**
 * Resolves a YouTube handle (@handle), channel URL, or raw UC... ID
 * to the real UCxxxxxx channel ID required for RSS feeds.
 */
export async function resolveYouTubeChannelId(input: string): Promise<string> {
  const trimmed = input.trim();

  // Case 1: Already a UC... channel ID (24 chars starting with UC)
  if (/^UC[\w-]{22}$/.test(trimmed)) {
    return trimmed;
  }

  // Case 2: /channel/UCxxxxxx URL — extract directly
  const channelPathMatch = trimmed.match(/\/channel\/(UC[\w-]{22})/);
  if (channelPathMatch) {
    return channelPathMatch[1];
  }

  // Case 3: @handle or full URL — scrape YouTube page for the real ID
  let pageUrl: string;

  if (trimmed.startsWith('@')) {
    pageUrl = `https://www.youtube.com/${trimmed}`;
  } else if (trimmed.startsWith('http')) {
    pageUrl = trimmed;
  } else {
    // Assume it's a handle without @
    pageUrl = `https://www.youtube.com/@${trimmed}`;
  }

  const response = await fetch(pageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Veritas Pipeline/1.0)',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube page: ${response.status} for ${pageUrl}`);
  }

  const html = await response.text();

  // Try multiple patterns YouTube uses to embed the channel ID
  // Pattern 1: <meta itemprop="identifier" content="UCxxxxxx">
  const metaMatch = html.match(/<meta\s+itemprop="identifier"\s+content="(UC[\w-]{22})"/);
  if (metaMatch) return metaMatch[1];

  // Pattern 2: "channelId":"UCxxxxxx"
  const jsonMatch = html.match(/"channelId"\s*:\s*"(UC[\w-]{22})"/);
  if (jsonMatch) return jsonMatch[1];

  // Pattern 3: /channel/UCxxxxxx anywhere in page
  const linkMatch = html.match(/\/channel\/(UC[\w-]{22})/);
  if (linkMatch) return linkMatch[1];

  throw new Error(`Could not resolve YouTube channel ID from: ${input}`);
}

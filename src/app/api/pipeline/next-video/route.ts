import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  validatePipelineSecret,
  parseYouTubeRss,
  checkDailyLimit,
} from '@/lib/pipeline-utils';

export const dynamic = 'force-dynamic';

const DAILY_VIDEO_CAP = 250;

export async function GET(req: Request) {
  // 1. Auth check
  const secret = new URL(req.url).searchParams.get('secret');
  if (!validatePipelineSecret(secret)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 2. Daily rate limit check
  const { allowed, count } = await checkDailyLimit(supabaseAdmin, DAILY_VIDEO_CAP);
  if (!allowed) {
    return NextResponse.json({
      done: true,
      reason: 'daily_limit_reached',
      count,
    });
  }

  // 3. Get stalest active channel (round-robin)
  const { data: channel, error: channelError } = await supabaseAdmin
    .from('pipeline_channels')
    .select('*')
    .eq('status', 'active')
    .eq('fetch_enabled', true)
    .order('last_fetched_at', { ascending: true, nullsFirst: true })
    .limit(1)
    .single();

  if (channelError || !channel) {
    return NextResponse.json({
      done: true,
      reason: 'no_active_channels',
    });
  }

  // 4. Fetch YouTube RSS feed
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channel_id}`;
  let rssText: string;

  try {
    const rssResponse = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Veritas Pipeline/1.0' },
    });

    if (!rssResponse.ok) {
      // Mark channel fetch time even on failure to avoid hammering a broken channel
      await supabaseAdmin
        .from('pipeline_channels')
        .update({ last_fetched_at: new Date().toISOString() })
        .eq('id', channel.id);

      return NextResponse.json({
        done: true,
        reason: 'rss_fetch_failed',
        channel: channel.channel_name,
        status: rssResponse.status,
      });
    }

    rssText = await rssResponse.text();
  } catch (err: any) {
    await supabaseAdmin
      .from('pipeline_channels')
      .update({ last_fetched_at: new Date().toISOString() })
      .eq('id', channel.id);

    return NextResponse.json({
      done: true,
      reason: 'rss_fetch_error',
      error: err.message,
    });
  }

  // 5. Parse RSS entries
  const entries = parseYouTubeRss(rssText, channel.max_video_age_days);

  if (entries.length === 0) {
    await supabaseAdmin
      .from('pipeline_channels')
      .update({ last_fetched_at: new Date().toISOString() })
      .eq('id', channel.id);

    return NextResponse.json({
      done: true,
      reason: 'no_new_videos',
      channel: channel.channel_name,
    });
  }

  // 6. Batch-check against videos table AND pipeline_jobs
  const videoIds = entries.map((e) => e.videoId);

  const [existingVideosRes, existingJobsRes] = await Promise.all([
    supabaseAdmin.from('videos').select('id').in('id', videoIds),
    supabaseAdmin
      .from('pipeline_jobs')
      .select('video_id')
      .in('video_id', videoIds)
      .in('status', [
        'completed',
        'queued',
        'fetching_transcript',
        'analyzing',
        'generating_embedding',
      ]),
  ]);

  const processedIds = new Set([
    ...(existingVideosRes.data || []).map((v) => v.id),
    ...(existingJobsRes.data || []).map((j) => j.video_id),
  ]);

  const candidate = entries.find((e) => !processedIds.has(e.videoId));

  // 7. Update last_fetched_at
  await supabaseAdmin
    .from('pipeline_channels')
    .update({ last_fetched_at: new Date().toISOString() })
    .eq('id', channel.id);

  // 8. Return candidate or done
  if (!candidate) {
    return NextResponse.json({
      done: true,
      reason: 'all_videos_processed',
      channel: channel.channel_name,
    });
  }

  return NextResponse.json({
    done: false,
    video_id: candidate.videoId,
    video_url: `https://www.youtube.com/watch?v=${candidate.videoId}`,
    channel_id: channel.channel_id,
    channel_name: channel.channel_name,
    title: candidate.title,
    published: candidate.published,
    daily_count: count,
  });
}

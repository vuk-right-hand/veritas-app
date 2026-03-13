import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  validatePipelineSecret,
  resolveYouTubeChannelId,
} from '@/lib/pipeline-utils';

export const maxDuration = 60; // Channel ID resolution involves fetching YouTube pages

interface ChannelInput {
  handle: string; // @handle, full URL, or UCxxxxxx ID
  name: string;   // Display name
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pipeline_secret, channels } = body;

    // 1. Auth
    if (!validatePipelineSecret(pipeline_secret)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return NextResponse.json(
        { error: 'channels array is required. Each item needs { handle, name }.' },
        { status: 400 }
      );
    }

    const resolved: Array<{ channel_id: string; channel_name: string; handle: string }> = [];
    const failed: Array<{ handle: string; error: string }> = [];

    // 2. Resolve each channel handle to a real UC... ID
    for (const ch of channels as ChannelInput[]) {
      if (!ch.handle || !ch.name) {
        failed.push({ handle: ch.handle || 'missing', error: 'Both handle and name are required' });
        continue;
      }

      try {
        const channelId = await resolveYouTubeChannelId(ch.handle);

        // Build a canonical URL from the resolved ID
        const channelUrl = ch.handle.startsWith('http')
          ? ch.handle
          : ch.handle.startsWith('@')
            ? `https://www.youtube.com/${ch.handle}`
            : `https://www.youtube.com/channel/${channelId}`;

        // 3. Insert into pipeline_channels
        const { error: insertError } = await supabaseAdmin
          .from('pipeline_channels')
          .upsert(
            {
              channel_id: channelId,
              channel_url: channelUrl,
              channel_name: ch.name,
              status: 'active',
              fetch_enabled: true,
            },
            { onConflict: 'channel_id' }
          );

        if (insertError) {
          failed.push({ handle: ch.handle, error: insertError.message });
        } else {
          resolved.push({
            channel_id: channelId,
            channel_name: ch.name,
            handle: ch.handle,
          });
        }
      } catch (err: any) {
        failed.push({ handle: ch.handle, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      resolved,
      failed,
      summary: `${resolved.length} channels added, ${failed.length} failed`,
    });
  } catch (error: any) {
    console.error('[Pipeline] seed error:', error);
    return NextResponse.json(
      { error: error.message || 'Seed failed' },
      { status: 500 }
    );
  }
}

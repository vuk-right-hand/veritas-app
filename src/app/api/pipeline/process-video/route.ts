import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateEmbedding1536 } from '@/lib/gemini';
import { fetchVideoMeta } from '@/lib/video-service';
import { slugify } from '@/lib/utils';
import {
  validatePipelineSecret,
  createPipelineJob,
  updatePipelineJob,
} from '@/lib/pipeline-utils';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ANALYSIS_RESPONSE_SCHEMA,
  SKILL_TAGS,
  buildAnalysisPrompt,
  parseAnalysisResult,
} from '@/lib/analysis-prompt';

export const maxDuration = 60; // Vercel Hobby tier supports up to 60s with explicit config

const SUPADATA_API_URL = 'https://api.supadata.ai/v1/youtube/transcript';
const MIN_DURATION_SECONDS = 180;     // 3 minutes — filters out YouTube Shorts (up to 3min)
const MAX_DURATION_SECONDS = 2100;    // 35 minutes

// CLASSIFICATION_ENABLED is a FULL kill switch, not a classification-only toggle.
// When false, new videos land as classification_status='pending' + feed_category=null
// and are invisible to all three feed tabs until the flag flips back on.
const CLASSIFICATION_ENABLED = process.env.CLASSIFICATION_ENABLED !== 'false';

function getPipelineAiModel() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('Missing GOOGLE_API_KEY');
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: ANALYSIS_RESPONSE_SCHEMA,
    } as any, // generationConfig type doesn't include responseSchema yet
  });
}

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { video_id, channel_id, pipeline_secret } = body;

    // 1. Auth
    if (!validatePipelineSecret(pipeline_secret)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!video_id) {
      return NextResponse.json({ error: 'video_id is required' }, { status: 400 });
    }

    // 2. Create job
    const jobId = await createPipelineJob(supabaseAdmin, video_id, channel_id);
    if (!jobId) {
      return NextResponse.json({ error: 'Failed to create pipeline job' }, { status: 500 });
    }

    // 3. Idempotency — extended from a bare existence check to also recognize
    //    videos that have already been classified or rejected, so retries from
    //    n8n don't burn Gemini calls.
    const { data: existingVideo } = await supabaseAdmin
      .from('videos')
      .select('id, classification_status')
      .eq('id', video_id)
      .single();

    if (existingVideo) {
      await updatePipelineJob(supabaseAdmin, jobId, {
        status: 'skipped_duplicate',
        processing_time_ms: Date.now() - startTime,
      });
      return NextResponse.json({
        success: true,
        status: 'skipped_duplicate',
        job_id: jobId,
        classification_status: existingVideo.classification_status ?? null,
      });
    }

    // 4. Fetch transcript from Supadata
    await updatePipelineJob(supabaseAdmin, jobId, { status: 'fetching_transcript' });

    const videoUrl = `https://www.youtube.com/watch?v=${video_id}`;
    const transcriptResponse = await fetch(
      `${SUPADATA_API_URL}?url=${encodeURIComponent(videoUrl)}`,
      {
        headers: { 'x-api-key': process.env.SUPADATA_API_KEY! },
      }
    );

    if (!transcriptResponse.ok) {
      const errData = await transcriptResponse.json().catch(() => ({}));
      await updatePipelineJob(supabaseAdmin, jobId, {
        status: 'skipped_no_transcript',
        error_message: `Supadata ${transcriptResponse.status}: ${errData.error || 'unknown'}`,
        processing_time_ms: Date.now() - startTime,
      });
      return NextResponse.json({
        success: true,
        status: 'skipped_no_transcript',
        job_id: jobId,
      });
    }

    const transcriptData = await transcriptResponse.json();

    if (!transcriptData.content || !Array.isArray(transcriptData.content) || transcriptData.content.length === 0) {
      await updatePipelineJob(supabaseAdmin, jobId, {
        status: 'skipped_no_transcript',
        error_message: 'Empty transcript from Supadata',
        processing_time_ms: Date.now() - startTime,
      });
      return NextResponse.json({
        success: true,
        status: 'skipped_no_transcript',
        job_id: jobId,
      });
    }

    const fullTranscript = transcriptData.content
      .map((segment: any) => segment.text)
      .join(' ');

    // 5. Duration check — use Supadata segment timestamps when available, fall back to word count
    const lastSegment = transcriptData.content[transcriptData.content.length - 1];
    const segmentDuration = lastSegment?.offset != null && lastSegment?.duration != null
      ? Math.round((lastSegment.offset + lastSegment.duration) / 1000) // ms → seconds
      : null;
    const wordCount = fullTranscript.split(/\s+/).length;
    const wordEstimate = Math.round((wordCount / 150) * 60);
    const estimatedDurationSeconds = segmentDuration || wordEstimate;

    await updatePipelineJob(supabaseAdmin, jobId, {
      transcript_length: fullTranscript.length,
      duration_seconds: estimatedDurationSeconds,
    });

    if (estimatedDurationSeconds < MIN_DURATION_SECONDS || estimatedDurationSeconds > MAX_DURATION_SECONDS) {
      await updatePipelineJob(supabaseAdmin, jobId, {
        status: 'skipped_duration',
        error_message: `Duration ~${Math.round(estimatedDurationSeconds / 60)}min (${segmentDuration ? 'from timestamps' : wordCount + ' words'}) outside 3-35min range`,
        processing_time_ms: Date.now() - startTime,
      });
      return NextResponse.json({
        success: true,
        status: 'skipped_duration',
        job_id: jobId,
        estimated_minutes: Math.round(estimatedDurationSeconds / 60),
      });
    }

    const truncatedTranscript = fullTranscript.substring(0, 25000);

    // 6. Fetch video metadata via oEmbed
    const meta = await fetchVideoMeta(videoUrl);
    if (!meta || !meta.youtube_id) {
      await updatePipelineJob(supabaseAdmin, jobId, {
        status: 'failed',
        error_message: 'Failed to fetch video metadata via oEmbed',
        processing_time_ms: Date.now() - startTime,
      });
      return NextResponse.json({ success: false, error: 'Metadata fetch failed', job_id: jobId });
    }

    // 6.5. Upsert channel BEFORE classification so the Zod-failure fallback
    //      insert below doesn't FK-violate on a brand-new channel. Safe to
    //      run unconditionally — even rejected videos don't insert a videos
    //      row so the channel row is harmless.
    const channelSlug = meta.channel_id;
    await supabaseAdmin
      .from('channels')
      .upsert(
        {
          youtube_channel_id: channelSlug,
          name: meta.channel_name,
          status: 'pending',
        },
        { onConflict: 'youtube_channel_id' }
      );

    // 7. Gemini analysis with structured output
    await updatePipelineJob(supabaseAdmin, jobId, { status: 'analyzing' });

    const aiModel = getPipelineAiModel();
    const prompt = buildAnalysisPrompt(truncatedTranscript, meta.published_at);
    const analysisResult = await aiModel.generateContent(prompt);
    const responseText = analysisResult.response.text();

    let rawAnalysis: any;
    try {
      rawAnalysis = JSON.parse(responseText);
    } catch {
      const cleaned = responseText.replace(/```json|```/g, '').trim();
      rawAnalysis = JSON.parse(cleaned);
    }

    // 8. Zod parse — on failure, insert a row with classification_status='failed'
    //    so the record exists but is invisible to feed readers (status stays
    //    non-verified). Recoverable via a future backfill retry.
    let analysis;
    try {
      analysis = parseAnalysisResult(rawAnalysis);
    } catch (parseErr: any) {
      console.error('[Pipeline] Zod parse failed:', parseErr?.message);
      await updatePipelineJob(supabaseAdmin, jobId, {
        status: 'failed',
        error_message: `Zod parse failed: ${parseErr?.message?.substring(0, 200) ?? 'unknown'}`,
        processing_time_ms: Date.now() - startTime,
      });
      // Insert a minimal row so the video_id is tracked but invisible
      await supabaseAdmin.from('videos').insert({
        id: video_id,
        slug: slugify(meta.title).substring(0, 100) + '-' + Math.random().toString(36).substring(2, 6),
        title: meta.title,
        channel_title: meta.channel_name,
        channel_id: meta.channel_id,
        channel_url: channel_id ? `https://www.youtube.com/channel/${channel_id}` : undefined,
        status: 'pending',
        classification_status: 'failed',
        thumbnail_url: meta.thumbnail_url,
        published_at: meta.published_at,
        suggestion_count: 0,
      });
      return NextResponse.json({
        success: false,
        status: 'failed',
        job_id: jobId,
        error: 'Analysis parse failure',
      });
    }

    // Force score 91-100 (safety net)
    if (analysis.humanScore < 91) {
      analysis.humanScore = Math.floor(Math.random() * (99 - 91 + 1) + 91);
    }
    if (analysis.humanScore > 100) analysis.humanScore = 100;

    // 9. Reject videos still get the full insert (embedding, tags, quiz) —
    //    the work is already computed in this same hop, and writing
    //    status='banned' keeps them visible in /suggested-videos Denied
    //    column for audit + pure-DB approve-anyway override.
    const isRejected = CLASSIFICATION_ENABLED && analysis.verdict === 'reject';

    // 11. Generate embedding (1536-dim, pgvector text literal)
    await updatePipelineJob(supabaseAdmin, jobId, { status: 'generating_embedding' });

    const tagsString = analysis.content_tags
      ? analysis.content_tags.map((t: any) => t.tag).join(' ')
      : '';
    const cleanContentToEmbed = `Title: ${meta.title} | Category: ${analysis.category} | Key Insights: ${analysis.takeaways.join(', ')} | Topics: ${tagsString}`;
    const embeddingVector = await generateEmbedding1536(cleanContentToEmbed);
    const embeddingLiteral = '[' + embeddingVector.join(',') + ']';

    // 12. INSERT video with slug collision handling
    let generatedSlug = slugify(meta.title).substring(0, 100);
    let insertSuccess = false;

    while (!insertSuccess) {
      const { error: insertError } = await supabaseAdmin
        .from('videos')
        .insert({
          id: video_id,
          slug: generatedSlug,
          title: meta.title,
          channel_title: meta.channel_name,
          channel_id: channelSlug,
          channel_url: channel_id ? `https://www.youtube.com/channel/${channel_id}` : undefined,
          thumbnail_url: meta.thumbnail_url,
          published_at: meta.published_at,
          status: isRejected ? 'banned' : 'verified',
          human_score: analysis.humanScore,
          summary_points: analysis.takeaways,
          category_tag: analysis.category,
          embedding_1536: embeddingLiteral,
          // Classification fields — gated by kill switch
          classification_status: CLASSIFICATION_ENABLED ? (isRejected ? 'rejected' : 'classified') : 'pending',
          feed_category: CLASSIFICATION_ENABLED ? analysis.feed_category : null,
          category_confidence: CLASSIFICATION_ENABLED ? analysis.category_confidence : null,
          category_rationale: CLASSIFICATION_ENABLED ? analysis.category_rationale : null,
          category_signals: CLASSIFICATION_ENABLED ? analysis.category_signals : null,
          suggestion_count: 0,
        });

      if (insertError) {
        if (insertError.code === '23505' && insertError.message.includes('slug')) {
          generatedSlug = `${slugify(meta.title).substring(0, 95)}-${Math.random().toString(36).substring(2, 6)}`;
          continue;
        }
        // Race with concurrent call — second caller wasted a Gemini call but
        // no data corruption. Acknowledged, handled.
        if (insertError.code === '23505') {
          await updatePipelineJob(supabaseAdmin, jobId, {
            status: 'skipped_duplicate',
            error_message: 'Video inserted by another process',
            processing_time_ms: Date.now() - startTime,
          });
          return NextResponse.json({ success: true, status: 'skipped_duplicate', job_id: jobId });
        }
        throw new Error(`Video insert failed: ${insertError.message}`);
      }
      insertSuccess = true;
    }

    // 13. INSERT content DNA tags
    if (analysis.content_tags && Array.isArray(analysis.content_tags)) {
      for (const tagData of analysis.content_tags) {
        await supabaseAdmin
          .from('video_tags')
          .upsert(
            {
              video_id: video_id,
              tag: tagData.tag.toLowerCase().replace(/\s+/g, '_'),
              weight: Math.min(10, Math.max(1, tagData.weight)),
              segment_start_pct: Math.min(100, Math.max(0, tagData.segment_start_pct)),
              segment_end_pct: Math.min(100, Math.max(0, tagData.segment_end_pct)),
            },
            { onConflict: 'video_id,tag' }
          );
      }
    }

    // 14. INSERT quiz questions
    if (analysis.quiz_questions && Array.isArray(analysis.quiz_questions)) {
      for (let i = 0; i < analysis.quiz_questions.length; i++) {
        const q = analysis.quiz_questions[i];
        const lessonNum = i + 1; // Force sequential 1-6 ordering
        await supabaseAdmin
          .from('video_quizzes')
          .upsert(
            {
              video_id: video_id,
              lesson_number: lessonNum,
              skill_tag: SKILL_TAGS.includes(q.skill_tag as any) ? q.skill_tag : 'Content Creation',
              question_text: q.question,
            },
            { onConflict: 'video_id,lesson_number' }
          );
      }
    }

    // 15. Mark job completed (or skipped_rejected — row still written)
    await updatePipelineJob(supabaseAdmin, jobId, {
      status: isRejected ? 'skipped_rejected' : 'completed',
      error_message: isRejected
        ? analysis.category_rationale?.substring(0, 500) ?? 'Rejected by classifier'
        : undefined,
      processing_time_ms: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      status: isRejected ? 'skipped_rejected' : 'completed',
      job_id: jobId,
      video_id: video_id,
      title: meta.title,
      human_score: analysis.humanScore,
      feed_category: CLASSIFICATION_ENABLED ? analysis.feed_category : null,
      processing_time_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    console.error('[Pipeline] process-video error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Pipeline processing failed',
        details: error.stack?.substring(0, 500),
      },
      { status: 500 }
    );
  }
}

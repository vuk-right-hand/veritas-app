import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateEmbedding } from '@/lib/gemini';
import { fetchVideoMeta } from '@/lib/video-service';
import { slugify } from '@/lib/utils';
import {
  validatePipelineSecret,
  createPipelineJob,
  updatePipelineJob,
} from '@/lib/pipeline-utils';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60; // Vercel Hobby tier supports up to 60s with explicit config

const SUPADATA_API_URL = 'https://api.supadata.ai/v1/youtube/transcript';
const MIN_DURATION_SECONDS = 60;      // 1 minute
const MAX_DURATION_SECONDS = 2100;    // 35 minutes

const SKILL_TAGS = [
  'Sales', 'Copywriting', 'Marketing Psychology', 'AI/Automation',
  'Content Creation', 'Outreach', 'Time Management', 'VibeCoding/Architecture',
];

// Structured output schema for Gemini
const ANALYSIS_SCHEMA = {
  type: 'object' as const,
  properties: {
    humanScore: { type: 'number' as const },
    humanScoreReason: { type: 'string' as const },
    takeaways: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    category: { type: 'string' as const },
    content_tags: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          tag: { type: 'string' as const },
          weight: { type: 'number' as const },
          segment_start_pct: { type: 'number' as const },
          segment_end_pct: { type: 'number' as const },
        },
        required: ['tag', 'weight', 'segment_start_pct', 'segment_end_pct'] as const,
      },
    },
    quiz_questions: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          lesson_number: { type: 'number' as const },
          skill_tag: { type: 'string' as const },
          question: { type: 'string' as const },
        },
        required: ['lesson_number', 'skill_tag', 'question'] as const,
      },
    },
  },
  required: ['humanScore', 'humanScoreReason', 'takeaways', 'category', 'content_tags', 'quiz_questions'] as const,
};

function getPipelineAiModel() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('Missing GOOGLE_API_KEY');
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
      responseSchema: ANALYSIS_SCHEMA,
    } as any, // generationConfig type doesn't include responseSchema yet
  });
}

// The same battle-tested prompt from /api/analyze
function buildAnalysisPrompt(transcript: string): string {
  return `
Analyze this YouTube video transcript.

Goal 1: Calculate a "Human Verification Score" (0-100).
- CRITICAL: For verified/high-quality content (which this is), the score MUST be between 91 and 100.
- 91-99: Excellent, authentic, high signal.
- 100: Absolute masterpiece, purely human, deeply rigorous.
- NEVER return a score below 91 for this specific task.

Goal 2: Extract 3 specific, high-value Key Lessons.
- STYLE: Curiosity-Driven & Benefit-Oriented.
- LENGTH: Each lesson MUST be 75 characters or less (including spaces/punctuation).
- Do NOT just summarize. Tease the value.
- BAD: "He talks about being consistent."
- GOOD: "The 'Rule of 100' framework that guarantees your first result."
- GOOD: "Why 'Shallow Work' destroys careers (and the fix)."
- Make the user feel they *must* watch to get the full secret.
- Look for specific frameworks, numbers, or unique insights.
- Keep it punchy and concise - single line per lesson!

Goal 3: Determine the "Vibe" category (e.g., Productivity, Mindset, Sales, Coding).

Goal 4: Extract exactly 3 "Content DNA" tags for interest-based scoring.
- Each tag is a lowercase_slug (e.g., cold_approach, dating, business_mindset, morning_routine).
- Keep tags broad enough to be reusable across videos, but specific enough to be meaningful.
- Assign weights: the primary/dominant topic = 10, secondary = 8, tertiary = 5.
- For each tag, estimate what percentage range of the video discusses that topic.
  Use segment_start_pct (0-100) and segment_end_pct (0-100).
  These can overlap if topics are interwoven.

Goal 5: Generate EXACTLY 6 "Proof of Work" Questions.
- CRITICAL: YOU MUST GENERATE EXACTLY 6 QUESTIONS. DO NOT GENERATE 3. DO NOT GENERATE 5. EXACTLY 6.
- Convert the essence of the lessons into 6 UNIQUE, open-ended application questions.
- Draw from the full context of the video to create 6 varied questions.
- The questions must force the user to apply the concept to their own business, life, or workflow.
- Do NOT ask "What did the video say?" Ask "How would you use this to..."
- You MUST assign one of these exact 'Skill Tags' to each question: ['Sales', 'Copywriting', 'Marketing Psychology', 'AI/Automation', 'Content Creation', 'Outreach', 'Time Management', 'VibeCoding/Architecture'].
- Questions must be SHORT and punchy. MAXIMUM 15 WORDS per question. No fluff.
- Do NOT start with "Based on..." or "According to..." — just ask directly.
- Number them exactly 1, 2, 3, 4, 5, and 6 via the "lesson_number" field.

Transcript:
"${transcript}"
`;
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

    // 3. Duplicate check
    const { data: existingVideo } = await supabaseAdmin
      .from('videos')
      .select('id')
      .eq('id', video_id)
      .single();

    if (existingVideo) {
      await updatePipelineJob(supabaseAdmin, jobId, {
        status: 'skipped_duplicate',
        processing_time_ms: Date.now() - startTime,
      });
      return NextResponse.json({ success: true, status: 'skipped_duplicate', job_id: jobId });
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

    // 5. Duration check (estimate from transcript length if Supadata doesn't return duration)
    // Average speaking rate: ~150 words/min. If transcript is too short or too long, skip.
    const wordCount = fullTranscript.split(/\s+/).length;
    const estimatedDurationSeconds = Math.round((wordCount / 150) * 60);

    await updatePipelineJob(supabaseAdmin, jobId, {
      transcript_length: fullTranscript.length,
      duration_seconds: estimatedDurationSeconds,
    });

    if (estimatedDurationSeconds < MIN_DURATION_SECONDS || estimatedDurationSeconds > MAX_DURATION_SECONDS) {
      await updatePipelineJob(supabaseAdmin, jobId, {
        status: 'skipped_duration',
        error_message: `Estimated duration ${Math.round(estimatedDurationSeconds / 60)}min (${wordCount} words) outside 1-35min range`,
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

    // 7. Gemini analysis with structured output
    await updatePipelineJob(supabaseAdmin, jobId, { status: 'analyzing' });

    const aiModel = getPipelineAiModel();
    const prompt = buildAnalysisPrompt(truncatedTranscript);
    const analysisResult = await aiModel.generateContent(prompt);
    const responseText = analysisResult.response.text();

    let analysis: any;
    try {
      // With responseMimeType: "application/json", Gemini should return pure JSON
      analysis = JSON.parse(responseText);
    } catch {
      // Fallback: try stripping markdown code fences
      const cleaned = responseText.replace(/```json|```/g, '').trim();
      analysis = JSON.parse(cleaned);
    }

    // Force score 91-100 (safety net)
    if (analysis.humanScore < 91) {
      analysis.humanScore = Math.floor(Math.random() * (99 - 91 + 1) + 91);
    }
    if (analysis.humanScore > 100) analysis.humanScore = 100;

    // 8. Generate embedding
    await updatePipelineJob(supabaseAdmin, jobId, { status: 'generating_embedding' });

    const tagsString = analysis.content_tags
      ? analysis.content_tags.map((t: any) => t.tag).join(' ')
      : '';
    const cleanContentToEmbed = `Title: ${meta.title} | Category: ${analysis.category} | Key Insights: ${analysis.takeaways.join(', ')} | Topics: ${tagsString}`;
    const embeddingVector = await generateEmbedding(cleanContentToEmbed);

    // 9. Upsert channel (FK requirement)
    const channelSlug = meta.channel_id; // slugified channel name from fetchVideoMeta
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

    // 10. INSERT video with slug collision handling
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
          status: 'verified', // Pipeline videos are auto-verified
          human_score: analysis.humanScore,
          summary_points: analysis.takeaways,
          category_tag: analysis.category,
          embedding: embeddingVector,
          suggestion_count: 0,
        });

      if (insertError) {
        if (insertError.code === '23505' && insertError.message.includes('slug')) {
          generatedSlug = `${slugify(meta.title).substring(0, 95)}-${Math.random().toString(36).substring(2, 6)}`;
          continue;
        }
        // If it's a true duplicate video (race condition), mark as duplicate
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

    // 11. INSERT content DNA tags
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

    // 12. INSERT quiz questions
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
              skill_tag: SKILL_TAGS.includes(q.skill_tag) ? q.skill_tag : 'Content Creation',
              question_text: q.question,
            },
            { onConflict: 'video_id,lesson_number' }
          );
      }
    }

    // 13. Mark job completed
    await updatePipelineJob(supabaseAdmin, jobId, {
      status: 'completed',
      processing_time_ms: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      status: 'completed',
      job_id: jobId,
      video_id: video_id,
      title: meta.title,
      human_score: analysis.humanScore,
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

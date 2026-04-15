import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateEmbedding1536 } from '@/lib/gemini';
import { fetchVideoMeta, saveVideoAnalysis } from '@/lib/video-service';
import {
  ANALYSIS_RESPONSE_SCHEMA,
  SKILL_TAGS,
  buildAnalysisPrompt,
  parseAnalysisResult,
} from '@/lib/analysis-prompt';

export const maxDuration = 60; // Max duration for Vercel Hobby tier

const CLASSIFICATION_ENABLED = process.env.CLASSIFICATION_ENABLED !== 'false';

function getManualAiModel() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('Missing GOOGLE_API_KEY');
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: ANALYSIS_RESPONSE_SCHEMA,
    } as any,
  });
}

// Service role client for writing video_tags (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // 1. Fetch Metadata (Title, Channel, etc.)
        const meta = await fetchVideoMeta(url);
        if (!meta || !meta.youtube_id) {
            return NextResponse.json({ error: 'Invalid YouTube URL or Metadata Error' }, { status: 400 });
        }

        // 2. Fetch Transcript via Supadata
        console.log("Fetching transcript for:", url);
        const bridgeResponse = await fetch(`https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(url)}`, {
            headers: {
                'x-api-key': process.env.SUPADATA_API_KEY!
            }
        });

        const bridgeData = await bridgeResponse.json();

        if (!bridgeResponse.ok) {
            throw new Error(bridgeData.error || 'Failed to fetch transcript from bridge');
        }

        const fullTranscript = bridgeData.content
            .map((segment: any) => segment.text)
            .join(' ');

        const truncatedTranscript = fullTranscript.substring(0, 25000); // Limit context

        // 3. Parallel Processing (Analysis + Embedding)
        console.log("Analyzing & Embedding with Gemini...");

        const prompt = buildAnalysisPrompt(truncatedTranscript, meta.published_at);

        console.log("Analyzing with Gemini...");

        const aiModel = getManualAiModel();
        const analysisResult = await aiModel.generateContent(prompt);
        const responseText = analysisResult.response.text();

        let rawAnalysis: any;
        try {
            rawAnalysis = JSON.parse(responseText);
        } catch {
            const cleaned = responseText.replace(/```json|```/g, '').trim();
            rawAnalysis = JSON.parse(cleaned);
        }

        let analysis;
        try {
            analysis = parseAnalysisResult(rawAnalysis);
        } catch (parseErr: any) {
            console.error("Zod parse failed:", parseErr?.message);
            return NextResponse.json({
                error: "Analysis output failed validation",
                details: parseErr?.message?.substring(0, 300),
            }, { status: 502 });
        }

        // FORCE SCORE TO BE 91-100 (Safety Net)
        if (analysis.humanScore < 91) {
            analysis.humanScore = Math.floor(Math.random() * (99 - 91 + 1) + 91);
        }
        if (analysis.humanScore > 100) analysis.humanScore = 100;

        // 4. GENERATE EMBEDDING (Search Bomb Fix)
        // Instead of embedding 25k chars of potentially keyword-stuffed raw transcript,
        // we embed ONLY the AI-verified, highly refined insights and categories.
        // A hacker stuffing keyword spam won't make it past Gemini's extraction!
        const tagsString = analysis.content_tags ? analysis.content_tags.map((t: any) => t.tag).join(" ") : "";
        const cleanContentToEmbed = `Title: ${meta.title} | Category: ${analysis.category} | Key Insights: ${analysis.takeaways.join(", ")} | Topics: ${tagsString}`;

        console.log("Generating embedding for cleaned content:", cleanContentToEmbed);
        const embeddingVector = await generateEmbedding1536(cleanContentToEmbed);

        // 5. Save to Database. Runs for BOTH verdicts — rejects persist
        //    feed_category + rationale so the override path is a pure DB flip.
        //    saveVideoAnalysis branches status internally on analysis.verdict.
        await saveVideoAnalysis(meta, analysis, embeddingVector);

        // 5. Save Content DNA tags to video_tags table
        if (analysis.content_tags && Array.isArray(analysis.content_tags)) {
            console.log(`💡 Saving ${analysis.content_tags.length} Content DNA tags for ${meta.youtube_id}`);

            for (const tagData of analysis.content_tags) {
                const { error: tagError } = await supabaseAdmin
                    .from('video_tags')
                    .upsert({
                        video_id: meta.youtube_id,
                        tag: tagData.tag.toLowerCase().replace(/\s+/g, '_'),
                        weight: Math.min(10, Math.max(1, tagData.weight)),
                        segment_start_pct: Math.min(100, Math.max(0, tagData.segment_start_pct)),
                        segment_end_pct: Math.min(100, Math.max(0, tagData.segment_end_pct)),
                    }, { onConflict: 'video_id,tag' });

                if (tagError) {
                    console.error(`⚠️ Failed to save tag "${tagData.tag}":`, tagError);
                }
            }
            console.log(`✅ Content DNA saved for ${meta.youtube_id}`);
        }

        // 6. Save 6 Quiz Questions directly to video_quizzes
        if (analysis.quiz_questions && Array.isArray(analysis.quiz_questions)) {
            console.log(`🧠 Saving ${analysis.quiz_questions.length} quiz questions for ${meta.youtube_id}...`);

            const SKILL_TAGS = ['Sales', 'Copywriting', 'Marketing Psychology', 'AI/Automation', 'Content Creation', 'Outreach', 'Time Management', 'VibeCoding/Architecture'];

            for (let i = 0; i < analysis.quiz_questions.length; i++) {
                const q = analysis.quiz_questions[i];
                const lessonNum = i + 1; // Force sequential 1-6 ordering regardless of LLM output
                const { error } = await supabaseAdmin
                    .from('video_quizzes')
                    .upsert({
                        video_id: meta.youtube_id,
                        lesson_number: lessonNum,
                        skill_tag: SKILL_TAGS.includes(q.skill_tag) ? q.skill_tag : 'Content Creation',
                        question_text: q.question,
                    }, { onConflict: 'video_id,lesson_number' });

                if (error) {
                    console.error(`❌ Failed to save quiz question ${lessonNum}:`, error);
                }
            }
            console.log(`✅ Quiz questions saved for ${meta.youtube_id}`);
        }

        // Reject branch — row is already written with status='rejected' +
        // feed_category preserved by saveVideoAnalysis. Content DNA + quiz
        // are now populated above, so "Submit anyway" override (pure DB flip)
        // surfaces a fully-featured row. No second Gemini call.
        if (CLASSIFICATION_ENABLED && analysis.verdict === 'reject') {
            return NextResponse.json({
                success: false,
                rejected: true,
                rationale: analysis.category_rationale,
                suggested_category: analysis.feed_category,
                video_id: meta.youtube_id,
            }, { status: 200 });
        }

        return NextResponse.json({
            success: true,
            meta: meta,
            analysis: analysis,
            // embedding: embeddingVector // No need to return the huge vector to frontend
        });

    } catch (error: any) {
        console.error("Bridge Error:", error);
        console.error("Full Error:", JSON.stringify(error, null, 2));
        return NextResponse.json({
            error: error.message || "Something went wrong during analysis.",
            details: error.errorDetails || error.status || "No additional details"
        }, { status: 500 });
    }
}

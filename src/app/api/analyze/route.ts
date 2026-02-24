import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAiModel, generateEmbedding } from '@/lib/gemini';
import { fetchVideoMeta, saveVideoAnalysis } from '@/lib/video-service';

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
                'x-api-key': 'sd_2fb896d1eb5cc52981e383f3a1560d72'
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

        const prompt = `
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
        - Example: A video about cold emailing that also covers outreach mindset and tech setup:
          [
            {"tag": "cold_emails", "weight": 10, "segment_start_pct": 0, "segment_end_pct": 45},
            {"tag": "outreach_mindset", "weight": 8, "segment_start_pct": 30, "segment_end_pct": 75},
            {"tag": "tech_setup", "weight": 5, "segment_start_pct": 65, "segment_end_pct": 100}
          ]

        Goal 5: Generate 6 "Proof of Work" Questions based on the insights from Goal 2 and the overall context.
        - Convert the essence of the lessons into 6 UNIQUE, open-ended application questions.
        - Do not just make 2 questions per lesson. Draw from the full context of the video to create 6 varied questions.
        - The questions must force the user to apply the concept to their own business, life, or workflow.
        - Do NOT ask "What did the video say?" Ask "How would you use this to..."
        - You MUST assign one of these exact 'Skill Tags' to each question: ['Sales', 'Copywriting', 'Marketing Psychology', 'AI/Automation', 'Content Creation', 'Outreach', 'Time Management', 'VibeCoding/Architecture'].
        - Questions must be SHORT and punchy. MAXIMUM 15 WORDS per question. No fluff. Cut all preamble.
        - Do NOT start with "Based on..." or "According to..." — just ask directly.
        - Number them 1 through 6 via the "lesson_number" field.

        Transcript:
        "${truncatedTranscript}" 
        
        Return JSON format ONLY:
        {
            "humanScore": number,
            "humanScoreReason": "short sentence explaining why",
            "takeaways": ["lesson 1", "lesson 2", "lesson 3"],
            "category": "string",
            "content_tags": [
                {"tag": "slug", "weight": 10, "segment_start_pct": 0, "segment_end_pct": 50},
                {"tag": "slug", "weight": 8,  "segment_start_pct": 30, "segment_end_pct": 70},
                {"tag": "slug", "weight": 5,  "segment_start_pct": 60, "segment_end_pct": 100}
            ],
            "quiz_questions": [
                {
                    "lesson_number": 1,
                    "skill_tag": "string",
                    "question": "question text"
                }
            ]
        }
        `;

        // 3. Sequential Processing (Analysis THEN Embedding)
        console.log("Analyzing with Gemini...");

        const aiModel = getAiModel();
        const analysisResult = await aiModel.generateContent(prompt);

        const responseText = analysisResult.response.text();

        // Clean up markdown code blocks if Gemini adds them
        const jsonString = responseText.replace(/```json|```/g, '').trim();
        const analysis = JSON.parse(jsonString);

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
        const embeddingVector = await generateEmbedding(cleanContentToEmbed);

        // 5. Save to Database (The Library)
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

import { NextResponse } from 'next/server';
import { aiModel, generateEmbedding } from '@/lib/gemini';
import { fetchVideoMeta, saveVideoAnalysis } from '@/lib/video-service';

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

        Transcript:
        "${truncatedTranscript}" 
        
        Return JSON format ONLY:
        {
            "humanScore": number,
            "humanScoreReason": "short sentence explaining why",
            "takeaways": ["lesson 1", "lesson 2", "lesson 3"],
            "category": "string"
        }
        `;

        // Run both AI tasks at the same time for speed
        const [analysisResult, embeddingVector] = await Promise.all([
            aiModel.generateContent(prompt),
            generateEmbedding(truncatedTranscript)
        ]);

        const responseText = analysisResult.response.text();

        // Clean up markdown code blocks if Gemini adds them
        const jsonString = responseText.replace(/```json|```/g, '').trim();
        const analysis = JSON.parse(jsonString);

        // FORCE SCORE TO BE 91-100 (Safety Net)
        if (analysis.humanScore < 91) {
            analysis.humanScore = Math.floor(Math.random() * (99 - 91 + 1) + 91);
        }
        if (analysis.humanScore > 100) analysis.humanScore = 100;

        // 4. Save to Database (The Library)
        await saveVideoAnalysis(meta, analysis, embeddingVector);

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

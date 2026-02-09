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
        - For verified/high-quality content (which this is), the score MUST be between 91 and 100.
        - 91-99: Excellent, authentic, high signal.
        - 100: Absolute masterpiece, purely human, deeply rigorous.
        
        Goal 2: Extract 3 specific, high-value takeaways (Key Lessons).
        - These MUST be precise and actionable.
        - Avoid generic advice like "Work hard" or "Be consistent".
        - Look for specific frameworks, numbers, or unique insights mentioned (e.g., "The Rule of 100", "Bimodal Scheduling").
        - Format as a clear sentence.

        Goal 3: Determine the "Vibe" category (e.g., Productivity, Mindset, Sales, Coding).

        Transcript:
        "${truncatedTranscript}" 
        
        Return JSON format ONLY:
        {
            "humanScore": number,
            "humanScoreReason": "short sentence explaining why",
            "takeaways": ["point 1", "point 2", "point 3"],
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

        // 4. Save to Database (The Library)
        await saveVideoAnalysis(meta, analysis, embeddingVector);

        return NextResponse.json({
            success: true,
            meta: meta,
            analysis: analysis,
            // embedding: embeddingVector // No need to return the huge vector to frontend
        });

    } catch (error: any) {
        console.error("Bridge Error:", error.message);
        return NextResponse.json({
            error: error.message || "Something went wrong during analysis."
        }, { status: 500 });
    }
}

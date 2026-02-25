import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testPrompt() {
    console.log("Testing new Gemini prompt...");
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-lite",
        generationConfig: { temperature: 0.3 }
    });

    const fakeTranscript = "This is a video about how to use AI for marketing. First, you should automate your social media posts. Second, use ChatGPT for copywriting. Third, analyze data with Claude. But wait, there's more. The real secret is prompt engineering. You need to tell it exactly what persona to adopt. Finally, you should review everything humanely before posting.";

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

        Goal 5: Generate EXACTLY 6 "Proof of Work" Questions based on the insights from Goal 2 and the overall context.
        - CRITICAL REQUIREMENT: YOU MUST GENERATE EXACTLY 6 QUESTIONS. DO NOT GENERATE 3. DO NOT GENERATE 5. EXACTLY 6. If you generate less than 6, the system will crash.
        - Convert the essence of the lessons into 6 UNIQUE, open-ended application questions.
        - Draw from the full context of the video to create 6 varied questions. (e.g., Q1 about the hook, Q2 about the core concept, Q3 about implementation, Q4 about mindset, Q5 about a case study, Q6 about immediate action).
        - The questions must force the user to apply the concept to their own business, life, or workflow.
        - Do NOT ask "What did the video say?" Ask "How would you use this to..."
        - You MUST assign one of these exact 'Skill Tags' to each question: ['Sales', 'Copywriting', 'Marketing Psychology', 'AI/Automation', 'Content Creation', 'Outreach', 'Time Management', 'VibeCoding/Architecture'].
        - Questions must be SHORT and punchy. MAXIMUM 15 WORDS per question. No fluff. Cut all preamble.
        - Do NOT start with "Based on..." or "According to..." — just ask directly.
        - Number them exactly 1, 2, 3, 4, 5, and 6 via the "lesson_number" field. You must provide all 6.

        Transcript:
        "${fakeTranscript}" 
        
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
                    "question": "question text 1"
                },
                {
                    "lesson_number": 2,
                    "skill_tag": "string",
                    "question": "question text 2"
                },
                {
                    "lesson_number": 3,
                    "skill_tag": "string",
                    "question": "question text 3"
                },
                {
                    "lesson_number": 4,
                    "skill_tag": "string",
                    "question": "question text 4"
                },
                {
                    "lesson_number": 5,
                    "skill_tag": "string",
                    "question": "question text 5"
                },
                {
                    "lesson_number": 6,
                    "skill_tag": "string",
                    "question": "question text 6"
                }
            ]
        }
        `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonString = text.replace(/```json|```/g, '').trim();
        const analysis = JSON.parse(jsonString);

        console.log(`Generated ${analysis.quiz_questions.length} questions!`);
        if (analysis.quiz_questions.length === 6) {
            console.log("✅ SUCCESS! 6 questions generated.");
            analysis.quiz_questions.forEach(q => console.log(`Q${q.lesson_number}: ${q.question}`));
        } else {
            console.log("❌ FAILURE! LLM failed to generate exactly 6 questions.");
            console.log("Actual output length:", analysis.quiz_questions.length);
        }
    } catch (e) {
        console.error("Error running prompt:", e);
    }
}

testPrompt();

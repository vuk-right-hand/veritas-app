import { GoogleGenerativeAI } from "@google/generative-ai";

const getGenAI = () => {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error("Missing GOOGLE_API_KEY environment variable. Have you added it to Vercel?");
    }
    return new GoogleGenerativeAI(apiKey);
};

// We use the 'gemini-1.5-flash' model for speed and efficiency
// It creates the model instance we'll use throughout the app
export const getAiModel = () => {
    return getGenAI().getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: {
            // Force the AI to be more deterministic (less random) for scoring
            temperature: 0.3,
        }
    });
};

// Lightweight model for quiz grading & question generation (token-efficient)
export const getQuizAiModel = () => {
    return getGenAI().getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: {
            temperature: 0.4,
        }
    });
};

// Model specifically for creating vector embeddings
// "embedding-001" returns 768 dims normally? NO, user tests show 3072.
// We stick to what works: "embedding-001"
export async function generateEmbedding(text: string): Promise<number[]> {
    const embeddingModel = getGenAI().getGenerativeModel({ model: "models/gemini-embedding-001" });
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
}

// 1536-dim embeddings via REST. @google/generative-ai@0.24.1 does NOT expose
// outputDimensionality on embedContent (verified in the SDK's d.ts — only
// content, taskType, title). Gemini's REST endpoint has supported it since
// early 2024, so we bypass the SDK for this path only. generateContent still
// uses the SDK — smaller blast radius, no dependency swap.
export async function generateEmbedding1536(text: string): Promise<number[]> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error("Missing GOOGLE_API_KEY environment variable. Have you added it to Vercel?");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            // model field is required in the body in addition to the URL path
            // for gemini-embedding-001:embedContent — omitting it returns a
            // cryptic 400 on some API versions.
            model: 'models/gemini-embedding-001',
            content: { parts: [{ text }] },
            outputDimensionality: 1536,
        }),
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '<no body>');
        throw new Error(`Gemini embedContent failed (${res.status}): ${errText}`);
    }

    const data: any = await res.json();
    const values: number[] | undefined = data?.embedding?.values;
    if (!Array.isArray(values) || values.length !== 1536) {
        throw new Error(`Gemini embedContent returned unexpected shape (len=${values?.length ?? 'undefined'})`);
    }
    return values;
}

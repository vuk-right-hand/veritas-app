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
        model: "gemini-2.5-flash",
        generationConfig: {
            // Force the AI to be more deterministic (less random) for scoring
            temperature: 0.3,
        }
    });
};

// Lightweight model for quiz grading & question generation (token-efficient)
export const getQuizAiModel = () => {
    return getGenAI().getGenerativeModel({
        model: "gemini-2.5-flash",
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

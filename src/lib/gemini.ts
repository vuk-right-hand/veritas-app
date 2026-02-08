import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
    throw new Error("Missing GOOGLE_API_KEY environment variable");
}

const genAI = new GoogleGenerativeAI(apiKey);

// We use the 'gemini-1.5-flash' model for speed and efficiency
// It creates the model instance we'll use throughout the app
export const aiModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
        // Force the AI to be more deterministic (less random) for scoring
        temperature: 0.3,
    }
});

// Model specifically for creating vector embeddings
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

export async function generateEmbedding(text: string): Promise<number[]> {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
}

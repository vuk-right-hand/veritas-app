const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

const googleKey = process.env.GOOGLE_API_KEY;
console.log("API Key present:", !!googleKey);

const genAI = new GoogleGenerativeAI(googleKey);
const embeddingModel = genAI.getGenerativeModel({ model: "models/gemini-embedding-001" });

async function run() {
    console.log("--- Test 1: 'Hello world' ---");
    try {
        const result1 = await embeddingModel.embedContent("Hello world");
        console.log("SUCCESS! Dimensions:", result1.embedding.values.length);
    } catch (e) {
        console.error("Test 1 FAILED:", e.message);
    }

    const text = "Title: The 5 levels of business in 12 minutes. Category: Business. Summary: ";
    console.log(`\n--- Test 2: Actual Text (${text.length} chars) ---`);
    console.log(`Payload: "${text}"`);

    try {
        const result = await embeddingModel.embedContent(text);
        console.log("SUCCESS! Dimensions:", result.embedding.values.length);
    } catch (e) {
        console.error("Test 2 FAILED Message:", e.message);
        console.error("Test 2 FAILED Status:", e.status);
    }
}

run();

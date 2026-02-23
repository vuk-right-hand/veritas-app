const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

const googleKey = process.env.GOOGLE_API_KEY;

if (!googleKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(googleKey);

async function list() {
    try {
        console.log("Testing known embedding models...");

        const candidates = [
            "embedding-001",
            "models/embedding-001",
            "gemini-embedding-001"
        ];

        for (const m of candidates) {
            try {
                const model = genAI.getGenerativeModel({ model: m });
                const result = await model.embedContent("Hello world");
                console.log(`[OK] Model: "${m}" -> Dimensions: ${result.embedding.values.length}`);
            } catch (e) {
                console.log(`[FAIL] Model: "${m}" -> ${e.message ? e.message.split('\n')[0] : e}`);
            }
        }

    } catch (e) {
        console.error(e);
    }
}

list();

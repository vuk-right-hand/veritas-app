const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

const googleKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(googleKey);
const model = genAI.getGenerativeModel({ model: "embedding-001" });

const variations = [
    { name: "Hello world", text: "Hello world" },
    { name: "Hello business", text: "Hello business" },
    { name: "Business", text: "Business" },
    { name: "The cat sat", text: "The cat sat" },
    { name: "cat", text: "cat" },
    { name: "The 5 levels of business in 12 minutes", text: "The 5 levels of business in 12 minutes" },
    { name: "Short nonsense", text: "asdf" },
    { name: "Longer nonsense", text: "asdf ".repeat(5) }
];

async function run() {
    console.log("Starting Semantic Payload Debug...");

    for (const v of variations) {
        try {
            const result = await model.embedContent(v.text);
            console.log(`[PASS] ${v.name} (${result.embedding.values.length})`);
        } catch (e) {
            console.log(`[FAIL] ${v.name} - ${e.message.split('\n')[0]} (Status: ${e.status})`);
        }
    }
}

run();

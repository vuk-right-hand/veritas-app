const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

const googleKey = process.env.GOOGLE_API_KEY;
console.log("API Key present:", !!googleKey);

const genAI = new GoogleGenerativeAI(googleKey);

const strategies = [
    "embedding-001",
    "models/embedding-001",
    "text-embedding-004",
    "models/text-embedding-004"
];

const payloads = [
    { name: "Short", text: "Hello world" },
    { name: "Long", text: "Title: The 5 levels of business in 12 minutes. Category: Business. Summary: " }
];

async function run() {
    for (const modelName of strategies) {
        console.log(`\n=== Testing Model: ${modelName} ===`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });

            for (const payload of payloads) {
                try {
                    console.log(`  Payload: ${payload.name} (${payload.text.length} chars)`);
                    const result = await model.embedContent(payload.text);
                    console.log(`    SUCCESS! Dimensions: ${result.embedding.values.length}`);
                } catch (e) {
                    console.log(`    FAILED: ${e.message.split('\n')[0]} (Status: ${e.status})`);
                    // console.log(JSON.stringify(e, null, 2)); 
                }
            }
        } catch (e) {
            console.log(`  Model Init Failed: ${e.message}`);
        }
    }
}

run();

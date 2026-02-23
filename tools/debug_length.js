const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

const googleKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(googleKey);
const model = genAI.getGenerativeModel({ model: "embedding-001" });

async function run() {
    console.log("Starting Length Debug...");

    // Create strings of increasing length
    const lengths = [10, 20, 30, 40, 50, 60, 70, 80, 100];

    for (const len of lengths) {
        const text = "a".repeat(len);
        try {
            const result = await model.embedContent(text);
            console.log(`[PASS] Length ${len}`);
        } catch (e) {
            console.log(`[FAIL] Length ${len} - ${e.message.split('\n')[0]}`);
        }
    }
}

run();

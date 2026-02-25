import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function listModels() {
    console.log("Fetching models...");
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            data.models.forEach(m => console.log(m.name, m.supportedGenerationMethods.includes('generateContent') ? '(generate)' : ''));
        } else {
            console.log("No models found or error:", data);
        }
    } catch (e) {
        console.error(e);
    }
}

listModels();

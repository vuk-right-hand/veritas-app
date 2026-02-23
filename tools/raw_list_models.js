const https = require('https');
require('dotenv').config({ path: '.env.local' });

const key = process.env.GOOGLE_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

console.log("Fetching models from:", url.replace(key, 'HIDDEN_KEY'));

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.error("API Error:", json.error);
                return;
            }
            if (!json.models) {
                console.log("No models found in response:", json);
                return;
            }

            console.log(`Found ${json.models.length} models.`);

            // Filter for embedding models
            const embeddingModels = json.models.filter(m =>
                m.name.includes('embed') ||
                m.supportedGenerationMethods.includes('embedContent')
            );

            console.log("\n--- Embedding Models ---");
            embeddingModels.forEach(m => {
                console.log(`Name: ${m.name}`);
                console.log(`DisplayName: ${m.displayName}`);
                console.log(`Methods: ${m.supportedGenerationMethods.join(', ')}`);
                console.log(`Input Limit: ${m.inputTokenLimit}`);
                console.log("---");
            });

        } catch (e) {
            console.error("Parse Error:", e);
            console.log("Raw Data:", data);
        }
    });
}).on('error', (e) => {
    console.error("Request Error:", e);
});

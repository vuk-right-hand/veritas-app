// Test script to find YouTube publish date in HTML
const videoId = "hJKe5P9y6V4"; // Test video

async function testYouTubeMetadata() {
    try {
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const html = await response.text();

        console.log("\n=== SEARCHING FOR PUBLISH DATE ===\n");

        // YouTube embeds data in <script> tags with ytInitialData or ytInitialPlayerResponse
        // Look for publishDate in these JSON blobs

        // Pattern 1: Look for "publishDate" in the entire HTML
        const publishDateMatches = [...html.matchAll(/"publishDate":"([^"]+)"/g)];
        if (publishDateMatches.length > 0) {
            console.log("✅ Found publishDate fields:");
            publishDateMatches.forEach((match, i) => {
                console.log(`   [${i + 1}] ${match[1]}`);
            });
        }

        // Pattern 2: Look for uploadDate
        const uploadDateMatches = [...html.matchAll(/"uploadDate":"([^"]+)"/g)];
        if (uploadDateMatches.length > 0) {
            console.log("✅ Found uploadDate fields:");
            uploadDateMatches.forEach((match, i) => {
                console.log(`   [${i + 1}] ${match[1]}`);
            });
        }

        // Pattern 3: Extract ytInitialData and look inside
        const ytInitialDataMatch = html.match(/var ytInitialData = ({.*?});/s);
        if (ytInitialDataMatch) {
            try {
                const ytData = JSON.parse(ytInitialDataMatch[1]);
                console.log("✅ Found ytInitialData - searching for dates...");
                const dataStr = JSON.stringify(ytData);
                const dateMatch = dataStr.match(/"publishDate":"([^"]+)"/);
                if (dateMatch) {
                    console.log(`   → publishDate: ${dateMatch[1]}`);
                }
            } catch (e) {
                console.log("   ⚠️  Could not parse ytInitialData");
            }
        }

        console.log("\n=== TEST COMPLETE ===\n");

    } catch (error) {
        console.error("Error:", error.message);
    }
}

testYouTubeMetadata();

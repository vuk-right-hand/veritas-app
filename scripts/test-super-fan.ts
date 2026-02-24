
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables immediately
const envPath = resolve(process.cwd(), '.env.local');
console.log(`Loading env from: ${envPath}`);
config({ path: envPath });

async function main() {
    // Dynamic import to ensure env vars are loaded first
    const { getVerifiedVideos, getPendingVideos } = await import('../src/app/actions/video-actions');

    console.log("1. Fetching a video to test with...");
    let videos = await getVerifiedVideos();

    if (videos.length === 0) {
        console.log("No verified videos found, trying pending...");
        videos = await getPendingVideos();
    }

    if (videos.length === 0) {
        console.error("No videos found in DB. Cannot test.");
        return;
    }

    const video = videos[0];
    console.log(`Found video: ${video.title} (ID: ${video.id})`);

    console.log("2. Test script previously logged watch time here but action is removed.");
    console.log("SUCCESS: Video fetched successfully.");
}

main().catch(console.error);


import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables immediately
const envPath = resolve(process.cwd(), '.env.local');
console.log(`Loading env from: ${envPath}`);
config({ path: envPath });

async function main() {
    // Dynamic import to ensure env vars are loaded first
    const { getVerifiedVideos, logWatchTime, getPendingVideos } = await import('../src/app/actions/video-actions');

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

    console.log("2. Logging 120 seconds of watch time...");
    const result = await logWatchTime(video.id, 120);

    if (result.success) {
        console.log("SUCCESS: Watch time logged!");
    } else {
        console.error("FAILURE: Could not log watch time:", result.error);
        console.log("NOTE: This might fail if the migration hasn't been applied yet or if the user is not authenticated (which this script isn't by default without a session).");
    }
}

main().catch(console.error);

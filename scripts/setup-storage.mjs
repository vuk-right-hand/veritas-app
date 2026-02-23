
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorage() {
    console.log("Checking storage buckets...");
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
        console.error("Error listing buckets:", error);
        return;
    }

    const avatarBucketName = 'avatars';
    const avatarBucket = buckets.find(b => b.name === avatarBucketName);

    if (!avatarBucket) {
        console.log(`Creating '${avatarBucketName}' bucket...`);
        const { data, error: createError } = await supabase.storage.createBucket(avatarBucketName, {
            public: true,
            fileSizeLimit: 1048576, // 1MB limit
            allowedMimeTypes: ['image/webp', 'image/png', 'image/jpeg', 'image/jpg']
        });

        if (createError) {
            console.error("Error creating bucket:", createError);
        } else {
            console.log(`✅ Bucket '${avatarBucketName}' created successfully.`);
        }
    } else {
        console.log(`✅ Bucket '${avatarBucketName}' already exists.`);

        if (!avatarBucket.public) {
            console.log(`Updating '${avatarBucketName}' to be public...`);
            await supabase.storage.updateBucket(avatarBucketName, { public: true });
        }
    }
}

setupStorage();

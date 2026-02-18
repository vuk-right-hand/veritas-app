
-- Run this in your Supabase SQL Editor to fix the upload error

-- 1. Allow public uploads to 'avatars' bucket
CREATE POLICY "Public Uploads to Avatars"
ON storage.objects FOR INSERT
TO public
WITH CHECK ( bucket_id = 'avatars' );

-- 2. Allow public updates (if overwriting)
CREATE POLICY "Public Updates to Avatars"
ON storage.objects FOR UPDATE
TO public
USING ( bucket_id = 'avatars' );

-- 3. Allow public select (just in case, though bucket is public)
CREATE POLICY "Public Select Avatars"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'avatars' );

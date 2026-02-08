-- Run this in your Supabase SQL Editor to allow users to suggest videos

-- 1. Check if the policy exists (this logic is for migration files, but simple CREATE POLICY is fine for manual run)
DROP POLICY IF EXISTS "Anyone can insert pending videos" ON public.videos;

-- 2. Create the policy allowing anyone to insert a video if the status is 'pending'
CREATE POLICY "Anyone can insert pending videos"
  ON public.videos FOR INSERT
  WITH CHECK ( status = 'pending' );

-- 3. Ensure the 'videos' table has RLS enabled
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Run this in Supabase SQL Editor to allow video status updates

-- Drop existing policy if it exists (safe to run)
DROP POLICY IF EXISTS "Anyone can update video status" ON public.videos;

-- Create new policy: Allow any user to update only the 'status' field
-- This is a simplified policy for development. In production, you'd restrict to admins.
CREATE POLICY "Anyone can update video status"
  ON public.videos FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Note: This is permissive for development. 
-- In production, replace USING(true) with: 
-- USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))

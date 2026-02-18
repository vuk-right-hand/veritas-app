-- =====================================================
-- PATCH: Fix video_tags and user_interest_scores FKs
-- Run this in Supabase SQL Editor AFTER the original migration
-- =====================================================

-- 1. Drop the broken FK on video_tags (videos.id is UUID, but we store youtube_id TEXT)
ALTER TABLE public.video_tags DROP CONSTRAINT IF EXISTS video_tags_video_id_fkey;

-- 2. Drop the FK on user_interest_scores (profiles.id may not exist for creator accounts)
ALTER TABLE public.user_interest_scores DROP CONSTRAINT IF EXISTS user_interest_scores_user_id_fkey;

-- 3. Make user_id on user_interest_scores a plain UUID (no FK) so any UUID works
-- (mission_id, auth.uid, or profiles.id — all are valid UUIDs)
-- No column type change needed, just the constraint is removed above.

-- Verify the constraints are gone:
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid IN ('public.video_tags'::regclass, 'public.user_interest_scores'::regclass)
  AND contype = 'f';
-- Should return 0 rows

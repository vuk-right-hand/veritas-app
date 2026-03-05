-- Migration: Add strict UNIQUE constraint to prevent quiz point farming
-- This enforces that a user can only attempt a specific quiz question on a given video once.

-- 1. Deduplicate existing records by keeping only the FIRST attempt (oldest created_at).
-- This ensures the migration doesn't fail if users have already spammed.
DELETE FROM quiz_attempts
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY user_id, video_id, question 
                   ORDER BY created_at ASC
               ) as row_num
        FROM quiz_attempts
    ) ranked
    WHERE ranked.row_num > 1
);

-- 2. Add the unique constraint natively.
-- This effectively blocks any future duplicate inserts at the database level for the exact same question.
-- (If you already ran the previous version of this migration locally, we drop it first)
ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS unique_user_video_quiz;

ALTER TABLE quiz_attempts
ADD CONSTRAINT unique_user_video_quiz UNIQUE (user_id, video_id, question);

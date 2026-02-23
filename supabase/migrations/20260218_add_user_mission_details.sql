-- =====================================================
-- FIX: Capture Name and Email in User Missions
-- =====================================================

-- Add name and email columns to user_missions table
-- This ensures we capture user details even if auth user creation fails or for easier data export.

ALTER TABLE public.user_missions
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Optional: Add index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_missions_email ON public.user_missions(email);

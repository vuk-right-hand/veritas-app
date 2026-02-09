-- Migration: Add Name/Email to User Missions and 'storage' to App Status
-- Description: Stores user contact info directly on mission and adds 'storage' status for Admin Panel.

-- 1. Add columns to USER_MISSIONS
ALTER TABLE public.user_missions 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Update App Status Enum (Postgres doesn't support IF NOT EXISTS for enum values easily in one line)
-- We use a DO block to check if 'storage' exists before adding it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid  
                 WHERE t.typname = 'app_status' AND e.enumlabel = 'storage') THEN
    ALTER TYPE app_status ADD VALUE 'storage';
  END IF;
END$$;

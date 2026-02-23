-- =====================================================
-- FIX: Allow Anonymous Stats & Secure Verification
-- =====================================================

-- 1. Drop foreign key constraint on user_creator_stats to allow anonymous tracking
-- (Visitors who haven't completed onboarding yet use an anonymous UUID)
ALTER TABLE public.user_creator_stats 
DROP CONSTRAINT IF EXISTS user_creator_stats_user_id_fkey;

-- 2. Secure verification_requests by enabling RLS
-- (No policies are created, meaning ONLY the backend Service Role Key can read/write this table)
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

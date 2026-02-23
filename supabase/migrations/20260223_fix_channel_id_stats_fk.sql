-- =====================================================
-- FIX: Allow Creator Stats for Unclaimed Channels
-- =====================================================

-- 1. Drop foreign key constraint on user_creator_stats to allow tracking watch time for newly suggested channels
-- (Before the channel is officially parsed or claimed in the channels table)
ALTER TABLE public.user_creator_stats 
DROP CONSTRAINT IF EXISTS user_creator_stats_channel_id_fkey;

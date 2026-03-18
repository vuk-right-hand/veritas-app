-- ============================================================
-- Migration: Email Notifications Infrastructure
-- Date: 2026-03-18
-- Purpose: Track video suggesters, log sent emails,
--          milestone dedup, and return view count from RPC
-- ============================================================

-- 1. video_suggestions — track WHO suggested each video
CREATE TABLE IF NOT EXISTS public.video_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES public.user_missions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_suggestions_video ON public.video_suggestions(video_id);

ALTER TABLE public.video_suggestions ENABLE ROW LEVEL SECURITY;
-- No policies = service-role only (same pattern as pipeline_jobs)


-- 2. email_notifications_log — dedup + audit trail
CREATE TABLE IF NOT EXISTS public.email_notifications_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_type TEXT NOT NULL,           -- 'video_approved_user' | 'video_approved_creator' | 'view_milestone'
  recipient_email TEXT NOT NULL,
  video_id TEXT REFERENCES public.videos(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,  -- milestone count, resend_id, etc.
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_log_video_type ON public.email_notifications_log(video_id, email_type);

ALTER TABLE public.email_notifications_log ENABLE ROW LEVEL SECURITY;
-- No policies = service-role only


-- 3. view_milestones_sent — exactly-once milestone delivery
CREATE TABLE IF NOT EXISTS public.view_milestones_sent (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  milestone INTEGER NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(video_id, milestone)
);

ALTER TABLE public.view_milestones_sent ENABLE ROW LEVEL SECURITY;
-- No policies = service-role only


-- 4. Update increment_video_view RPC to RETURN the new count
--    This eliminates the need for a separate DB read on every view.
--    Milestone check only fires when count exactly hits a threshold.
CREATE OR REPLACE FUNCTION increment_video_view(video_id_param TEXT)
RETURNS INTEGER AS $$
DECLARE new_count INTEGER;
BEGIN
  UPDATE videos
  SET views_on_platform = COALESCE(views_on_platform, 0) + 1
  WHERE id = video_id_param
  RETURNING views_on_platform INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FIX SUPER-FAN METRIC RPC: track_creator_watch_time
-- =====================================================

-- We recreate the function to explicitly accept a user_id UUID
-- This avoids the auth.uid() evaluation failing when called by Service Role Key

CREATE OR REPLACE FUNCTION public.track_creator_watch_time(
  p_video_id text,
  p_seconds integer,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel_id text;
BEGIN
  -- Validate user parameter instead of inferring from auth context
  IF p_user_id IS NULL THEN
    RETURN; 
  END IF;

  -- Get channel ID from video
  SELECT channel_id INTO v_channel_id
  FROM public.videos
  WHERE id = p_video_id;

  IF v_channel_id IS NULL THEN
    -- Verify if video exists but has no channel_id, or video doesn't exist
    RETURN;
  END IF;

  -- Upsert stats
  INSERT INTO public.user_creator_stats (user_id, channel_id, total_watch_seconds, last_watched_at)
  VALUES (p_user_id, v_channel_id, p_seconds, now())
  ON CONFLICT (user_id, channel_id)
  DO UPDATE SET
    total_watch_seconds = user_creator_stats.total_watch_seconds + p_seconds,
    last_watched_at = now();

END;
$$;

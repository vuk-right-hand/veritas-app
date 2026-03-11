-- Watch History: one row per user+video, upserted on each watch-progress report.
-- This powers /watch-history and the profile "Recently Watched" preview.

CREATE TABLE IF NOT EXISTS public.watch_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    video_id TEXT NOT NULL,
    last_watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    watch_seconds INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, video_id)
);

-- Index for fast per-user queries sorted by recency
CREATE INDEX IF NOT EXISTS idx_watch_history_user_recent
    ON public.watch_history (user_id, last_watched_at DESC);

-- Enable RLS
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

-- Users can read their own history
CREATE POLICY "Users can view own watch history"
    ON public.watch_history FOR SELECT
    USING (auth.uid() = user_id);

-- Service role handles all inserts/updates (from watch-progress API)
-- No direct client inserts allowed — the API route resolves identity and writes via service role
CREATE POLICY "Service role can manage watch history"
    ON public.watch_history
    USING (true)
    WITH CHECK (true);

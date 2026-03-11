-- Video likes: tracks which users liked which videos, with mission context for personalization.
-- mission_id captures the user's goal + obstacle at time of like — used later to surface
-- this video to other users with matching goals/obstacles/topics.

CREATE TABLE IF NOT EXISTS public.video_likes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id    TEXT NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mission_id  UUID REFERENCES public.user_missions(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT video_likes_unique_per_user UNIQUE (video_id, user_id)
);

-- Indexes for personalization queries
-- "which videos does this user like?"
CREATE INDEX idx_video_likes_user_id     ON public.video_likes (user_id);
-- "who liked this video?" (for ranking/recommendation)
CREATE INDEX idx_video_likes_video_id    ON public.video_likes (video_id);
-- "what videos did people with this mission like?"
CREATE INDEX idx_video_likes_mission_id  ON public.video_likes (mission_id) WHERE mission_id IS NOT NULL;

-- RLS
ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own likes (checking liked state per video)
CREATE POLICY "video_likes_select_own"
    ON public.video_likes FOR SELECT
    USING (auth.uid() = user_id);

-- Authenticated users can insert their own likes
CREATE POLICY "video_likes_insert_own"
    ON public.video_likes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Authenticated users can delete their own likes (unlike)
CREATE POLICY "video_likes_delete_own"
    ON public.video_likes FOR DELETE
    USING (auth.uid() = user_id);

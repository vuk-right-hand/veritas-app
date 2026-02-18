-- =====================================================
-- INTEREST SCORING: Content DNA + Shadow Profile
-- =====================================================
-- Table A: video_tags    — "Content DNA" (3 weighted tags per video)
-- Table B: user_interest_scores — "Shadow Profile" (cumulative scores per user per tag)
-- RPC:     upsert_user_interest — Atomic score incrementing

-- =====================================================
-- TABLE A: video_tags (Content DNA)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.video_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,               -- normalized slug e.g. 'cold_approach', 'dating'
  weight INTEGER NOT NULL CHECK (weight >= 1 AND weight <= 10),
  segment_start_pct INTEGER NOT NULL DEFAULT 0 CHECK (segment_start_pct >= 0 AND segment_start_pct <= 100),
  segment_end_pct INTEGER NOT NULL DEFAULT 100 CHECK (segment_end_pct >= 0 AND segment_end_pct <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Each tag can only appear once per video
  CONSTRAINT uq_video_tag UNIQUE (video_id, tag),
  -- Ensure segment range is valid
  CONSTRAINT chk_segment_range CHECK (segment_start_pct < segment_end_pct)
);

-- Index for fast lookups when user watches a video
CREATE INDEX IF NOT EXISTS idx_video_tags_video_id ON public.video_tags(video_id);

-- =====================================================
-- TABLE B: user_interest_scores (Shadow Profile)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_interest_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,                -- same slugs as video_tags
  score INTEGER NOT NULL DEFAULT 0, -- cumulative, only goes up
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One score per user per tag
  CONSTRAINT uq_user_tag UNIQUE (user_id, tag)
);

-- Index for fast per-user lookups (e.g., "show me John's top interests")
CREATE INDEX IF NOT EXISTS idx_user_interest_scores_user_id ON public.user_interest_scores(user_id);
-- Index for finding users by interest (e.g., "who is most interested in dating?")
CREATE INDEX IF NOT EXISTS idx_user_interest_scores_tag ON public.user_interest_scores(tag, score DESC);

-- =====================================================
-- RPC: upsert_user_interest
-- Atomically: INSERT if new, ADD to score if exists
-- =====================================================
CREATE OR REPLACE FUNCTION public.upsert_user_interest(
  p_user_id UUID,
  p_tag TEXT,
  p_score_delta INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_interest_scores (user_id, tag, score, last_updated)
  VALUES (p_user_id, p_tag, p_score_delta, NOW())
  ON CONFLICT (user_id, tag)
  DO UPDATE SET
    score = user_interest_scores.score + p_score_delta,
    last_updated = NOW();
END;
$$;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.video_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interest_scores ENABLE ROW LEVEL SECURITY;

-- video_tags: Public read (content tags aren't secret)
CREATE POLICY "Video tags are viewable by everyone"
  ON public.video_tags FOR SELECT
  USING (true);

-- video_tags: Only service role writes (AI pipeline)
-- Service role bypasses RLS, so no explicit INSERT policy needed for it.
-- But if we ever need admin users to write:
CREATE POLICY "Admins can manage video tags"
  ON public.video_tags FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- user_interest_scores: Users can see their own scores
CREATE POLICY "Users can view own interest scores"
  ON public.user_interest_scores FOR SELECT
  USING (auth.uid() = user_id);

-- user_interest_scores: Admins can view all (for analytics/reporting)
CREATE POLICY "Admins can view all interest scores"
  ON public.user_interest_scores FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role handles INSERT/UPDATE via the RPC function (bypasses RLS)

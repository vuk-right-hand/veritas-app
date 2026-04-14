-- Feed Category (Pulse / Forge / Alchemy)
-- Adds a nullable taxonomy column used by the /dashboard 3-tab feed.
-- Legacy rows stay NULL and are invisible to the feed until an admin classifies them.

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS feed_category TEXT
  CHECK (feed_category IS NULL OR feed_category IN ('pulse','forge','alchemy'));

-- Partial index covers every feed query: WHERE status='verified' AND feed_category = <tab>
-- sorted by published_at DESC. NULL rows are intentionally outside the index —
-- they're never queried by the scrolling feed.
CREATE INDEX IF NOT EXISTS idx_videos_feed_category_status
  ON public.videos (feed_category, published_at DESC)
  WHERE status = 'verified' AND feed_category IS NOT NULL;

-- Helps the overlap-score correlated subquery in get_personalized_feed.
CREATE INDEX IF NOT EXISTS idx_user_interest_scores_user_tag
  ON public.user_interest_scores (user_id, tag);

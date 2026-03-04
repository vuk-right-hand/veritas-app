-- Shadow Profiles Migration
-- Purpose: Allow unclaimed creator profiles (user_id = NULL) so every
-- verified video's channel has an internal /c/[slug] page.
-- This plugs the "traffic leak" — no more linking out to YouTube from feed.
--
-- RUN AS TWO SEPARATE QUERIES if Supabase times out on a single execution.

-- 1. Make user_id nullable for shadow (unclaimed) profiles
ALTER TABLE public.creators ALTER COLUMN user_id DROP NOT NULL;

-- 2. Make channel_id nullable (shadow profiles may not have YouTube channel ID)
ALTER TABLE public.creators ALTER COLUMN channel_id DROP NOT NULL;

-- 3. Add public read policy so /c/[slug] pages work for all visitors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'creators' AND policyname = 'Anyone can view creator profiles'
  ) THEN
    CREATE POLICY "Anyone can view creator profiles"
      ON public.creators FOR SELECT
      USING (true);
  END IF;
END $$;

-- 4. Backfill: Bulk-insert shadow creator profiles for verified videos
-- that have no matching creator row yet. Uses random suffix to avoid slug collisions.
INSERT INTO public.creators (channel_name, channel_url, channel_id, slug, is_verified, human_score)
SELECT DISTINCT ON (sub.channel_url)
  sub.channel_title,
  sub.channel_url,
  NULL,
  public.slugify(sub.channel_title) || '-' || substr(gen_random_uuid()::text, 1, 4) AS slug,
  true,
  50
FROM (
  SELECT DISTINCT ON (v.channel_url)
    v.channel_title,
    v.channel_url
  FROM public.videos v
  WHERE v.status = 'verified'
    AND v.channel_url IS NOT NULL
    AND v.channel_title IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.creators c WHERE c.channel_url = v.channel_url
    )
  ORDER BY v.channel_url, v.created_at ASC
) sub;

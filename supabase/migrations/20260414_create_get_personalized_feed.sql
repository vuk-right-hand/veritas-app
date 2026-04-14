-- Personalized feed RPC for Forge / Alchemy tabs.
-- All ranking, sorting, pagination, AND exclusion happen inside Postgres so
-- OFFSET math stays honest across infinite-scroll calls. Pulse does NOT use
-- this RPC — it uses a plain chronological query.
--
-- Security: NO p_user_id param. The overlap subquery reads auth.uid() directly
-- so an authenticated caller can only score against their own interest scores,
-- and an anon caller (auth.uid() = NULL) collapses overlap to 0 and falls
-- through to pure published_at DESC ordering. This closes the classic
-- SECURITY DEFINER impersonation hole.
--
-- LANGUAGE sql (not plpgsql): avoids the 42702 ambiguous-column bug this
-- codebase has hit before when plpgsql variable names collide with column
-- names inside a SELECT.

-- Drop current shape + legacy 5-arg draft shape (if ever shipped with p_user_id).
DROP FUNCTION IF EXISTS public.get_personalized_feed(text, integer, integer, text[]);
DROP FUNCTION IF EXISTS public.get_personalized_feed(uuid, text, integer, integer, text[]);

CREATE OR REPLACE FUNCTION public.get_personalized_feed(
  p_feed_category TEXT,
  p_limit         INT     DEFAULT 10,
  p_offset        INT     DEFAULT 0,
  p_exclude_ids   TEXT[]  DEFAULT '{}'
)
RETURNS TABLE (
  id                 TEXT,
  title              TEXT,
  human_score        INTEGER,
  category_tag       TEXT,
  feed_category      TEXT,
  channel_title      TEXT,
  channel_url        TEXT,
  published_at       TIMESTAMPTZ,
  summary_points     JSONB,
  custom_description TEXT,
  custom_links       JSONB,
  created_at         TIMESTAMPTZ,
  status             TEXT,
  slug               TEXT,
  overlap_score      NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH scored AS (
    SELECT
      v.id,
      v.title,
      v.human_score,
      v.category_tag,
      v.feed_category,
      v.channel_title,
      v.channel_url,
      v.published_at,
      v.summary_points,
      v.custom_description,
      v.custom_links,
      v.created_at,
      v.status::text AS status,
      v.slug,
      COALESCE(
        (
          SELECT SUM(vt.weight * uis.score)::NUMERIC
          FROM public.video_tags vt
          JOIN public.user_interest_scores uis
            ON uis.tag = vt.tag
           AND uis.user_id = auth.uid()
          WHERE vt.video_id = v.id
        ),
        0
      ) AS overlap_score
    FROM public.videos v
    WHERE v.status::text = 'verified'
      AND v.feed_category = p_feed_category
      AND NOT (v.id = ANY(p_exclude_ids))
  )
  SELECT
    scored.id,
    scored.title,
    scored.human_score,
    scored.category_tag,
    scored.feed_category,
    scored.channel_title,
    scored.channel_url,
    scored.published_at,
    scored.summary_points,
    scored.custom_description,
    scored.custom_links,
    scored.created_at,
    scored.status,
    scored.slug,
    scored.overlap_score
  FROM scored
  ORDER BY scored.overlap_score DESC,
           scored.published_at DESC NULLS LAST,
           scored.id DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_personalized_feed(TEXT, INT, INT, TEXT[])
  TO anon, authenticated;

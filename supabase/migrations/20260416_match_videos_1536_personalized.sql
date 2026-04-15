-- Phase 2: personalize match_videos_1536 with viewer_taste vector.
--
-- The signature from 20260416_match_videos_1536.sql already accepts
-- viewer_taste vector(1536) DEFAULT NULL, so this is a pure body replacement
-- via CREATE OR REPLACE — no DROP, no client contract change.
--
-- Personalization formula:
--   final = 0.7 * base_score + 0.3 * (1 - (embedding_1536 <=> viewer_taste))
--   when viewer_taste IS NULL → final = base_score (anon/cold-start no-op)
--
-- Anon users get byte-identical results to Phase 1. Logged-in users with a
-- populated taste vector see semantic re-rank weighted toward their niche.

BEGIN;

CREATE OR REPLACE FUNCTION public.match_videos_1536(
  query_embedding vector(1536),
  query_text      text             DEFAULT '',
  match_threshold double precision DEFAULT 0.65,
  match_count     integer          DEFAULT 9,
  days_filter     integer          DEFAULT NULL,
  viewer_taste    vector(1536)     DEFAULT NULL
)
RETURNS TABLE (
  id                 text,
  title              text,
  human_score        integer,
  similarity         double precision,
  channel_title      text,
  channel_url        text,
  published_at       timestamp with time zone,
  summary_points     jsonb,
  custom_description text,
  custom_links       jsonb,
  slug               text,
  score              double precision,
  fts_matched        boolean
)
LANGUAGE sql STABLE
AS $$
  WITH fts_hits AS (
    SELECT
      v.id,
      ts_rank_cd(
        to_tsvector('english', v.title || ' ' || coalesce(v.custom_description, '')),
        websearch_to_tsquery('english', query_text)
      )::double precision AS fts_raw
    FROM public.videos v
    WHERE length(trim(query_text)) > 0
      AND v.status = 'verified'
      AND (days_filter IS NULL OR v.published_at >= now() - interval '1 day' * days_filter)
      AND to_tsvector('english', v.title || ' ' || coalesce(v.custom_description, ''))
          @@ websearch_to_tsquery('english', query_text)
  ),
  vec_hits AS (
    SELECT
      v.id,
      (1 - (v.embedding_1536 <=> query_embedding))::double precision AS sim
    FROM public.videos v
    WHERE v.status = 'verified'
      AND v.embedding_1536 IS NOT NULL
      AND (days_filter IS NULL OR v.published_at >= now() - interval '1 day' * days_filter)
      AND (1 - (v.embedding_1536 <=> query_embedding)) > match_threshold
  ),
  candidate_ids AS (
    SELECT id FROM fts_hits
    UNION
    SELECT id FROM vec_hits
  ),
  scored AS (
    SELECT
      v.id,
      v.title,
      v.human_score,
      coalesce((1 - (v.embedding_1536 <=> query_embedding))::double precision, 0.0) AS similarity,
      v.channel_title,
      v.channel_url,
      v.published_at,
      v.summary_points,
      v.custom_description,
      v.custom_links,
      v.slug,
      v.embedding_1536,
      vh.sim,
      fh.fts_raw,
      (fh.fts_raw IS NOT NULL) AS fts_matched
    FROM candidate_ids c
    JOIN public.videos v ON v.id = c.id
    LEFT JOIN vec_hits vh ON vh.id = v.id
    LEFT JOIN fts_hits fh ON fh.id = v.id
  ),
  blended AS (
    SELECT
      s.*,
      (
        0.6 * coalesce(s.sim, 0)
        + 0.4 * coalesce(s.fts_raw / (1 + s.fts_raw), 0)
        + CASE
            WHEN s.sim IS NOT NULL
             AND s.fts_raw IS NOT NULL
             AND s.fts_raw > 0
            THEN 0.10
            ELSE 0
          END
      )::double precision AS base_score
    FROM scored s
  ),
  floored AS (
    SELECT
      b.*,
      CASE
        WHEN b.fts_matched THEN greatest(b.base_score, 0.55)
        ELSE b.base_score
      END AS floored_score
    FROM blended b
  )
  SELECT
    f.id,
    f.title,
    f.human_score,
    f.similarity,
    f.channel_title,
    f.channel_url,
    f.published_at,
    f.summary_points,
    f.custom_description,
    f.custom_links,
    f.slug,
    CASE
      WHEN viewer_taste IS NULL OR f.embedding_1536 IS NULL THEN f.floored_score
      ELSE (
        0.7 * f.floored_score
        + 0.3 * (1 - (f.embedding_1536 <=> viewer_taste))::double precision
      )
    END AS score,
    f.fts_matched
  FROM floored f
  ORDER BY score DESC, f.similarity DESC
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_videos_1536(vector, text, double precision, integer, integer, vector)
  TO anon, authenticated, service_role;

COMMIT;

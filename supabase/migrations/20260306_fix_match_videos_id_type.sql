-- Fix match_videos return types to match actual videos table schema:
--   id: text (YouTube video IDs, not UUID)
--   summary_points: jsonb (not text[])
--   status: app_status enum (cast to text for comparison)

DROP FUNCTION IF EXISTS match_videos(vector, double precision, integer, integer);
DROP FUNCTION IF EXISTS match_videos(vector, double precision, integer);

CREATE OR REPLACE FUNCTION match_videos (
  query_embedding vector(3072),
  match_threshold double precision,
  match_count integer,
  days_filter integer DEFAULT NULL
)
RETURNS TABLE (
  id text,
  title text,
  human_score integer,
  similarity double precision,
  channel_title text,
  channel_url text,
  published_at timestamp with time zone,
  summary_points jsonb,
  custom_description text,
  custom_links jsonb,
  slug text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.title,
    v.human_score,
    (1 - (v.embedding <=> query_embedding))::double precision as similarity,
    v.channel_title,
    v.channel_url,
    v.published_at,
    v.summary_points,
    v.custom_description,
    v.custom_links,
    v.slug
  FROM videos v
  WHERE v.embedding IS NOT NULL
    AND v.status::text = 'verified'
    AND 1 - (v.embedding <=> query_embedding) > match_threshold
    AND (days_filter IS NULL OR v.published_at >= now() - interval '1 day' * days_filter)
  ORDER BY v.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

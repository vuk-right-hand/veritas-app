-- Hybrid search: combines pgvector semantic search + Postgres Full-Text Search (FTS)
-- Replaces pure vector-only match_videos with a two-path approach:
--   Path A (FTS):    to_tsvector + websearch_to_tsquery — catches exact/near-exact keyword matches
--   Path B (vector): cosine similarity > 0.65 — catches semantic/typo matches via Gemini embedding
--
-- Priority ordering in results:
--   0 = matched BOTH paths (highest confidence — shown first)
--   1 = FTS only (exact keyword match — shown second)
--   2 = vector only (semantic match — shown third)
--
-- Threshold change: 0.85 → 0.65 similarity (max cosine distance 0.15 → 0.35)
-- match_count default: 5 → 9 (fills a 3-column desktop grid exactly)
--
-- IMPORTANT: Uses LANGUAGE sql (not plpgsql) to avoid the PL/pgSQL variable scope bug
-- where RETURNS TABLE column names (id, title, etc.) conflict with identically-named
-- columns in subqueries, causing ERROR 42702 "column reference is ambiguous".

-- Nuclear drop: removes ALL match_videos overloads regardless of signature.
-- Required because CREATE OR REPLACE cannot change a function's signature.
DO $$
DECLARE func_sig text;
BEGIN
  FOR func_sig IN (
    SELECT p.oid::regprocedure::text FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'match_videos'
  ) LOOP
    EXECUTE 'DROP FUNCTION ' || func_sig || ' CASCADE';
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION match_videos(
  query_embedding vector(3072),
  query_text      text             DEFAULT '',
  match_threshold double precision DEFAULT 0.65,
  match_count     integer          DEFAULT 9,
  days_filter     integer          DEFAULT NULL
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
  slug               text
)
LANGUAGE sql STABLE
AS $$
  WITH fts_ids AS (
    -- Keyword path: finds "killer youtube thumbnails" when query is "youtube thumbnails"
    -- websearch_to_tsquery safely handles arbitrary user input without erroring
    SELECT v.id
    FROM videos v
    WHERE length(trim(query_text)) > 0
      AND v.status::text = 'verified'
      AND (days_filter IS NULL OR v.published_at >= now() - interval '1 day' * days_filter)
      AND to_tsvector('english', v.title || ' ' || COALESCE(v.custom_description, ''))
          @@ websearch_to_tsquery('english', query_text)
  ),
  vector_matches AS (
    -- Semantic path: Gemini embedding handles typos and synonyms
    -- Videos in fts_ids get priority=0 (both paths matched), others get priority=2
    SELECT
      v.id,
      v.title,
      v.human_score,
      (1 - (v.embedding <=> query_embedding))::double precision AS similarity,
      v.channel_title,
      v.channel_url,
      v.published_at,
      v.summary_points,
      v.custom_description,
      v.custom_links,
      v.slug,
      CASE WHEN v.id IN (SELECT fi.id FROM fts_ids fi) THEN 0 ELSE 2 END AS priority
    FROM videos v
    WHERE v.embedding IS NOT NULL
      AND v.status::text = 'verified'
      AND 1 - (v.embedding <=> query_embedding) > match_threshold
      AND (days_filter IS NULL OR v.published_at >= now() - interval '1 day' * days_filter)
  ),
  fts_only AS (
    -- FTS results not captured by vector (exact title match with similarity below threshold)
    -- Still compute similarity for display; falls back to 0.0 if no embedding
    SELECT
      v.id,
      v.title,
      v.human_score,
      COALESCE((1 - (v.embedding <=> query_embedding))::double precision, 0.0) AS similarity,
      v.channel_title,
      v.channel_url,
      v.published_at,
      v.summary_points,
      v.custom_description,
      v.custom_links,
      v.slug,
      1 AS priority
    FROM videos v
    WHERE v.id IN (SELECT fi.id FROM fts_ids fi)
      AND v.id NOT IN (SELECT vm.id FROM vector_matches vm)
      AND v.status::text = 'verified'
  ),
  combined AS (
    SELECT * FROM vector_matches
    UNION ALL
    SELECT * FROM fts_only
  )
  SELECT c.id, c.title, c.human_score, c.similarity, c.channel_title, c.channel_url,
         c.published_at, c.summary_points, c.custom_description, c.custom_links, c.slug
  FROM combined c
  ORDER BY c.priority ASC, c.similarity DESC
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_videos(vector, text, double precision, integer, integer) TO anon, authenticated, service_role;

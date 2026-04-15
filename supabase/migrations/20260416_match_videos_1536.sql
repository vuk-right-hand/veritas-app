-- Search RPC on 1536-dim Gemini embeddings + blended hybrid score.
--
-- WHY: Ingest path (saveVideoAnalysis) now writes only videos.embedding_1536
-- since commit 4cb2cca (personalization refactor). The legacy match_videos RPC
-- still reads videos.embedding (3072-dim, always NULL for new videos), so the
-- vector path silently drops every post-refactor video. FTS masked it. This
-- migration lands a parallel RPC on the 1536-dim column with a blended score
-- that replaces the old priority-tier ranking.
--
-- The legacy match_videos RPC (3072-dim) is NOT dropped: red-team-search still
-- calls it via supabaseAdmin. Both RPCs coexist.
--
-- Index predicate discipline: partial HNSW and partial GIN are matched by the
-- planner only when the RPC filter is literally the same expression. Use
-- `v.status = 'verified'` (no ::text cast). The to_tsvector expression is
-- reused verbatim in three places (GIN index, candidate @@, ts_rank_cd) —
-- treat it as a shared constant.

BEGIN;

-- ============================================================================
-- 1. search_cache column swap: 3072 → 1536
-- ----------------------------------------------------------------------------
-- Cache rows carry vector(3072) blobs. After this migration the route writes
-- 1536-dim arrays, which would fail to insert into a 3072 column. TRUNCATE
-- is safe: search_cache is a cost optimization, not a source of truth.
-- No HNSW index on this column — cache is keyed by query_text, not searched.
-- ============================================================================
DROP INDEX IF EXISTS public.search_cache_embedding_hnsw_idx;
DROP INDEX IF EXISTS public.search_cache_embedding_ivfflat_idx;
TRUNCATE TABLE public.search_cache;
ALTER TABLE public.search_cache DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.search_cache ADD COLUMN embedding vector(1536);

-- ============================================================================
-- 2. Partial GIN index for FTS path.
-- ----------------------------------------------------------------------------
-- The existing hybrid_search RPC re-tokenizes every verified row on every
-- query because no GIN index exists. This one serves both the candidate @@
-- filter and ts_rank_cd below. The to_tsvector expression MUST be byte-for-
-- byte identical in the index and in the query, or the planner won't use it.
-- ============================================================================
CREATE INDEX IF NOT EXISTS videos_fts_gin_idx
  ON public.videos
  USING gin (to_tsvector('english', title || ' ' || coalesce(custom_description, '')))
  WHERE status = 'verified';

-- ============================================================================
-- 3. Partial HNSW index for search path on embedding_1536.
-- ----------------------------------------------------------------------------
-- Separate from the per-feed-category HNSW indexes in
-- 20260416_add_embedding_1536_and_taste_vectors.sql — search runs across all
-- verified videos regardless of feed_category.
-- ============================================================================
CREATE INDEX IF NOT EXISTS videos_embedding_1536_search_hnsw_idx
  ON public.videos
  USING hnsw (embedding_1536 vector_cosine_ops)
  WHERE status = 'verified' AND embedding_1536 IS NOT NULL;

-- ============================================================================
-- 4. match_videos_1536 — blended-score hybrid search.
-- ----------------------------------------------------------------------------
-- Candidate set = FTS hits ∪ vector hits (cosine sim > match_threshold).
--
-- Blended score:
--   sim       = 1 - (v.embedding_1536 <=> query_embedding), NULL if no embedding
--   fts_raw   = ts_rank_cd(to_tsvector(...), websearch_to_tsquery(...))
--   fts_norm  = fts_raw / (1 + fts_raw)                    -- [0,∞) → [0,1)
--   base      = 0.6 * coalesce(sim,0) + 0.4 * coalesce(fts_norm,0)
--             + 0.10 IF both paths matched
--   score     = max(base, 0.55) IF FTS hit ELSE base       -- FTS-only floor
--
-- FTS-only floor semantics: an FTS hit always outranks a vector-only hit
-- unless the vector hit is near-perfect (sim ≳ 0.92). Intent: trust literal
-- keyword matches over semantic neighbours. Revisit after Phase 3 click data.
--
-- viewer_taste is accepted but unused in this revision — the route passes
-- NULL. Phase 2 will replace the function with CREATE OR REPLACE to wire it,
-- without changing the signature.
-- ============================================================================
DROP FUNCTION IF EXISTS public.match_videos_1536(vector, text, double precision, integer, integer, vector);

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
      -- similarity is returned for display even when embedding is NULL.
      coalesce((1 - (v.embedding_1536 <=> query_embedding))::double precision, 0.0) AS similarity,
      v.channel_title,
      v.channel_url,
      v.published_at,
      v.summary_points,
      v.custom_description,
      v.custom_links,
      v.slug,
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
  )
  SELECT
    b.id,
    b.title,
    b.human_score,
    b.similarity,
    b.channel_title,
    b.channel_url,
    b.published_at,
    b.summary_points,
    b.custom_description,
    b.custom_links,
    b.slug,
    CASE
      WHEN b.fts_matched THEN greatest(b.base_score, 0.55)
      ELSE b.base_score
    END AS score,
    b.fts_matched
  FROM blended b
  ORDER BY score DESC, b.similarity DESC
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_videos_1536(vector, text, double precision, integer, integer, vector)
  TO anon, authenticated, service_role;

COMMIT;

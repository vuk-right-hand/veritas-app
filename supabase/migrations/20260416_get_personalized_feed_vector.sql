-- Rewrite get_personalized_feed to rank by cosine similarity over
-- user_taste_vectors.embedding instead of the broken tag-JOIN path.
--
-- Signature CHANGES: adds p_user_id UUID as the first arg, drops auth.uid()
-- usage entirely. Callers (video-actions.ts) must resolve the viewer id via
-- resolveViewerIdReadOnly() and pass it in.
--
-- Security: SECURITY INVOKER (NOT DEFINER). Service-role client bypasses RLS
-- already; DEFINER would only widen surface. The RPC is NOT granted to anon
-- or authenticated — calling it from a browser session would let a caller
-- scrape anyone else's ranked feed and leak their taste profile via ordering.
-- Service-role-only, always called from supabaseAdmin.
--
-- Language: plpgsql so we can DECLARE a local for the user vector and branch
-- on p_feed_category with LITERAL predicates (partial HNSW indexes require
-- literal WHERE clauses at plan time). We dodge the 42702 ambiguous-column
-- bug that pushed the previous migration to LANGUAGE sql by strictly prefixing
-- every column reference with v.

-- Drop the old 5-arg shape before creating the new 6-arg shape.
DROP FUNCTION IF EXISTS public.get_personalized_feed(text, integer, integer, text[], timestamptz);

CREATE OR REPLACE FUNCTION public.get_personalized_feed(
  p_user_id         UUID,
  p_feed_category   TEXT,
  p_limit           INT         DEFAULT 10,
  p_offset          INT         DEFAULT 0,
  p_exclude_ids     TEXT[]      DEFAULT '{}',
  p_published_after TIMESTAMPTZ DEFAULT NULL
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
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_embedding vector(1536);
  v_watch_count    INT := 0;
BEGIN
  -- Fetch user vector into a local so pgvector treats it as a constant in the
  -- ORDER BY (inline subquery may not evaluate as a constant InitPlan).
  IF p_user_id IS NOT NULL THEN
    SELECT uts.embedding, uts.watch_count
      INTO v_user_embedding, v_watch_count
    FROM public.user_taste_vectors uts
    WHERE uts.user_id = p_user_id;
  END IF;

  -- Cold-start / anon / low-confidence: fall through to chronological.
  -- watch_count < 3 guards against noisy one-watch taste vectors ranking the feed.
  IF v_user_embedding IS NULL OR v_watch_count < 3 THEN
    RETURN QUERY
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
      v.status::text,
      v.slug,
      0::NUMERIC
    FROM public.videos v
    WHERE v.status::text = 'verified'
      AND v.feed_category = p_feed_category
      AND NOT (v.id = ANY(p_exclude_ids))
      AND (p_published_after IS NULL OR v.published_at >= p_published_after)
    ORDER BY v.published_at DESC NULLS LAST, v.id DESC
    LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;

  -- NOTE: historical versions of this function included SET LOCAL
  -- hnsw.ef_search = 100 here to widen the HNSW candidate pool against long
  -- scroll sessions with large p_exclude_ids. Removed because the GUC is
  -- only registered once pgvector's HNSW code path is first touched in the
  -- session, and SET LOCAL on an unregistered GUC aborts the RPC. Re-add as
  -- a follow-up once the catalog is large enough to need it, wrapped in a
  -- PERFORM set_config('hnsw.ef_search', '100', true) inside a BEGIN block
  -- that catches undefined_object.

  -- Personalized branch: one literal-predicate block per personalized bucket.
  -- LITERAL predicates are required for the planner to pick a partial index.
  -- NO OFFSET — HNSW is approximate; rely on p_exclude_ids cursor instead.
  -- NOTE: pulse is intentionally NOT handled here. Feed call sites route pulse
  -- to a raw chronological query and never reach this RPC with 'pulse'. If the
  -- caller contract ever changes, the ELSE branch will RAISE loudly.
  IF p_feed_category = 'forge' THEN
    RETURN QUERY
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
      v.status::text,
      v.slug,
      (1 - (v.embedding_1536 <=> v_user_embedding))::NUMERIC
    FROM public.videos v
    WHERE v.status::text = 'verified'
      AND v.feed_category = 'forge'
      AND NOT (v.id = ANY(p_exclude_ids))
      AND (p_published_after IS NULL OR v.published_at >= p_published_after)
    ORDER BY v.embedding_1536 <=> v_user_embedding ASC
    LIMIT p_limit;
  ELSIF p_feed_category = 'alchemy' THEN
    RETURN QUERY
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
      v.status::text,
      v.slug,
      (1 - (v.embedding_1536 <=> v_user_embedding))::NUMERIC
    FROM public.videos v
    WHERE v.status::text = 'verified'
      AND v.feed_category = 'alchemy'
      AND NOT (v.id = ANY(p_exclude_ids))
      AND (p_published_after IS NULL OR v.published_at >= p_published_after)
    ORDER BY v.embedding_1536 <=> v_user_embedding ASC
    LIMIT p_limit;
  ELSE
    -- KEEP IN SYNC with FEED_CATEGORIES in src/app/actions/video-actions.ts.
    -- Adding a fourth bucket requires: (1) a fourth partial HNSW index in
    -- 20260416_add_embedding_1536_and_taste_vectors.sql, (2) a fourth ELSIF
    -- branch here. Until both land, the RPC throws for the new bucket.
    RAISE EXCEPTION 'Unknown feed_category: % - new bucket needs a partial HNSW index + ELSIF branch', p_feed_category;
  END IF;
END;
$$;

-- NO GRANT to anon / authenticated. Service-role-only.

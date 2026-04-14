-- Embedding-based personalization: add 1536-dim column + per-user taste vectors.
-- Replaces the broken tag-JOIN ranking path with cosine similarity over HNSW.
--
-- Key decisions documented in the plan:
--  * Three PARTIAL HNSW indexes (one per feed_category). Partials let each RPC
--    branch pick a pre-filtered index, avoiding the filtered-HNSW recall problem.
--  * 1536 dims instead of 3072 — generated server-side by Gemini via
--    outputDimensionality on the REST embedContent endpoint.
--  * user_taste_vectors.user_id has NO FK. Keyspace is mixed by design
--    (auth.users.id | user_missions.user_id | anon UUID). The feed RPC and the
--    write path are both responsible for passing the same resolved id.

-- pgvector >= 0.7 required for l2_normalize(). Use array comparison so this
-- keeps working when pgvector ships 0.10+ (lexicographic '0.10' < '0.7' lies).
DO $$
DECLARE
  v_ver   text;
  v_parts int[];
BEGIN
  SELECT extversion INTO v_ver FROM pg_extension WHERE extname = 'vector';
  IF v_ver IS NULL THEN
    RAISE EXCEPTION 'pgvector extension is not installed';
  END IF;
  v_parts := string_to_array(v_ver, '.')::int[];
  IF v_parts < ARRAY[0, 7] THEN
    RAISE EXCEPTION 'pgvector >= 0.7 required for l2_normalize (found %)', v_ver;
  END IF;
END $$;

-- 1. New 1536-dim column. Legacy embedding vector(3072) stays for one release.
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS embedding_1536 vector(1536);

-- 2. Partial HNSW indexes — one per personalized feed bucket. Each RPC branch
--    passes a LITERAL predicate so the planner can prove a partial index matches;
--    a plpgsql variable in the WHERE clause would drop to seq scan.
--    NOTE: pulse has NO index by design — feed call sites route pulse to a raw
--    chronological query before calling the RPC, so a pulse HNSW index would
--    cost write-amp on every insert for zero read benefit.
CREATE INDEX IF NOT EXISTS videos_embedding_1536_forge_hnsw_idx
  ON public.videos USING hnsw (embedding_1536 vector_cosine_ops)
  WHERE status = 'verified' AND feed_category = 'forge';

CREATE INDEX IF NOT EXISTS videos_embedding_1536_alchemy_hnsw_idx
  ON public.videos USING hnsw (embedding_1536 vector_cosine_ops)
  WHERE status = 'verified' AND feed_category = 'alchemy';

-- 3. Per-user taste vector table.
CREATE TABLE IF NOT EXISTS public.user_taste_vectors (
  user_id     UUID PRIMARY KEY,
  embedding   vector(1536) NOT NULL,
  watch_count INT          NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.user_taste_vectors ENABLE ROW LEVEL SECURITY;

-- NO SELECT policy by design. This table is read exclusively via
-- get_personalized_feed (service-role call) and written exclusively by
-- upsert_user_taste_vector (service-role call). A SELECT policy keyed on
-- auth.uid() would silently return empty for viewer-path users (who have no
-- auth session), which is a debugging footgun if anyone later builds a
-- "see my taste profile" endpoint. Keep RLS enabled so no authenticated
-- browser session can read the table directly.
DROP POLICY IF EXISTS "user_taste_vectors_select_own" ON public.user_taste_vectors;

-- 4. Atomic, race-free EMA upsert.
--   alpha = 0.15 (inlined). Takes p_video_id and SELECTs the embedding
--   internally — this avoids shipping a 1536-float array across the wire
--   (Supabase JS serializes vectors as text, and any mismatch silently writes
--   garbage). First insert stores l2_normalize(video_embedding) directly;
--   subsequent watches apply a weighted EMA and renormalize.
--   Single-statement INSERT ... ON CONFLICT = atomic under concurrent writes.
DROP FUNCTION IF EXISTS public.upsert_user_taste_vector(uuid, vector, real);
CREATE OR REPLACE FUNCTION public.upsert_user_taste_vector(
  p_user_id  UUID,
  p_video_id TEXT,
  p_weight   REAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_embedding vector(1536);
BEGIN
  SELECT v.embedding_1536 INTO v_embedding
  FROM public.videos v
  WHERE v.id = p_video_id;

  IF v_embedding IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_taste_vectors (user_id, embedding, watch_count, updated_at)
  VALUES (
    p_user_id,
    l2_normalize(v_embedding),
    1,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET embedding = l2_normalize(
        -- pgvector has NO scalar-multiplication operator at all — only
        -- element-wise `vector * vector`. To scale a vector by a constant k
        -- we build a constant vector of [k, k, k, ...] via array_fill and
        -- multiply element-wise. Dimension must match (1536) or pgvector
        -- throws. p_weight is float4 (REAL); array_fill expects a real-typed
        -- element so we cast once at the fill site.
        user_taste_vectors.embedding
          * array_fill(0.85::real, ARRAY[1536])::vector(1536)
        + EXCLUDED.embedding
          * array_fill((0.15 * p_weight)::real, ARRAY[1536])::vector(1536)
      ),
      watch_count = user_taste_vectors.watch_count + 1,
      updated_at  = now();
END;
$$;

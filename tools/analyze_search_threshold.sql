-- Phase 3B: threshold + floor tuning analyst query.
--
-- Reads analytics_events rows written by /api/search (event_type='creator_search')
-- and /api/search click-throughs (event_type='search_click') to show where the
-- current blended-score distribution lands and whether the 0.55 FTS floor /
-- 0.65 cosine threshold match real click behavior.
--
-- Run in Supabase SQL editor. Not a migration.

-- ============================================================================
-- 1. Score distribution of returned results (last 7 days).
-- ----------------------------------------------------------------------------
-- Look for: median score, spread, fts_matched share. If median is < 0.45 the
-- threshold is too loose; if P90 is > 0.85 the threshold is too tight.
-- ============================================================================
WITH returned AS (
  SELECT
    (metadata->>'query')        AS query,
    (metadata->>'rank')::int    AS rank,
    (metadata->>'score')::float AS score,
    (metadata->>'similarity')::float AS similarity,
    (metadata->>'fts_matched')::boolean AS fts_matched,
    created_at
  FROM public.analytics_events
  WHERE event_type = 'creator_search'
    AND created_at >= now() - interval '7 days'
    AND metadata ? 'score'
)
SELECT
  count(*)                                     AS n_results,
  count(DISTINCT query)                        AS n_queries,
  round(avg(score)::numeric, 3)                AS mean_score,
  round((percentile_cont(0.5)  WITHIN GROUP (ORDER BY score))::numeric, 3) AS p50_score,
  round((percentile_cont(0.9)  WITHIN GROUP (ORDER BY score))::numeric, 3) AS p90_score,
  round((percentile_cont(0.99) WITHIN GROUP (ORDER BY score))::numeric, 3) AS p99_score,
  round((percentile_cont(0.5)  WITHIN GROUP (ORDER BY similarity))::numeric, 3) AS p50_sim,
  sum(CASE WHEN fts_matched THEN 1 ELSE 0 END)::float / nullif(count(*),0) AS fts_share
FROM returned;

-- ============================================================================
-- 2. Click-through rate by score bucket.
-- ----------------------------------------------------------------------------
-- For each 0.05-wide score bucket: how many results were returned vs clicked?
-- The threshold should sit just above the bucket where CTR collapses — i.e.
-- the bucket where users stop trusting the results.
-- ============================================================================
WITH returned AS (
  SELECT
    (metadata->>'query') AS query,
    target_id             AS video_id,
    (metadata->>'rank')::int    AS rank,
    (metadata->>'score')::float AS score,
    (metadata->>'similarity')::float AS similarity
  FROM public.analytics_events
  WHERE event_type = 'creator_search'
    AND created_at >= now() - interval '7 days'
    AND metadata ? 'score'
),
clicked AS (
  SELECT
    (metadata->>'query') AS query,
    target_id             AS video_id
  FROM public.analytics_events
  WHERE event_type = 'search_click'
    AND created_at >= now() - interval '7 days'
),
joined AS (
  SELECT
    r.*,
    CASE WHEN c.video_id IS NOT NULL THEN 1 ELSE 0 END AS clicked
  FROM returned r
  LEFT JOIN clicked c
    ON c.query = r.query AND c.video_id = r.video_id
)
SELECT
  width_bucket(score, 0, 1, 20)::float / 20 AS score_bucket_low,
  count(*)                                  AS returned,
  sum(clicked)                              AS clicks,
  round((sum(clicked)::numeric / nullif(count(*),0))::numeric, 3) AS ctr
FROM joined
GROUP BY 1
ORDER BY 1;

-- ============================================================================
-- 3. FTS-only floor audit.
-- ----------------------------------------------------------------------------
-- Does the 0.55 floor help or hurt? Compare CTR for FTS hits vs vector-only
-- hits in the same rank bracket. If FTS-only CTR is materially lower at top
-- ranks, the floor is too aggressive — lower it to 0.45.
-- ============================================================================
WITH returned AS (
  SELECT
    (metadata->>'query') AS query,
    target_id            AS video_id,
    (metadata->>'rank')::int    AS rank,
    (metadata->>'fts_matched')::boolean AS fts_matched
  FROM public.analytics_events
  WHERE event_type = 'creator_search'
    AND created_at >= now() - interval '7 days'
    AND metadata ? 'fts_matched'
    AND (metadata->>'rank')::int < 3
),
clicked AS (
  SELECT
    (metadata->>'query') AS query,
    target_id            AS video_id
  FROM public.analytics_events
  WHERE event_type = 'search_click'
    AND created_at >= now() - interval '7 days'
)
SELECT
  r.fts_matched,
  count(*)                                             AS top3_returned,
  sum(CASE WHEN c.video_id IS NOT NULL THEN 1 ELSE 0 END) AS top3_clicks,
  round(
    (sum(CASE WHEN c.video_id IS NOT NULL THEN 1 ELSE 0 END)::numeric
     / nullif(count(*),0))::numeric, 3
  ) AS top3_ctr
FROM returned r
LEFT JOIN clicked c ON c.query = r.query AND c.video_id = r.video_id
GROUP BY r.fts_matched
ORDER BY r.fts_matched DESC;

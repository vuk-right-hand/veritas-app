-- Observability view: per-day rollup of feed_category + classification_status
-- over the last 7 days. Read by scripts/check-classification-health.mjs.

BEGIN;

CREATE OR REPLACE VIEW public.classification_daily_stats AS
SELECT
  date_trunc('day', created_at) AS day,
  feed_category,
  classification_status,
  count(*)::bigint AS videos
FROM public.videos
WHERE created_at >= now() - interval '7 days'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 2, 3;

GRANT SELECT ON public.classification_daily_stats TO anon, authenticated, service_role;

COMMIT;

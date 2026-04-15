-- Classification metadata for automatic Pulse/Forge/Alchemy routing.
--
-- Adds four nullable columns to `videos` for Gemini's classification output
-- (separate from the existing `status` column — no overloading).
-- Extends `pipeline_jobs.status` CHECK with `skipped_rejected` so the pipeline
-- can record off-niche rejections without inserting a videos row.
--
-- `classification_status` values:
--   pending          — row exists, not yet classified (manual flow initial insert)
--   classified       — Gemini emitted verdict='approve', feed_category populated
--   rejected         — Gemini emitted verdict='reject'; row hidden via status='rejected'
--                      feed_category still holds Gemini's best-guess bucket for override
--   failed           — Zod parse failure; row invisible, recoverable
--   manual_override  — user clicked "Submit anyway" after a reject

BEGIN;

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS classification_status text
    CHECK (classification_status IS NULL OR classification_status IN
      ('pending', 'classified', 'rejected', 'failed', 'manual_override')),
  ADD COLUMN IF NOT EXISTS category_confidence real,
  ADD COLUMN IF NOT EXISTS category_rationale  text,
  ADD COLUMN IF NOT EXISTS category_signals    jsonb;

ALTER TABLE public.pipeline_jobs
  DROP CONSTRAINT IF EXISTS pipeline_jobs_status_check;

ALTER TABLE public.pipeline_jobs
  ADD CONSTRAINT pipeline_jobs_status_check
    CHECK (status IN (
      'queued', 'fetching_transcript', 'analyzing', 'generating_embedding',
      'completed', 'failed',
      'skipped_duplicate', 'skipped_duration', 'skipped_no_transcript',
      'skipped_rejected'
    ));

COMMIT;

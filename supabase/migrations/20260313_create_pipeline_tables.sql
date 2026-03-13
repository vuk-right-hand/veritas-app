-- =====================================================
-- Pipeline Automation Tables
-- Purpose: Support n8n-driven automated video ingestion
-- =====================================================

-- 1. pipeline_channels: Which YouTube channels to auto-fetch from
CREATE TABLE IF NOT EXISTS public.pipeline_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL UNIQUE,              -- YouTube channel ID (e.g., UCxxxxxx) — required for RSS
  channel_url text NOT NULL,                    -- Full URL (e.g., https://www.youtube.com/@handle)
  channel_name text NOT NULL,
  last_fetched_at timestamptz,                  -- Last time we successfully fetched RSS for this channel
  fetch_enabled boolean NOT NULL DEFAULT true,
  max_video_age_days integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for the next-video query: find active channels sorted by staleness
CREATE INDEX idx_pipeline_channels_active_fetch
  ON public.pipeline_channels (last_fetched_at ASC NULLS FIRST)
  WHERE status = 'active' AND fetch_enabled = true;

-- 2. pipeline_jobs: Every automation run for debugging/monitoring
CREATE TABLE IF NOT EXISTS public.pipeline_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL,                       -- YouTube video ID
  channel_id text,                              -- YouTube channel ID (nullable for manual runs)
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN (
      'queued', 'fetching_transcript', 'analyzing', 'generating_embedding',
      'completed', 'failed',
      'skipped_duplicate', 'skipped_duration', 'skipped_no_transcript'
    )),
  error_message text,
  transcript_length integer,                    -- Character count of raw transcript
  duration_seconds integer,                     -- Video duration
  processing_time_ms integer,                   -- Total wall-clock time for this job
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for daily rate-limit counting
CREATE INDEX idx_pipeline_jobs_created_date
  ON public.pipeline_jobs (created_at DESC);

-- Index for duplicate checking (fast lookup by video_id)
CREATE INDEX idx_pipeline_jobs_video_id
  ON public.pipeline_jobs (video_id);

-- 3. RLS: These tables are service-role only.
--    No anon/authenticated access.
ALTER TABLE public.pipeline_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_jobs ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon or authenticated roles.
-- Only service_role (which bypasses RLS) can access these tables.

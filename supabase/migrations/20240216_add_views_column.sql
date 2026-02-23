-- 1. Add views_on_platform to videos
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS views_on_platform integer DEFAULT 0;

-- 2. Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('creator_search', 'video_view', 'channel_view', 'user_search')),
  target_id text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_target_type ON analytics_events(target_id, event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);

-- 4. Add links to creators and videos
ALTER TABLE creators ADD COLUMN IF NOT EXISTS links jsonb DEFAULT '[]'::jsonb;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS custom_links jsonb DEFAULT '[]'::jsonb;

-- 5. Enable RLS (Security)
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Safely create policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'analytics_events'
        AND policyname = 'Allow public insert to analytics_events'
    ) THEN
        CREATE POLICY "Allow public insert to analytics_events" 
        ON analytics_events FOR INSERT 
        TO public 
        WITH CHECK (true);
    END IF;
END
$$;

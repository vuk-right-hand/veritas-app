-- 1. Create analytics_events table for tracking views and searches
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('creator_search', 'video_view', 'channel_view')),
  target_id text NOT NULL, -- Can be video_id (string) or channel_url/id (string)
  metadata jsonb DEFAULT '{}'::jsonb, -- Store extra info like referrer, etc.
  created_at timestamp with time zone DEFAULT now()
);

-- Index for faster querying of stats
CREATE INDEX IF NOT EXISTS idx_analytics_events_target_type ON analytics_events(target_id, event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);

-- 2. Add links column to creators table
ALTER TABLE creators 
ADD COLUMN IF NOT EXISTS links jsonb DEFAULT '[]'::jsonb;

-- 3. Add custom_links column to videos table
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS custom_links jsonb DEFAULT '[]'::jsonb;

-- 4. Enable RLS on analytics_events (if not already public logic, but usually analytics are insert-only public, read-admin/owner)
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert events (public analytics)
CREATE POLICY "Allow public insert to analytics_events" 
ON analytics_events FOR INSERT 
TO public 
WITH CHECK (true);

-- Policy: Allow creators to read their own events (This is complex because target_id is text. 
-- For now, we might rely on Service Role for fetching stats in server actions to simplify).
-- If we want direct client select:
-- CREATE POLICY "Allow creators to view their own stats" ...

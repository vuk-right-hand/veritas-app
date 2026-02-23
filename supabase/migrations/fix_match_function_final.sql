-- FINAL FIX: This matches the exact types Supabase expects
-- Run this in Supabase SQL Editor

-- Drop ALL versions of the function (in case there are multiple overloads)
DROP FUNCTION IF EXISTS match_videos;

-- Create with the exact types that Supabase uses
CREATE OR REPLACE FUNCTION match_videos (
  query_embedding vector(3072),
  match_threshold double precision,
  match_count integer
)
RETURNS TABLE (
  id uuid,
  title text,
  human_score integer,
  similarity double precision  -- Changed from 'float' to 'double precision'
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.title,
    v.human_score,
    (1 - (v.embedding <=> query_embedding))::double precision as similarity
  FROM videos v
  WHERE v.embedding IS NOT NULL
    AND 1 - (v.embedding <=> query_embedding) > match_threshold
  ORDER BY v.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

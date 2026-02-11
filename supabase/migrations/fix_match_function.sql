-- CRITICAL: Run this SQL in your Supabase SQL Editor
-- This fixes the match_videos function to accept 3072-dimensional vectors

-- Step 1: Drop the old function
DROP FUNCTION IF EXISTS match_videos(vector, float, int);

-- Step 2: Create the updated function with correct dimensions
CREATE OR REPLACE FUNCTION match_videos (
  query_embedding vector(3072),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  title text,
  human_score integer,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.title,
    v.human_score,
    1 - (v.embedding <=> query_embedding) as similarity
  FROM videos v
  WHERE v.embedding IS NOT NULL
    AND 1 - (v.embedding <=> query_embedding) > match_threshold
  ORDER BY v.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Verify the function was created
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'match_videos';

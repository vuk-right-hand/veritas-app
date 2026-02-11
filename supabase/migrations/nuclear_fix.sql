-- NUCLEAR OPTION: Force-drop ALL versions of match_videos
-- Run this in Supabase SQL Editor

-- Drop with CASCADE to remove any dependencies
DROP FUNCTION IF EXISTS public.match_videos CASCADE;

-- Also try dropping by explicit signature in case there are overloads
DROP FUNCTION IF EXISTS public.match_videos(vector, double precision, integer) CASCADE;
DROP FUNCTION IF EXISTS public.match_videos(vector, float, integer) CASCADE;
DROP FUNCTION IF EXISTS public.match_videos(vector(768), double precision, integer) CASCADE;
DROP FUNCTION IF EXISTS public.match_videos(vector(768), float, integer) CASCADE;

-- Now create the correct version
CREATE FUNCTION public.match_videos (
  query_embedding vector(3072),
  match_threshold double precision,
  match_count integer
)
RETURNS TABLE (
  id uuid,
  title text,
  human_score integer,
  similarity double precision
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

-- Verify it's created correctly
SELECT 
  proname,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as return_type
FROM pg_proc 
WHERE proname = 'match_videos' AND pronamespace = 'public'::regnamespace;

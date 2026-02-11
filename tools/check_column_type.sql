-- Run this in Supabase SQL Editor to see the ACTUAL column definition

SELECT 
  column_name,
  data_type,
  udt_name,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'videos'
  AND column_name = 'embedding';

-- Also check the vector type details
SELECT 
  a.attname AS column_name,
  pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type
FROM pg_catalog.pg_attribute a
WHERE a.attrelid = 'public.videos'::regclass
  AND a.attname = 'embedding'
  AND NOT a.attisdropped;

-- Add missing columns to videos table
alter table public.videos 
add column if not exists thumbnail_url text,
add column if not exists human_score_reason text;

-- Check if embedding exists, if not add it (assuming 768 for Gemini)
-- We use a do block to avoid errors if extension not enabled or column exists
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'videos' and column_name = 'embedding') then
    -- Make sure vector extension is available
    create extension if not exists vector;
    alter table public.videos add column embedding vector(768);
  end if;
end $$;

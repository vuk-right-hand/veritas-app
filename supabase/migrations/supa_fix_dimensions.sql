-- 1. DROP EXISTING DEPENDENCIES
drop function if exists match_videos;
drop index if exists videos_embedding_hnsw_idx;
drop index if exists search_cache_embedding_hnsw_idx;
drop index if exists videos_embedding_ivfflat_idx;
drop index if exists search_cache_embedding_ivfflat_idx;

-- 2. UPDATE VIDEOS TABLE
-- We drop and re-add because changing dimension with data present can be tricky without casting, 
-- and we know the data is currently invalid/empty anyway.
alter table public.videos drop column if exists embedding;
alter table public.videos add column embedding vector(3072);

-- 3. UPDATE SEARCH CACHE TABLE
alter table public.search_cache drop column if exists embedding;
alter table public.search_cache add column embedding vector(3072);

-- 4. SKIP INDEX FOR NOW (Dimension Limit > 2000)
-- Supabase/pgvector on this plan limits indexes to 2000 dims.
-- Our model is 3072. 
-- For < 100,000 videos, exact search (no index) is actually fast enough.
-- We will rely on full table scan until we can switch to a smaller embedding model.

-- drop index if exists videos_embedding_ivfflat_idx;
-- drop index if exists search_cache_embedding_ivfflat_idx;

-- 5. RECREATE MATCH FUNCTION
create or replace function match_videos (
  query_embedding vector(3072),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  title text,
  human_score integer,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    v.id,
    v.title,
    v.human_score,
    1 - (v.embedding <=> query_embedding) as similarity
  from videos v
  where 1 - (v.embedding <=> query_embedding) > match_threshold
  order by v.embedding <=> query_embedding
  limit match_count;
end;
$$;

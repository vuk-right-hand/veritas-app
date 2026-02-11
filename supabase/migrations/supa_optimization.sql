-- 1. SEARCH CACHE TABLE
-- Stores the vector for a specific query text so we don't pay for Gemini Embeddings twice.
create table if not exists public.search_cache (
    id uuid default uuid_generate_v4() primary key,
    query_text text not null unique, -- "how to focus"
    embedding vector(768) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS (Public Read for now, or service role only?)
-- Let's stick to service role for writing, public for reading is fine if needed.
alter table public.search_cache enable row level security;
create policy "Anyone can read cache" on public.search_cache for select using (true);
-- Only service role can insert (handled by API)

-- 2. HNSW INDEX FOR VIDEOS
-- standard ivfflat is O(n), HNSW is O(log n) - much faster for 1M+ rows.
-- We use 'vector_cosine_ops' because we use cosine similarity in match_videos.

-- FIRST: Ensure the column exists (User reported it was missing)
alter table public.videos add column if not exists embedding vector(768);

create index if not exists videos_embedding_hnsw_idx 
on public.videos 
using hnsw (embedding vector_cosine_ops);

-- 3. HNSW INDEX FOR CACHE (Optional, but good if we ever do fuzzy matching on queries)
create index if not exists search_cache_embedding_hnsw_idx 
on public.search_cache 
using hnsw (embedding vector_cosine_ops);

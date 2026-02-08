-- 1. Enable Extensions
create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- 2. CREATE VIDEOS TABLE
create table if not exists public.videos (
  id uuid default uuid_generate_v4() primary key,
  youtube_id text unique not null,
  title text not null,
  channel_name text,
  thumbnail_url text,
  
  -- AI Analysis Data
  human_score integer,
  human_score_reason text,
  takeaways jsonb, 
  category text, 
  vibe_tags text[], 
  
  -- Semantic Search
  embedding vector(768),
  
  -- Stats
  views_on_platform integer default 0,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. CREATE PROFILES TABLE (if not exists)
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  primary_goal text,
  biggest_struggle text,
  human_score_avg numeric default 0,
  invites_count integer default 0,
  is_premium boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. CREATE WATCH HISTORY TABLE (if not exists)
create table if not exists public.watch_history (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id),
  video_id uuid references public.videos(id),
  watched_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed boolean default false,
  quiz_score integer
);

-- 5. RLS POLICIES (Security)
alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.watch_history enable row level security;

-- Policies (use DO block to avoid errors if they exist, or just drop/create)
drop policy if exists "Videos are viewable by everyone." on public.videos;
create policy "Videos are viewable by everyone." on public.videos for select using ( true );

drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone." on public.profiles for select using ( true );

drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile." on public.profiles for insert with check ( auth.uid() = id );

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile." on public.profiles for update using ( auth.uid() = id );

-- 6. SEARCH FUNCTION (The "Brain")
create or replace function match_videos (
  query_embedding vector(768),
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

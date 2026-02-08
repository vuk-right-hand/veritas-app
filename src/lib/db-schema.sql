-- Enable UUID extension
create extension if not exists "uuid-ossp";
-- Enable pgvector (Semantic Search)
create extension if not exists vector;

-- 1. USERS PROFILE (Extends Supabase Auth)
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  
  -- Questionnaire Data
  primary_goal text, -- e.g. "make money online", "video editing"
  biggest_struggle text, -- e.g. "procrastination", "focus"
  
  -- Gamification
  human_score_avg numeric default 0,
  invites_count integer default 0,
  is_premium boolean default false,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. VIDEOS (The "White List" or Scraped Content)
create table public.videos (
  id uuid default uuid_generate_v4() primary key,
  youtube_id text unique not null,
  title text not null,
  channel_name text,
  thumbnail_url text,
  
  -- AI Analysis Data
  human_score integer, -- 0-100
  human_score_reason text,
  takeaways jsonb, 
  category text, 
  vibe_tags text[], 
  
  -- Semantic Search
  embedding vector(768), -- Dimensions for Gemini 'text-embedding-004'
  
  -- Stats
  views_on_platform integer default 0,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Function to Search Videos by Similarity
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

-- 3. USER WATCH HISTORY (For personalized feed)
create table public.watch_history (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id),
  video_id uuid references public.videos(id),
  watched_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed boolean default false,
  quiz_score integer -- Optional: if they took the quiz
);

-- RLS POLICIES (Security)
alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.watch_history enable row level security;

-- Allow users to read all profiles (or just their own? for leaderboard maybe all)
create policy "Public profiles are viewable by everyone." on public.profiles for select using ( true );
create policy "Users can insert their own profile." on public.profiles for insert with check ( auth.uid() = id );
create policy "Users can update own profile." on public.profiles for update using ( auth.uid() = id );

-- Videos are public read
create policy "Videos are viewable by everyone." on public.videos for select using ( true );

-- Watch history is private
create policy "Users can see own history." on public.watch_history for select using ( auth.uid() = user_id );
create policy "Users can insert own history." on public.watch_history for insert with check ( auth.uid() = user_id );

-- TRIGGERS
-- Auto-create profile on signup (optional, usually handled by app logic or trigger)
create function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

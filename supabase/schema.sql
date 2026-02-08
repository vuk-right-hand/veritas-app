-- Enable UUID extension
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 0. Cleanup / Reset (Use with caution in production)
drop table if exists public.comments cascade;
drop table if exists public.videos cascade;
drop table if exists public.channels cascade;
drop table if exists public.profiles cascade;
drop type if exists app_status cascade;

-- 1. Enums
create type app_status as enum ('verified', 'pending', 'banned');

-- 2. Tables

-- PROFILES
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique,
  avatar_url text,
  goals text[],
  subscription_tier text default 'free',
  role text default 'user' check (role in ('user', 'admin')),
  updated_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- CHANNELS
create table public.channels (
  youtube_channel_id text primary key,
  name text not null,
  status app_status default 'pending',
  global_links jsonb default '{}'::jsonb,
  is_claimed boolean default false,
  owner_id uuid references public.profiles(id),
  created_at timestamp with time zone default now()
);

-- VIDEOS
create table public.videos (
  id text primary key, -- YouTube Video ID
  channel_id text references public.channels(youtube_channel_id) on delete cascade,
  title text not null,
  description text,
  transcript text,
  status app_status default 'pending',
  human_score integer check (human_score >= 0 and human_score <= 100),
  summary_points jsonb, -- Array of strings
  category_tag text,
  created_at timestamp with time zone default now()
);

-- COMMENTS
create table public.comments (
  id uuid default gen_random_uuid() primary key,
  video_id text references public.videos(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  text text not null,
  timestamp_marker text,
  created_at timestamp with time zone default now()
);

-- 3. Row Level Security (RLS) Policies

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.channels enable row level security;
alter table public.videos enable row level security;
alter table public.comments enable row level security;

-- PROFILES POLICIES
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using ( true );

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile"
  on public.profiles for update
  using ( auth.uid() = id );

-- CHANNELS POLICIES
create policy "Channels are viewable by everyone"
  on public.channels for select
  using ( true );

create policy "Admins can insert channels"
  on public.channels for insert
  with check ( 
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') 
  );

create policy "Admins can update channels"
  on public.channels for update
  using ( 
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') 
  );

create policy "Channel owners can update their own channel"
  on public.channels for update
  using ( auth.uid() = owner_id );

-- VIDEOS POLICIES
create policy "Videos are viewable by everyone"
  on public.videos for select
  using ( true );

create policy "Admins can insert videos"
  on public.videos for insert
  with check ( 
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') 
  );

create policy "Admins can update videos"
  on public.videos for update
  using ( 
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') 
  );

create policy "Channel owners can insert videos for their channel"
  on public.videos for insert
  with check ( 
    exists (select 1 from public.channels where youtube_channel_id = channel_id and owner_id = auth.uid()) 
  );

create policy "Channel owners can update videos for their channel"
  on public.videos for update
  using ( 
    exists (select 1 from public.channels where youtube_channel_id = channel_id and owner_id = auth.uid()) 
  );

-- COMMENTS POLICIES
create policy "Comments are viewable by everyone"
  on public.comments for select
  using ( true );

create policy "Authenticated users can insert comments"
  on public.comments for insert
  with check ( auth.role() = 'authenticated' );

create policy "Users can update own comments"
  on public.comments for update
  using ( auth.uid() = user_id );

create policy "Users can delete own comments"
  on public.comments for delete
  using ( auth.uid() = user_id );

-- 4. Triggers (Optional but recommended for syncing user creation)
-- Create a trigger to automatically create a profile entry when a new user signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url, role)
  values (new.id, new.raw_user_meta_data ->> 'username', new.raw_user_meta_data ->> 'avatar_url', 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

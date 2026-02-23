-- =====================================================
-- SUPER-FAN METRIC: Watch Time per Creator
-- =====================================================

-- Table: user_creator_stats
-- Tracks aggregated watch time for a user on a specific channel.
create table if not exists public.user_creator_stats (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id text not null references public.channels(youtube_channel_id) on delete cascade,
  total_watch_seconds integer not null default 0,
  last_watched_at timestamp with time zone default now(),
  
  -- Ensure one record per user per channel
  constraint uq_user_creator_stats unique (user_id, channel_id)
);

-- Indexes for performance
create index if not exists idx_user_creator_stats_user_id on public.user_creator_stats(user_id);
create index if not exists idx_user_creator_stats_channel_id on public.user_creator_stats(channel_id);
create index if not exists idx_user_creator_stats_watch_time on public.user_creator_stats(total_watch_seconds desc);


-- RLS Policies
alter table public.user_creator_stats enable row level security;

-- Users can view their own stats
create policy "Users can view own creator stats"
  on public.user_creator_stats for select
  using (auth.uid() = user_id);

-- Admins can view all stats
create policy "Admins can view all creator stats"
  on public.user_creator_stats for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- RPC: track_creator_watch_time
-- Atomically increments watch time for a user/channel pair.
-- Handles insert (if record doesn't exist) or update.
create or replace function public.track_creator_watch_time(
  p_video_id text,
  p_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id text;
  v_user_id uuid;
begin
  -- Get user ID
  v_user_id := auth.uid();
  if v_user_id is null then
    return; -- Do nothing if not authenticated
  end if;

  -- Get channel ID from video
  select channel_id into v_channel_id
  from public.videos
  where id = p_video_id;

  if v_channel_id is null then
    -- Verify if video exists but has no channel_id, or video doesn't exist
    -- In this app logic, if we can't link video to channel, we can't track creator stats.
    return;
  end if;

  -- Upsert stats
  insert into public.user_creator_stats (user_id, channel_id, total_watch_seconds, last_watched_at)
  values (v_user_id, v_channel_id, p_seconds, now())
  on conflict (user_id, channel_id)
  do update set
    total_watch_seconds = user_creator_stats.total_watch_seconds + p_seconds,
    last_watched_at = now();

end;
$$;

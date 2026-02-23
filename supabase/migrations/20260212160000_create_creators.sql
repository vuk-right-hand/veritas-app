-- Create the creators table to store channel data linked to users
create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  channel_id text unique not null,
  channel_name text not null,
  channel_handle text,
  channel_url text,
  is_verified boolean default false,
  verification_token text,
  subscribers text,
  human_score integer,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.creators enable row level security;

-- Policies
create policy "Creators can view their own profile"
  on public.creators for select
  using (auth.uid() = user_id);

create policy "Creators can update their own profile"
  on public.creators for update
  using (auth.uid() = user_id);

-- Allow new creators to insert their profile during onboarding (if authenticated)
-- Or we handle this via Service Role in the backend action
create policy "Service role can manage all creators"
    on public.creators
    using (true)
    with check (true);

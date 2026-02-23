create table if not exists public.channel_suggestions (
    id uuid primary key default gen_random_uuid(),
    channel_url text not null unique,
    title text,
    avatar_url text,
    status text default 'pending',
    suggestion_count integer default 1,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.channel_suggestions enable row level security;

create policy "Enable read access for all users" on public.channel_suggestions
    for select using (true);

create policy "Enable insert for all users" on public.channel_suggestions
    for insert with check (true);

create policy "Enable update for all users" on public.channel_suggestions
    for update using (true);

create policy "Enable delete for all users" on public.channel_suggestions
    for delete using (true);

create table if not exists public.platform_updates (
    id uuid primary key default gen_random_uuid(),
    video_id text not null,
    title text,
    message text,
    status text default 'pending',
    suggestion_count integer default 1,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.platform_updates enable row level security;

create policy "Enable read access for all users" on public.platform_updates
    for select using (true);

create policy "Enable insert for all users" on public.platform_updates
    for insert with check (true);

create policy "Enable update for all users" on public.platform_updates
    for update using (true);

create policy "Enable delete for all users" on public.platform_updates
    for delete using (true);

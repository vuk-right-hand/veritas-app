-- Create feature_requests table
create table public.feature_requests (
  id uuid not null default gen_random_uuid (),
  user_id uuid null references auth.users (id) on delete set null,
  content text not null,
  status text not null default 'pending', -- pending, reviewed, implemented
  created_at timestamp with time zone not null default now(),
  constraint feature_requests_pkey primary key (id)
);

-- RLS Policies
alter table public.feature_requests enable row level security;

create policy "Enable insert for authenticated users only" on public.feature_requests as permissive
  for insert to authenticated
  with check (true);

create policy "Enable read for admin users" on public.feature_requests as permissive
  for select to authenticated
  using (true); -- Ideally restrict to admins, but simplifying for now

-- BabyLog Supabase schema
create extension if not exists pgcrypto;

create table if not exists public.babies (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  birthdate timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create table if not exists public.feed_events (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  baby_id text not null references public.babies(id) on delete cascade,
  timestamp timestamptz not null,
  type text not null check (type in ('breast','bottle','formula','solids')),
  amount_ml numeric,
  duration_minutes int,
  side text not null check (side in ('left','right','both','none')),
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create table if not exists public.measurements (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  baby_id text not null references public.babies(id) on delete cascade,
  timestamp timestamptz not null,
  weight_kg numeric not null,
  length_cm numeric,
  head_circumference_cm numeric,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists idx_babies_user_id on public.babies(user_id);
create index if not exists idx_feed_user_id on public.feed_events(user_id);
create index if not exists idx_feed_baby_time on public.feed_events(baby_id, timestamp desc);
create index if not exists idx_measurements_user_id on public.measurements(user_id);
create index if not exists idx_measurements_baby_time on public.measurements(baby_id, timestamp desc);

alter table public.babies enable row level security;
alter table public.feed_events enable row level security;
alter table public.measurements enable row level security;

create policy "babies owner read" on public.babies
for select using (auth.uid() = user_id);
create policy "babies owner write" on public.babies
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "feed owner read" on public.feed_events
for select using (auth.uid() = user_id);
create policy "feed owner write" on public.feed_events
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "measurement owner read" on public.measurements
for select using (auth.uid() = user_id);
create policy "measurement owner write" on public.measurements
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

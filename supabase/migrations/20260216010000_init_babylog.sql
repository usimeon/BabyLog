-- BabyLog baseline schema
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

create table if not exists public.temperature_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  baby_id text not null references public.babies(id) on delete cascade,
  timestamp timestamptz not null,
  temperature_c numeric not null,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create table if not exists public.diaper_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  baby_id text not null references public.babies(id) on delete cascade,
  timestamp timestamptz not null,
  had_pee boolean not null default false,
  had_poop boolean not null default false,
  poop_size text check (poop_size in ('small','medium','large')),
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create table if not exists public.medication_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  baby_id text not null references public.babies(id) on delete cascade,
  timestamp timestamptz not null,
  medication_name text not null,
  dose_value numeric not null,
  dose_unit text not null check (dose_unit in ('ml','mg','drops','tablet')),
  min_interval_hours numeric,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create table if not exists public.milestones (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  baby_id text not null references public.babies(id) on delete cascade,
  timestamp timestamptz not null,
  title text not null,
  notes text,
  photo_uri text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists idx_babies_user_id on public.babies(user_id);
create index if not exists idx_feed_user_id on public.feed_events(user_id);
create index if not exists idx_feed_baby_time on public.feed_events(baby_id, timestamp desc);
create index if not exists idx_measurements_user_id on public.measurements(user_id);
create index if not exists idx_measurements_baby_time on public.measurements(baby_id, timestamp desc);
create index if not exists idx_temperature_logs_user_id on public.temperature_logs(user_id);
create index if not exists idx_temperature_logs_baby_time on public.temperature_logs(baby_id, timestamp desc);
create index if not exists idx_diaper_logs_user_id on public.diaper_logs(user_id);
create index if not exists idx_diaper_logs_baby_time on public.diaper_logs(baby_id, timestamp desc);
create index if not exists idx_medication_logs_user_id on public.medication_logs(user_id);
create index if not exists idx_medication_logs_baby_time on public.medication_logs(baby_id, timestamp desc);
create index if not exists idx_milestones_user_id on public.milestones(user_id);
create index if not exists idx_milestones_baby_time on public.milestones(baby_id, timestamp desc);

alter table public.babies enable row level security;
alter table public.feed_events enable row level security;
alter table public.measurements enable row level security;
alter table public.temperature_logs enable row level security;
alter table public.diaper_logs enable row level security;
alter table public.medication_logs enable row level security;
alter table public.milestones enable row level security;

drop policy if exists "babies owner read" on public.babies;
drop policy if exists "babies owner write" on public.babies;
create policy "babies owner read" on public.babies
for select using (auth.uid() = user_id);
create policy "babies owner write" on public.babies
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "feed owner read" on public.feed_events;
drop policy if exists "feed owner write" on public.feed_events;
create policy "feed owner read" on public.feed_events
for select using (auth.uid() = user_id);
create policy "feed owner write" on public.feed_events
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "measurement owner read" on public.measurements;
drop policy if exists "measurement owner write" on public.measurements;
create policy "measurement owner read" on public.measurements
for select using (auth.uid() = user_id);
create policy "measurement owner write" on public.measurements
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "temperature owner read" on public.temperature_logs;
drop policy if exists "temperature owner write" on public.temperature_logs;
create policy "temperature owner read" on public.temperature_logs
for select using (auth.uid() = user_id);
create policy "temperature owner write" on public.temperature_logs
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "diaper owner read" on public.diaper_logs;
drop policy if exists "diaper owner write" on public.diaper_logs;
create policy "diaper owner read" on public.diaper_logs
for select using (auth.uid() = user_id);
create policy "diaper owner write" on public.diaper_logs
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "medication owner read" on public.medication_logs;
drop policy if exists "medication owner write" on public.medication_logs;
create policy "medication owner read" on public.medication_logs
for select using (auth.uid() = user_id);
create policy "medication owner write" on public.medication_logs
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "milestone owner read" on public.milestones;
drop policy if exists "milestone owner write" on public.milestones;
create policy "milestone owner read" on public.milestones
for select using (auth.uid() = user_id);
create policy "milestone owner write" on public.milestones
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

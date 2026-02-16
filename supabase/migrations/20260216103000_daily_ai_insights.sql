create table if not exists public.daily_ai_insights (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  baby_id text not null references public.babies(id) on delete cascade,
  date date not null,
  payload_json jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_daily_ai_insights_user_baby_date
  on public.daily_ai_insights(user_id, baby_id, date);

create index if not exists idx_daily_ai_insights_user_id on public.daily_ai_insights(user_id);

alter table public.daily_ai_insights enable row level security;

drop policy if exists "daily_ai_insights owner read" on public.daily_ai_insights;
drop policy if exists "daily_ai_insights owner write" on public.daily_ai_insights;

create policy "daily_ai_insights owner read" on public.daily_ai_insights
for select using (auth.uid() = user_id);

create policy "daily_ai_insights owner write" on public.daily_ai_insights
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

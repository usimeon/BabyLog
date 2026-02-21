alter table if exists public.babies
  add column if not exists photo_uri text;

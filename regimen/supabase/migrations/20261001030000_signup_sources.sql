-- How a person first found Regimen (e.g. utm_source=instagram), saved once when they first sign in.
-- Only counts are looked at; users can insert and read their own row, nobody can change it afterwards.
create table if not exists public.signup_sources (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  source text,
  medium text,
  campaign text,
  referrer text,
  landing text,
  first_seen timestamptz,
  created_at timestamptz not null default now()
);
alter table public.signup_sources enable row level security;
drop policy if exists "insert own source" on public.signup_sources;
create policy "insert own source" on public.signup_sources for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "read own source" on public.signup_sources;
create policy "read own source" on public.signup_sources for select to authenticated using (user_id = (select auth.uid()));

-- Private calendar subscription link (Google Calendar, Outlook, Apple Calendar) per user.
-- The token is the secret in the link; the calendar-feed Edge Function looks it up with the service role.
-- Deleting the row ("Stop syncing") makes the old link stop working.
create table if not exists public.calendar_feeds (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  tz text not null default 'UTC',   -- IANA time zone for workout times, e.g. America/Toronto
  created_at timestamptz not null default now()
);
alter table public.calendar_feeds enable row level security;
drop policy if exists "own feed" on public.calendar_feeds;
create policy "own feed" on public.calendar_feeds for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

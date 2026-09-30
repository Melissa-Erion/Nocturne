-- Per-user hourly count of live USDA searches (cache hits don't count), so one account can't use up the shared USDA key.
create table if not exists public.usda_usage (
  user_id uuid not null references auth.users on delete cascade,
  hour timestamptz not null,
  n int not null default 0,
  primary key (user_id, hour)
);
alter table public.usda_usage enable row level security;
revoke all on public.usda_usage from anon, authenticated;

create or replace function public.bump_usda_usage(uid uuid)
returns int
language sql
security definer
set search_path = ''
as $$
  insert into public.usda_usage (user_id, hour, n) values (uid, date_trunc('hour', now()), 1)
  on conflict (user_id, hour) do update set n = public.usda_usage.n + 1
  returning n;
$$;
revoke all on function public.bump_usda_usage(uuid) from public, anon, authenticated;
grant execute on function public.bump_usda_usage(uuid) to service_role;

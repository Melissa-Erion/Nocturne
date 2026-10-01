-- Per-weekday workout times ({"0": "06:30", "3": "18:00"}, 0 = Monday) and the user's clock format.
alter table public.profiles
  add column if not exists day_times jsonb not null default '{}'::jsonb,
  add column if not exists clock text not null default '12h';
alter table public.profiles drop constraint if exists profiles_clock_check;
alter table public.profiles add constraint profiles_clock_check check (clock in ('12h', '24h'));

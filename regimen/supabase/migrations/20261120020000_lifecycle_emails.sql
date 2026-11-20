-- Lifecycle emails (trial ending, come-back). Server only: RLS on with no policies, so only the service role
-- (the lifecycle-emails Edge Function) can read or write these.

-- One row per email sent, so the daily run never sends the same email twice.
create table if not exists public.email_log (
  user_id uuid not null references auth.users on delete cascade,
  kind text not null,
  ref text not null,           -- e.g. the trial end date the email was about
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;

-- Unsubscribe from marketing emails (CASL): each user gets a random token used in the unsubscribe link.
create table if not exists public.email_prefs (
  user_id uuid primary key references auth.users on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  unsubscribed boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.email_prefs enable row level security;
revoke all on public.email_prefs from anon, authenticated;

-- Shared secret the daily scheduler sends to the function. Generated here; never committed or shown.
insert into public.app_secrets (name, value)
values ('lifecycle_cron_auth', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (name) do nothing;

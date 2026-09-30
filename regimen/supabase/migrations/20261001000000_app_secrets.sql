-- Server-only settings (e.g. the RevenueCat webhook's Authorization value). RLS on with no policies and no grants:
-- only the service role (Edge Functions) can read it. Values are inserted from the dashboard/SQL, never committed.
create table if not exists public.app_secrets (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

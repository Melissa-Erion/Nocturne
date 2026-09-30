-- Subscription / access state per user. The app only reads it; it is written by the server
-- (RevenueCat webhook once billing is live, or manually for complimentary access).
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  status text not null check (status in ('trialing','active','canceled','expired','comp')),
  plan text check (plan in ('monthly','yearly')),
  period_end timestamptz,          -- access ends after this (null for comp)
  source text,                     -- 'stripe' | 'app_store' | 'play_store' | 'manual'
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));
-- No insert/update/delete policies: users can't grant themselves access.

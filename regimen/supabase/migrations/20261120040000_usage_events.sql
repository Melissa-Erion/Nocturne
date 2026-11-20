-- Usage events for the sign-up → paying funnel. Signed-in users can only add their own events (they can't read any);
-- the report lives in the private "analytics" schema, which the app's API doesn't expose. Owner reads it in the SQL editor:
--   select * from analytics.funnel_weekly;
create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (name in (
    'app_open', 'setup_done', 'food_added', 'meal_eaten', 'extra_logged', 'workout_started', 'workout_finished',
    'paywall_prompt', 'upgrade_viewed', 'checkout_started', 'checkout_done', 'calorie_check_applied')),
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) < 1024),
  at timestamptz not null default now()
);
create index if not exists events_user_name_idx on public.events (user_id, name);
alter table public.events enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'events' and policyname = 'add own events') then
    create policy "add own events" on public.events for insert to authenticated with check (user_id = (select auth.uid()));
  end if;
end $$;
revoke all on table public.events from anon, authenticated;
grant insert (name, props) on table public.events to authenticated;

create schema if not exists analytics;
revoke all on schema analytics from anon, authenticated, public;

-- One row per sign-up week: how many people reached each step (ever, not just that week).
create or replace view analytics.funnel_weekly as
with u as (
  select id, date_trunc('week', created_at)::date as week from auth.users
), e as (
  select user_id, array_agg(distinct name) as names from public.events group by user_id
)
select
  u.week,
  count(*) as signed_up,
  count(*) filter (where 'setup_done' = any(e.names) or p.onboarded) as finished_setup,
  count(*) filter (where e.names && array['food_added', 'meal_eaten', 'extra_logged']) as used_meals,
  count(*) filter (where e.names && array['workout_started']) as started_a_workout,
  count(*) filter (where 'paywall_prompt' = any(e.names) or 'upgrade_viewed' = any(e.names)) as saw_the_offer,
  count(*) filter (where 'checkout_started' = any(e.names)) as opened_checkout,
  count(*) filter (where s.status in ('trialing', 'active', 'canceled', 'expired')) as started_trial,
  count(*) filter (where s.status = 'active') as paying_now
from u
left join e on e.user_id = u.id
left join public.profiles p on p.user_id = u.id
left join public.subscriptions s on s.user_id = u.id
group by u.week
order by u.week desc;

-- Which locked features make people hit the paywall most (last 30 days).
create or replace view analytics.paywall_features as
select props->>'feature' as feature, count(*) as prompts, count(distinct user_id) as people
from public.events where name = 'paywall_prompt' and at > now() - interval '30 days'
group by 1 order by prompts desc;
revoke all on all tables in schema analytics from anon, authenticated, public;

-- Accounts left out of the reports (the owner's own accounts). Rows are added by hand in the SQL editor, e.g.
--   insert into analytics.internal_users (user_id, note) select id, 'owner' from auth.users where email = '…';
create table if not exists analytics.internal_users (
  user_id uuid primary key references auth.users on delete cascade,
  note text not null default ''
);
revoke all on analytics.internal_users from anon, authenticated, public;

create or replace view analytics.funnel_weekly as
with u as (
  select id, date_trunc('week', created_at)::date as week from auth.users
  where id not in (select user_id from analytics.internal_users)
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

create or replace view analytics.paywall_features as
select props->>'feature' as feature, count(*) as prompts, count(distinct user_id) as people
from public.events
where name = 'paywall_prompt' and at > now() - interval '30 days'
  and user_id not in (select user_id from analytics.internal_users)
group by 1 order by prompts desc;
revoke all on all tables in schema analytics from anon, authenticated, public;

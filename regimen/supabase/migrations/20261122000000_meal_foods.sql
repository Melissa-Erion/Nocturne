-- Foods the user picked for each meal slot ("Choose my foods" on Eat › Meals). Index = meal, values = food ids.
alter table public.profiles add column if not exists meal_foods jsonb;

-- Usage event for choosing foods.
alter table public.events drop constraint if exists events_name_check;
alter table public.events add constraint events_name_check check (name in (
  'app_open', 'setup_done', 'food_added', 'meal_eaten', 'extra_logged', 'workout_started', 'workout_finished',
  'paywall_prompt', 'upgrade_viewed', 'checkout_started', 'checkout_done', 'calorie_check_applied', 'meal_foods_set'));

-- Indexes covering the composite foreign keys (Supabase performance advisor).
create index if not exists day_meals_user_date_idx on public.day_meals (user_id, date);
create index if not exists meal_items_user_meal_idx on public.meal_items (user_id, meal_id);
create index if not exists photos_user_checkin_idx on public.photos (user_id, checkin_id);
create index if not exists plan_items_user_workout_idx on public.plan_items (user_id, workout_id);
create index if not exists plan_workouts_user_plan_idx on public.plan_workouts (user_id, plan_id);
create index if not exists recipe_ingredients_user_recipe_idx on public.recipe_ingredients (user_id, recipe_id);
create index if not exists session_sets_user_session_idx on public.session_sets (user_id, session_id);

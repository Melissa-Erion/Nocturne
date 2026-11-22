-- Grocery items can be removed from the list (hidden until restored).
alter table public.grocery_checks add column if not exists removed boolean not null default false;
-- How many days the grocery list covers, and prep-from-plan settings (days, which meal slots).
alter table public.profiles add column if not exists shop_days integer;
alter table public.profiles add column if not exists prep_days integer;
alter table public.profiles add column if not exists prep_meals jsonb;

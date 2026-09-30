-- The guided app tour has been finished or skipped (it can be replayed from Settings or the menu).
alter table public.profiles add column if not exists tour_done boolean not null default false;

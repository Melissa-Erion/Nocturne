-- Deleting a plan that has logged history hides it instead of removing it, so past workouts keep their names.
alter table public.plans add column if not exists archived boolean not null default false;

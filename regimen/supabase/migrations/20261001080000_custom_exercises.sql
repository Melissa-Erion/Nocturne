-- Exercises a user adds themselves (the built-in library stays in public.exercises).
create table if not exists public.custom_exercises (
  -- Linked to the profile (itself deleted with the account), so deleting an account removes these too.
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) between 1 and 80),
  muscle text not null default 'Other',
  region text not null default 'full' check (region in ('upper', 'lower', 'core', 'full')),
  equip text not null default 'Bodyweight',
  instr text not null default '' check (char_length(instr) <= 1000),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.custom_exercises enable row level security;
drop policy if exists "own custom exercises" on public.custom_exercises;
create policy "own custom exercises" on public.custom_exercises for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Exercises a user adds themselves (the built-in library stays in public.exercises).
create table if not exists public.custom_exercises (
  user_id uuid not null,
  id text not null,
  name text not null check (char_length(name) between 1 and 80),
  muscle text not null default 'Other',
  region text not null default 'full' check (region in ('upper', 'lower', 'core', 'full')),
  equip text not null default 'Bodyweight',
  instr text not null default '' check (char_length(instr) <= 1000),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
-- Linked to the profile (itself deleted with the account), so deleting an account removes these too.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'custom_exercises_user_id_fkey') then
    alter table public.custom_exercises add constraint custom_exercises_user_id_fkey
      foreign key (user_id) references public.profiles (user_id) on delete cascade;
  end if;
end $$;
alter table public.custom_exercises enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'custom_exercises' and policyname = 'own custom exercises') then
    create policy "own custom exercises" on public.custom_exercises for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end $$;
-- Signed-in users only (row-level security limits them to their own rows).
revoke all on table public.custom_exercises from anon;
grant select, insert, update, delete on table public.custom_exercises to authenticated;

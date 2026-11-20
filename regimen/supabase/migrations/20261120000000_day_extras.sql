-- Food eaten that wasn't in the plan ("Log something else"). The day's remaining meals are re-portioned around it.
create table if not exists public.day_extras (
  user_id uuid not null default auth.uid(),
  id text not null,
  date date not null,
  position int not null default 0,
  name text not null check (char_length(name) between 1 and 120),
  food_id text,
  grams double precision not null default 0,
  estimate jsonb,
  primary key (user_id, id)
);
-- Removed with its day (and so with the account).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'day_extras_day_fkey') then
    alter table public.day_extras add constraint day_extras_day_fkey
      foreign key (user_id, date) references public.day_plans (user_id, date) on delete cascade;
  end if;
end $$;
alter table public.day_extras enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'day_extras' and policyname = 'own day extras') then
    create policy "own day extras" on public.day_extras for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end $$;
-- Signed-in users only (row-level security limits them to their own rows).
revoke all on table public.day_extras from anon;
grant select, insert, update, delete on table public.day_extras to authenticated;

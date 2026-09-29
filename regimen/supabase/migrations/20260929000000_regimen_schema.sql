-- Regimen schema. Every user table is scoped to user_id = auth.uid() by Row-Level Security.
-- Check-ins, measurements and photos are sensitive: photos live in a PRIVATE bucket and are served only via short-lived signed URLs.
-- Metric is the internal standard (kg, cm, g, ml).

-- ───────────── Global reference data (read-only for users) ─────────────
create table if not exists public.exercises (
  id text primary key,
  name text not null,
  muscle text not null,
  region text not null check (region in ('upper','lower','core','full')),
  equipment text not null,
  instructions text not null default '',
  alt_ids text[] not null default '{}'
);

-- Foods: user_id null = global library; otherwise a user's custom food.
create table if not exists public.foods (
  id text primary key,
  user_id uuid references auth.users on delete cascade,
  name text not null,
  basis text not null check (basis in ('raw','cooked','drained','prepared','edible')),
  kcal double precision not null,
  protein double precision not null,
  carbs double precision not null,
  fat double precision not null,
  role text not null check (role in ('protein','carb','fat','veg')),
  category text not null default 'Other',
  tags text[] not null default '{}',
  source text not null default '',
  estimated boolean not null default false,
  serving jsonb,
  raw_id text,
  cooked_id text,
  yield double precision,
  buy jsonb,
  extra jsonb not null default '{}'
);
create index if not exists foods_user_idx on public.foods (user_id);

-- ───────────── Per-user tables ─────────────
create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  name text not null default '',
  goal text not null default 'Fat loss',
  weight_kg double precision,
  goal_weight_kg double precision,
  height_cm double precision,
  age int,
  sex text not null default 'Female',
  activity text not null default 'Moderately active',
  experience text not null default 'Intermediate',
  training_days int[] not null default '{0,1,3,4}',   -- Mon = 0
  rest_days int[] not null default '{2,5,6}',
  duration_min int not null default 60,
  workout_time text not null default '17:30',
  location text not null default 'Gym',
  equipment text[] not null default '{}',
  priorities text[] not null default '{}',
  kcal int not null default 1800,
  protein_g int not null default 140,
  carbs_g int not null default 190,
  fat_g int not null default 55,
  meals_per_day int not null default 4 check (meals_per_day between 1 and 6),
  diet_prefs text[] not null default '{}',
  allergies text[] not null default '{}',
  exclude text[] not null default '{}',
  check_in_day int not null default 6,
  check_in_freq text not null default 'Weekly',
  units text not null default 'metric' check (units in ('metric','imperial')),
  water_enabled boolean not null default true,
  water_ml int not null default 2500,
  supplements boolean not null default false,
  increments jsonb not null default '{"Barbell":2.5,"Dumbbell":2,"Cable":2.5,"Machine":5,"Bodyweight":0}',
  progression text not null default 'double' check (progression in ('double','linear')),
  shift_later boolean not null default true,
  calendar_sync boolean not null default false,
  quiet_start text not null default '22:00',
  quiet_end text not null default '07:00',
  quote_tone text not null default 'Disciplined',
  onboarded boolean not null default false,
  start_date date,
  active_plan_id text,
  active_workout jsonb,           -- in-progress session, so it can be resumed on any device
  is_sample boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null,
  note text not null default '',
  rotation text[] not null default '{}',
  allow_consecutive boolean not null default false,
  position int not null default 0,
  primary key (user_id, id)
);

create table if not exists public.plan_workouts (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,               -- '<plan_id>:<code>'
  plan_id text not null,
  code text not null,             -- L1, U1 …
  name text not null,
  focus text not null default '',
  region text not null default 'full',
  muscles text[] not null default '{}',
  position int not null default 0,
  primary key (user_id, id),
  foreign key (user_id, plan_id) references public.plans (user_id, id) on delete cascade
);

create table if not exists public.plan_items (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,               -- '<workout_id>:<item_key>'
  workout_id text not null,
  item_key text not null,
  exercise_id text not null,
  position int not null default 0,
  sets int not null,
  rep_min int not null,
  rep_max int not null,
  rir int not null default 2,
  rest_s int not null default 90,
  tempo text not null default '',
  warmups int not null default 0,
  superset text not null default '',
  notes text not null default '',
  target_kg double precision,
  media_url text,
  replaced jsonb not null default '[]',   -- [{exId, date}]
  primary key (user_id, id),
  foreign key (user_id, workout_id) references public.plan_workouts (user_id, id) on delete cascade
);

create table if not exists public.schedule_entries (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  date date not null,
  plan_id text not null,
  workout_code text not null,
  status text not null check (status in ('planned','done','missed','skipped')),
  origin text not null check (origin in ('auto','manual','rescheduled')),
  session_id text,
  rescheduled_to text,
  from_entry text,
  primary key (user_id, id)
);
create index if not exists schedule_date_idx on public.schedule_entries (user_id, date);

create table if not exists public.pauses (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  from_date date not null,
  to_date date,
  reason text not null default '',
  primary key (user_id, id)
);

create table if not exists public.sessions (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  date date not null,
  workout_code text not null,
  plan_id text not null,
  entry_id text,
  duration_min int not null default 0,
  notes text not null default '',
  primary key (user_id, id)
);

create table if not exists public.session_sets (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,               -- '<session_id>:<position>'
  session_id text not null,
  position int not null,
  exercise_id text not null,
  kg double precision not null default 0,
  reps int not null,
  rir double precision,
  warm boolean not null default false,
  note text not null default '',
  feel text not null default '',
  substituted_for text,
  primary key (user_id, id),
  foreign key (user_id, session_id) references public.sessions (user_id, id) on delete cascade
);

create table if not exists public.weights (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  kg double precision not null,
  primary key (user_id, date)
);

create table if not exists public.checkins (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  date date not null,
  kg double precision,
  waist double precision,
  hips double precision,
  chest double precision,
  thighs double precision,
  arms double precision,
  custom jsonb not null default '[]',
  energy int, sleep int, hunger int, stress int, recovery int,   -- 1–5
  cycle text not null default '',
  strength text not null default '',
  notes text not null default '',
  primary key (user_id, id)
);

create table if not exists public.photos (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,               -- '<checkin_id>:<pose>'
  checkin_id text not null,
  pose text not null,             -- front / side / back / custom…
  storage_path text not null,     -- object path in the private 'progress-photos' bucket
  primary key (user_id, id),
  foreign key (user_id, checkin_id) references public.checkins (user_id, id) on delete cascade
);

create table if not exists public.nutrition_log (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  kcal double precision not null default 0,
  protein double precision not null default 0,
  carbs double precision not null default 0,
  fat double precision not null default 0,
  prepped boolean,
  water_ml int not null default 0,
  primary key (user_id, date)
);

create table if not exists public.day_plans (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  type text not null check (type in ('training','rest')),
  water_ml int not null default 0,
  primary key (user_id, date)
);

create table if not exists public.day_meals (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  date date not null,
  slot int not null,
  logged boolean not null default false,
  prepped boolean not null default false,
  primary key (user_id, id),
  foreign key (user_id, date) references public.day_plans (user_id, date) on delete cascade
);

create table if not exists public.meal_items (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  meal_id text not null,
  position int not null default 0,
  food_id text not null,
  grams double precision not null default 0,
  locked boolean not null default false,
  estimate jsonb,
  primary key (user_id, id),
  foreign key (user_id, meal_id) references public.day_meals (user_id, id) on delete cascade
);

create table if not exists public.meal_slots (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,               -- '<day_type>:<index>'
  day_type text not null check (day_type in ('training','rest')),
  index int not null,
  name text not null default '',
  label text not null default '',
  time text not null default '',
  primary key (user_id, id)
);

create table if not exists public.distribution (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  mode text not null default 'prepost' check (mode in ('equal','custom','prepost','protein','manual')),
  custom double precision[] not null default '{25,25,25,25}',
  manual jsonb,
  pre_idx int not null default 2,
  post_idx int not null default 3,
  protein_idx int[] not null default '{1,3}'
);

create table if not exists public.saved_meals (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null,
  items jsonb not null default '[]',    -- [{foodId, g}]
  estimate jsonb,                       -- restaurant estimate {kcal,p,c,f}
  fav boolean not null default false,
  uses int not null default 0,
  position int not null default 0,
  primary key (user_id, id)
);

create table if not exists public.recipes (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null,
  cooked_weight double precision not null default 0,
  servings int not null default 1,
  by_weight boolean not null default false,
  serving_g double precision,
  fav boolean not null default false,
  position int not null default 0,
  primary key (user_id, id)
);

create table if not exists public.recipe_ingredients (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,               -- '<recipe_id>:<position>'
  recipe_id text not null,
  position int not null,
  food_id text not null,
  grams double precision not null,
  primary key (user_id, id),
  foreign key (user_id, recipe_id) references public.recipes (user_id, id) on delete cascade
);

create table if not exists public.prep_plans (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  source_id text not null,
  kind text not null check (kind in ('meal','recipe')),
  containers int not null default 1,
  people int not null default 1,
  days int not null default 1,
  version text not null default 'training',
  actual jsonb not null default '{}',
  position int not null default 0,
  primary key (user_id, id)
);

create table if not exists public.grocery_checks (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  checked boolean not null default true,
  primary key (user_id, id)
);

create table if not exists public.grocery_manual (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null,
  qty text not null default '',
  category text not null default 'Other',
  position int not null default 0,
  primary key (user_id, id)
);

create table if not exists public.reminders (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  type text not null,
  time text not null,
  freq text not null,
  channel text not null default 'Push',
  snooze_min int not null default 0,
  enabled boolean not null default true,
  reschedule boolean not null default false,
  note text,
  position int not null default 0,
  primary key (user_id, id)
);

create table if not exists public.quotes_user (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,               -- '<kind>:<quote_id>'
  kind text not null check (kind in ('fav','hidden','custom')),
  quote_id text not null,
  text text,
  tone text,
  position int not null default 0,
  primary key (user_id, id)
);

-- ───────────── Row-Level Security ─────────────
do $$
declare t text;
begin
  foreach t in array array['profiles','plans','plan_workouts','plan_items','schedule_entries','pauses','sessions','session_sets',
    'weights','checkins','photos','nutrition_log','day_plans','day_meals','meal_items','meal_slots','distribution','saved_meals',
    'recipes','recipe_ingredients','prep_plans','grocery_checks','grocery_manual','reminders','quotes_user']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

alter table public.exercises enable row level security;
drop policy if exists "read exercises" on public.exercises;
create policy "read exercises" on public.exercises for select to authenticated using (true);

alter table public.foods enable row level security;
drop policy if exists "read global and own foods" on public.foods;
create policy "read global and own foods" on public.foods for select to authenticated using (user_id is null or user_id = (select auth.uid()));
drop policy if exists "write own foods" on public.foods;
create policy "write own foods" on public.foods for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "update own foods" on public.foods;
create policy "update own foods" on public.foods for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "delete own foods" on public.foods;
create policy "delete own foods" on public.foods for delete to authenticated using (user_id = (select auth.uid()));

-- ───────────── Private photo storage ─────────────
-- Objects are stored at '<user_id>/<checkin_id>/<pose>-<timestamp>.jpg'. The bucket is private: no public URLs, signed URLs only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set public = false;

drop policy if exists "own photos select" on storage.objects;
create policy "own photos select" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "own photos insert" on storage.objects;
create policy "own photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "own photos update" on storage.objects;
create policy "own photos update" on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "own photos delete" on storage.objects;
create policy "own photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

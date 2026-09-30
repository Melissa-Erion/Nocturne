-- Separate rest-day macro targets (null = use the training-day targets).
alter table public.profiles
  add column if not exists rest_kcal int,
  add column if not exists rest_protein_g int,
  add column if not exists rest_carbs_g int,
  add column if not exists rest_fat_g int;

-- Shared cache of USDA search results, keyed by normalised query + limit, so repeat searches don't call USDA.
-- Only the usda-search Edge Function (service role) reads or writes it: RLS is on and there are no policies.
create table if not exists public.food_search_cache (
  query_key text primary key,
  results jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.food_search_cache enable row level security;
create index if not exists food_search_cache_created_idx on public.food_search_cache (created_at);

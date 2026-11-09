-- RepSense: diet, meal logging and the AI coach. Run once, after 0001_init.sql.
-- Same rules as 0001: RLS on every table, grants only for what the app uses, and
-- composite foreign keys so a child row and its parent always share an owner.

create table public.nutrition_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  age smallint not null check (age between 13 and 100),
  sex text not null check (sex in ('male', 'female')),
  activity text not null check (activity in ('sedentary', 'light', 'moderate', 'active', 'athlete')),
  diet_type text not null check (diet_type in ('veg', 'eggetarian', 'non-veg', 'vegan')),
  allergies text[] not null default '{}' check (cardinality(allergies) <= 20),
  cuisine text not null default 'Indian' check (char_length(cuisine) <= 40),
  target_kcal smallint not null check (target_kcal between 800 and 6000),
  protein_g smallint not null check (protein_g between 0 and 500),
  carbs_g smallint not null check (carbs_g between 0 and 1000),
  fat_g smallint not null check (fat_g between 0 and 400),
  updated_at timestamptz not null default now()
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_at timestamptz not null default now(),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  source text not null check (source in ('search', 'text', 'photo', 'plan')),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  -- Our food list id when the numbers come from USDA; null for AI estimates.
  food_id text check (char_length(food_id) <= 40),
  grams numeric(7, 1) not null check (grams > 0 and grams <= 5000),
  kcal numeric(7, 1) not null check (kcal between 0 and 10000),
  protein numeric(6, 1) not null check (protein between 0 and 1000),
  carbs numeric(6, 1) not null check (carbs between 0 and 1000),
  fat numeric(6, 1) not null check (fat between 0 and 1000),
  data_source text not null check (data_source in ('usda', 'estimate')),
  foreign key (meal_id, user_id) references public.meals (id, user_id) on delete cascade
);

-- The latest plan only: generating a new one replaces it.
create table public.diet_plans (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  plan jsonb not null,
  created_at timestamptz not null default now()
);

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  created_at timestamptz not null default now()
);

-- Counts AI requests per user per day. No one can read or write it directly: only
-- consume_ai_quota() below touches it, so the limits can't be bypassed from the app.
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  kind text not null,
  count integer not null default 0,
  primary key (user_id, day, kind)
);

create index meals_user_eaten_idx on public.meals (user_id, eaten_at desc);
create index meal_items_meal_idx on public.meal_items (meal_id);
create index meal_items_user_idx on public.meal_items (user_id);
create index coach_messages_user_created_idx on public.coach_messages (user_id, created_at desc);

alter table public.nutrition_profiles enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.diet_plans enable row level security;
alter table public.coach_messages enable row level security;
alter table public.ai_usage enable row level security;

revoke all on public.nutrition_profiles, public.meals, public.meal_items, public.diet_plans, public.coach_messages, public.ai_usage
  from anon, authenticated;
grant select, insert, update on public.nutrition_profiles to authenticated;
grant select, insert, update, delete on public.meals, public.meal_items, public.diet_plans to authenticated;
grant select, insert, delete on public.coach_messages to authenticated;

create policy "nutrition: read own" on public.nutrition_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "nutrition: insert own" on public.nutrition_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "nutrition: update own" on public.nutrition_profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "meals: read own" on public.meals
  for select to authenticated using (user_id = (select auth.uid()));
create policy "meals: insert own" on public.meals
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "meals: update own" on public.meals
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "meals: delete own" on public.meals
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "meal items: read own" on public.meal_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy "meal items: insert own" on public.meal_items
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "meal items: update own" on public.meal_items
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "meal items: delete own" on public.meal_items
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "plans: read own" on public.diet_plans
  for select to authenticated using (user_id = (select auth.uid()));
create policy "plans: insert own" on public.diet_plans
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "plans: update own" on public.diet_plans
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "plans: delete own" on public.diet_plans
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "coach: read own" on public.coach_messages
  for select to authenticated using (user_id = (select auth.uid()));
create policy "coach: insert own" on public.coach_messages
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "coach: delete own" on public.coach_messages
  for delete to authenticated using (user_id = (select auth.uid()));

-- Uses one AI request from today's allowance. The limits live here, not in the app,
-- so calling this directly with different numbers isn't possible. Returns false when
-- the allowance is used up or nobody is signed in.
create function public.consume_ai_quota(request_kind text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  daily_limit integer;
  used integer;
begin
  daily_limit := case request_kind
    when 'chat' then 40
    when 'photo' then 15
    when 'text' then 40
    when 'plan' then 5
    else 0
  end;
  if uid is null or daily_limit = 0 then
    return false;
  end if;
  insert into public.ai_usage as u (user_id, day, kind, count)
  values (uid, (now() at time zone 'utc')::date, request_kind, 1)
  on conflict (user_id, day, kind) do update set count = u.count + 1
    where u.count < daily_limit
  returning u.count into used;
  return used is not null;
end;
$$;

revoke all on function public.consume_ai_quota(text) from public, anon;
grant execute on function public.consume_ai_quota(text) to authenticated;

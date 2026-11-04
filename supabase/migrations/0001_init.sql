-- RepSense schema: workout numbers only, never video or landmarks.
-- Run once in the Supabase SQL editor (or with `supabase db push`).
--
-- Row Level Security: the publishable key is public, so anyone can call the API. Security
-- lives here: every table has RLS on, and each policy only lets a signed-in user touch
-- rows where user_id is their own id, taken from their verified login token.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  goal text not null check (goal in ('strength', 'muscle', 'fat-loss', 'habit')),
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  equipment text[] not null default '{}',
  weight_kg numeric(5, 1) not null check (weight_kg between 30 and 250),
  height_cm numeric(5, 1) not null check (height_cm between 120 and 230),
  voice_on boolean not null default true,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  calories integer not null default 0 check (calories >= 0),
  avg_form_score smallint check (avg_form_score between 0 and 100),
  -- Lets the foreign keys below require that a child row and its session share an owner.
  unique (id, user_id)
);

create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise text not null check (exercise in ('squat', 'pushup', 'pullup', 'dip', 'lunge', 'plank')),
  set_number smallint not null check (set_number >= 1),
  reps smallint not null default 0 check (reps >= 0),
  hold_seconds integer not null default 0 check (hold_seconds >= 0),
  load_kg numeric(5, 1) not null default 0 check (load_kg >= 0),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  avg_form_score smallint check (avg_form_score between 0 and 100),
  good_reps smallint not null default 0 check (good_reps >= 0),
  scored_reps smallint not null default 0 check (scored_reps >= 0),
  missed smallint not null default 0 check (missed >= 0),
  calories numeric(7, 2) not null default 0 check (calories >= 0),
  form_issues jsonb not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id) references public.workout_sessions (id, user_id) on delete cascade
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid,
  sleep smallint not null check (sleep between 0 and 10),
  energy smallint not null check (energy between 0 and 10),
  soreness smallint not null check (soreness between 0 and 10),
  choice text not null check (choice in ('move', 'trim', 'half', 'keep')),
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id) references public.workout_sessions (id, user_id) on delete set null (session_id)
);

-- Indexes on the columns the policies and history screens filter on.
create index workout_sessions_user_started_idx on public.workout_sessions (user_id, started_at desc);
create index exercise_sets_session_idx on public.exercise_sets (session_id);
create index exercise_sets_user_idx on public.exercise_sets (user_id);
create index checkins_user_idx on public.checkins (user_id, created_at desc);
create index checkins_session_idx on public.checkins (session_id);

alter table public.profiles enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.checkins enable row level security;

-- Policies don't replace grants, so start from nothing and grant back only what the app
-- uses. Signed-out requests (anon) get no access at all. Profiles have no delete: they go
-- when the auth user does.
revoke all on public.profiles, public.workout_sessions, public.exercise_sets, public.checkins from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.workout_sessions, public.exercise_sets, public.checkins to authenticated;

-- (select auth.uid()) runs once per statement rather than once per row.
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "sessions: read own" on public.workout_sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "sessions: insert own" on public.workout_sessions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "sessions: update own" on public.workout_sessions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "sessions: delete own" on public.workout_sessions
  for delete to authenticated using (user_id = (select auth.uid()));

-- The (session_id, user_id) foreign key stops a set being attached to someone else's session.
create policy "sets: read own" on public.exercise_sets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "sets: insert own" on public.exercise_sets
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "sets: update own" on public.exercise_sets
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "sets: delete own" on public.exercise_sets
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "checkins: read own" on public.checkins
  for select to authenticated using (user_id = (select auth.uid()));
create policy "checkins: insert own" on public.checkins
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "checkins: update own" on public.checkins
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "checkins: delete own" on public.checkins
  for delete to authenticated using (user_id = (select auth.uid()));

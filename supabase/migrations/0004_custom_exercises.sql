-- RepSense 0004: taught exercises ("Teach a rep") and reps counted by hand.
-- Run in the Supabase SQL editor after 0001–0003.
--
-- custom_exercises holds only numbers that describe how to count (which joint, the
-- thresholds, the camera view): no video, no landmarks. The app checks `definition`
-- (isCustomExercise in web/lib/exercises/custom.ts) before using it.

create table public.custom_exercises (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (id ~ '^custom-[a-z0-9]{8,32}$'),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  -- Removed from the picker but kept, so old workouts still show the name.
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.custom_exercises enable row level security;

-- Same pattern as 0001: no access for signed-out requests, owner-only for everyone else.
revoke all on public.custom_exercises from anon, authenticated;
grant select, insert, update, delete on public.custom_exercises to authenticated;

create policy "custom: read own" on public.custom_exercises
  for select to authenticated using (user_id = (select auth.uid()));
create policy "custom: insert own" on public.custom_exercises
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "custom: update own" on public.custom_exercises
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "custom: delete own" on public.custom_exercises
  for delete to authenticated using (user_id = (select auth.uid()));

-- Reps the user added by hand while the camera had lost them (already included in reps).
alter table public.exercise_sets
  add column manual_reps smallint not null default 0 check (manual_reps >= 0);

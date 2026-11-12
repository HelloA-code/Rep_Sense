-- RepSense 0003: allow every catalog exercise, not just the original 6.
-- Run in the Supabase SQL editor after 0001 and 0002.
--
-- The app validates exercise ids against its catalog (web/lib/exercises/catalog.ts);
-- the database only checks the id's shape, so adding exercises needs no migration.
-- Row Level Security on exercise_sets is unchanged.

alter table public.exercise_sets drop constraint if exists exercise_sets_exercise_check;

alter table public.exercise_sets
  add constraint exercise_sets_exercise_check check (exercise ~ '^[a-z0-9-]{1,40}$');

import type { AnyExerciseId } from "@/lib/exercises/ids";
import { isKnownExercise } from "@/lib/exercises/registry";

// The workout picker starts empty. It's only filled when you asked for something just
// before: Today's suggestion, an exercise you've just taught, or your picks kept while you
// went off to teach one. That hand-off is read once (takePlan). How many sets you like is
// remembered separately.

const PLAN_KEY = "repsense.workout.plan";
const SETS_KEY = "repsense.workout.sets";

export type SavedPlan = { exercises: AnyExerciseId[]; sets: number };

const validSets = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;

/** Hands exercises to the picker for its next visit. */
export function savePlan(plan: SavedPlan) {
  try {
    window.localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  } catch {
    // Not important: the picker just starts empty.
  }
}

/** The hand-off waiting for the picker, without using it up (e.g. to add to it). */
export function loadPlan(): SavedPlan | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PLAN_KEY) ?? "null");
    if (typeof parsed !== "object" || parsed === null) return null;
    const { exercises, sets } = parsed as Partial<SavedPlan>;
    if (!Array.isArray(exercises) || !validSets(sets)) return null;
    return { exercises: exercises.filter((id): id is AnyExerciseId => typeof id === "string" && isKnownExercise(id)), sets };
  } catch {
    return null;
  }
}

/** Reads the hand-off once: the next visit to the picker starts empty again. */
export function takePlan(): SavedPlan | null {
  const plan = loadPlan();
  try {
    window.localStorage.removeItem(PLAN_KEY);
  } catch {
    // ignore
  }
  return plan;
}

export function saveSetsPreference(sets: number) {
  try {
    if (validSets(sets)) window.localStorage.setItem(SETS_KEY, String(sets));
  } catch {
    // ignore
  }
}

export function loadSetsPreference(): number | null {
  try {
    const n = Number(window.localStorage.getItem(SETS_KEY));
    return validSets(n) ? n : null;
  } catch {
    return null;
  }
}

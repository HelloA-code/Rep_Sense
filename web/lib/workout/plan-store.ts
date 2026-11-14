import type { AnyExerciseId } from "@/lib/exercises/ids";
import { isKnownExercise } from "@/lib/exercises/registry";

// The exercises and sets picked last time, or the suggestion sent over from Today.

const PLAN_KEY = "repsense.workout.plan";

export type SavedPlan = { exercises: AnyExerciseId[]; sets: number };

export function savePlan(plan: SavedPlan) {
  try {
    window.localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  } catch {
    // Not important: the picker falls back to its defaults.
  }
}

export function loadPlan(): SavedPlan | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PLAN_KEY) ?? "null");
    if (typeof parsed !== "object" || parsed === null) return null;
    const { exercises, sets } = parsed as Partial<SavedPlan>;
    if (!Array.isArray(exercises) || typeof sets !== "number" || sets < 1 || sets > 5) return null;
    return { exercises: exercises.filter((id): id is AnyExerciseId => typeof id === "string" && isKnownExercise(id)), sets };
  } catch {
    return null;
  }
}

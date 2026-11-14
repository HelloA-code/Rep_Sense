import type { ExerciseId } from "@/lib/equipment";
import { CATALOG } from "@/lib/exercises/catalog";
import { FAMILIES } from "@/lib/exercises/families";
import { exerciseInfo, groupMet } from "@/lib/exercises/library";

// Energy estimate: kcal = MET × body weight (kg) × time (hours).
// MET values from the Compendium of Physical Activities (2011):
// calisthenics, vigorous effort (push-ups, pull-ups…) = 8.0; moderate effort (lunges, squats…) = 3.8.
// Each family has one of the two; a few exercises override it (jump squats are vigorous).
// Only time spent in sets counts, not rest. It's a rough estimate and labelled as one.

export const MET = Object.fromEntries(
  CATALOG.map((e) => [e.id, "met" in e ? e.met : FAMILIES[e.family].met]),
) as Record<ExerciseId, number>;

/** Taught exercises (and anything unknown) count as moderate effort. */
export const DEFAULT_MET = 3.8;

export function caloriesBurned(exerciseId: string, weightKg: number, durationMs: number): number {
  const info = exerciseId in MET ? null : exerciseInfo(exerciseId);
  const met = exerciseId in MET ? MET[exerciseId as ExerciseId] : info ? groupMet(info.group) : DEFAULT_MET;
  return met * weightKg * (durationMs / 3_600_000);
}

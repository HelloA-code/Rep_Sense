import type { ExerciseId } from "@/lib/equipment";

// Energy estimate: kcal = MET × body weight (kg) × time (hours).
// MET values from the Compendium of Physical Activities (2011):
// calisthenics, vigorous effort (push-ups, pull-ups…) = 8.0; moderate effort (lunges, squats…) = 3.8.
// Only time spent in sets counts, not rest. It's a rough estimate and labelled as one.

export const MET: Record<ExerciseId, number> = {
  pushup: 8.0,
  pullup: 8.0,
  dip: 8.0,
  squat: 3.8,
  lunge: 3.8,
  plank: 3.8,
};

export function caloriesBurned(exerciseId: ExerciseId, weightKg: number, durationMs: number): number {
  return MET[exerciseId] * weightKg * (durationMs / 3_600_000);
}

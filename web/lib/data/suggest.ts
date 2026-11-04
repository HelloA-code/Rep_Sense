import { availableExercises, type EquipmentId, type ExerciseId } from "@/lib/equipment";
import type { LevelId } from "@/lib/onboarding";

export const SETS_BY_LEVEL: Record<LevelId, number> = { beginner: 2, intermediate: 3, advanced: 4 };
const EXERCISES_PER_SESSION = 3;

export type Suggestion = { exercises: ExerciseId[]; sets: number };

/**
 * Today's session: whatever you've gone longest without (never-trained first), limited
 * to your equipment, with planks last so they don't tire your core for the rest.
 */
export function suggestSession(
  equipment: readonly EquipmentId[],
  level: LevelId,
  lastTrained: Readonly<Record<string, string>>,
): Suggestion {
  const ids = availableExercises(equipment).map((e) => e.id);
  const byRest = ids
    .map((id, order) => ({ id, order, last: lastTrained[id] ?? "" }))
    .sort((a, b) => a.last.localeCompare(b.last) || a.order - b.order)
    .slice(0, EXERCISES_PER_SESSION)
    .map((x) => x.id);
  const exercises = [...byRest.filter((id) => id !== "plank"), ...byRest.filter((id) => id === "plank")];
  return { exercises, sets: SETS_BY_LEVEL[level] };
}

import { availableExercises, type EquipmentId, type Exercise, type ExerciseId } from "@/lib/equipment";
import { FAMILIES, type Pattern } from "@/lib/exercises/families";
import type { LevelId } from "@/lib/onboarding";

export const SETS_BY_LEVEL: Record<LevelId, number> = { beginner: 2, intermediate: 3, advanced: 4 };

/** A balanced session: one per pattern. Core (planks) only fills in when there's nothing to pull on. */
const SESSION_PATTERNS: readonly Pattern[] = ["legs", "push", "pull"];

export type Suggestion = { exercises: ExerciseId[]; sets: number };

/**
 * Today's session: one legs, one push and one pull exercise, each the one you've gone
 * longest without (never-trained first), limited to your equipment. Without pull
 * equipment a core hold takes the last slot, so it doesn't tire your core for the rest.
 *
 * Only the classic exercises and ones you've already done are suggested: with 40+ in the
 * catalog, "never trained" would otherwise mean a random new exercise every day.
 */
export function suggestSession(
  equipment: readonly EquipmentId[],
  level: LevelId,
  lastTrained: Readonly<Record<string, string>>,
): Suggestion {
  const candidates = availableExercises(equipment).filter((e) => e.classic || e.id in lastTrained);
  const pick = (pattern: Pattern): Exercise | undefined =>
    candidates
      .map((e, order) => ({ e, order, last: lastTrained[e.id] ?? "" }))
      .filter(({ e }) => FAMILIES[e.family].pattern === pattern)
      .sort((a, b) => a.last.localeCompare(b.last) || a.order - b.order)[0]?.e;

  const picks = SESSION_PATTERNS.map(pick).filter((e): e is Exercise => e !== undefined);
  if (picks.length < SESSION_PATTERNS.length) {
    const core = pick("core");
    if (core) picks.push(core);
  }
  return { exercises: picks.map((e) => e.id), sets: SETS_BY_LEVEL[level] };
}

import type { AnyExerciseId } from "@/lib/exercises/ids";
import { exerciseName } from "@/lib/exercises/registry";

// Pre-workout check-in: three 0–10 answers become a suggestion through plain rules.

export type CheckinAnswers = { sleep: number; energy: number; soreness: number };
export type CheckinChoice = "move" | "trim" | "half" | "keep";

export type PlanItem = { exerciseId: AnyExerciseId; sets: number };

const LOW = 4;
const HIGH_SORENESS = 7;
const VERY_LOW = 2;
const VERY_HIGH_SORENESS = 9;

export function recommend({ sleep, energy, soreness }: CheckinAnswers): CheckinChoice {
  const warnings = [sleep <= LOW, energy <= LOW, soreness >= HIGH_SORENESS].filter(Boolean).length;
  const severe = sleep <= VERY_LOW || energy <= VERY_LOW || soreness >= VERY_HIGH_SORENESS;
  if (severe && warnings >= 2) return "move";
  if (severe || warnings >= 2) return "half";
  return warnings === 1 ? "trim" : "keep";
}

/** One sentence on why, naming the answer that matters most. */
export function checkinReason({ sleep, energy, soreness }: CheckinAnswers): string {
  if (soreness >= HIGH_SORENESS) return "You're feeling sore today. Less volume gives your muscles time to recover.";
  if (sleep <= LOW) return "You slept less than usual. Lighter work today still counts.";
  if (energy <= LOW) return "Your energy is low today. A shorter session may suit you better.";
  return "You're good to go. Train as planned.";
}

const totalSets = (plan: readonly PlanItem[]) => plan.reduce((sum, p) => sum + p.sets, 0);

const SET_RATIO: Record<Exclude<CheckinChoice, "move">, number> = { keep: 1, trim: 2 / 3, half: 1 / 2 };

/**
 * Removes sets one at a time from whichever exercise has the most (the later one on a
 * tie, so the first exercises stay fresh). Exercises left with 0 sets drop out.
 */
export function adjustPlan(plan: readonly PlanItem[], choice: Exclude<CheckinChoice, "move">): PlanItem[] {
  const target = Math.max(1, Math.round(totalSets(plan) * SET_RATIO[choice]));
  const out = plan.map((p) => ({ ...p }));
  while (totalSets(out) > target) {
    let pick = 0;
    out.forEach((p, i) => {
      if (p.sets >= out[pick].sets) pick = i;
    });
    out[pick].sets -= 1;
  }
  return out.filter((p) => p.sets > 0);
}

/** "4 of 6 sets: one set less on Squat and Push-up" */
export function describeAdjustment(plan: readonly PlanItem[], adjusted: readonly PlanItem[]): string {
  const name = (id: AnyExerciseId) => exerciseName(id);
  const changed = plan
    .filter((p) => (adjusted.find((a) => a.exerciseId === p.exerciseId)?.sets ?? 0) < p.sets)
    .map((p) => name(p.exerciseId));
  const list = changed.length > 1 ? `${changed.slice(0, -1).join(", ")} and ${changed.at(-1)}` : changed[0];
  return `${totalSets(adjusted)} of ${totalSets(plan)} sets: fewer sets of ${list}`;
}

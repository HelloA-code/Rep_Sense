import type { ExerciseId } from "@/lib/equipment";
import { LABELS, type ModelLabel } from "./features";

// A classifier flickers between frames, and switching the rep counter resets it, so a
// switch must be earned: the same exercise, confidently, several predictions running.

export const MIN_CONFIDENCE = 0.7;
export const REQUIRED_STREAK = 3;

export type Detection = {
  label: ModelLabel;
  confidence: number;
  /** Set on the one prediction that should switch the counter. */
  switchTo: ExerciseId | null;
};

export function createAutoDetector(initial: ExerciseId | null = null) {
  let current = initial;
  let candidate: ModelLabel | null = null;
  let streak = 0;

  return {
    update(probabilities: ArrayLike<number>): Detection {
      let best = 0;
      for (let i = 1; i < LABELS.length; i++) if (probabilities[i] > probabilities[best]) best = i;
      const label = LABELS[best];
      const confidence = probabilities[best];

      // Idle never switches: pausing between sets shouldn't lose your exercise.
      if (label === "idle" || confidence < MIN_CONFIDENCE) {
        candidate = null;
        streak = 0;
        return { label, confidence, switchTo: null };
      }
      streak = label === candidate ? streak + 1 : 1;
      candidate = label;
      if (streak >= REQUIRED_STREAK && label !== current) {
        current = label;
        return { label, confidence, switchTo: label };
      }
      return { label, confidence, switchTo: null };
    },
    /** The user picked an exercise by hand. */
    setCurrent(id: ExerciseId | null) {
      current = id;
      candidate = null;
      streak = 0;
    },
  };
}

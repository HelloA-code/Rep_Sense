import type { AnyExerciseId } from "@/lib/exercises/ids";
import type { LogMode } from "@/lib/exercises/library";
import type { SetResult } from "./set-engine";
import type { LoggedSet } from "./summary";

// Sets of exercises the camera doesn't count (log by hand): there's no engine run, so the
// set starts blank and is filled from what the user types.

/**
 * Assumed time per hand-logged rep, only for the calorie estimate (which is labelled as an
 * estimate). A controlled rep takes roughly 2–4 s; 3 s is the middle.
 */
export const SECONDS_PER_REP = 3;

export function blankResult(exerciseId: AnyExerciseId, mode: LogMode): SetResult {
  return {
    exerciseId,
    mode: mode === "reps" ? "reps" : "hold",
    reps: 0,
    manualReps: 0,
    repScores: [],
    goodReps: 0,
    missed: 0,
    issueCounts: {},
    durationMs: 0,
    heldMs: 0,
    score: null,
  };
}

/** The typed number (reps, seconds or minutes) as a logged set: all of it counted by hand. */
export function handLoggedSet(result: SetResult, mode: LogMode, typed: number, loadKg: number): LoggedSet {
  const value = Math.max(0, Math.round(typed));
  if (mode === "reps") {
    return { ...result, reps: value, manualReps: value, durationMs: value * SECONDS_PER_REP * 1000, loggedValue: value, loadKg };
  }
  const seconds = mode === "minutes" ? value * 60 : value;
  return { ...result, heldMs: seconds * 1000, durationMs: seconds * 1000, loggedValue: seconds, loadKg };
}

import type { ExerciseId } from "@/lib/equipment";
import { caloriesBurned } from "./calories";
import { GOOD_REP_SCORE } from "./form";
import type { SetResult } from "./set-engine";

/** A finished set after the user confirmed it on the keypad screen. */
export type LoggedSet = SetResult & {
  /** Reps (or plank seconds) as confirmed/corrected by the user. */
  loggedValue: number;
  /** Added load in kg (vest, backpack…); 0 = bodyweight. */
  loadKg: number;
};

export type ExerciseSummary = {
  exerciseId: ExerciseId;
  sets: LoggedSet[];
  /** Most frequent cues first. */
  topIssues: string[];
};

export type SessionSummary = {
  totalReps: number;
  totalHoldMs: number;
  goodReps: number;
  badReps: number;
  missed: number;
  /** Average over every scored rep / plank set; null if nothing was scored. */
  avgScore: number | null;
  durationMs: number;
  calories: number;
  exercises: ExerciseSummary[];
};

export function summarizeSession(sets: readonly LoggedSet[], weightKg: number, durationMs: number): SessionSummary {
  const scores: number[] = [];
  let totalReps = 0;
  let totalHoldMs = 0;
  let goodReps = 0;
  let badReps = 0;
  let missed = 0;
  let calories = 0;
  const byExercise = new Map<ExerciseId, LoggedSet[]>();

  for (const set of sets) {
    if (set.mode === "hold") {
      totalHoldMs += set.loggedValue * 1000;
      if (set.score !== null) scores.push(set.score);
    } else {
      totalReps += set.loggedValue;
      scores.push(...set.repScores);
      goodReps += set.repScores.filter((s) => s >= GOOD_REP_SCORE).length;
      badReps += set.repScores.filter((s) => s < GOOD_REP_SCORE).length;
    }
    missed += set.missed;
    // Added load makes the work harder; scale the bodyweight estimate by it.
    calories += caloriesBurned(set.exerciseId, weightKg + set.loadKg, set.durationMs);
    byExercise.set(set.exerciseId, [...(byExercise.get(set.exerciseId) ?? []), set]);
  }

  const exercises = [...byExercise].map(([exerciseId, exSets]) => {
    const counts = new Map<string, number>();
    for (const s of exSets) for (const [cue, n] of Object.entries(s.issueCounts)) counts.set(cue, (counts.get(cue) ?? 0) + n);
    const topIssues = [...counts].sort((a, b) => b[1] - a[1]).map(([cue]) => cue);
    return { exerciseId, sets: exSets, topIssues };
  });

  return {
    totalReps,
    totalHoldMs,
    goodReps,
    badReps,
    missed,
    avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    durationMs,
    calories: Math.round(calories),
    exercises,
  };
}

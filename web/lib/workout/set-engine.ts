import type { ExerciseId } from "@/lib/equipment";
import type { ExerciseConfig, PoseFrame } from "@/lib/exercises/types";
import {
  createHoldTimer,
  createRepCounter,
  type RepPhase,
  type RepRejection,
} from "@/lib/exercises/state-machine";
import { createLandmarkSmoother } from "@/lib/pose/filters";
import type { Landmark } from "@/lib/pose/landmarks";
import { pickSide, type Side } from "@/lib/pose/side";
import { estimateView } from "@/lib/pose/view";
import type { CameraView } from "@/lib/recording/format";
import { GOOD_REP_SCORE, createCueScheduler, createFormTracker, scoreRep, type ActiveIssue } from "./form";

// The whole per-frame pipeline for one set, with no React or browser APIs:
//   raw landmarks → smooth → pick side → detect view → measure → count → form rules → cues
// The live camera, clip replay and tests all drive this same code.

/** Lost the person for longer than this: restart smoothing instead of gliding across the gap. */
const SMOOTHER_RESET_MS = 300;

export type SetEvent =
  | { type: "rep"; reps: number; score: number; issues: string[] }
  | { type: "miss"; reason: RepRejection }
  | { type: "cue"; text: string };

export type FrameOutput = {
  /** Smoothed landmarks, for drawing. */
  smooth: Landmark[] | null;
  side: Side | null;
  view: CameraView | null;
  /** The exercise's metric on smoothed / raw landmarks (debug graph). */
  value: number | null;
  rawValue: number | null;
  phase: RepPhase;
  reps: number;
  holding: boolean;
  heldMs: number;
  /** Broken right now: draw red rings on these joints. */
  issues: ActiveIssue[];
  events: SetEvent[];
};

export type SetResult = {
  exerciseId: ExerciseId;
  mode: ExerciseConfig["mode"];
  /** Counted reps (0 for planks). */
  reps: number;
  /** Form score of each counted rep, in order. */
  repScores: number[];
  goodReps: number;
  /** Attempts that didn't count (too shallow, no lockout, chin under the bar). */
  missed: number;
  /** How often each cue came up: { "Knees out": 3 }. */
  issueCounts: Record<string, number>;
  durationMs: number;
  /** Plank: time actually held with good form. */
  heldMs: number;
  /** Average rep score, or plank held ÷ time in position; null if nothing to score. */
  score: number | null;
};

export function createSetEngine(exercise: ExerciseConfig) {
  const smoother = createLandmarkSmoother();
  const tracker = createFormTracker(exercise.rules);
  const cues = createCueScheduler();
  const counter = exercise.mode === "reps" ? createRepCounter(exercise.counter) : null;
  const hold = exercise.mode === "hold" ? createHoldTimer(exercise.hold) : null;

  let side: Side | null = null;
  let view: CameraView | null = null;
  let lastPose = -Infinity;
  let startT: number | null = null;
  let lastT = 0;
  let inPositionMs = 0;
  let lastInPosition: number | null = null;
  const repScores: number[] = [];
  let missed = 0;
  const issueCounts: Record<string, number> = {};
  const count = (cue: string) => (issueCounts[cue] = (issueCounts[cue] ?? 0) + 1);

  function process(raw: readonly Landmark[] | null, tMs: number, width: number, height: number): FrameOutput {
    startT ??= tMs;
    lastT = tMs;
    const events: SetEvent[] = [];
    let smooth: Landmark[] | null = null;
    let value: number | null = null;
    let rawValue: number | null = null;
    let issues: ActiveIssue[] = [];

    if (raw) {
      if (tMs - lastPose > SMOOTHER_RESET_MS) smoother.reset();
      lastPose = tMs;
      smooth = smoother.smooth(raw, tMs);
      side = pickSide(smooth, side);
      view = estimateView(smooth, width, height, view);
      const frame: PoseFrame = { lm: smooth, width, height, side };
      value = exercise.measure(frame);
      rawValue = exercise.measure({ ...frame, lm: raw });

      if (exercise.mode === "reps" && counter && value !== null) {
        const before = counter.state.reps;
        const s = counter.update(value, tMs, exercise.goal ? exercise.goal(frame) : true);
        if (s.reps > before) {
          const repIssues = tracker.takeRepIssues();
          const score = scoreRep(repIssues);
          repScores.push(score);
          repIssues.forEach((i) => count(i.cue));
          events.push({ type: "rep", reps: s.reps, score, issues: repIssues.map((i) => i.cue) });
        } else if (s.rejected && s.rejected !== "too-fast") {
          tracker.takeRepIssues(); // that attempt is over; don't charge its issues to the next rep
          missed += 1;
          events.push({ type: "miss", reason: s.rejected });
          const cue = exercise.missCues[s.rejected];
          if (cue) {
            count(cue);
            if (cues.offer(`miss:${s.rejected}`, tMs)) events.push({ type: "cue", text: cue });
          }
        }
      }

      const phase = counter?.state.phase ?? "up";
      const form = tracker.update(frame, view, phase, tMs);
      issues = form.active;
      for (const issue of form.started) {
        if (exercise.mode === "hold") count(issue.cue); // reps count theirs per rep, above
        if (cues.offer(issue.id, tMs)) events.push({ type: "cue", text: issue.cue });
      }
    }

    if (hold) {
      hold.update(value, tMs);
      // Time "in position" (lying out), whether or not the form was good: the plank score's denominator.
      if (value !== null) {
        if (lastInPosition !== null) inPositionMs += Math.min(tMs - lastInPosition, 250);
        lastInPosition = tMs;
      } else {
        lastInPosition = null;
      }
    }

    return {
      smooth,
      side,
      view,
      value,
      rawValue,
      phase: counter?.state.phase ?? "up",
      reps: counter?.state.reps ?? 0,
      holding: hold?.state.holding ?? false,
      heldMs: hold?.state.heldMs ?? 0,
      issues,
      events,
    };
  }

  function finish(tMs: number = lastT): SetResult {
    const heldMs = hold?.state.heldMs ?? 0;
    const avg = repScores.length ? Math.round(repScores.reduce((a, b) => a + b, 0) / repScores.length) : null;
    const holdScore = inPositionMs > 0 ? Math.round((100 * Math.min(heldMs, inPositionMs)) / inPositionMs) : null;
    return {
      exerciseId: exercise.id,
      mode: exercise.mode,
      reps: repScores.length,
      repScores: [...repScores],
      goodReps: repScores.filter((s) => s >= GOOD_REP_SCORE).length,
      missed,
      issueCounts: { ...issueCounts },
      durationMs: startT === null ? 0 : Math.max(0, tMs - startT),
      heldMs,
      score: exercise.mode === "hold" ? holdScore : avg,
    };
  }

  return { process, finish };
}

export type SetEngine = ReturnType<typeof createSetEngine>;

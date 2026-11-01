import type { ExerciseId } from "@/lib/equipment";
import { MIN_VISIBILITY } from "@/lib/pose/frame-check";
import { angle, toPixels, type Point } from "@/lib/pose/geometry";
import { LM, type Landmark } from "@/lib/pose/landmarks";
import type { Side } from "@/lib/pose/side";
import type { CameraView } from "@/lib/recording/format";
import type { HoldConfig, RepCounterConfig, RepPhase } from "./state-machine";

/** One smoothed pose plus what we need to measure it. */
export type PoseFrame = {
  lm: readonly Landmark[];
  width: number;
  height: number;
  /** The side the camera sees best (pickSide). */
  side: Side;
};

type ExerciseBase = {
  id: ExerciseId;
  name: string;
  preferredView: CameraView;
  /** Shown before starting, e.g. "Side view, whole body in frame". */
  setupHint: string;
  /** What `measure` returns, for the debug graph. */
  metric: string;
};

export type RepExercise = ExerciseBase & {
  mode: "reps";
  counter: RepCounterConfig;
  phaseLabel: Record<RepPhase, string>;
  /** The joint angle that drives the counter, or null if those joints aren't visible. */
  measure(f: PoseFrame): number | null;
  /** Optional extra condition during the bottom phase (pull-up: chin above the bar). */
  goal?(f: PoseFrame): boolean;
};

export type HoldExercise = ExerciseBase & {
  mode: "hold";
  hold: HoldConfig;
  /** Body-line deviation in degrees, or null if not in position. */
  measure(f: PoseFrame): number | null;
};

export type ExerciseConfig = RepExercise | HoldExercise;

// ---- helpers shared by the exercise files ----

type Triplet = readonly [number, number, number];

export const SIDE_LM = {
  left: {
    shoulder: LM.LEFT_SHOULDER, elbow: LM.LEFT_ELBOW, wrist: LM.LEFT_WRIST,
    hip: LM.LEFT_HIP, knee: LM.LEFT_KNEE, ankle: LM.LEFT_ANKLE,
  },
  right: {
    shoulder: LM.RIGHT_SHOULDER, elbow: LM.RIGHT_ELBOW, wrist: LM.RIGHT_WRIST,
    hip: LM.RIGHT_HIP, knee: LM.RIGHT_KNEE, ankle: LM.RIGHT_ANKLE,
  },
} as const;

export function visible(f: PoseFrame, ...indices: number[]): boolean {
  return indices.every((i) => (f.lm[i]?.visibility ?? 0) >= MIN_VISIBILITY);
}

export function px(f: PoseFrame, i: number): Point {
  return toPixels(f.lm[i], f.width, f.height);
}

/** Angle at the middle joint, in screen pixels; null if any of the three is hidden. */
export function jointAngle(f: PoseFrame, [a, b, c]: Triplet): number | null {
  if (!visible(f, a, b, c)) return null;
  return angle(px(f, a), px(f, b), px(f, c));
}

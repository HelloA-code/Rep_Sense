import type { ExerciseId } from "@/lib/equipment";
import { MIN_VISIBILITY } from "@/lib/pose/frame-check";
import { angle, hipOffset, toPixels, torsoLean, type Point } from "@/lib/pose/geometry";
import { LM, type Landmark } from "@/lib/pose/landmarks";
import type { Side } from "@/lib/pose/side";
import type { CameraView } from "@/lib/recording/format";
import type { HoldConfig, RepCounterConfig, RepPhase, RepRejection } from "./state-machine";

/** One smoothed pose plus what we need to measure it. */
export type PoseFrame = {
  lm: readonly Landmark[];
  width: number;
  height: number;
  /** The side the camera sees best (pickSide). */
  side: Side;
};

/**
 * One coaching cue as a pure check. Returns the joints to highlight when the rule is
 * broken, or null when it's fine or can't be measured (joints hidden).
 */
export type FormRule = {
  id: string;
  /** Short, spoken out loud: "Knees out". */
  cue: string;
  /** "bad" costs more of the rep's form score than "warn". */
  severity: "warn" | "bad";
  /** Camera views where this rule can be judged (knees caving needs the front). */
  views: readonly CameraView[];
  /** "down" = only check during the bottom half of a rep. */
  phases: "down" | "any";
  check(f: PoseFrame): readonly number[] | null;
};

type ExerciseBase = {
  id: ExerciseId;
  name: string;
  preferredView: CameraView;
  /** Shown before starting, e.g. "Side view, whole body in frame". */
  setupHint: string;
  /** What `measure` returns, for the debug graph. */
  metric: string;
  rules: readonly FormRule[];
};

export type RepExercise = ExerciseBase & {
  mode: "reps";
  counter: RepCounterConfig;
  phaseLabel: Record<RepPhase, string>;
  /** The joint angle that drives the counter, or null if those joints aren't visible. */
  measure(f: PoseFrame): number | null;
  /** Optional extra condition during the bottom phase (pull-up: chin above the bar). */
  goal?(f: PoseFrame): boolean;
  /** What to say when an attempt doesn't count. Missing = say nothing (e.g. too-fast glitches). */
  missCues: Partial<Record<RepRejection, string>>;
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
    heel: LM.LEFT_HEEL, toe: LM.LEFT_FOOT,
  },
  right: {
    shoulder: LM.RIGHT_SHOULDER, elbow: LM.RIGHT_ELBOW, wrist: LM.RIGHT_WRIST,
    hip: LM.RIGHT_HIP, knee: LM.RIGHT_KNEE, ankle: LM.RIGHT_ANKLE,
    heel: LM.RIGHT_HEEL, toe: LM.RIGHT_FOOT,
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

/** Shoulder→ankle must be within this many degrees of horizontal to count as "lying out". */
const MAX_TILT = 40;

/** Body roughly horizontal, as in a plank or push-up (not standing or kneeling up). */
export function isHorizontal(f: PoseFrame): boolean {
  const s = SIDE_LM[f.side];
  if (!visible(f, s.shoulder, s.hip, s.ankle)) return false;
  const a = px(f, s.shoulder);
  const b = px(f, s.ankle);
  const tilt = (Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 180) / Math.PI;
  return tilt <= MAX_TILT;
}

/** Hip sag / pike rules shared by push-ups and planks. */
export function hipRules(sagCue: string, pikeCue: string, limit = 15): FormRule[] {
  const offset = (f: PoseFrame) => {
    if (!isHorizontal(f)) return null;
    const s = SIDE_LM[f.side];
    return hipOffset(px(f, s.shoulder), px(f, s.hip), px(f, s.ankle));
  };
  return [
    {
      id: "hips-sag",
      cue: sagCue,
      severity: "bad",
      views: ["side"],
      phases: "any",
      check: (f) => ((offset(f) ?? 0) > limit ? [SIDE_LM[f.side].hip] : null),
    },
    {
      id: "hips-pike",
      cue: pikeCue,
      severity: "warn",
      views: ["side"],
      phases: "any",
      check: (f) => ((offset(f) ?? 0) < -limit ? [SIDE_LM[f.side].hip] : null),
    },
  ];
}

/** Torso leaning more than `limit` degrees from vertical at the bottom of a rep. */
export function torsoLeanRule(cue: string, limit: number): FormRule {
  return {
    id: "torso-lean",
    cue,
    severity: "warn",
    views: ["side"],
    phases: "down",
    check(f) {
      const s = SIDE_LM[f.side];
      if (!visible(f, s.shoulder, s.hip)) return null;
      return torsoLean(px(f, s.shoulder), px(f, s.hip)) > limit ? [s.shoulder, s.hip] : null;
    },
  };
}

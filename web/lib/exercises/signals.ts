import { bodyLineDeviation, torsoLean } from "@/lib/pose/geometry";
import { LM } from "@/lib/pose/landmarks";
import { SIDE_LM, isHorizontal, jointAngle, px, visible, type PoseFrame } from "./types";

// A signal turns one pose into the single number an exercise is counted on.
// Rep counting needs "large at rest, small at the bottom of the rep", so signals that
// naturally grow during a rep (arm raises, heel raises) are flipped.

export type SignalId = "knee" | "front-knee" | "hip" | "elbow" | "arm-raise" | "heel-raise" | "body-line";

type Signal = {
  /** Shown next to the live value: "Knee angle 92°". */
  metric: string;
  measure(f: PoseFrame): number | null;
};

/** The leg in front = the more bent knee (either leg can lead, and people alternate). */
export function frontLeg(f: PoseFrame) {
  let best: { s: (typeof SIDE_LM)[keyof typeof SIDE_LM]; angle: number } | null = null;
  for (const side of ["left", "right"] as const) {
    const s = SIDE_LM[side];
    const a = jointAngle(f, [s.hip, s.knee, s.ankle]);
    if (a !== null && (best === null || a < best.angle)) best = { s, angle: a };
  }
  return best;
}

export const SIGNALS: Record<SignalId, Signal> = {
  // Hip–knee–ankle: ~175° standing, ~90° at parallel.
  knee: {
    metric: "Knee angle",
    measure(f) {
      const s = SIDE_LM[f.side];
      return jointAngle(f, [s.hip, s.knee, s.ankle]);
    },
  },
  "front-knee": {
    metric: "Front knee angle",
    measure: (f) => frontLeg(f)?.angle ?? null,
  },
  // Shoulder–hip–knee: ~175° standing tall, ~90° folded forward.
  hip: {
    metric: "Hip angle",
    measure(f) {
      const s = SIDE_LM[f.side];
      return jointAngle(f, [s.shoulder, s.hip, s.knee]);
    },
  },
  // Shoulder–elbow–wrist: ~170° straight arm, ~40° fully curled.
  elbow: {
    metric: "Elbow angle",
    measure(f) {
      const s = SIDE_LM[f.side];
      return jointAngle(f, [s.shoulder, s.elbow, s.wrist]);
    },
  },
  // 180° − hip–shoulder–elbow: arm hanging ≈ 170, arm at shoulder height ≈ 90.
  "arm-raise": {
    metric: "Arm (flipped)",
    measure(f) {
      const s = SIDE_LM[f.side];
      const a = jointAngle(f, [s.hip, s.shoulder, s.elbow]);
      return a === null ? null : 180 - a;
    },
  },
  // 90° − foot tilt (heel → toe vs horizontal): flat foot ≈ 85–90, up on the toes ≈ 50.
  "heel-raise": {
    metric: "Heel (flipped)",
    measure(f) {
      const s = SIDE_LM[f.side];
      if (!visible(f, s.heel, s.toe)) return null;
      const heel = px(f, s.heel);
      const toe = px(f, s.toe);
      const tilt = (Math.atan2(toe.y - heel.y, Math.abs(toe.x - heel.x)) * 180) / Math.PI;
      return 90 - tilt;
    },
  },
  // Shoulder–hip–ankle bend away from a straight line (plank).
  "body-line": {
    metric: "Body line bend",
    measure(f) {
      const s = SIDE_LM[f.side];
      if (!visible(f, s.shoulder, s.hip, s.ankle)) return null;
      return bodyLineDeviation(px(f, s.shoulder), px(f, s.hip), px(f, s.ankle));
    },
  },
};

// ---- position checks for holds (the timer only runs in position) ----

export type GateId = "horizontal" | "hanging" | "upright" | "legs-straight";

/** Hands above the head: hanging from a bar (image y grows downwards). */
function hanging(f: PoseFrame): boolean {
  const wrists = [LM.LEFT_WRIST, LM.RIGHT_WRIST].filter((i) => visible(f, i));
  return visible(f, LM.NOSE) && wrists.length > 0 && wrists.every((i) => f.lm[i].y < f.lm[LM.NOSE].y);
}

export const GATES: Record<GateId, (f: PoseFrame) => boolean> = {
  horizontal: isHorizontal,
  hanging,
  // Back against the wall: torso within 25° of vertical.
  upright(f) {
    const s = SIDE_LM[f.side];
    return visible(f, s.shoulder, s.hip) && torsoLean(px(f, s.shoulder), px(f, s.hip)) <= 25;
  },
  // L-sit: knees locked out.
  "legs-straight"(f) {
    const s = SIDE_LM[f.side];
    const knee = jointAngle(f, [s.hip, s.knee, s.ankle]);
    return knee !== null && knee >= 150;
  },
};

// ---- extra conditions during a rep ----

export type GoalId = "chin-over-bar";

/** Wiggle room in normalised height: nose level with the wrists still counts. */
const CHIN_TOLERANCE = 0.02;

/**
 * Pull-up: chin over the bar, approximated as "nose above the wrists" (the wrists are
 * on the bar). Image y grows downwards, so "above" means a smaller y.
 */
export function chinOverBar(f: PoseFrame): boolean {
  const wrists = [LM.LEFT_WRIST, LM.RIGHT_WRIST].filter((i) => visible(f, i));
  if (!visible(f, LM.NOSE) || wrists.length === 0) return false;
  const barY = wrists.reduce((sum, i) => sum + f.lm[i].y, 0) / wrists.length;
  return f.lm[LM.NOSE].y <= barY + CHIN_TOLERANCE;
}

export const GOALS: Record<GoalId, (f: PoseFrame) => boolean> = { "chin-over-bar": chinOverBar };

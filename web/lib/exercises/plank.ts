import { bodyLineDeviation } from "@/lib/pose/geometry";
import { SIDE_LM, px, visible, type HoldExercise, type PoseFrame } from "./types";

// A timer, not reps. It runs while the body is roughly horizontal and the
// shoulder–hip–ankle line is straight, and pauses when the hips sag or pike.

/** Shoulder→ankle must be within this many degrees of horizontal to count as "in plank". */
const MAX_TILT = 40;

export function inPlankPosition(f: PoseFrame): boolean {
  const s = SIDE_LM[f.side];
  if (!visible(f, s.shoulder, s.hip, s.ankle)) return false;
  const a = px(f, s.shoulder);
  const b = px(f, s.ankle);
  const tilt = (Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 180) / Math.PI;
  return tilt <= MAX_TILT;
}

export const config: HoldExercise = {
  id: "plank",
  name: "Plank",
  mode: "hold",
  preferredView: "side",
  setupHint: "Side view, camera at floor height",
  metric: "Body line bend",
  hold: { maxDeviation: 15, graceMs: 600 },
  measure(f) {
    if (!inPlankPosition(f)) return null;
    const s = SIDE_LM[f.side];
    return bodyLineDeviation(px(f, s.shoulder), px(f, s.hip), px(f, s.ankle));
  },
};

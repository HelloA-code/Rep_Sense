import { bodyLineDeviation } from "@/lib/pose/geometry";
import { SIDE_LM, hipRules, isHorizontal, px, type HoldExercise, type PoseFrame } from "./types";

// A timer, not reps. It runs while the body is roughly horizontal and the
// shoulder–hip–ankle line is straight, and pauses when the hips sag or pike.

export function inPlankPosition(f: PoseFrame): boolean {
  return isHorizontal(f);
}

export const config: HoldExercise = {
  id: "plank",
  name: "Plank",
  mode: "hold",
  preferredView: "side",
  setupHint: "Side view, camera at floor height",
  metric: "Body line bend",
  hold: { maxDeviation: 15, graceMs: 600 },
  rules: hipRules("Lift your hips", "Lower your hips"),
  measure(f) {
    if (!inPlankPosition(f)) return null;
    const s = SIDE_LM[f.side];
    return bodyLineDeviation(px(f, s.shoulder), px(f, s.hip), px(f, s.ankle));
  },
};

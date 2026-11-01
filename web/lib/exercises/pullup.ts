import { LM } from "@/lib/pose/landmarks";
import { SIDE_LM, jointAngle, visible, type PoseFrame, type RepExercise } from "./types";

// Elbow angle: ~170° hanging, below ~90° at the top. The rep only counts if the chin
// got over the bar at some point, approximated as "nose above the wrists" (the
// wrists are on the bar). Image y grows downwards, so "above" means a smaller y.

/** Wiggle room in normalised height: nose level with the wrists still counts. */
const CHIN_TOLERANCE = 0.02;

export function chinOverBar(f: PoseFrame): boolean {
  const wrists = [LM.LEFT_WRIST, LM.RIGHT_WRIST].filter((i) => visible(f, i));
  if (!visible(f, LM.NOSE) || wrists.length === 0) return false;
  const barY = wrists.reduce((sum, i) => sum + f.lm[i].y, 0) / wrists.length;
  return f.lm[LM.NOSE].y <= barY + CHIN_TOLERANCE;
}

export const config: RepExercise = {
  id: "pullup",
  name: "Pull-up",
  mode: "reps",
  preferredView: "front",
  setupHint: "Front view, bar and feet in frame",
  metric: "Elbow angle",
  counter: { downBelow: 90, upAbove: 150, minRepMs: 500 },
  phaseLabel: { up: "Hang", down: "Pull" },
  measure(f) {
    const s = SIDE_LM[f.side];
    return jointAngle(f, [s.shoulder, s.elbow, s.wrist]);
  },
  goal: chinOverBar,
};

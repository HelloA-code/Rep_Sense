import { SIDE_LM, jointAngle, type RepExercise } from "./types";

// Knee angle (hip–knee–ankle): ~175° standing, ~90° at parallel.
// Side view measures it best. From the front, the 2D angle shrinks less, so the
// bottom threshold is a little forgiving (100°, not 90°). Depth is judged on Day 4.

export const config: RepExercise = {
  id: "squat",
  name: "Squat",
  mode: "reps",
  preferredView: "side",
  setupHint: "Side view, whole body in frame",
  metric: "Knee angle",
  counter: { downBelow: 100, upAbove: 160, minRepMs: 400 },
  phaseLabel: { up: "Standing", down: "Down" },
  measure(f) {
    const s = SIDE_LM[f.side];
    return jointAngle(f, [s.hip, s.knee, s.ankle]);
  },
};

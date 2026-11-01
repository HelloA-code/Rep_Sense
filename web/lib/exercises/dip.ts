import { SIDE_LM, jointAngle, type RepExercise } from "./types";

// Elbow angle: ~170° locked out at the top, ~90° at the bottom.

export const config: RepExercise = {
  id: "dip",
  name: "Dip",
  mode: "reps",
  preferredView: "side",
  setupHint: "Side view, bars and whole body in frame",
  metric: "Elbow angle",
  counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
  phaseLabel: { up: "Top", down: "Bottom" },
  measure(f) {
    const s = SIDE_LM[f.side];
    return jointAngle(f, [s.shoulder, s.elbow, s.wrist]);
  },
};

import { SIDE_LM, hipRules, jointAngle, type RepExercise } from "./types";

// Elbow angle (shoulder–elbow–wrist): ~170° at the top, ~80–90° at the bottom.
// Form: a straight body line from the side (hips neither sagging nor piked).

export const config: RepExercise = {
  id: "pushup",
  name: "Push-up",
  mode: "reps",
  preferredView: "side",
  setupHint: "Side view, camera at floor height",
  metric: "Elbow angle",
  counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
  phaseLabel: { up: "Top", down: "Bottom" },
  rules: hipRules("Hips up", "Lower your hips"),
  missCues: { shallow: "Go lower", "no-lockout": "Lock out your arms" },
  measure(f) {
    const s = SIDE_LM[f.side];
    return jointAngle(f, [s.shoulder, s.elbow, s.wrist]);
  },
};

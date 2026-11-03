import { LM } from "@/lib/pose/landmarks";
import { SIDE_LM, jointAngle, px, torsoLeanRule, visible, type FormRule, type RepExercise } from "./types";

// Knee angle (hip–knee–ankle): ~175° standing, ~90° at parallel.
// Side view measures it best. From the front, the 2D angle shrinks less, so the
// bottom threshold is a little forgiving (100°, not 90°).

/** Knees caving in (valgus): only visible from the front, at the bottom of the squat. */
export const kneesCaving: FormRule = {
  id: "knees-caving",
  cue: "Knees out",
  severity: "bad",
  views: ["front"],
  phases: "down",
  check(f) {
    if (!visible(f, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE)) return null;
    const kneeGap = Math.abs(px(f, LM.LEFT_KNEE).x - px(f, LM.RIGHT_KNEE).x);
    const ankleGap = Math.abs(px(f, LM.LEFT_ANKLE).x - px(f, LM.RIGHT_ANKLE).x);
    return ankleGap > 0 && kneeGap < 0.75 * ankleGap ? [LM.LEFT_KNEE, LM.RIGHT_KNEE] : null;
  },
};

export const config: RepExercise = {
  id: "squat",
  name: "Squat",
  mode: "reps",
  preferredView: "side",
  setupHint: "Side view, whole body in frame",
  metric: "Knee angle",
  counter: { downBelow: 100, upAbove: 160, minRepMs: 400 },
  phaseLabel: { up: "Standing", down: "Down" },
  rules: [kneesCaving, torsoLeanRule("Chest up", 50)],
  missCues: { shallow: "Go lower", "no-lockout": "Stand up tall" },
  measure(f) {
    const s = SIDE_LM[f.side];
    return jointAngle(f, [s.hip, s.knee, s.ankle]);
  },
};

import { SIDE_LM, jointAngle, type RepExercise } from "./types";

// Front-knee angle: ~175° standing, ~90° at the bottom. Either leg can be in front
// and people alternate, so we take the more bent of the two visible knees.

export const config: RepExercise = {
  id: "lunge",
  name: "Lunge",
  mode: "reps",
  preferredView: "side",
  setupHint: "Side view, whole body in frame",
  metric: "Front knee angle",
  counter: { downBelow: 110, upAbove: 155, minRepMs: 400 },
  phaseLabel: { up: "Standing", down: "Down" },
  measure(f) {
    const knees = (["left", "right"] as const)
      .map((side) => {
        const s = SIDE_LM[side];
        return jointAngle(f, [s.hip, s.knee, s.ankle]);
      })
      .filter((a): a is number => a !== null);
    return knees.length > 0 ? Math.min(...knees) : null;
  },
};

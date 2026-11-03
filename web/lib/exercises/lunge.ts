import { SIDE_LM, jointAngle, px, torsoLeanRule, visible, type FormRule, type PoseFrame, type RepExercise } from "./types";

// Front-knee angle: ~175° standing, ~90° at the bottom. Either leg can be in front
// and people alternate, so we take the more bent of the two visible knees.

/** The leg in front = the more bent knee. */
function frontLeg(f: PoseFrame) {
  let best: { s: (typeof SIDE_LM)[keyof typeof SIDE_LM]; angle: number } | null = null;
  for (const side of ["left", "right"] as const) {
    const s = SIDE_LM[side];
    const a = jointAngle(f, [s.hip, s.knee, s.ankle]);
    if (a !== null && (best === null || a < best.angle)) best = { s, angle: a };
  }
  return best;
}

/** Front knee shooting past the toes (side view). Toe direction comes from heel → toe. */
export const kneePastToes: FormRule = {
  id: "knee-past-toes",
  cue: "Knee behind your toes",
  severity: "warn",
  views: ["side"],
  phases: "down",
  check(f) {
    const leg = frontLeg(f)?.s;
    if (!leg || !visible(f, leg.knee, leg.ankle, leg.heel, leg.toe)) return null;
    const knee = px(f, leg.knee);
    const toe = px(f, leg.toe);
    const dir = Math.sign(toe.x - px(f, leg.heel).x) || 1;
    const shin = Math.hypot(knee.x - px(f, leg.ankle).x, knee.y - px(f, leg.ankle).y);
    return (knee.x - toe.x) * dir > 0.1 * shin ? [leg.knee] : null;
  },
};

export const config: RepExercise = {
  id: "lunge",
  name: "Lunge",
  mode: "reps",
  preferredView: "side",
  setupHint: "Side view, whole body in frame",
  metric: "Front knee angle",
  counter: { downBelow: 110, upAbove: 155, minRepMs: 400 },
  phaseLabel: { up: "Standing", down: "Down" },
  measure: (f) => frontLeg(f)?.angle ?? null,
  rules: [kneePastToes, torsoLeanRule("Torso upright", 25)],
  missCues: { shallow: "Go lower", "no-lockout": "Stand up tall" },
};

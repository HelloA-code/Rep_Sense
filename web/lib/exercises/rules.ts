import { torsoLean } from "@/lib/pose/geometry";
import { LM } from "@/lib/pose/landmarks";
import { frontLeg } from "./signals";
import { SIDE_LM, hipRules, jointAngle, px, torsoLeanRule, visible, type FormRule } from "./types";

// The form-rule library. Exercises refer to rules by id (plain data, so the catalog can
// later live in JSON); `resolveRules` turns those references into checks.

export type RuleRef =
  | { readonly id: "knees-caving" }
  | { readonly id: "knee-past-toes" }
  | { readonly id: "torso-lean"; readonly cue: string; readonly limit: number }
  | { readonly id: "hips"; readonly sagCue: string; readonly pikeCue: string }
  | { readonly id: "hinge-knees" }
  | { readonly id: "no-swing" }
  | { readonly id: "raise-too-high" }
  | { readonly id: "elbow-flare" };

export type RuleId = RuleRef["id"];

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

/** Romanian deadlift / good morning: the movement should come from the hips, not a squat. */
export const hingeKnees: FormRule = {
  id: "hinge-knees",
  cue: "Hinge at the hips",
  severity: "warn",
  views: ["side"],
  phases: "down",
  check(f) {
    const s = SIDE_LM[f.side];
    const knee = jointAngle(f, [s.hip, s.knee, s.ankle]);
    return knee !== null && knee < 130 ? [s.knee] : null;
  },
};

/** Curls and raises: the torso should stay still, not rock to swing the weight up. */
export const noSwing: FormRule = {
  id: "no-swing",
  cue: "Don't swing",
  severity: "warn",
  views: ["side", "front"],
  phases: "any",
  check(f) {
    const s = SIDE_LM[f.side];
    if (!visible(f, s.shoulder, s.hip)) return null;
    return torsoLean(px(f, s.shoulder), px(f, s.hip)) > 15 ? [s.shoulder, s.hip] : null;
  },
};

/** Lateral / front raise: stop around shoulder height (wrist well above it = too high). */
export const raiseTooHigh: FormRule = {
  id: "raise-too-high",
  cue: "Stop at shoulder height",
  severity: "warn",
  views: ["side", "front"],
  phases: "down",
  check(f) {
    const s = SIDE_LM[f.side];
    if (!visible(f, s.shoulder, s.hip, s.wrist)) return null;
    const torso = Math.abs(px(f, s.hip).y - px(f, s.shoulder).y);
    return px(f, s.shoulder).y - px(f, s.wrist).y > 0.25 * torso ? [s.wrist] : null;
  },
};

/** Push-up from the front: elbows flaring far wider than the shoulders. */
export const elbowFlare: FormRule = {
  id: "elbow-flare",
  cue: "Elbows in",
  severity: "warn",
  views: ["front"],
  phases: "down",
  check(f) {
    if (!visible(f, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW)) return null;
    const shoulders = Math.abs(px(f, LM.LEFT_SHOULDER).x - px(f, LM.RIGHT_SHOULDER).x);
    const elbows = Math.abs(px(f, LM.LEFT_ELBOW).x - px(f, LM.RIGHT_ELBOW).x);
    return shoulders > 0 && elbows > 1.8 * shoulders ? [LM.LEFT_ELBOW, LM.RIGHT_ELBOW] : null;
  },
};

export function resolveRules(refs: readonly RuleRef[] = []): FormRule[] {
  return refs.flatMap((ref): FormRule[] => {
    switch (ref.id) {
      case "knees-caving":
        return [kneesCaving];
      case "knee-past-toes":
        return [kneePastToes];
      case "torso-lean":
        return [torsoLeanRule(ref.cue, ref.limit)];
      case "hips":
        return hipRules(ref.sagCue, ref.pikeCue);
      case "hinge-knees":
        return [hingeKnees];
      case "no-swing":
        return [noSwing];
      case "raise-too-high":
        return [raiseTooHigh];
      case "elbow-flare":
        return [elbowFlare];
    }
  });
}

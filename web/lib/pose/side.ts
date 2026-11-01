import { LM, type Landmark } from "./landmarks";

export type Side = "left" | "right";

/** Joints used to judge which side faces the camera (person's left/right). */
export const SIDE_JOINTS: Record<Side, readonly number[]> = {
  left: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE],
  right: [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST, LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
};

/** Switch sides only when the other one is clearly better, so it doesn't flicker. */
export const SIDE_SWITCH_MARGIN = 0.15;

export function sideVisibility(landmarks: readonly Landmark[], side: Side): number {
  const joints = SIDE_JOINTS[side];
  return joints.reduce((sum, i) => sum + (landmarks[i]?.visibility ?? 0), 0) / joints.length;
}

/**
 * From a side view, the far-side limbs are hidden and their landmarks are guesses,
 * so measure angles on the side the camera sees best. Sticky: keeps `prev` unless
 * the other side beats it by SIDE_SWITCH_MARGIN.
 */
export function pickSide(landmarks: readonly Landmark[], prev: Side | null): Side {
  const left = sideVisibility(landmarks, "left");
  const right = sideVisibility(landmarks, "right");
  if (prev === "left") return right > left + SIDE_SWITCH_MARGIN ? "right" : "left";
  if (prev === "right") return left > right + SIDE_SWITCH_MARGIN ? "left" : "right";
  return left >= right ? "left" : "right";
}

import { LANDMARK_COUNT, LM, type Landmark } from "./landmarks";

export const MIN_VISIBILITY = 0.5;
const EDGE_MARGIN = 0.02;

export type FrameCheck =
  | { ok: true }
  | { ok: false; reason: "no-body" | "feet" | "head"; message: string };

/** Confident and inside the image (MediaPipe guesses points outside the frame too). */
export function isSeen(lm: Landmark | undefined): boolean {
  return (
    lm !== undefined &&
    lm.visibility >= MIN_VISIBILITY &&
    lm.x >= -EDGE_MARGIN &&
    lm.x <= 1 + EDGE_MARGIN &&
    lm.y >= -EDGE_MARGIN &&
    lm.y <= 1 + EDGE_MARGIN
  );
}

const either = (lms: readonly Landmark[], a: number, b: number) => isSeen(lms[a]) || isSeen(lms[b]);

/**
 * Is enough of the body visible to track exercises? One side is enough
 * (side views hide the far limbs), but we need shoulders/hips, a foot and the head.
 */
export function checkBodyInFrame(landmarks: readonly Landmark[] | null): FrameCheck {
  if (!landmarks || landmarks.length < LANDMARK_COUNT) {
    return { ok: false, reason: "no-body", message: "I can't see you. Step into the frame." };
  }
  const torso =
    either(landmarks, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER) && either(landmarks, LM.LEFT_HIP, LM.RIGHT_HIP);
  if (!torso) {
    return { ok: false, reason: "no-body", message: "I can't see you. Step into the frame." };
  }
  if (!either(landmarks, LM.LEFT_ANKLE, LM.RIGHT_ANKLE)) {
    return { ok: false, reason: "feet", message: "Step back, I can't see your feet." };
  }
  if (!isSeen(landmarks[LM.NOSE]) && !either(landmarks, LM.LEFT_EAR, LM.RIGHT_EAR)) {
    return { ok: false, reason: "head", message: "Step back, I can't see your head." };
  }
  return { ok: true };
}

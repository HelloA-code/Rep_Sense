import type { CameraView } from "@/lib/recording/format";
import { distance, toPixels } from "./geometry";
import { LM, type Landmark } from "./landmarks";

// Which way is the camera looking at the person? It decides which form rules are
// valid: knees caving in is only visible from the front, hip sag only from the side.
// From the front the shoulders are wide apart; from the side they overlap.

/** Shoulder width ÷ torso length above this = front view, below SIDE_BELOW = side view. */
export const FRONT_ABOVE = 0.45;
export const SIDE_BELOW = 0.3;

/** Shoulder width relative to torso length (shoulder midpoint → hip midpoint), in pixels. */
export function viewRatio(lm: readonly Landmark[], width: number, height: number): number | null {
  const ls = toPixels(lm[LM.LEFT_SHOULDER], width, height);
  const rs = toPixels(lm[LM.RIGHT_SHOULDER], width, height);
  const lh = toPixels(lm[LM.LEFT_HIP], width, height);
  const rh = toPixels(lm[LM.RIGHT_HIP], width, height);
  const torso = distance({ x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 }, { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 });
  if (torso === 0) return null;
  return distance(ls, rs) / torso;
}

/** Sticky: in the grey zone between the two thresholds it keeps the previous answer. */
export function estimateView(
  lm: readonly Landmark[],
  width: number,
  height: number,
  prev: CameraView | null,
): CameraView | null {
  const ratio = viewRatio(lm, width, height);
  if (ratio === null) return prev;
  if (ratio > FRONT_ABOVE) return "front";
  if (ratio < SIDE_BELOW) return "side";
  return prev;
}

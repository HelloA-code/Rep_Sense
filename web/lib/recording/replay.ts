import type { Landmark } from "@/lib/pose/landmarks";
import { RECORDING_VERSION, type RecordedFrame, type Recording } from "./format";

/** Frames further apart than this mean the person was lost; show nothing in the gap. */
export const MAX_GAP_MS = 250;

/**
 * Index of the frame to show at playback time `t` (the last frame with frame.t <= t),
 * or -1 before the first frame or inside a gap. Binary search: frames are sorted by t.
 */
export function frameIndexAt(frames: readonly RecordedFrame[], t: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found === -1) return -1;
  const next = frames[found + 1];
  if (next && next.t - frames[found].t > MAX_GAP_MS && t - frames[found].t > MAX_GAP_MS) return -1;
  return found;
}

/** Turns a stored `[x, y, z, vis]` row array back into landmarks for drawSkeleton. */
export function frameLandmarks(frame: RecordedFrame): Landmark[] {
  return frame.lm.map(([x, y, z, visibility]) => ({ x, y, z, visibility }));
}

export type ClipBundle = { version: typeof RECORDING_VERSION; exportedAt: string; clips: Recording[] };

/** Many clips in one file, for moving the dataset to a laptop. Read by ml/src/prepare.py. */
export function createBundle(clips: Recording[], now: Date): ClipBundle {
  return { version: RECORDING_VERSION, exportedAt: now.toISOString(), clips };
}

/** e.g. repsense_clips_20261101-142530.json */
export function bundleFileName(now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  return `repsense_clips_${stamp}.json`;
}

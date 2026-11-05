import { MAX_GAP_MS, NUM_FEATURES, RESAMPLE_HZ, WINDOW, frameFeatures } from "./features";

const STEP_MS = 1000 / RESAMPLE_HZ;

type Frame = { landmarks: readonly { x: number; y: number }[]; width: number; height: number };

/**
 * The last 30 ticks at a fixed 15 Hz, however fast the camera runs. Each tick takes the
 * latest frame at or before it: the same loop as resample() in ml/src/features.py.
 * Losing the person for over 250 ms starts the window again.
 */
export function createRollingWindow() {
  let ticks: Float32Array[] = [];
  let nextTick: number | null = null;
  let lastT = 0;
  let last: Frame | null = null;

  const add = (f: Frame) => {
    ticks.push(frameFeatures(f.landmarks, f.width, f.height));
    if (ticks.length > WINDOW) ticks.shift();
  };

  return {
    /** Returns how many ticks this frame completed. */
    push(frame: Frame, tMs: number): number {
      if (nextTick === null || tMs - lastT > MAX_GAP_MS) {
        ticks = [];
        nextTick = tMs;
        last = null;
      }
      let added = 0;
      while (nextTick <= tMs) {
        const source = nextTick === tMs || !last ? frame : last;
        add(source);
        nextTick += STEP_MS;
        added += 1;
      }
      last = frame;
      lastT = tMs;
      return added;
    },
    get full() {
      return ticks.length === WINDOW;
    },
    /** WINDOW × NUM_FEATURES, flattened, oldest first. */
    values(): Float32Array {
      const out = new Float32Array(WINDOW * NUM_FEATURES);
      ticks.forEach((t, i) => out.set(t, i * NUM_FEATURES));
      return out;
    },
    reset() {
      ticks = [];
      nextTick = null;
      last = null;
    },
  };
}

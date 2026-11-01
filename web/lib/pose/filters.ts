import type { Landmark } from "./landmarks";

// One-Euro filter (Casiez et al., 2012): a low-pass filter whose cutoff rises with speed.
// Still → low cutoff → heavy smoothing (kills jitter).
// Moving fast → high cutoff → little smoothing (no lag).
//   minCutoff (Hz): smoothing when still. Lower = smoother but laggier.
//   beta: how fast the cutoff climbs with speed. Higher = less lag on fast moves.
//   dCutoff (Hz): smoothing of the speed estimate itself; 1 is fine.

export type OneEuroParams = { minCutoff: number; beta: number; dCutoff: number };

/** Tuned for normalised (0–1) landmark coordinates at ~30 FPS. */
export const LANDMARK_FILTER: OneEuroParams = { minCutoff: 1.0, beta: 10, dCutoff: 1.0 };

/** Smoothing factor of an exponential filter with the given cutoff, for a step of dt seconds. */
function alpha(cutoff: number, dt: number) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private t = 0;

  constructor(private readonly params: OneEuroParams) {}

  /** `tSec` must be in seconds and increasing. Returns the smoothed value. */
  filter(value: number, tSec: number): number {
    if (this.x === null) {
      this.x = value;
      this.t = tSec;
      return value;
    }
    const dt = tSec - this.t;
    if (dt <= 0) return this.x;
    this.t = tSec;

    const rawDx = (value - this.x) / dt;
    const aD = alpha(this.params.dCutoff, dt);
    this.dx = aD * rawDx + (1 - aD) * this.dx;

    const cutoff = this.params.minCutoff + this.params.beta * Math.abs(this.dx);
    const a = alpha(cutoff, dt);
    this.x = a * value + (1 - a) * this.x;
    return this.x;
  }

  reset() {
    this.x = null;
    this.dx = 0;
  }
}

/**
 * One filter per coordinate of each landmark. Visibility passes through unfiltered.
 * Call reset() when the person is lost so we don't smooth across the gap.
 */
export function createLandmarkSmoother(params: OneEuroParams = LANDMARK_FILTER) {
  let filters: OneEuroFilter[][] = [];

  return {
    smooth(landmarks: readonly Landmark[], tMs: number): Landmark[] {
      if (filters.length !== landmarks.length) {
        filters = landmarks.map(() => [new OneEuroFilter(params), new OneEuroFilter(params), new OneEuroFilter(params)]);
      }
      const t = tMs / 1000;
      return landmarks.map((l, i) => {
        const [fx, fy, fz] = filters[i];
        return { x: fx.filter(l.x, t), y: fy.filter(l.y, t), z: fz.filter(l.z, t), visibility: l.visibility };
      });
    },
    reset() {
      filters = [];
    },
  };
}

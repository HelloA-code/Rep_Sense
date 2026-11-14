// Has the camera lost the joints this exercise needs? One bad frame isn't "lost": only a
// stretch of frames with nothing measurable is, and getting back needs a short stretch of
// good frames, so the manual counter doesn't flicker on and off.

export type TrackingState = "tracking" | "lost";

export type TrackingMonitorOptions = {
  /** Nothing measurable for this long → lost. */
  lostAfterMs: number;
  /** Measurable again for this long → tracking. */
  backAfterMs: number;
};

export const TRACKING_DEFAULTS: TrackingMonitorOptions = { lostAfterMs: 2000, backAfterMs: 500 };

export function createTrackingMonitor({ lostAfterMs, backAfterMs }: TrackingMonitorOptions = TRACKING_DEFAULTS) {
  let state: TrackingState = "tracking";
  let lastSeen: number | null = null;
  let seenSince: number | null = null;

  return {
    /** `measurable`: the exercise's signal could be measured on this frame. */
    update(measurable: boolean, tMs: number): TrackingState {
      lastSeen ??= tMs; // the clock starts with the first frame
      if (measurable) {
        lastSeen = tMs;
        seenSince ??= tMs;
        if (state === "lost" && tMs - seenSince >= backAfterMs) state = "tracking";
      } else {
        seenSince = null;
        if (state === "tracking" && tMs - lastSeen >= lostAfterMs) state = "lost";
      }
      return state;
    },
    reset() {
      state = "tracking";
      lastSeen = null;
      seenSince = null;
    },
    get state() {
      return state;
    },
  };
}

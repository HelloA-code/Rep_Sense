// Generic rep counter: TOP → BOTTOM → TOP, with hysteresis.
//
// Every rep exercise is "an angle that starts large, gets small, and comes back":
// knee for squats and lunges, elbow for push-ups, pull-ups and dips. Two thresholds,
// not one: you enter the bottom below `downBelow` and the rep only counts once you're
// back above `upAbove`. Jitter around either line can't count twice, because to
// count again you have to cross both.

export type RepPhase = "up" | "down";

export type RepCounterConfig = {
  /** Enter the bottom phase once the angle drops below this (degrees). */
  downBelow: number;
  /** Count the rep when the angle comes back above this (degrees). */
  upAbove: number;
  /** Ignore "reps" faster than this from bottom to top: usually a tracking glitch. */
  minRepMs: number;
};

export type RepState = {
  phase: RepPhase;
  reps: number;
  /** A rep was rejected this frame (too fast, or the extra goal wasn't met). */
  rejected: "too-fast" | "goal" | null;
};

export type RepCounter = {
  /**
   * Feed one smoothed angle per frame. `goalMet` is an optional extra condition that
   * must be true at some point during the bottom phase (pull-up: chin above the bar).
   */
  update(angle: number, tMs: number, goalMet?: boolean): RepState;
  reset(): void;
  readonly state: RepState;
};

export function createRepCounter(config: RepCounterConfig): RepCounter {
  let phase: RepPhase = "up";
  let reps = 0;
  let downSince = 0;
  let goalSeen = false;
  let state: RepState = { phase, reps, rejected: null };

  return {
    update(angle, tMs, goalMet = true) {
      let rejected: RepState["rejected"] = null;
      if (phase === "up" && angle < config.downBelow) {
        phase = "down";
        downSince = tMs;
        goalSeen = goalMet;
      } else if (phase === "down") {
        if (goalMet) goalSeen = true;
        if (angle > config.upAbove) {
          phase = "up";
          if (tMs - downSince < config.minRepMs) rejected = "too-fast";
          else if (!goalSeen) rejected = "goal";
          else reps += 1;
        }
      }
      state = { phase, reps, rejected };
      return state;
    },
    reset() {
      phase = "up";
      reps = 0;
      goalSeen = false;
      state = { phase, reps, rejected: null };
    },
    get state() {
      return state;
    },
  };
}

// Plank: no reps, a timer that only runs while the body is in position and straight.

export type HoldConfig = {
  /** Body line may bend this far (degrees) before the timer pauses. */
  maxDeviation: number;
  /** Short breaks shorter than this don't pause the timer (tracking blips). */
  graceMs: number;
};

export type HoldState = { holding: boolean; heldMs: number };

export type HoldTimer = {
  /** `deviation` = bodyLineDeviation, or null if the person isn't in plank position. */
  update(deviation: number | null, tMs: number): HoldState;
  reset(): void;
  readonly state: HoldState;
};

export function createHoldTimer(config: HoldConfig): HoldTimer {
  let heldMs = 0;
  let lastT: number | null = null;
  let lastGoodT: number | null = null;
  let state: HoldState = { holding: false, heldMs: 0 };

  return {
    update(deviation, tMs) {
      const good = deviation !== null && deviation <= config.maxDeviation;
      if (good) lastGoodT = tMs;
      const holding = lastGoodT !== null && tMs - lastGoodT <= config.graceMs;
      if (holding && lastT !== null) heldMs += Math.min(tMs - lastT, 250); // cap gaps between frames
      lastT = tMs;
      state = { holding, heldMs };
      return state;
    },
    reset() {
      heldMs = 0;
      lastT = null;
      lastGoodT = null;
      state = { holding: false, heldMs: 0 };
    },
    get state() {
      return state;
    },
  };
}

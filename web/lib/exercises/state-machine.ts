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
  /**
   * The halfway line for partial reps (default: midway between the two thresholds).
   * Past it but not to the bottom, then back up → "shallow".
   * Back past it from the bottom but not to the top, then down again → "no-lockout".
   */
  partialBelow?: number;
};

/**
 * Why an attempt didn't count:
 * - too-fast: a tracking glitch
 * - goal: the extra condition wasn't met (pull-up chin)
 * - shallow: didn't go deep enough
 * - no-lockout: didn't come all the way back up before the next rep
 */
export type RepRejection = "too-fast" | "goal" | "shallow" | "no-lockout";

export type RepState = {
  phase: RepPhase;
  reps: number;
  /** An attempt was rejected this frame. */
  rejected: RepRejection | null;
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
  const partial = config.partialBelow ?? (config.downBelow + config.upAbove) / 2;
  let phase: RepPhase = "up";
  let reps = 0;
  let downSince = 0;
  let goalSeen = false;
  /** Seen the top at least once, so a "shallow" verdict is fair (not mid-rep at the start). */
  let armed = false;
  let minSinceTop = Infinity;
  let maxSinceBottom = -Infinity;
  let state: RepState = { phase, reps, rejected: null };

  return {
    update(angle, tMs, goalMet = true) {
      let rejected: RepRejection | null = null;
      if (phase === "up") {
        if (angle < config.downBelow) {
          phase = "down";
          downSince = tMs;
          goalSeen = goalMet;
          maxSinceBottom = angle;
        } else {
          if (armed) minSinceTop = Math.min(minSinceTop, angle);
          if (angle > config.upAbove) {
            if (minSinceTop < partial) rejected = "shallow";
            armed = true;
            minSinceTop = angle;
          }
        }
      } else {
        if (goalMet) goalSeen = true;
        maxSinceBottom = Math.max(maxSinceBottom, angle);
        if (angle > config.upAbove) {
          phase = "up";
          armed = true;
          minSinceTop = angle;
          if (tMs - downSince < config.minRepMs) rejected = "too-fast";
          else if (!goalSeen) rejected = "goal";
          else reps += 1;
        } else if (angle < config.downBelow && maxSinceBottom > partial) {
          // Came halfway up and went back down: the last attempt never locked out.
          rejected = "no-lockout";
          downSince = tMs;
          goalSeen = goalMet;
          maxSinceBottom = angle;
        }
      }
      state = { phase, reps, rejected };
      return state;
    },
    reset() {
      phase = "up";
      reps = 0;
      goalSeen = false;
      armed = false;
      minSinceTop = Infinity;
      maxSinceBottom = -Infinity;
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

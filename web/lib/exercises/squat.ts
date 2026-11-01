// Squat rep counter: STANDING → DOWN → STANDING, with hysteresis.
//
// YOU WRITE THIS ONE (Day 3). Tests: squat.test.ts.

/** Enter "down" once the knee angle drops below this. */
export const SQUAT_DOWN_BELOW = 90;
/** Count the rep only when the knee angle comes back above this. */
export const SQUAT_UP_ABOVE = 160;

export type SquatPhase = "standing" | "down";
export type SquatState = { phase: SquatPhase; reps: number };

export type SquatCounter = {
  /** Feed one (smoothed) knee angle in degrees per frame; returns the state after it. */
  update(kneeAngle: number): SquatState;
  /** Back to standing with 0 reps. */
  reset(): void;
};

export function createSquatCounter(): SquatCounter {
  throw new Error("TODO: write createSquatCounter() — see the hints in the Day 3 notes");
}

import { describe, expect, it } from "vitest";
import { createHoldTimer, createRepCounter } from "./state-machine";

const squat = { downBelow: 90, upAbove: 160, minRepMs: 300 };

/** Feeds angles 100 ms apart; returns the final state. */
function run(angles: number[], config = squat, goals?: boolean[]) {
  const counter = createRepCounter(config);
  angles.forEach((a, i) => counter.update(a, i * 100, goals?.[i]));
  return counter.state;
}

describe("createRepCounter", () => {
  it("starts up with 0 reps", () => {
    expect(run([175])).toMatchObject({ phase: "up", reps: 0 });
  });

  it("counts one full rep: down below the low line, back above the high one", () => {
    expect(run([175, 140, 100, 85, 80, 95, 130, 165, 175])).toMatchObject({ phase: "up", reps: 1 });
  });

  it("is 'down' at the bottom; the rep only counts on the way up", () => {
    expect(run([175, 120, 85])).toMatchObject({ phase: "down", reps: 0 });
    expect(run([175, 120, 85, 120, 150])).toMatchObject({ phase: "down", reps: 0 });
  });

  it("counts several reps", () => {
    const rep = [170, 120, 80, 80, 120, 170];
    expect(run([...rep, ...rep, ...rep])).toMatchObject({ reps: 3 });
  });

  it("ignores jitter around the bottom line (hysteresis)", () => {
    expect(run([175, 89, 91, 88, 92, 89, 91, 170])).toMatchObject({ phase: "up", reps: 1 });
  });

  it("ignores jitter around the top line", () => {
    expect(run([175, 85, 85, 85, 161, 159, 162, 158, 163])).toMatchObject({ phase: "up", reps: 1 });
  });

  it("doesn't count a half rep that never crosses the low line", () => {
    expect(run([175, 130, 100, 95, 130, 175])).toMatchObject({ reps: 0 });
  });

  it("rejects a 'rep' that is too fast to be real", () => {
    const counter = createRepCounter(squat);
    counter.update(175, 0);
    counter.update(80, 33);
    expect(counter.update(170, 66)).toMatchObject({ reps: 0, rejected: "too-fast" });
  });

  it("requires the goal at some point during the bottom phase", () => {
    const angles = [170, 80, 70, 80, 170];
    expect(run(angles, squat, [false, false, false, false, false])).toMatchObject({ reps: 0, rejected: "goal" });
    expect(run(angles, squat, [false, false, true, false, false])).toMatchObject({ reps: 1 });
  });

  it("flags a shallow attempt (past halfway, not to the bottom)", () => {
    const counter = createRepCounter(squat); // halfway = 125
    const states = [175, 140, 110, 100, 120, 150, 170].map((a, i) => counter.update(a, i * 100));
    expect(states.at(-1)).toMatchObject({ reps: 0, rejected: "shallow" });
  });

  it("doesn't call a small dip or the start of the set shallow", () => {
    const counter = createRepCounter(squat);
    const dip = [175, 150, 140, 170].map((a, i) => counter.update(a, i * 100)); // never past halfway
    expect(dip.some((s) => s.rejected)).toBe(false);
    const fresh = createRepCounter(squat);
    const start = [110, 130, 170].map((a, i) => fresh.update(a, i * 100)); // started mid-way, then stood
    expect(start.some((s) => s.rejected)).toBe(false);
  });

  it("flags no-lockout when you go back down before reaching the top", () => {
    const counter = createRepCounter(squat);
    const states = [175, 80, 80, 140, 145, 80, 80, 80, 80, 170].map((a, i) => counter.update(a, i * 100));
    expect(states.map((s) => s.rejected)).toContain("no-lockout");
    expect(states.at(-1)).toMatchObject({ reps: 1 }); // the second, complete attempt still counts
  });

  it("reset() goes back to up with 0 reps", () => {
    const counter = createRepCounter(squat);
    [170, 80, 80, 80, 80, 170].forEach((a, i) => counter.update(a, i * 100));
    expect(counter.state.reps).toBe(1);
    counter.reset();
    expect(counter.update(175, 1000)).toMatchObject({ phase: "up", reps: 0 });
  });
});

describe("createHoldTimer", () => {
  const plank = { maxDeviation: 15, graceMs: 500 };

  it("counts time only while the body line is straight", () => {
    const t = createHoldTimer(plank);
    for (let ms = 0; ms <= 2000; ms += 100) t.update(5, ms);
    expect(t.state.heldMs).toBe(2000);
    for (let ms = 2100; ms <= 4000; ms += 100) t.update(30, ms); // hips sagging
    expect(t.state.holding).toBe(false);
    expect(t.state.heldMs).toBeLessThanOrEqual(2500); // grace period only
  });

  it("forgives a short blip but pauses when out of position", () => {
    const t = createHoldTimer(plank);
    t.update(5, 0);
    t.update(null, 200); // lost for a moment
    expect(t.update(5, 400).holding).toBe(true);
    expect(t.update(null, 1500).holding).toBe(false);
  });

  it("reset() clears the time", () => {
    const t = createHoldTimer(plank);
    t.update(5, 0);
    t.update(5, 1000);
    t.reset();
    expect(t.update(5, 2000)).toEqual({ holding: true, heldMs: 0 });
  });
});

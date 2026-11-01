import { describe, expect, it } from "vitest";
import { createSquatCounter } from "./squat";

/** Feeds a list of knee angles and returns the final state. */
function run(angles: number[]) {
  const counter = createSquatCounter();
  let state = counter.update(angles[0]);
  for (const a of angles.slice(1)) state = counter.update(a);
  return state;
}

// createSquatCounter() is yours to write. These go green when it's right.
describe("squat counter (yours)", () => {
  it("starts standing with 0 reps", () => {
    expect(run([175])).toEqual({ phase: "standing", reps: 0 });
  });

  it("counts one full rep: down below 90, back up above 160", () => {
    expect(run([175, 140, 100, 85, 80, 95, 130, 165, 175])).toEqual({ phase: "standing", reps: 1 });
  });

  it("is 'down' at the bottom, and the rep only counts on the way up", () => {
    expect(run([175, 120, 85])).toEqual({ phase: "down", reps: 0 });
    expect(run([175, 120, 85, 120, 150])).toEqual({ phase: "down", reps: 0 }); // not above 160 yet
  });

  it("counts several reps", () => {
    const rep = [170, 120, 80, 120, 170];
    expect(run([...rep, ...rep, ...rep])).toEqual({ phase: "standing", reps: 3 });
  });

  it("ignores jitter around the bottom threshold (hysteresis)", () => {
    expect(run([175, 89, 91, 88, 92, 89, 91, 170])).toEqual({ phase: "standing", reps: 1 });
  });

  it("ignores jitter around the top threshold", () => {
    expect(run([175, 85, 161, 159, 162, 158, 163])).toEqual({ phase: "standing", reps: 1 });
  });

  it("doesn't count a half squat that never goes below 90", () => {
    expect(run([175, 130, 100, 95, 130, 175])).toEqual({ phase: "standing", reps: 0 });
  });

  it("reset() goes back to standing with 0 reps", () => {
    const counter = createSquatCounter();
    for (const a of [170, 80, 170]) counter.update(a);
    counter.reset();
    expect(counter.update(175)).toEqual({ phase: "standing", reps: 0 });
  });
});

import { describe, expect, it } from "vitest";
import { OneEuroFilter, createLandmarkSmoother, type OneEuroParams } from "./filters";

const params: OneEuroParams = { minCutoff: 1, beta: 0, dCutoff: 1 };
const FPS = 30;

/** Runs a filter over a signal sampled at 30 Hz; returns the outputs. */
function runFilter(f: OneEuroFilter, signal: (i: number) => number, n: number) {
  return Array.from({ length: n }, (_, i) => f.filter(signal(i), i / FPS));
}

describe("OneEuroFilter", () => {
  it("passes the first value through and keeps a constant signal constant", () => {
    const out = runFilter(new OneEuroFilter(params), () => 0.42, 30);
    for (const v of out) expect(v).toBeCloseTo(0.42);
  });

  it("smooths jitter: output varies less than the input", () => {
    const noisy = (i: number) => 0.5 + (i % 2 === 0 ? 0.02 : -0.02);
    const out = runFilter(new OneEuroFilter(params), noisy, 60).slice(10);
    const spread = Math.max(...out) - Math.min(...out);
    expect(spread).toBeLessThan(0.04 * 0.5);
  });

  it("converges to a new value after a step", () => {
    const out = runFilter(new OneEuroFilter(params), (i) => (i < 5 ? 0 : 1), 90);
    expect(out[5]).toBeLessThan(1);
    expect(out[89]).toBeCloseTo(1, 2);
  });

  it("lags less on a fast move when beta is higher", () => {
    const ramp = (i: number) => i * 0.05; // moving steadily
    const slow = runFilter(new OneEuroFilter({ ...params, beta: 0 }), ramp, 20);
    const fast = runFilter(new OneEuroFilter({ ...params, beta: 10 }), ramp, 20);
    const target = ramp(19);
    expect(target - fast[19]).toBeLessThan(target - slow[19]);
  });

  it("ignores repeated or backwards timestamps", () => {
    const f = new OneEuroFilter(params);
    f.filter(1, 0);
    expect(f.filter(5, 0)).toBe(1);
  });
});

describe("createLandmarkSmoother", () => {
  it("smooths x/y/z per landmark and keeps visibility as-is", () => {
    const s = createLandmarkSmoother(params);
    s.smooth([{ x: 0, y: 0, z: 0, visibility: 0.9 }], 0);
    const [out] = s.smooth([{ x: 1, y: 1, z: 1, visibility: 0.3 }], 33);
    expect(out.x).toBeGreaterThan(0);
    expect(out.x).toBeLessThan(1);
    expect(out.visibility).toBe(0.3);
  });

  it("starts fresh after reset()", () => {
    const s = createLandmarkSmoother(params);
    s.smooth([{ x: 0, y: 0, z: 0, visibility: 1 }], 0);
    s.reset();
    expect(s.smooth([{ x: 1, y: 1, z: 1, visibility: 1 }], 33)[0].x).toBe(1);
  });
});

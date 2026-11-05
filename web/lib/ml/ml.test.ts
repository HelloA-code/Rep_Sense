import { describe, expect, it } from "vitest";
import { createAutoDetector, MIN_CONFIDENCE, REQUIRED_STREAK } from "./auto-detect";
import { FEATURE_VERSION, LABELS, NUM_FEATURES, WINDOW, frameFeatures } from "./features";
import golden from "./__fixtures__/features_golden.json";
import { createRollingWindow } from "./rolling-window";

const frames = golden.frames.map((f) => f.map(([x, y]) => ({ x, y })));
const { width, height, times } = golden;

/** The same clip, frame by frame, as the camera would deliver it. */
function liveWindows() {
  const rolling = createRollingWindow();
  const out: Float32Array[] = [];
  let ticks = 0;
  let sinceFull = 0;
  frames.forEach((landmarks, i) => {
    const gap = i > 0 && times[i] - times[i - 1] > 250;
    if (gap) {
      ticks = 0;
      sinceFull = 0;
    }
    const added = rolling.push({ landmarks, width, height }, times[i]);
    for (let k = 0; k < added; k++) {
      ticks += 1;
      if (ticks < WINDOW) continue;
      if (sinceFull % 5 === 0 && k === added - 1) out.push(rolling.values());
      sinceFull += 1;
    }
  });
  return out;
}

describe("Python/TypeScript parity (golden fixture from ml/src/write_fixtures.py)", () => {
  it("was generated for the current feature version", () => {
    expect(golden.featureVersion).toBe(FEATURE_VERSION);
    expect(golden.windows.length).toBeGreaterThan(0);
  });

  it("computes the same features for a frame", () => {
    // Window 0's first row is the clip's first frame.
    const f = frameFeatures(frames[0], width, height);
    for (let i = 0; i < NUM_FEATURES; i++) expect(f[i]).toBeCloseTo(golden.windows[0][i], 2);
  });

  it("builds the same windows from a live frame stream, across a tracking gap", () => {
    const live = liveWindows();
    expect(live.length).toBe(golden.windows.length);
    live.forEach((w, i) => {
      expect(w.length).toBe(WINDOW * NUM_FEATURES);
      w.forEach((v, j) => expect(Math.abs(v - golden.windows[i][j])).toBeLessThan(0.003));
    });
  });
});

describe("rolling window", () => {
  const pose = frames[0];

  it("fills at 15 Hz regardless of camera speed", () => {
    for (const fps of [15, 30, 60]) {
      const r = createRollingWindow();
      let ticks = 0;
      for (let t = 0; t < 2000; t += 1000 / fps) ticks += r.push({ landmarks: pose, width, height }, t);
      expect(Math.abs(ticks - 30)).toBeLessThanOrEqual(1);
    }
  });

  it("starts again after losing the person", () => {
    const r = createRollingWindow();
    for (let t = 0; t < 2500; t += 33) r.push({ landmarks: pose, width, height }, t);
    expect(r.full).toBe(true);
    r.push({ landmarks: pose, width, height }, 5000);
    expect(r.full).toBe(false);
  });
});

describe("auto-detect", () => {
  const probs = (label: (typeof LABELS)[number], p: number) => {
    const out = new Array(LABELS.length).fill((1 - p) / (LABELS.length - 1));
    out[LABELS.indexOf(label)] = p;
    return out;
  };
  const feed = (d: ReturnType<typeof createAutoDetector>, n: number, label: (typeof LABELS)[number], p = 0.9) =>
    Array.from({ length: n }, () => d.update(probs(label, p)).switchTo);

  it("switches once, after a confident streak", () => {
    const d = createAutoDetector();
    expect(feed(d, REQUIRED_STREAK + 2, "squat")).toEqual([null, null, "squat", null, null]);
  });

  it("ignores flicker and low confidence", () => {
    const d = createAutoDetector();
    feed(d, REQUIRED_STREAK - 1, "squat");
    feed(d, 1, "lunge");
    expect(feed(d, REQUIRED_STREAK - 1, "squat")).toEqual([null, null]);
    expect(feed(createAutoDetector(), 10, "squat", MIN_CONFIDENCE - 0.1).every((s) => s === null)).toBe(true);
  });

  it("never switches to idle, and keeps the exercise through a rest", () => {
    const d = createAutoDetector("squat");
    expect(feed(d, 10, "idle").every((s) => s === null)).toBe(true);
    expect(feed(d, 5, "squat").every((s) => s === null)).toBe(true);
  });

  it("moves on to a new exercise", () => {
    const d = createAutoDetector("squat");
    expect(feed(d, REQUIRED_STREAK, "pushup").at(-1)).toBe("pushup");
  });

  it("respects a manual pick", () => {
    const d = createAutoDetector();
    feed(d, REQUIRED_STREAK - 1, "squat");
    d.setCurrent("dip");
    expect(feed(d, REQUIRED_STREAK - 1, "squat")).toEqual([null, null]);
  });
});

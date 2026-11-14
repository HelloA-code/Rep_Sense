import { describe, expect, it } from "vitest";
import { createTrackingMonitor } from "@/lib/pose/visibility";
import { buildCustomExercise, customFromTeach, isCustomExercise, isCustomId, newCustomId } from "./custom";
import { exerciseConfig, exerciseName } from "./registry";
import { createRepCounter } from "./state-machine";
import { analyseTeach, type TeachFrame, type TeachSuccess } from "./teach";
import { FIG_H, FIG_W, figure, frontFigure } from "./test-figure";
import type { PoseFrame } from "./types";

const FPS = 30;

/** `reps` slow reps of a movement: `pose(p)` with p going 0 → 1 → 0 each rep, after a short rest. */
function recording(pose: (p: number) => PoseFrame, reps = 3, repMs = 2400): TeachFrame[] {
  const frames: TeachFrame[] = [];
  const restMs = 600;
  const total = restMs + reps * repMs + restMs;
  for (let t = 0; t <= total; t += 1000 / FPS) {
    const inRep = t - restMs;
    const p = inRep < 0 || inRep >= reps * repMs ? 0 : (1 - Math.cos((2 * Math.PI * (inRep % repMs)) / repMs)) / 2;
    frames.push({ t, landmarks: pose(p).lm });
  }
  return frames;
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

function teach(pose: (p: number) => PoseFrame, reps = 3): TeachSuccess {
  const result = analyseTeach(recording(pose, reps), FIG_W, FIG_H);
  if (!result.ok) throw new Error(result.message);
  return result;
}

/** Counts reps of a fresh recording with the taught exercise, the way a set would. */
function countWith(taught: TeachSuccess, pose: (p: number) => PoseFrame, reps: number) {
  const config = buildCustomExercise(customFromTeach("Test", taught));
  const counter = createRepCounter(config.counter);
  let state = counter.state;
  for (const f of recording(pose, reps)) {
    const v = config.measure({ lm: f.landmarks, width: FIG_W, height: FIG_H, side: "left" });
    if (v !== null) state = counter.update(v, f.t);
  }
  return state.reps;
}

describe("teach a rep", () => {
  const curl = (p: number) => figure({ elbow: lerp(170, 40, p) });
  const squat = (p: number) => figure({ knee: lerp(175, 85, p) });
  const raise = (p: number) => figure({ shoulder: lerp(10, 90, p), elbow: 175 });
  const abductor = (p: number) => frontFigure({ kneeSpread: lerp(60, 160, p) });

  it("curl: picks the elbow and counts the taught reps", () => {
    const t = teach(curl);
    expect(t.signal).toBe("elbow");
    expect(t.reps).toBe(3);
    expect(t.mirror).toBeNull();
    expect(t.confidence).toBe("high");
    expect(countWith(t, curl, 5)).toBe(5);
  });

  it("squat: picks the knee", () => {
    const t = teach(squat);
    expect(t.signal).toBe("knee");
    expect(countWith(t, squat, 4)).toBe(4);
  });

  it("lateral raise: picks the shoulder and flips it (the angle grows during the rep)", () => {
    const t = teach(raise);
    expect(t.signal).toBe("shoulder");
    expect(t.mirror).not.toBeNull();
    expect(countWith(t, raise, 3)).toBe(3);
  });

  it("hip abductor: picks the knee spread from the front", () => {
    const t = teach(abductor);
    expect(t.signal).toBe("knee-spread");
    expect(t.view).toBe("front");
    expect(countWith(t, abductor, 3)).toBe(3);
  });

  it("thresholds sit inside the movement, with a gap between them", () => {
    const t = teach(curl);
    expect(t.counter.downBelow).toBeGreaterThan(40);
    expect(t.counter.upAbove).toBeLessThan(170);
    expect(t.counter.upAbove - t.counter.downBelow).toBeGreaterThan(30);
    expect(t.counter.minRepMs).toBeGreaterThanOrEqual(300);
  });

  it("gives a frame at the bottom of a rep with the joint to ring", () => {
    const t = teach(curl);
    expect(t.bottomPose).not.toBeNull();
    expect(t.joints).toHaveLength(1);
  });

  it("refuses standing still", () => {
    const result = analyseTeach(recording(() => figure()), FIG_W, FIG_H);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no-movement");
  });

  it("refuses when the body is hidden", () => {
    const hidden = recording(curl).map((f) => ({ ...f, landmarks: f.landmarks.map((l) => ({ ...l, visibility: 0.1 })) }));
    const result = analyseTeach(hidden, FIG_W, FIG_H);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not-visible");
  });

  it("refuses a single rep, and a too-short recording", () => {
    const one = analyseTeach(recording(curl, 1), FIG_W, FIG_H);
    expect(one.ok).toBe(false);
    if (!one.ok) expect(one.reason).toBe("no-reps");
    const short = analyseTeach(recording(curl).slice(0, 20), FIG_W, FIG_H);
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.reason).toBe("too-short");
  });

  it("refuses random noise", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const noisy = recording(() => figure({ elbow: 60 + rand() * 110, knee: 100 + rand() * 75 }));
    expect(analyseTeach(noisy, FIG_W, FIG_H).ok).toBe(false);
  });
});

describe("taught exercises", () => {
  const taught = () => customFromTeach("  Cable curl  ", teach((p) => figure({ elbow: lerp(170, 40, p) })));

  it("ids are 'custom-' plus random letters, and fit the database check", () => {
    const id = newCustomId();
    expect(isCustomId(id)).toBe(true);
    expect(id).toMatch(/^[a-z0-9-]{1,40}$/);
    expect(isCustomId("squat")).toBe(false);
  });

  it("keeps a tidy name and validates what comes back from storage", () => {
    const c = taught();
    expect(c.name).toBe("Cable curl");
    expect(isCustomExercise(c)).toBe(true);
    expect(isCustomExercise(JSON.parse(JSON.stringify(c)))).toBe(true);
    expect(isCustomExercise({ ...c, signal: "nose" })).toBe(false);
    expect(isCustomExercise({ ...c, counter: { downBelow: 150, upAbove: 100, minRepMs: 300 } })).toBe(false);
    expect(isCustomExercise({ ...c, name: "" })).toBe(false);
    expect(isCustomExercise(null)).toBe(false);
  });

  it("builds a counting-only rep exercise", () => {
    const cfg = buildCustomExercise(taught());
    expect(cfg.mode).toBe("reps");
    expect(cfg.rules).toEqual([]);
    expect(cfg.name).toBe("Cable curl");
  });

  it("registry: finds built-in and taught exercises, and names unknown ones", () => {
    const c = taught();
    expect(exerciseConfig("squat", [])?.name).toBe("Squat");
    expect(exerciseConfig(c.id, [c])?.name).toBe("Cable curl");
    expect(exerciseConfig(c.id, [])).toBeNull();
    expect(exerciseName(c.id, [c])).toBe("Cable curl");
    expect(exerciseName(c.id, [])).toBe("Taught exercise");
    expect(exerciseName("goblet-squat", [])).toBe("Goblet squat");
  });
});

describe("tracking monitor", () => {
  it("only counts as lost after 2 s with nothing measurable", () => {
    const m = createTrackingMonitor();
    m.update(true, 0);
    expect(m.update(false, 1500)).toBe("tracking");
    expect(m.update(false, 2100)).toBe("lost");
  });

  it("one bad frame doesn't count", () => {
    const m = createTrackingMonitor();
    for (let t = 0; t < 5000; t += 33) expect(m.update(t % 990 !== 0, t)).toBe("tracking");
  });

  it("comes back after half a second of good frames", () => {
    const m = createTrackingMonitor();
    m.update(true, 0);
    m.update(false, 2500);
    expect(m.state).toBe("lost");
    expect(m.update(true, 2600)).toBe("lost");
    expect(m.update(true, 3150)).toBe("tracking");
  });
});

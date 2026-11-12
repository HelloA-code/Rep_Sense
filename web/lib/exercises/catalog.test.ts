import { describe, expect, it } from "vitest";
import { EQUIPMENT, EXERCISES } from "@/lib/equipment";
import { LM } from "@/lib/pose/landmarks";
import { CAMERA_VIEWS } from "@/lib/recording/format";
import { MET } from "@/lib/workout/calories";
import { outsideBand } from "./build";
import { CATALOG, type CatalogEntry, type HoldEntry, type RepEntry } from "./catalog";
import { FAMILIES, FAMILY_ORDER } from "./families";
import { EXERCISE_CONFIGS } from "./index";
import { elbowFlare, hingeKnees, noSwing, raiseTooHigh } from "./rules";
import { GATES, SIGNALS } from "./signals";
import { createRepCounter } from "./state-machine";
import { figure, frame, poseForSignal } from "./test-figure";

const entries: readonly CatalogEntry[] = CATALOG;
const reps = entries.filter((e): e is RepEntry => "counter" in e);
const holds = entries.filter((e): e is HoldEntry => "hold" in e);

describe("catalog data", () => {
  it("has the original 6 plus 40 new exercises", () => {
    expect(entries).toHaveLength(46);
    expect(entries.filter((e) => e.classic).map((e) => e.id).sort()).toEqual(
      ["dip", "lunge", "plank", "pullup", "pushup", "squat"],
    );
  });

  it("ids are unique and fit the database check (0003)", () => {
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{1,40}$/);
  });

  it("every entry has a known family, view, signal and equipment", () => {
    const equipment = new Set<string>(EQUIPMENT.map((e) => e.id));
    for (const e of entries) {
      expect(FAMILY_ORDER).toContain(e.family);
      if (e.view) expect(CAMERA_VIEWS).toContain(e.view);
      for (const id of e.requiresAny) expect(equipment.has(id), `${e.id}: ${id}`).toBe(true);
      const signal = "hold" in e ? e.hold.signal : (e.signal ?? FAMILIES[e.family].signal);
      expect(SIGNALS[signal], e.id).toBeDefined();
    }
  });

  it("rep thresholds are in order and holds only live in the hold family", () => {
    for (const e of reps) {
      expect(e.counter.downBelow, e.id).toBeLessThan(e.counter.upAbove);
      expect(e.counter.minRepMs, e.id).toBeGreaterThan(0);
      expect(e.family, e.id).not.toBe("hold");
    }
    for (const e of holds) {
      expect(e.family, e.id).toBe("hold");
      if (e.hold.band) expect(e.hold.band[0], e.id).toBeLessThan(e.hold.band[1]);
    }
  });

  it("builds a config for every exercise, with a calorie rate", () => {
    expect(Object.keys(EXERCISE_CONFIGS)).toHaveLength(46);
    expect(EXERCISES).toHaveLength(46);
    for (const e of entries) {
      const cfg = EXERCISE_CONFIGS[e.id as keyof typeof EXERCISE_CONFIGS];
      expect(cfg.name).toBe(e.name);
      expect(cfg.setupHint.length).toBeGreaterThan(5);
      expect([3.8, 8.0]).toContain(MET[e.id as keyof typeof MET]);
    }
  });

  it("keeps the original calorie rates", () => {
    expect(MET.pushup).toBe(8.0);
    expect(MET.pullup).toBe(8.0);
    expect(MET.dip).toBe(8.0);
    expect(MET.squat).toBe(3.8);
    expect(MET.lunge).toBe(3.8);
    expect(MET.plank).toBe(3.8);
  });
});

describe("every rep exercise counts synthetic reps", () => {
  const REPS = 3;
  const FPS = 30;
  const REP_MS = 8000; // slow enough for the negative pull-up (2.5 s+ from the top to a full hang)

  for (const e of reps) {
    it(e.name, () => {
      const cfg = EXERCISE_CONFIGS[e.id as keyof typeof EXERCISE_CONFIGS];
      if (cfg.mode !== "reps") throw new Error("expected a rep exercise");
      const signal = e.signal ?? FAMILIES[e.family].signal;
      const top = Math.min(e.counter.upAbove + 15, 178);
      const bottom = Math.max(e.counter.downBelow - 15, 5);
      const counter = createRepCounter(e.counter);
      let state = counter.state;
      const frames = (REP_MS / 1000) * FPS;
      for (let r = 0; r < REPS; r++) {
        for (let i = 0; i < frames; i++) {
          const t = r * REP_MS + (i * 1000) / FPS;
          // top → bottom → top, as a cosine.
          const value = bottom + ((top - bottom) * (1 + Math.cos((2 * Math.PI * i) / frames))) / 2;
          const pose = poseForSignal(signal, value);
          const measured = cfg.measure(pose);
          expect(measured, `${e.id} at ${value.toFixed(0)}`).not.toBeNull();
          // The goal (chin over the bar) is met at the bottom of every synthetic rep.
          state = counter.update(measured!, t, cfg.goal ? value < e.counter.downBelow : true);
        }
      }
      expect(state.reps).toBe(REPS);
    });
  }

  it("negative pull-up: dropping fast doesn't count", () => {
    const cfg = EXERCISE_CONFIGS["negative-pullup"];
    if (cfg.mode !== "reps") throw new Error("expected reps");
    const counter = createRepCounter(cfg.counter);
    counter.update(60, 0);
    const state = counter.update(165, 800);
    expect(state.reps).toBe(0);
    expect(state.rejected).toBe("too-fast");
    expect(cfg.missCues["too-fast"]).toBe("Lower slower");
  });
});

describe("holds", () => {
  it("band holds measure how far outside the target range you are", () => {
    expect(outsideBand(90, [75, 110])).toBe(0);
    expect(outsideBand(60, [75, 110])).toBe(15);
    expect(outsideBand(130, [75, 110])).toBe(20);
  });

  it("wall sit: on target at 90°, off target standing", () => {
    const cfg = EXERCISE_CONFIGS["wall-sit"];
    expect(cfg.measure(figure({ knee: 90, hip: 90 }))).toBe(0);
    // Standing up: the knee is far outside the band.
    expect(cfg.measure(figure({ knee: 175, hip: 175 }))!).toBeGreaterThan(5);
  });

  it("dead hang: only counts while hanging with straight arms", () => {
    const cfg = EXERCISE_CONFIGS["dead-hang"];
    expect(cfg.measure(figure({ shoulder: 175, elbow: 170 }))).toBe(0);
    expect(cfg.measure(figure({ shoulder: 175, elbow: 100 }))!).toBeGreaterThan(5);
    expect(cfg.measure(figure({ shoulder: 10 }))).toBeNull(); // hands down: not hanging
  });

  it("L-sit: hips at 90° with straight legs", () => {
    const cfg = EXERCISE_CONFIGS["l-sit"];
    expect(cfg.measure(figure({ hip: 90, knee: 170 }))).toBe(0);
    expect(cfg.measure(figure({ hip: 90, knee: 100 }))).toBeNull(); // knees bent
  });

  it("hollow hold and side plank need you lying out", () => {
    expect(EXERCISE_CONFIGS["hollow-hold"].measure(figure({ hip: 150, lie: 90 }))).toBe(0);
    expect(EXERCISE_CONFIGS["hollow-hold"].measure(figure({ hip: 150 }))).toBeNull();
    expect(EXERCISE_CONFIGS["side-plank"].measure(figure({ hip: 178, lie: 90 }))!).toBeLessThan(15);
    expect(EXERCISE_CONFIGS["side-plank"].measure(figure({ hip: 120, lie: 90 }))!).toBeGreaterThan(15);
  });

  it("gates", () => {
    expect(GATES.upright(figure({ knee: 90, hip: 90 }))).toBe(true);
    expect(GATES.upright(figure({ hip: 120 }))).toBe(false);
    expect(GATES.horizontal(figure({ lie: 90 }))).toBe(true);
    expect(GATES.horizontal(figure())).toBe(false);
  });
});

describe("new form rules", () => {
  it("hinge at the hips: knees bending too much", () => {
    expect(hingeKnees.check(figure({ hip: 100, knee: 165 }))).toBeNull();
    expect(hingeKnees.check(figure({ hip: 100, knee: 110 }))).not.toBeNull();
  });

  it("don't swing: torso rocking off vertical", () => {
    expect(noSwing.check(figure())).toBeNull();
    expect(noSwing.check(figure({ hip: 150 }))).not.toBeNull();
  });

  it("raise too high: wrist well above the shoulder", () => {
    expect(raiseTooHigh.check(figure({ shoulder: 90, elbow: 178 }))).toBeNull();
    expect(raiseTooHigh.check(figure({ shoulder: 150, elbow: 178 }))).not.toBeNull();
  });

  it("elbow flare: elbows much wider than the shoulders (front view)", () => {
    const pose = (elbowGap: number) =>
      frame({
        [LM.LEFT_SHOULDER]: { x: 740, y: 300 },
        [LM.RIGHT_SHOULDER]: { x: 540, y: 300 },
        [LM.LEFT_ELBOW]: { x: 640 + elbowGap / 2, y: 380 },
        [LM.RIGHT_ELBOW]: { x: 640 - elbowGap / 2, y: 380 },
      });
    expect(elbowFlare.check(pose(260))).toBeNull();
    expect(elbowFlare.check(pose(480))).not.toBeNull();
  });
});

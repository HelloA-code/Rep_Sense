import { describe, expect, it } from "vitest";
import { EXERCISE_CONFIGS } from "@/lib/exercises";
import { createSetEngine, type SetEvent } from "./set-engine";
import { H, W, frontSquatPose, plankPose, repAngles } from "./test-poses";

const FRAME_MS = 33;

/** Feeds poses at ~30 fps; returns the engine and every event it emitted. */
function replay(exercise: keyof typeof EXERCISE_CONFIGS, poses: ReturnType<typeof frontSquatPose>[]) {
  const engine = createSetEngine(EXERCISE_CONFIGS[exercise]);
  const events: SetEvent[] = [];
  poses.forEach((p, i) => events.push(...engine.process(p, i * FRAME_MS, W, H).events));
  return { result: engine.finish(poses.length * FRAME_MS), events };
}

describe("set engine: squats from the front", () => {
  it("counts 3 clean reps with full form scores", () => {
    const poses = [0, 1, 2].flatMap(() => repAngles().map((a) => frontSquatPose(a)));
    const { result, events } = replay("squat", poses);
    expect(result.reps).toBe(3);
    expect(result.repScores).toEqual([100, 100, 100]);
    expect(result.goodReps).toBe(3);
    expect(events.filter((e) => e.type === "cue")).toEqual([]);
  });

  it("flags knees caving at the bottom: red joints, a cue and a lower score", () => {
    const poses = repAngles().map((a) => frontSquatPose(a, true));
    const engine = createSetEngine(EXERCISE_CONFIGS.squat);
    const events: SetEvent[] = [];
    let sawRing = false;
    poses.forEach((p, i) => {
      const out = engine.process(p, i * FRAME_MS, W, H);
      events.push(...out.events);
      if (out.issues.some((x) => x.id === "knees-caving")) sawRing = true;
    });
    const result = engine.finish();
    expect(sawRing).toBe(true);
    expect(events).toContainEqual({ type: "cue", text: "Knees out" });
    expect(result.reps).toBe(1);
    expect(result.repScores[0]).toBe(65);
    expect(result.issueCounts).toEqual({ "Knees out": 1 });
  });

  it("calls a half squat a missed rep and says 'Go lower'", () => {
    const poses = [...repAngles(), ...repAngles(115, 20)].map((a) => frontSquatPose(a));
    const { result, events } = replay("squat", poses);
    expect(result.reps).toBe(1);
    expect(result.missed).toBe(1);
    expect(events).toContainEqual({ type: "cue", text: "Go lower" });
  });
});

describe("set engine: plank", () => {
  it("times a straight hold and pauses with a cue when the hips sag", () => {
    const good = Array.from({ length: 60 }, () => plankPose(0)); // ~2 s
    const sag = Array.from({ length: 60 }, () => plankPose(90));
    const { result, events } = replay("plank", [...good, ...sag]);
    expect(result.heldMs).toBeGreaterThan(1500);
    expect(result.heldMs).toBeLessThan(3000);
    expect(result.score).toBeGreaterThan(30);
    expect(result.score).toBeLessThan(80);
    expect(events).toContainEqual({ type: "cue", text: "Lift your hips" });
  });
});

describe("countRepsInRecording", () => {
  it("gives the same count from a saved clip as the live engine", async () => {
    const { countRepsInRecording } = await import("./replay");
    const poses = [0, 1].flatMap(() => repAngles().map((a) => frontSquatPose(a)));
    const rec = {
      version: 1 as const,
      label: "squat" as const,
      subject: "test",
      view: "front" as const,
      createdAt: "2026-11-03T10:00:00.000Z",
      durationMs: poses.length * FRAME_MS,
      frameCount: poses.length,
      fpsAvg: 30,
      source: { facing: "user" as const, width: W, height: H },
      frames: poses.map((lm, i) => ({ t: i * FRAME_MS, lm: lm.map((l) => [l.x, l.y, l.z, l.visibility]), world: null })),
    };
    expect(countRepsInRecording(rec, EXERCISE_CONFIGS.squat).reps).toBe(2);
  });
});

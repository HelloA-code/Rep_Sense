import { describe, expect, it } from "vitest";
import { EXERCISE_CONFIGS } from "@/lib/exercises";
import { kneesCaving } from "@/lib/exercises/squat";
import type { FormRule, PoseFrame } from "@/lib/exercises/types";
import { caloriesBurned } from "./calories";
import { createCueScheduler, createFormTracker, scoreRep } from "./form";
import { summarizeSession, type LoggedSet } from "./summary";
import { H, W, frontSquatPose, plankPose } from "./test-poses";

const frame = (lm: PoseFrame["lm"]): PoseFrame => ({ lm, width: W, height: H, side: "left" });

const alwaysBroken: FormRule = {
  id: "x",
  cue: "Fix it",
  severity: "warn",
  views: ["side"],
  phases: "down",
  check: () => [1],
};

describe("rules", () => {
  it("knees caving: only when the knees come inside the ankles", () => {
    expect(kneesCaving.check(frame(frontSquatPose(90)))).toBeNull();
    expect(kneesCaving.check(frame(frontSquatPose(90, true)))).not.toBeNull();
  });

  it("push-up hips: sag and pike, nothing when straight", () => {
    const [sag, pike] = EXERCISE_CONFIGS.pushup.rules;
    expect(sag.check(frame(plankPose(0)))).toBeNull();
    expect(pike.check(frame(plankPose(0)))).toBeNull();
    expect(sag.check(frame(plankPose(90)))).not.toBeNull();
    expect(pike.check(frame(plankPose(-90)))).not.toBeNull();
  });

  it("push-up hips: ignored when not lying out (standing up)", () => {
    const [sag] = EXERCISE_CONFIGS.pushup.rules;
    expect(sag.check(frame(frontSquatPose(178)))).toBeNull();
  });

  it("squat torso lean only from the side", () => {
    const lean = EXERCISE_CONFIGS.squat.rules.find((r) => r.id === "torso-lean")!;
    expect(lean.views).toEqual(["side"]);
  });
});

describe("createFormTracker", () => {
  it("waits for an issue to hold before reporting it, then reports its start once", () => {
    const t = createFormTracker([alwaysBroken], 300);
    const f = frame(plankPose());
    expect(t.update(f, "side", "down", 0).active).toEqual([]);
    expect(t.update(f, "side", "down", 200).active).toEqual([]);
    const at300 = t.update(f, "side", "down", 300);
    expect(at300.active).toHaveLength(1);
    expect(at300.started).toHaveLength(1);
    expect(t.update(f, "side", "down", 400).started).toEqual([]);
  });

  it("skips rules for the wrong view or phase", () => {
    const t = createFormTracker([alwaysBroken], 0);
    const f = frame(plankPose());
    expect(t.update(f, "front", "down", 0).active).toEqual([]);
    expect(t.update(f, "side", "up", 10).active).toEqual([]);
    expect(t.update(f, null, "down", 20).active).toEqual([]);
  });

  it("collects distinct issues per rep", () => {
    const t = createFormTracker([alwaysBroken], 0);
    const f = frame(plankPose());
    t.update(f, "side", "down", 0);
    t.update(f, "side", "down", 50);
    expect(t.takeRepIssues().map((i) => i.id)).toEqual(["x"]);
    expect(t.takeRepIssues()).toEqual([]);
  });
});

describe("scoreRep", () => {
  it("takes 35 per bad and 15 per warn issue, never below 0", () => {
    expect(scoreRep([])).toBe(100);
    expect(scoreRep([{ severity: "warn" }])).toBe(85);
    expect(scoreRep([{ severity: "bad" }, { severity: "warn" }])).toBe(50);
    expect(scoreRep([{ severity: "bad" }, { severity: "bad" }, { severity: "bad" }])).toBe(0);
  });
});

describe("createCueScheduler", () => {
  it("rate-limits cues globally and per cue", () => {
    const s = createCueScheduler(2500, 6000);
    expect(s.offer("a", 0)).toBe(true);
    expect(s.offer("b", 1000)).toBe(false); // too soon after any cue
    expect(s.offer("b", 2600)).toBe(true);
    expect(s.offer("a", 5200)).toBe(false); // same cue within 6 s
    expect(s.offer("a", 6100)).toBe(true);
  });
});

describe("calories + summary", () => {
  it("uses MET × kg × hours", () => {
    expect(caloriesBurned("pushup", 70, 3_600_000)).toBeCloseTo(560);
    expect(caloriesBurned("squat", 70, 60_000)).toBeCloseTo(4.43, 1);
  });

  const set = (over: Partial<LoggedSet>): LoggedSet => ({
    exerciseId: "squat",
    mode: "reps",
    reps: 3,
    repScores: [100, 65, 85],
    goodReps: 2,
    missed: 1,
    issueCounts: { "Knees out": 1 },
    durationMs: 60_000,
    heldMs: 0,
    score: 83,
    loggedValue: 3,
    loadKg: 0,
    ...over,
  });

  it("totals reps, good vs bad, missed, score and calories", () => {
    const plank = set({
      exerciseId: "plank",
      mode: "hold",
      reps: 0,
      repScores: [],
      goodReps: 0,
      missed: 0,
      issueCounts: { "Lift your hips": 2 },
      score: 90,
      loggedValue: 30,
    });
    const s = summarizeSession([set({}), set({ loggedValue: 4, issueCounts: { "Chest up": 3 } }), plank], 70, 600_000);
    expect(s.totalReps).toBe(7); // the user's corrected numbers
    expect(s.totalHoldMs).toBe(30_000);
    expect(s.goodReps).toBe(4);
    expect(s.badReps).toBe(2);
    expect(s.missed).toBe(2);
    expect(s.avgScore).toBe(Math.round((100 + 65 + 85 + 100 + 65 + 85 + 90) / 7));
    expect(s.calories).toBe(Math.round(caloriesBurned("squat", 70, 180_000)));
    expect(s.exercises.map((e) => e.exerciseId)).toEqual(["squat", "plank"]);
    expect(s.exercises[0].topIssues).toEqual(["Chest up", "Knees out"]);
  });
});

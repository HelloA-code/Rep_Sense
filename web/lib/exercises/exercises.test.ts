import { describe, expect, it } from "vitest";
import { LANDMARK_COUNT, LM, type Landmark } from "@/lib/pose/landmarks";
import { EXERCISE_CONFIGS, type PoseFrame } from "./index";
import { chinOverBar, GATES } from "./signals";
import { createRepCounter } from "./state-machine";

const inPlankPosition = GATES.horizontal;

const W = 1280;
const H = 720;

/** A pose with the given joints at pixel positions (visible) and everything else hidden. */
function pose(points: Record<number, [number, number]>): PoseFrame {
  const lm: Landmark[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.1 }));
  for (const [i, [x, y]] of Object.entries(points)) lm[Number(i)] = { x: x / W, y: y / H, z: 0, visibility: 0.99 };
  return { lm, width: W, height: H, side: "left" };
}

/** Left leg seen from the side with the given knee angle (thigh rotates, shin vertical). */
function legPose(kneeAngle: number): PoseFrame {
  const rad = (kneeAngle * Math.PI) / 180;
  const knee: [number, number] = [640, 500];
  const hip: [number, number] = [knee[0] + 150 * Math.sin(rad), knee[1] + 150 * Math.cos(rad)];
  return pose({ [LM.LEFT_HIP]: hip, [LM.LEFT_KNEE]: knee, [LM.LEFT_ANKLE]: [640, 650] });
}

describe("exercise configs", () => {
  it("still has the original 6 exercises", () => {
    expect(Object.keys(EXERCISE_CONFIGS)).toEqual(expect.arrayContaining(["dip", "lunge", "plank", "pullup", "pushup", "squat"]));
  });

  it("squat measures the knee angle in pixels", () => {
    expect(EXERCISE_CONFIGS.squat.measure(legPose(90))).toBeCloseTo(90, 0);
    expect(EXERCISE_CONFIGS.squat.measure(legPose(175))).toBeCloseTo(175, 0);
  });

  it("returns null when the joints aren't visible", () => {
    expect(EXERCISE_CONFIGS.squat.measure(pose({}))).toBeNull();
    expect(EXERCISE_CONFIGS.pushup.measure(legPose(90))).toBeNull(); // no arm landmarks
  });

  it("replays 3 synthetic squats into 3 reps", () => {
    const sq = EXERCISE_CONFIGS.squat;
    if (sq.mode !== "reps") throw new Error("squat should count reps");
    const counter = createRepCounter(sq.counter);
    let t = 0;
    for (let rep = 0; rep < 3; rep++) {
      for (let a = 175; a >= 80; a -= 5) counter.update(sq.measure(legPose(a))!, (t += 33));
      for (let a = 80; a <= 175; a += 5) counter.update(sq.measure(legPose(a))!, (t += 33));
    }
    expect(counter.state.reps).toBe(3);
  });

  it("lunge uses the more bent knee", () => {
    const left = legPose(170);
    const right = legPose(95);
    const lm = [...left.lm];
    lm[LM.RIGHT_HIP] = right.lm[LM.LEFT_HIP];
    lm[LM.RIGHT_KNEE] = right.lm[LM.LEFT_KNEE];
    lm[LM.RIGHT_ANKLE] = right.lm[LM.LEFT_ANKLE];
    const f = { ...left, lm };
    expect(EXERCISE_CONFIGS.lunge.measure(f)).toBeCloseTo(95, 0);
  });
});

describe("pull-up goal", () => {
  it("is met when the nose is at or above the wrists", () => {
    const wrists = { [LM.LEFT_WRIST]: [600, 200] as [number, number], [LM.RIGHT_WRIST]: [700, 200] as [number, number] };
    expect(chinOverBar(pose({ ...wrists, [LM.NOSE]: [650, 180] }))).toBe(true);
    expect(chinOverBar(pose({ ...wrists, [LM.NOSE]: [650, 320] }))).toBe(false);
    expect(chinOverBar(pose({ [LM.NOSE]: [650, 180] }))).toBe(false); // no wrists seen
  });
});

describe("plank", () => {
  const body = (hipDrop: number) =>
    pose({ [LM.LEFT_SHOULDER]: [300, 400], [LM.LEFT_HIP]: [600, 400 + hipDrop], [LM.LEFT_ANKLE]: [900, 400] });

  it("only counts as in position when roughly horizontal", () => {
    expect(inPlankPosition(body(0))).toBe(true);
    const standing = pose({ [LM.LEFT_SHOULDER]: [640, 150], [LM.LEFT_HIP]: [640, 400], [LM.LEFT_ANKLE]: [640, 650] });
    expect(inPlankPosition(standing)).toBe(false);
    expect(EXERCISE_CONFIGS.plank.measure(standing)).toBeNull();
  });

  it("measures how far the hips sag", () => {
    expect(EXERCISE_CONFIGS.plank.measure(body(0))).toBeCloseTo(0);
    expect(EXERCISE_CONFIGS.plank.measure(body(80))!).toBeGreaterThan(15);
  });
});

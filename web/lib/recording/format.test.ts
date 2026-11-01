import { describe, expect, it } from "vitest";
import { LANDMARK_COUNT } from "@/lib/pose/landmarks";
import { MAX_RECORDING_MS, createRecorder, recordingFileName } from "./format";

const pose = Array.from({ length: LANDMARK_COUNT }, (_, i) => ({
  x: 0.123456789,
  y: i / 100,
  z: -0.5,
  visibility: 0.987654,
}));
const world = pose.map(() => ({ x: 0.1, y: -0.33333, z: 0.05 }));

function recorder() {
  return createRecorder({
    label: "squat",
    subject: "  Aditya S ",
    view: "side",
    source: { facing: "user", width: 1280, height: 720 },
    startedAt: 1000,
    createdAt: new Date("2026-11-01T14:25:30.000Z"),
  });
}

describe("createRecorder", () => {
  it("stores rounded landmarks with times relative to the start", () => {
    const rec = recorder();
    rec.push(1000, pose, world);
    rec.push(1033.4, pose, null);
    const out = rec.finish();
    expect(out.frames[1].t).toBe(33);
    expect(out.frames[0].lm).toHaveLength(LANDMARK_COUNT);
    expect(out.frames[0].lm[0]).toEqual([0.1235, 0, -0.5, 0.9877]);
    expect(out.frames[0].world?.[0]).toEqual([0.1, -0.3333, 0.05]);
    expect(out.frames[1].world).toBeNull();
  });

  it("computes duration, frame count and average fps", () => {
    const rec = recorder();
    for (let i = 0; i <= 30; i++) rec.push(1000 + i * (1000 / 30), pose, world);
    const out = rec.finish();
    expect(out).toMatchObject({ version: 1, label: "squat", subject: "Aditya S", frameCount: 31, durationMs: 1000 });
    expect(out.fpsAvg).toBe(30);
  });

  it("refuses frames after the cap", () => {
    const rec = recorder();
    expect(rec.push(1000 + MAX_RECORDING_MS, pose, world)).toBe(true);
    expect(rec.push(1000 + MAX_RECORDING_MS + 1, pose, world)).toBe(false);
    expect(rec.frameCount).toBe(1);
  });
});

describe("recordingFileName", () => {
  it("is safe and sortable", () => {
    const rec = recorder();
    rec.push(1000, pose, world);
    expect(recordingFileName(rec.finish())).toBe("repsense_squat_side_aditya-s_20261101-142530.json");
  });
});

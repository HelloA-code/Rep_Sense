import { describe, expect, it } from "vitest";
import type { RecordedFrame } from "./format";
import { bundleFileName, createBundle, frameIndexAt, frameLandmarks } from "./replay";

const frame = (t: number): RecordedFrame => ({ t, lm: [[0.1, 0.2, -0.3, 0.9]], world: null });
const frames = [0, 33, 66, 100, 600, 633].map(frame); // gap between 100 and 600

describe("frameIndexAt", () => {
  it("returns -1 before the first frame and for empty clips", () => {
    expect(frameIndexAt(frames, -5)).toBe(-1);
    expect(frameIndexAt([], 10)).toBe(-1);
  });

  it("picks the last frame at or before t", () => {
    expect(frameIndexAt(frames, 0)).toBe(0);
    expect(frameIndexAt(frames, 50)).toBe(1);
    expect(frameIndexAt(frames, 66)).toBe(2);
    expect(frameIndexAt(frames, 10_000)).toBe(5);
  });

  it("shows nothing inside a gap where the person was lost", () => {
    expect(frameIndexAt(frames, 150)).toBe(3); // just after the last frame: keep it
    expect(frameIndexAt(frames, 400)).toBe(-1);
    expect(frameIndexAt(frames, 600)).toBe(4);
  });
});

describe("frameLandmarks", () => {
  it("restores landmark objects", () => {
    expect(frameLandmarks(frame(0))).toEqual([{ x: 0.1, y: 0.2, z: -0.3, visibility: 0.9 }]);
  });
});

describe("bundle", () => {
  it("wraps clips with a version and a stamped file name", () => {
    const now = new Date("2026-11-01T14:25:30.000Z");
    expect(createBundle([], now)).toEqual({ version: 1, exportedAt: "2026-11-01T14:25:30.000Z", clips: [] });
    expect(bundleFileName(now)).toBe("repsense_clips_20261101-142530.json");
  });
});

import { describe, expect, it } from "vitest";
import { recordingFileName, recordingFromVideo } from "@/lib/recording/format";
import { LANDMARK_COUNT } from "./landmarks";
import { MAX_VIDEO_MS, sampleTimes } from "./video-landmarks";

describe("sampleTimes", () => {
  it("reads 15 frames a second from the start", () => {
    const t = sampleTimes(1000);
    expect(t[0]).toBe(0);
    expect(t).toHaveLength(16); // 0 … 1000 ms
    expect(t[1]).toBe(67);
  });

  it("stops at the 60 s cap", () => {
    const t = sampleTimes(5 * 60_000);
    expect(t[t.length - 1]).toBeLessThanOrEqual(MAX_VIDEO_MS);
    expect(t.length).toBe(Math.floor((MAX_VIDEO_MS * 15) / 1000) + 1);
  });

  it("handles empty and broken durations", () => {
    expect(sampleTimes(0)).toEqual([0]);
    expect(sampleTimes(-5)).toEqual([0]);
  });
});

describe("a clip made from a video", () => {
  const pose = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
  const frames = [0, 67, 133, 200].map((t) => ({ t, landmarks: pose, world: null }));

  it("keeps the video's own times and is marked as imported", () => {
    const rec = recordingFromVideo(frames, {
      label: "squat",
      subject: "creator",
      view: "side",
      width: 1080,
      height: 1920,
      createdAt: new Date("2026-11-17T10:00:00Z"),
    });
    expect(rec.origin).toBe("import");
    expect(rec.frames.map((f) => f.t)).toEqual([0, 67, 133, 200]);
    expect(rec.durationMs).toBe(200);
    expect(rec.frameCount).toBe(4);
    expect(rec.source).toEqual({ facing: "environment", width: 1080, height: 1920 });
    expect(recordingFileName(rec)).toBe("repsense_squat_side_creator_20261117-100000.json");
  });
});

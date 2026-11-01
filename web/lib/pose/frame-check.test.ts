import { describe, expect, it } from "vitest";
import { checkBodyInFrame, isSeen } from "./frame-check";
import { LANDMARK_COUNT, LM, type Landmark } from "./landmarks";

const visible = (): Landmark[] =>
  Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 }));

function hide(lms: Landmark[], ...indices: number[]) {
  for (const i of indices) lms[i] = { ...lms[i], visibility: 0.1 };
  return lms;
}

describe("isSeen", () => {
  it("rejects low visibility and points outside the image", () => {
    expect(isSeen({ x: 0.5, y: 0.5, z: 0, visibility: 0.2 })).toBe(false);
    expect(isSeen({ x: 0.5, y: 1.3, z: 0, visibility: 0.99 })).toBe(false);
    expect(isSeen({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 })).toBe(true);
  });
});

describe("checkBodyInFrame", () => {
  it("passes a fully visible body", () => {
    expect(checkBodyInFrame(visible())).toEqual({ ok: true });
  });

  it("asks you to step in when no pose is found", () => {
    expect(checkBodyInFrame(null)).toMatchObject({ ok: false, reason: "no-body" });
  });

  it("asks you to step back when both ankles are missing", () => {
    const lms = hide(visible(), LM.LEFT_ANKLE, LM.RIGHT_ANKLE);
    expect(checkBodyInFrame(lms)).toMatchObject({ ok: false, reason: "feet" });
  });

  it("accepts a side view where only one ankle is visible", () => {
    expect(checkBodyInFrame(hide(visible(), LM.RIGHT_ANKLE)).ok).toBe(true);
  });

  it("flags a missing head", () => {
    const lms = hide(visible(), LM.NOSE, LM.LEFT_EAR, LM.RIGHT_EAR);
    expect(checkBodyInFrame(lms)).toMatchObject({ ok: false, reason: "head" });
  });

  it("treats feet below the bottom edge as missing", () => {
    const lms = visible();
    lms[LM.LEFT_ANKLE] = { ...lms[LM.LEFT_ANKLE], y: 1.2 };
    lms[LM.RIGHT_ANKLE] = { ...lms[LM.RIGHT_ANKLE], y: 1.15 };
    expect(checkBodyInFrame(lms)).toMatchObject({ reason: "feet" });
  });
});

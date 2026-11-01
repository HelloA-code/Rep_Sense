import { describe, expect, it } from "vitest";
import { LANDMARK_COUNT, type Landmark } from "./landmarks";
import { SIDE_JOINTS, pickSide, sideVisibility } from "./side";

function pose(left: number, right: number): Landmark[] {
  const lm = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.5 }));
  for (const i of SIDE_JOINTS.left) lm[i].visibility = left;
  for (const i of SIDE_JOINTS.right) lm[i].visibility = right;
  return lm;
}

describe("pickSide", () => {
  it("averages visibility over one side's joints", () => {
    expect(sideVisibility(pose(0.9, 0.2), "left")).toBeCloseTo(0.9);
    expect(sideVisibility(pose(0.9, 0.2), "right")).toBeCloseTo(0.2);
  });

  it("picks the more visible side the first time", () => {
    expect(pickSide(pose(0.9, 0.4), null)).toBe("left");
    expect(pickSide(pose(0.4, 0.9), null)).toBe("right");
  });

  it("is sticky: small differences don't flip it", () => {
    expect(pickSide(pose(0.8, 0.9), "left")).toBe("left");
    expect(pickSide(pose(0.9, 0.8), "right")).toBe("right");
  });

  it("switches when the other side is clearly better", () => {
    expect(pickSide(pose(0.5, 0.9), "left")).toBe("right");
    expect(pickSide(pose(0.9, 0.5), "right")).toBe("left");
  });
});

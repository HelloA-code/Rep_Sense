import { describe, expect, it } from "vitest";
import { hipOffset, torsoLean } from "./geometry";
import { LANDMARK_COUNT, LM, type Landmark } from "./landmarks";
import { estimateView, viewRatio } from "./view";

function torso(shoulderGap: number): Landmark[] {
  const lm = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  // 1000×1000 frame: torso 300 px tall, shoulders `shoulderGap` px apart
  lm[LM.LEFT_SHOULDER] = { x: 0.5 + shoulderGap / 2000, y: 0.3, z: 0, visibility: 1 };
  lm[LM.RIGHT_SHOULDER] = { x: 0.5 - shoulderGap / 2000, y: 0.3, z: 0, visibility: 1 };
  lm[LM.LEFT_HIP] = { x: 0.51, y: 0.6, z: 0, visibility: 1 };
  lm[LM.RIGHT_HIP] = { x: 0.49, y: 0.6, z: 0, visibility: 1 };
  return lm;
}

describe("estimateView", () => {
  it("measures shoulder width against torso length", () => {
    expect(viewRatio(torso(240), 1000, 1000)).toBeCloseTo(0.8);
  });

  it("is front when the shoulders are wide, side when they overlap", () => {
    expect(estimateView(torso(240), 1000, 1000, null)).toBe("front");
    expect(estimateView(torso(30), 1000, 1000, null)).toBe("side");
  });

  it("keeps the previous answer in the grey zone", () => {
    expect(estimateView(torso(110), 1000, 1000, "side")).toBe("side");
    expect(estimateView(torso(110), 1000, 1000, "front")).toBe("front");
    expect(estimateView(torso(110), 1000, 1000, null)).toBeNull();
  });
});

describe("hipOffset", () => {
  it("is + when hips sag, − when they pike, either facing direction", () => {
    expect(hipOffset({ x: 0, y: 0 }, { x: 1, y: 0.2 }, { x: 2, y: 0 })).toBeGreaterThan(15);
    expect(hipOffset({ x: 0, y: 0 }, { x: 1, y: -0.2 }, { x: 2, y: 0 })).toBeLessThan(-15);
    expect(hipOffset({ x: 2, y: 0 }, { x: 1, y: 0.2 }, { x: 0, y: 0 })).toBeGreaterThan(15);
    expect(hipOffset({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(0);
  });
});

describe("torsoLean", () => {
  it("is 0 upright and 45 when leaning halfway over", () => {
    expect(torsoLean({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(0);
    expect(torsoLean({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(45);
  });
});

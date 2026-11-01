import { describe, expect, it } from "vitest";
import { angle, bodyLineDeviation, distance, toPixels } from "./geometry";

// angle() is yours to write. These go green when it's right.
describe("angle (yours)", () => {
  it("is 90° for a right angle", () => {
    expect(angle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90);
  });

  it("is 180° for a straight line and 0° when folded back", () => {
    expect(angle({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180);
    expect(angle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(0);
  });

  it("handles 45° and 135°", () => {
    expect(angle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(45);
    expect(angle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: -1, y: 1 })).toBeCloseTo(135);
  });

  it("doesn't care which side a and c are on, or where the vertex is", () => {
    const a = { x: 3, y: 7 };
    const b = { x: 5, y: 5 };
    const c = { x: 9, y: 6 };
    expect(angle(a, b, c)).toBeCloseTo(angle(c, b, a));
  });

  it("uses z when given (3D)", () => {
    expect(angle({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })).toBeCloseTo(90);
  });

  it("returns a number, never NaN, for nearly-collinear float input", () => {
    // Rounding can push the cosine to 1.0000000000000002, and Math.acos of that is NaN.
    const r = angle({ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }, { x: 0.30000000000000004, y: 0.30000000000000004 });
    expect(Number.isNaN(r)).toBe(false);
    expect(r).toBeCloseTo(180);
  });

  it("returns 0 (not NaN) when a segment has zero length", () => {
    expect(angle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
  });
});

describe("distance / toPixels", () => {
  it("measures 2D and 3D distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 2 })).toBe(3);
  });

  it("scales normalised coords to pixels", () => {
    expect(toPixels({ x: 0.5, y: 0.25, z: -1, visibility: 1 }, 1280, 720)).toEqual({ x: 640, y: 180 });
  });
});

describe("bodyLineDeviation (needs your angle)", () => {
  it("is 0 for a straight body and grows as the hips sag", () => {
    expect(bodyLineDeviation({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(0);
    expect(bodyLineDeviation({ x: 0, y: 0 }, { x: 1, y: 0.2 }, { x: 2, y: 0 })).toBeGreaterThan(20);
  });
});

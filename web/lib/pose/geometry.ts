import type { Landmark } from "./landmarks";

/** A 2D or 3D point. Leave `z` out (or 0) for 2D. */
export type Point = { x: number; y: number; z?: number };

/**
 * The angle at vertex `b` formed by the segments b→a and b→c, in degrees, 0–180.
 * e.g. angle(hip, knee, ankle) is the knee angle: ~180 standing, ~90 at parallel.
 *
 * YOU WRITE THIS ONE (Day 3). Tests: geometry.test.ts.
 */
export function angle(a: Point, b: Point, c: Point): number {
  void a;
  void b;
  void c;
  throw new Error("TODO: write angle() — see the hints in the Day 3 notes");
}

/** Straight-line distance between two points (2D or 3D). */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

/**
 * Normalised landmarks use different units for x (fraction of width) and y (fraction
 * of height), so on a 16:9 frame a "45°" in normalised space isn't 45° on screen.
 * Convert to pixels before measuring angles. z is dropped: it's too noisy for angles.
 */
export function toPixels(lm: Landmark, width: number, height: number): Point {
  return { x: lm.x * width, y: lm.y * height };
}

/**
 * How far the body bends away from a straight shoulder–hip–ankle line, in degrees.
 * 0 = perfectly straight (good plank / push-up), 20+ = hips sagging or piking.
 */
export function bodyLineDeviation(shoulder: Point, hip: Point, ankle: Point): number {
  return 180 - angle(shoulder, hip, ankle);
}

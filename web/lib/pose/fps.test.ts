import { describe, expect, it } from "vitest";
import { createFpsMeter } from "./fps";

describe("createFpsMeter", () => {
  it("reports 0 before enough samples", () => {
    const meter = createFpsMeter();
    expect(meter.stats().fps).toBe(0);
    meter.tick(0, 10);
    expect(meter.stats()).toEqual({ fps: 0, latencyMs: 10 });
  });

  it("measures a steady 30 fps and average latency", () => {
    const meter = createFpsMeter();
    for (let i = 0; i <= 30; i++) meter.tick(i * (1000 / 30), i % 2 === 0 ? 10 : 20);
    expect(meter.stats().fps).toBeCloseTo(30, 5);
    expect(meter.stats().latencyMs).toBeCloseTo(15, 0);
  });

  it("drops samples older than the window", () => {
    const meter = createFpsMeter(1000);
    for (let i = 0; i < 10; i++) meter.tick(i * 100, 50); // 10 fps, slow
    for (let i = 0; i <= 40; i++) meter.tick(2000 + i * 25, 5); // then 40 fps, fast
    expect(meter.stats().fps).toBeCloseTo(40, 5);
    expect(meter.stats().latencyMs).toBe(5);
  });
});

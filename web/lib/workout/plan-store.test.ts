import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GROUP_EMOJI, TRACKING_EMOJI, exerciseEmoji } from "@/lib/exercises/emoji";
import { ALL_EXERCISES, GROUP_ORDER } from "@/lib/exercises/library";
import { loadPlan, loadSetsPreference, savePlan, saveSetsPreference, takePlan } from "./plan-store";

// A tiny in-memory localStorage, since the tests run outside a browser.
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  };
}

const g = globalThis as { window?: unknown };
let previous: unknown;

beforeEach(() => {
  previous = g.window;
  g.window = { localStorage: memoryStorage() };
});
afterEach(() => {
  g.window = previous;
});

describe("what the workout picker starts with", () => {
  it("starts empty when nothing was handed over", () => {
    expect(takePlan()).toBeNull();
  });

  it("a hand-off (Today's suggestion, a taught exercise) is used once", () => {
    savePlan({ exercises: ["squat", "pushup"], sets: 4 });
    expect(loadPlan()?.exercises).toEqual(["squat", "pushup"]); // peeking keeps it
    expect(takePlan()).toEqual({ exercises: ["squat", "pushup"], sets: 4 });
    expect(takePlan()).toBeNull(); // next visit: empty again
  });

  it("drops unknown exercises and bad set counts", () => {
    savePlan({ exercises: ["squat", "nope" as never], sets: 3 });
    expect(takePlan()?.exercises).toEqual(["squat"]);
    savePlan({ exercises: ["squat"], sets: 9 });
    expect(takePlan()).toBeNull();
  });

  it("remembers how many sets you like, separately", () => {
    expect(loadSetsPreference()).toBeNull();
    saveSetsPreference(4);
    expect(loadSetsPreference()).toBe(4);
    saveSetsPreference(0); // ignored
    expect(loadSetsPreference()).toBe(4);
  });
});

describe("emoji", () => {
  it("every group, tracking level and exercise has one", () => {
    for (const group of GROUP_ORDER) expect(GROUP_EMOJI[group]).toBeTruthy();
    for (const key of ["camera", "teach", "taught", "log"] as const) expect(TRACKING_EMOJI[key]).toBeTruthy();
    for (const e of ALL_EXERCISES) expect(exerciseEmoji(e.id, e.group), e.id).toBeTruthy();
  });

  it("some exercises get their own", () => {
    expect(exerciseEmoji("stationary-bike", "cardio")).toBe("🚴");
    expect(exerciseEmoji("squat", "squat")).toBe(GROUP_EMOJI.squat);
  });
});

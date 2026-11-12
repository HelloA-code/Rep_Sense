import { describe, expect, it } from "vitest";
import {
  EXERCISES,
  PRESETS,
  availableExercises,
  matchPreset,
  normalizeEquipment,
  toggleEquipment,
} from "./equipment";

const ids = (list: { id: string }[]) => list.map((x) => x.id);

describe("availableExercises", () => {
  it("offers only bodyweight exercises with no equipment", () => {
    const list = availableExercises([]);
    expect(list.every((e) => e.requiresAny.length === 0)).toBe(true);
    expect(ids(list)).toEqual(expect.arrayContaining(["squat", "lunge", "pushup", "plank", "wall-sit"]));
    expect(ids(list)).not.toContain("goblet-squat");
  });

  it("unlocks pull-ups with a bar but not dips", () => {
    const list = ids(availableExercises(["pullup-bar"]));
    expect(list).toContain("pullup");
    expect(list).not.toContain("dip");
  });

  it("unlocks both pull-ups and dips with rings", () => {
    expect(ids(availableExercises(["rings"]))).toEqual(expect.arrayContaining(["pullup", "dip"]));
  });

  it("offers everything at the gym", () => {
    const gym = PRESETS.find((p) => p.id === "gym")!;
    expect(availableExercises(gym.equipment)).toHaveLength(EXERCISES.length);
  });
});

describe("presets", () => {
  it("matches a preset regardless of order", () => {
    expect(matchPreset(["box", "bench", "dip-station", "pullup-bar"])).toBe("park");
  });

  it("returns null once the selection is customised", () => {
    expect(matchPreset(toggleEquipment(["box", "bench", "dip-station", "pullup-bar"], "rings"))).toBeNull();
  });
});

describe("toggleEquipment", () => {
  it("adds in grid order and removes", () => {
    const added = toggleEquipment(["mat"], "pullup-bar");
    expect(added).toEqual(["pullup-bar", "mat"]);
    expect(toggleEquipment(added, "mat")).toEqual(["pullup-bar"]);
  });

  it("normalize drops duplicates", () => {
    expect(normalizeEquipment(["mat", "mat", "rings"])).toEqual(["rings", "mat"]);
  });
});

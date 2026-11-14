import { describe, expect, it } from "vitest";
import { taughtFor } from "@/lib/data/custom-store";
import { setToRow } from "@/lib/data/rows";
import { EQUIPMENT } from "@/lib/equipment";
import { caloriesBurned } from "@/lib/workout/calories";
import { blankResult, handLoggedSet } from "@/lib/workout/manual";
import { CATALOG } from "./catalog";
import { customFromTeach, isCustomExercise, type CustomExercise } from "./custom";
import { ALL_EXERCISES, GROUP_ORDER, exerciseInfo, filterExercises, groupName, isLibraryOnly, loadDetails } from "./library";
import { LIBRARY } from "./library-data";
import type { LibraryEntry } from "./library-types";
import { exerciseConfig, exerciseName, isKnownExercise } from "./registry";
import type { TeachSuccess } from "./teach";

const entries: readonly LibraryEntry[] = LIBRARY;
const catalogIds = new Set<string>(CATALOG.map((c) => c.id));

describe("library data", () => {
  it("about 150 exercises, unique ids and names, ids fit the database check", () => {
    expect(ALL_EXERCISES.length).toBeGreaterThanOrEqual(150);
    const ids = ALL_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = ALL_EXERCISES.map((e) => e.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{1,40}$/);
  });

  it("camera entries are exactly the catalog; the rest are not in it", () => {
    const camera = entries.filter((e) => e.tracking === "camera").map((e) => e.id);
    expect(new Set(camera)).toEqual(catalogIds);
    for (const e of entries.filter((x) => x.tracking !== "camera")) expect(catalogIds.has(e.id), e.id).toBe(false);
  });

  it("every exercise has a known group, mode and equipment", () => {
    const gear = new Set<string>(EQUIPMENT.map((e) => e.id));
    for (const e of ALL_EXERCISES) {
      expect(GROUP_ORDER, e.id).toContain(e.group);
      expect(["reps", "seconds", "minutes"], e.id).toContain(e.mode);
      for (const g of e.requiresAny) expect(gear.has(g), `${e.id}: ${g}`).toBe(true);
      expect(groupName(e.group).length).toBeGreaterThan(2);
    }
  });

  it("most exercises have instructions from the dataset", () => {
    const sourced = ALL_EXERCISES.filter((e) => e.sourced).length;
    expect(sourced / ALL_EXERCISES.length).toBeGreaterThan(0.7);
  });

  it("loads instructions on demand; unsourced ones have none", async () => {
    const pushup = await loadDetails("pushup");
    expect(pushup?.source).toBe("Pushups");
    expect(pushup?.instructions.length).toBeGreaterThan(0);
    expect(pushup?.instructions.join(" ")).not.toMatch(/Â|â€/);
    const burpee = await loadDetails("burpee");
    expect(burpee?.source).toBeNull();
    expect(burpee?.instructions).toEqual([]);
  });
});

describe("search and filters", () => {
  it("finds curls of every tracking level by name", () => {
    const curls = filterExercises(ALL_EXERCISES, { query: "curl" });
    expect(new Set(curls.map((e) => e.tracking))).toEqual(new Set(["camera", "teach", "log"]));
  });

  it("finds by muscle and by group", () => {
    expect(filterExercises(ALL_EXERCISES, { query: "chest" }).map((e) => e.id)).toContain("barbell-bench-press");
    const cardio = filterExercises(ALL_EXERCISES, { group: "cardio" });
    expect(cardio.length).toBeGreaterThan(5);
    expect(cardio.every((e) => e.group === "cardio")).toBe(true);
  });

  it("camera only: camera exercises plus the ones you've taught", () => {
    const plain = filterExercises(ALL_EXERCISES, { cameraOnly: true });
    expect(plain.every((e) => e.tracking === "camera")).toBe(true);
    const withTaught = filterExercises(ALL_EXERCISES, { cameraOnly: true, taught: new Set(["leg-extension"]) });
    expect(withTaught.map((e) => e.id)).toContain("leg-extension");
  });

  it("limits to your equipment", () => {
    const home = filterExercises(ALL_EXERCISES, { owned: ["mat"] });
    expect(home.map((e) => e.id)).not.toContain("leg-press");
    expect(home.map((e) => e.id)).toContain("burpee");
  });
});

describe("taught library exercises", () => {
  const taught: TeachSuccess = {
    ok: true,
    signal: "knee",
    mirror: null,
    counter: { downBelow: 110, upAbove: 150, minRepMs: 400 },
    view: "side",
    reps: 3,
    confidence: "high",
    trace: [],
    bottomPose: null,
    joints: [],
  };

  it("keeps the library link and validates it", () => {
    const c = customFromTeach("Leg extension", taught, new Date(), "leg-extension");
    expect(c.libraryId).toBe("leg-extension");
    expect(isCustomExercise(c)).toBe(true);
    expect(isCustomExercise({ ...c, libraryId: "Not An Id!" })).toBe(false);
  });

  it("a taught library exercise counts under its own id and name", () => {
    const c: CustomExercise = customFromTeach("My leg ext", taught, new Date(), "leg-extension");
    expect(exerciseConfig("leg-extension", [])).toBeNull(); // not taught: logged by hand
    const cfg = exerciseConfig("leg-extension", [c]);
    expect(cfg?.id).toBe("leg-extension");
    expect(cfg?.name).toBe("Leg extension");
    expect(taughtFor("leg-extension", [c])?.id).toBe(c.id);
  });

  it("knows library names and kinds", () => {
    expect(exerciseName("leg-press", [])).toBe("Leg press");
    expect(isLibraryOnly("leg-press")).toBe(true);
    expect(isLibraryOnly("squat")).toBe(false);
    expect(exerciseInfo("treadmill-run")?.mode).toBe("minutes");
  });

  it("log-only exercises are known (so a saved workout keeps them) but have no camera config", () => {
    expect(isKnownExercise("leg-press", [])).toBe(true);
    expect(exerciseConfig("leg-press", [])).toBeNull();
    expect(isKnownExercise("custom-zzzzzzzzzzzz", [])).toBe(false);
    expect(isKnownExercise("not-an-exercise", [])).toBe(false);
  });
});

describe("logging by hand", () => {
  it("reps: all of them by hand, saved as manual reps", () => {
    const set = handLoggedSet(blankResult("leg-press", "reps"), "reps", 12, 40);
    expect(set.reps).toBe(12);
    expect(set.manualReps).toBe(12);
    const row = setToRow(set, "s", "w", 1, 70);
    expect(row).toMatchObject({ reps: 12, manual_reps: 12, load_kg: 40, hold_seconds: 0 });
  });

  it("minutes become seconds", () => {
    const set = handLoggedSet(blankResult("treadmill-run", "minutes"), "minutes", 20, 0);
    expect(setToRow(set, "s", "w", 1, 70)).toMatchObject({ hold_seconds: 1200, reps: 0 });
  });

  it("calories use the exercise's group (cardio is vigorous)", () => {
    expect(caloriesBurned("treadmill-run", 70, 3_600_000)).toBeCloseTo(560);
    expect(caloriesBurned("hamstring-stretch", 70, 3_600_000)).toBeCloseTo(161);
  });
});

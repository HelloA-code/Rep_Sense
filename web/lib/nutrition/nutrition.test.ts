import { describe, expect, it } from "vitest";
import { FOODS, foodById, macrosFor, sumMacros } from "./foods";
import { bestMatch, searchFoods } from "./match";
import { bmr, calculateTargets, type TargetInput } from "./targets";
import { defaultPortion, toGrams } from "./units";

const adult: TargetInput = { sex: "male", age: 30, weightKg: 70, heightCm: 175, activity: "moderate", goal: "habit" };

describe("food data", () => {
  it("has the USDA source and sane numbers for every food", () => {
    expect(FOODS.length).toBeGreaterThan(80);
    for (const f of FOODS) {
      expect(f.source.fdcId).toBeGreaterThan(0);
      const { kcal, protein, carbs, fat } = f.per100g;
      expect(kcal).toBeGreaterThanOrEqual(0);
      expect(kcal).toBeLessThanOrEqual(900);
      // Atwater check: 4/4/9 kcal per gram should roughly add up to the energy figure.
      if (kcal > 20) expect(Math.abs(protein * 4 + carbs * 4 + fat * 9 - kcal) / kcal).toBeLessThan(0.25);
    }
  });

  it("ids are unique", () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
  });
});

describe("macros", () => {
  it("scales per-100 g values", () => {
    expect(macrosFor({ kcal: 200, protein: 10, carbs: 20, fat: 5 }, 150)).toEqual({ kcal: 300, protein: 15, carbs: 30, fat: 7.5 });
  });

  it("adds items up", () => {
    expect(
      sumMacros([
        { kcal: 100, protein: 1.25, carbs: 2, fat: 3 },
        { kcal: 50, protein: 1.3, carbs: 0, fat: 0.1 },
      ]),
    ).toEqual({ kcal: 150, protein: 2.6, carbs: 2, fat: 3.1 });
  });
});

describe("targets", () => {
  it("uses Mifflin-St Jeor", () => {
    expect(bmr(adult)).toBeCloseTo(1648.75);
    expect(bmr({ ...adult, sex: "female" })).toBeCloseTo(1482.75);
  });

  it("multiplies by activity and adjusts for the goal", () => {
    const keep = calculateTargets(adult);
    expect(keep.tdee).toBe(2556);
    expect(keep.kcal).toBe(2560);
    expect(calculateTargets({ ...adult, goal: "fat-loss" }).kcal).toBe(2040);
    expect(calculateTargets({ ...adult, goal: "muscle" }).kcal).toBe(2810);
  });

  it("splits macros so they add back up to the calories", () => {
    for (const goal of ["fat-loss", "muscle", "strength", "habit"] as const) {
      const t = calculateTargets({ ...adult, goal });
      expect(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal)).toBeLessThan(20);
      expect(t.protein).toBeGreaterThanOrEqual(98); // ≥ 1.4 g/kg
    }
  });

  it("never goes below the safety floor", () => {
    const small = calculateTargets({ sex: "female", age: 60, weightKg: 42, heightCm: 145, activity: "sedentary", goal: "fat-loss" });
    expect(small.kcal).toBe(1200);
    expect(small.notes.join()).toMatch(/1200/);
    expect(small.carbs).toBeGreaterThanOrEqual(0);
  });

  it("gives teenagers no deficit, and says why", () => {
    const teen = calculateTargets({ ...adult, age: 16, goal: "fat-loss" });
    expect(teen.kcal).toBe(Math.round(teen.tdee / 10) * 10);
    expect(teen.notes.join()).toMatch(/Under 18/);
  });
});

describe("matching", () => {
  it("finds foods by alias, plural and spelling variants", () => {
    expect(bestMatch("chapatis")?.id).toBe("roti");
    expect(bestMatch("Dahi")?.id).toBe("curd");
    expect(bestMatch("boiled eggs")?.id).toBe("egg-boiled");
    expect(bestMatch("toor dal")?.id).toBe("dal");
    expect(bestMatch("chicken biryani")?.id).toBe("biryani-chicken");
  });

  it("returns nothing rather than a wrong guess", () => {
    expect(bestMatch("quantum soup")).toBeNull();
    expect(bestMatch("")).toBeNull();
  });

  it("ranks search results", () => {
    expect(searchFoods("milk")[0].id).toBe("milk-whole");
    expect(searchFoods("rice").map((f) => f.id)).toContain("rice-white");
  });
});

describe("portions", () => {
  const egg = foodById("egg-boiled")!;
  const rice = foodById("rice-white")!;
  const dal = foodById("dal")!;

  it("uses USDA servings for pieces", () => {
    expect(toGrams(egg, 2, "piece")).toMatchObject({ grams: 100, assumed: false });
  });

  it("uses the food's own cup weight", () => {
    expect(toGrams(rice, 1, "cup")).toMatchObject({ grams: 158, assumed: false });
  });

  it("marks bowls and kitchen measures as assumed", () => {
    expect(toGrams(dal, 1, "bowl")).toMatchObject({ grams: 240, assumed: true });
    expect(toGrams(foodById("honey")!, 1, "tsp")?.grams).toBeGreaterThan(0);
  });

  it("handles grams and rejects nonsense", () => {
    expect(toGrams(rice, 150, "g")).toMatchObject({ grams: 150, assumed: false });
    expect(toGrams(rice, 0, "g")).toBeNull();
    expect(toGrams(rice, -1, "cup")).toBeNull();
  });

  it("skips US packaging sizes like '1 container'", () => {
    expect(defaultPortion(foodById("curd")!, 1)?.basis).not.toMatch(/container/i);
  });

  it("guesses a sensible default for a bare count", () => {
    expect(defaultPortion(egg, 3)?.grams).toBe(150);
    expect(defaultPortion(dal, 1)?.grams).toBe(240);
  });
});

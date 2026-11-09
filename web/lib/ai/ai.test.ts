import { describe, expect, it } from "vitest";
import { foodById, macrosFor } from "@/lib/nutrition/foods";
import { buildPlan, isDietPlan } from "./plan";
import { itemsTotal, resolveFood, resolveFoods } from "./resolve";
import { DietPlanReply, ParsedFoods, toJsonSchema } from "./schemas";

const ai = (over: Partial<Parameters<typeof resolveFood>[0]> = {}) => ({
  name: "roti",
  quantity: 2,
  unit: "piece",
  grams: 80,
  kcal_per_100g: 297,
  protein_per_100g: 11,
  carbs_per_100g: 46,
  fat_per_100g: 7,
  ...over,
});

describe("resolveFood: USDA numbers whenever the food list has the food", () => {
  it("matches and uses USDA serving sizes", () => {
    const item = resolveFood(ai())!;
    const roti = foodById("roti")!;
    expect(item).toMatchObject({ foodId: "roti", dataSource: "usda" });
    expect(item.per100g).toEqual(roti.per100g); // not the AI's 297 kcal
    expect(item.grams).toBe(2 * roti.servings.find((s) => /medium/.test(s.label))!.grams);
  });

  it("falls back to the AI's grams when the unit doesn't fit the food", () => {
    const item = resolveFood(ai({ name: "dal", quantity: 1, unit: "slice", grams: 180 }))!;
    expect(item).toMatchObject({ foodId: "dal", grams: 180, basis: "weight estimated by AI" });
  });

  it("uses a labelled AI estimate for foods the list doesn't have", () => {
    const item = resolveFood(ai({ name: "poha", unit: "bowl", quantity: 1, grams: 200, kcal_per_100g: 130, protein_per_100g: 2.5, carbs_per_100g: 24, fat_per_100g: 3 }))!;
    expect(item).toMatchObject({ foodId: null, dataSource: "estimate", name: "Poha", grams: 200 });
  });

  it("rejects estimates whose macros don't add up to their calories", () => {
    expect(resolveFood(ai({ name: "mystery curry", kcal_per_100g: 900, protein_per_100g: 1, carbs_per_100g: 1, fat_per_100g: 1 }))).toBeNull();
    expect(resolveFood(ai({ name: "mystery", protein_per_100g: 60, carbs_per_100g: 60, fat_per_100g: 0 }))).toBeNull();
  });

  it("reports how many foods were dropped", () => {
    const { items, dropped } = resolveFoods([ai(), ai({ name: "bad", kcal_per_100g: 800, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 0 })]);
    expect(items).toHaveLength(1);
    expect(dropped).toBe(1);
  });
});

describe("schemas", () => {
  it("validate replies and reject out-of-range numbers", () => {
    expect(ParsedFoods.safeParse({ foods: [ai()] }).success).toBe(true);
    expect(ParsedFoods.safeParse({ foods: [ai({ grams: -5 })] }).success).toBe(false);
    expect(ParsedFoods.safeParse({ foods: [{ ...ai(), unit: "handful" }] }).success).toBe(false);
  });

  it("produce a JSON schema for Gemini's structured output", () => {
    const schema = toJsonSchema(ParsedFoods) as unknown as { properties: { foods: { items: { required: string[] } } } };
    expect(schema.properties.foods.items.required).toContain("kcal_per_100g");
  });
});

describe("buildPlan", () => {
  const reply = DietPlanReply.parse({
    meals: [
      { type: "breakfast", title: "Oats and fruit", foods: [{ name: "Oatmeal (cooked with milk)", grams: 300, kcal_per_100g: 100, protein_per_100g: 4, carbs_per_100g: 15, fat_per_100g: 3 }] },
      { type: "lunch", title: "Dal chawal", foods: [
        { name: "Dal", grams: 240, kcal_per_100g: 120, protein_per_100g: 7, carbs_per_100g: 16, fat_per_100g: 3 },
        { name: "Rice, white (cooked)", grams: 200, kcal_per_100g: 130, protein_per_100g: 2.7, carbs_per_100g: 28, fat_per_100g: 0.3 },
      ] },
    ],
    tip: "Prep dal the night before.",
  });

  it("recomputes totals from the food list, not the AI's numbers", () => {
    const plan = buildPlan(reply, { kcal: 2000, protein: 120, carbs: 250, fat: 60 }, new Date("2026-11-09T08:00:00Z"));
    expect(plan.meals.map((m) => m.items.map((i) => i.dataSource))).toEqual([["usda"], ["usda", "usda"]]);
    const expected =
      macrosFor(foodById("oats-milk")!.per100g, 300).kcal + macrosFor(foodById("dal")!.per100g, 240).kcal + macrosFor(foodById("rice-white")!.per100g, 200).kcal;
    expect(Math.abs(plan.total.kcal - expected)).toBeLessThanOrEqual(1);
    expect(plan.total).toEqual(itemsTotal(plan.meals.flatMap((m) => m.items)));
    expect(isDietPlan(plan)).toBe(true);
    expect(isDietPlan({ meals: "nope" })).toBe(false);
  });
});

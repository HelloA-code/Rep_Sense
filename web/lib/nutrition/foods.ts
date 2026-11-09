import data from "./foods.json";

// Food list built by ml/src/build_foods.py from USDA FoodData Central (public domain).
// Every number here comes from USDA; `note` marks stand-ins and odd entries.

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export type Food = {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  per100g: Macros & { fiber: number };
  servings: { label: string; grams: number }[];
  source: { dataset: string; fdcId: number; description: string };
  note?: string;
};

export const FOODS: readonly Food[] = data.foods as Food[];
export const FOOD_SOURCE = data.source;

export function foodById(id: string): Food | undefined {
  return FOODS.find((f) => f.id === id);
}

/** Macros for `grams` of a food, rounded for display and storage. */
export function macrosFor(per100g: Macros, grams: number): Macros {
  const k = grams / 100;
  return {
    kcal: Math.round(per100g.kcal * k),
    protein: Math.round(per100g.protein * k * 10) / 10,
    carbs: Math.round(per100g.carbs * k * 10) / 10,
    fat: Math.round(per100g.fat * k * 10) / 10,
  };
}

export function sumMacros(items: readonly Macros[]): Macros {
  const total = items.reduce(
    (t, m) => ({ kcal: t.kcal + m.kcal, protein: t.protein + m.protein, carbs: t.carbs + m.carbs, fat: t.fat + m.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const r = (n: number) => Math.round(n * 10) / 10;
  return { kcal: Math.round(total.kcal), protein: r(total.protein), carbs: r(total.carbs), fat: r(total.fat) };
}

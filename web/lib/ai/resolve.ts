import { macrosFor, sumMacros, type Macros } from "@/lib/nutrition/foods";
import { draftFromFood, newKey, type DraftItem } from "@/lib/nutrition/items";
import { bestMatch } from "@/lib/nutrition/match";
import { toGrams, type Unit } from "@/lib/nutrition/units";

// The key idea: the AI says *what* and *how much*; the numbers come from the USDA list
// whenever it has the food. Only foods the list doesn't know use the AI's estimate,
// and those are labelled as estimates.

type AiFood = {
  name: string;
  quantity?: number;
  unit?: string;
  grams: number;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
};

const MAX_ATWATER_GAP = 0.35;

/** An AI per-100 g estimate is only kept if protein/carbs/fat roughly add up to its calories. */
function plausibleEstimate(f: AiFood): Macros | null {
  const fromMacros = f.protein_per_100g * 4 + f.carbs_per_100g * 4 + f.fat_per_100g * 9;
  if (f.protein_per_100g + f.carbs_per_100g + f.fat_per_100g > 100) return null;
  if (f.kcal_per_100g > 20 && Math.abs(fromMacros - f.kcal_per_100g) / f.kcal_per_100g > MAX_ATWATER_GAP) return null;
  return { kcal: f.kcal_per_100g, protein: f.protein_per_100g, carbs: f.carbs_per_100g, fat: f.fat_per_100g };
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function resolveFood(f: AiFood): DraftItem | null {
  const food = bestMatch(f.name);
  if (food) {
    // Prefer USDA's serving sizes for "2 rotis"; fall back to the AI's gram estimate.
    const portion = f.quantity && f.unit ? toGrams(food, f.quantity, f.unit as Unit) : null;
    return portion
      ? draftFromFood(food, portion.grams, portion.basis)
      : draftFromFood(food, Math.round(f.grams), "weight estimated by AI");
  }
  const per100g = plausibleEstimate(f);
  if (!per100g) return null;
  return {
    key: newKey(),
    name: capitalise(f.name.trim()),
    foodId: null,
    grams: Math.round(f.grams),
    per100g,
    dataSource: "estimate",
    basis: "not in the food list: AI estimate",
  };
}

/** All foods the reply named; the ones that couldn't be trusted are counted, not shown. */
export function resolveFoods(foods: readonly AiFood[]): { items: DraftItem[]; dropped: number } {
  const items = foods.map(resolveFood);
  return { items: items.filter((i): i is DraftItem => i !== null), dropped: items.filter((i) => i === null).length };
}

/** Totals for a list of resolved items. */
export function itemsTotal(items: readonly DraftItem[]): Macros {
  return sumMacros(items.map((i) => macrosFor(i.per100g, i.grams)));
}

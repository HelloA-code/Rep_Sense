import { macrosFor, type Food, type Macros } from "./foods";

// A food in the "review before saving" list. Grams are editable; macros follow.

export type DraftItem = {
  key: string;
  name: string;
  /** Our USDA food id, or null for an AI estimate. */
  foodId: string | null;
  grams: number;
  per100g: Macros;
  dataSource: "usda" | "estimate";
  /** How the grams were worked out, e.g. "1 egg = 50 g (USDA)". */
  basis?: string;
  note?: string;
};

let counter = 0;
export const newKey = () => `item-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function draftFromFood(food: Food, grams: number, basis?: string): DraftItem {
  return {
    key: newKey(),
    name: food.name,
    foodId: food.id,
    grams,
    per100g: food.per100g,
    dataSource: "usda",
    basis,
    note: food.note,
  };
}

export function draftMacros(item: DraftItem): Macros {
  return macrosFor(item.per100g, item.grams);
}

/** Row values for meal_items. */
export function draftToRow(item: DraftItem, mealId: string, userId: string) {
  return {
    meal_id: mealId,
    user_id: userId,
    name: item.name.slice(0, 120),
    food_id: item.foodId,
    grams: Math.round(item.grams * 10) / 10,
    ...draftMacros(item),
    data_source: item.dataSource,
  };
}

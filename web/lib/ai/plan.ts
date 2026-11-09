import type { Macros } from "@/lib/nutrition/foods";
import type { DraftItem } from "@/lib/nutrition/items";
import type { MealType } from "@/lib/nutrition/profile";
import { itemsTotal, resolveFood } from "./resolve";
import type { DietPlanReply } from "./schemas";

// A diet plan as stored and shown: the AI picks foods and grams, and the totals are
// recomputed from the food list so they can be checked against the targets.

export type PlanMeal = { type: MealType; title: string; items: DraftItem[]; total: Macros };

export type DietPlan = {
  createdAt: string;
  meals: PlanMeal[];
  total: Macros;
  target: Macros;
  tip: string;
};

export function buildPlan(reply: DietPlanReply, target: Macros, now = new Date()): DietPlan {
  const meals = reply.meals.map((meal) => {
    const items = meal.foods.map((f) => resolveFood(f)).filter((i): i is DraftItem => i !== null);
    return { type: meal.type, title: meal.title, items, total: itemsTotal(items) };
  });
  return {
    createdAt: now.toISOString(),
    meals: meals.filter((m) => m.items.length > 0),
    total: itemsTotal(meals.flatMap((m) => m.items)),
    target: { kcal: target.kcal, protein: target.protein, carbs: target.carbs, fat: target.fat },
    tip: reply.tip,
  };
}

/** Accepts only a plan this code wrote: the database column is plain JSON. */
export function isDietPlan(value: unknown): value is DietPlan {
  const v = value as DietPlan | null;
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray(v.meals) &&
    typeof v.createdAt === "string" &&
    typeof v.total?.kcal === "number" &&
    typeof v.target?.kcal === "number"
  );
}

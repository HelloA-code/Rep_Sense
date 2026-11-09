import type { OnboardingData } from "@/lib/onboarding";
import type { NutritionProfileRow } from "@/lib/supabase/database";
import { ACTIVITY_LEVELS, DIET_TYPES, SEXES, calculateTargets, type ActivityId, type DietType, type Sex, type Targets } from "./targets";

/** The answers from the Diet setup, plus what onboarding already knows. */
export type NutritionAnswers = {
  age: number;
  sex: Sex;
  activity: ActivityId;
  dietType: DietType;
  allergies: string[];
  cuisine: string;
};

export function rowToAnswers(row: NutritionProfileRow): NutritionAnswers | null {
  const sex = SEXES.find((s) => s.id === row.sex)?.id;
  const activity = ACTIVITY_LEVELS.find((a) => a.id === row.activity)?.id;
  const dietType = DIET_TYPES.find((d) => d.id === row.diet_type)?.id;
  if (!sex || !activity || !dietType) return null;
  return { age: row.age, sex, activity, dietType, allergies: row.allergies, cuisine: row.cuisine };
}

/** Targets always come from the latest body stats, so a weight change updates them. */
export function targetsFor(answers: NutritionAnswers, body: OnboardingData): Targets {
  return calculateTargets({
    sex: answers.sex,
    age: answers.age,
    weightKg: body.weightKg,
    heightCm: body.heightCm,
    activity: answers.activity,
    goal: body.goal,
  });
}

export function answersToRow(answers: NutritionAnswers, targets: Targets) {
  return {
    age: answers.age,
    sex: answers.sex,
    activity: answers.activity,
    diet_type: answers.dietType,
    allergies: answers.allergies.slice(0, 20),
    cuisine: answers.cuisine.slice(0, 40) || "Indian",
    target_kcal: targets.kcal,
    protein_g: targets.protein,
    carbs_g: targets.carbs,
    fat_g: targets.fat,
    updated_at: new Date().toISOString(),
  };
}

/** "egg, Peanuts ,  " → ["egg", "peanuts"] */
export function parseAllergies(text: string): string[] {
  return [...new Set(text.split(/[,\n]/).map((a) => a.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

export const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "snack", label: "Snacks" },
  { id: "dinner", label: "Dinner" },
] as const;
export type MealType = (typeof MEAL_TYPES)[number]["id"];

/** A sensible default for "Add food" based on the time of day. */
export function mealTypeAt(hour: number): MealType {
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 19) return "snack";
  return "dinner";
}

import type { GoalId } from "@/lib/onboarding";
import type { Macros } from "./foods";

// Daily targets from standard equations, never from the AI.
// BMR: Mifflin–St Jeor (1990), the equation most dietitians use for healthy adults.
// TDEE = BMR × activity factor, then adjusted for the goal.

export const SEXES = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
] as const;
export type Sex = (typeof SEXES)[number]["id"];

export const ACTIVITY_LEVELS = [
  { id: "sedentary", label: "Mostly sitting", description: "Desk job, little exercise", factor: 1.2 },
  { id: "light", label: "Lightly active", description: "Exercise 1–3 days a week", factor: 1.375 },
  { id: "moderate", label: "Moderately active", description: "Exercise 3–5 days a week", factor: 1.55 },
  { id: "active", label: "Very active", description: "Hard exercise 6–7 days a week", factor: 1.725 },
  { id: "athlete", label: "Athlete", description: "Training twice a day or a physical job", factor: 1.9 },
] as const;
export type ActivityId = (typeof ACTIVITY_LEVELS)[number]["id"];

export const DIET_TYPES = [
  { id: "veg", label: "Vegetarian" },
  { id: "eggetarian", label: "Eggetarian" },
  { id: "non-veg", label: "Non-vegetarian" },
  { id: "vegan", label: "Vegan" },
] as const;
export type DietType = (typeof DIET_TYPES)[number]["id"];

export const MIN_AGE = 13;
export const MAX_AGE = 100;
const ADULT_AGE = 18;

/** Calorie change for each goal. Moderate on purpose: big deficits cost muscle. */
const GOAL_ADJUST: Record<GoalId, number> = { "fat-loss": -0.2, muscle: 0.1, strength: 0.05, habit: 0 };
/** Protein in g per kg bodyweight: within the 1.4–2.2 g/kg range sports nutrition uses. */
const PROTEIN_PER_KG: Record<GoalId, number> = { "fat-loss": 2.0, muscle: 1.8, strength: 1.8, habit: 1.4 };
const FAT_SHARE = 0.25;
const MIN_FAT_PER_KG = 0.6;
/** Common floors below which unsupervised diets aren't advised. */
const KCAL_FLOOR: Record<Sex, number> = { female: 1200, male: 1500 };

export type TargetInput = {
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
  activity: ActivityId;
  goal: GoalId;
};

export type Targets = Macros & { bmr: number; tdee: number; notes: string[] };

export function bmr({ sex, age, weightKg, heightCm }: TargetInput): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

export function calculateTargets(input: TargetInput): Targets {
  const notes: string[] = [];
  const base = bmr(input);
  const factor = ACTIVITY_LEVELS.find((a) => a.id === input.activity)?.factor ?? 1.2;
  const tdee = base * factor;

  let adjust = GOAL_ADJUST[input.goal];
  if (input.age < ADULT_AGE && adjust < 0) {
    adjust = 0;
    notes.push("Under 18: no calorie deficit. Growing bodies need the energy; talk to a doctor before dieting.");
  }
  let kcal = tdee * (1 + adjust);
  const floor = KCAL_FLOOR[input.sex];
  if (kcal < floor) {
    kcal = floor;
    notes.push(`Raised to ${floor} kcal, the usual minimum without medical supervision.`);
  }

  const protein = PROTEIN_PER_KG[input.goal] * input.weightKg;
  let fat = Math.max((kcal * FAT_SHARE) / 9, MIN_FAT_PER_KG * input.weightKg);
  let carbs = (kcal - protein * 4 - fat * 9) / 4;
  if (carbs < 0) {
    // Very small or very heavy people: keep protein, trim fat to its minimum first.
    fat = MIN_FAT_PER_KG * input.weightKg;
    carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  }

  const round10 = (n: number) => Math.round(n / 10) * 10;
  return {
    bmr: Math.round(base),
    tdee: Math.round(tdee),
    kcal: round10(kcal),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    notes,
  };
}

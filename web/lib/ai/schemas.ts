import { z } from "zod";
import { UNITS } from "@/lib/nutrition/units";

// What Gemini must return. The JSON schema goes to the API (structured output), and the
// same zod schema validates the reply: a model can still return something odd.

const estimate = {
  kcal_per_100g: z.number().min(0).max(900),
  protein_per_100g: z.number().min(0).max(100),
  carbs_per_100g: z.number().min(0).max(100),
  fat_per_100g: z.number().min(0).max(100),
};

export const ParsedFood = z.object({
  name: z.string().min(1).max(80).describe("Common name of one food or dish, e.g. 'roti', 'dal', 'boiled egg'"),
  quantity: z.number().positive().max(5000).describe("How many units"),
  unit: z.enum(UNITS as [string, ...string[]]).describe("Unit for quantity; use 'piece' for countable items"),
  grams: z.number().positive().max(5000).describe("Your estimate of the total weight in grams"),
  ...estimate,
});

export const ParsedFoods = z.object({ foods: z.array(ParsedFood).max(20) });
export type ParsedFoods = z.infer<typeof ParsedFoods>;

export const PlanFood = z.object({
  name: z.string().min(1).max(80),
  grams: z.number().positive().max(2000),
  ...estimate,
});

export const DietPlanReply = z.object({
  meals: z
    .array(
      z.object({
        type: z.enum(["breakfast", "lunch", "snack", "dinner"]),
        title: z.string().min(1).max(80),
        foods: z.array(PlanFood).min(1).max(10),
      }),
    )
    .min(2)
    .max(6),
  tip: z.string().max(300).describe("One short, practical tip for following this plan"),
});
export type DietPlanReply = z.infer<typeof DietPlanReply>;

export const toJsonSchema = (schema: z.ZodType) => z.toJSONSchema(schema);

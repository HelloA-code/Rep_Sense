import { beforeEach, describe, expect, it } from "vitest";
import { calculateTargets } from "@/lib/nutrition/targets";
import { buildCoachContext } from "./coach-context";
import { generateJson, streamChat } from "./gemini";
import { buildPlan } from "./plan";
import { COACH_SYSTEM, PARSE_TEXT_SYSTEM, planSystem } from "./prompts";
import { resolveFoods } from "./resolve";
import { DietPlanReply, ParsedFoods } from "./schemas";

// Real calls to Gemini, using the same code as the app. Skipped unless a key is set:
// run with `npm run test:ai` (reads web/.env.local). Uses a little of your free quota.

const live = describe.skipIf(!process.env.GEMINI_API_KEY);

live("Gemini, for real", () => {
  // The free tier allows only a few requests a minute: space the calls out.
  beforeEach(() => new Promise((resolve) => setTimeout(resolve, 15_000)), 20_000);

  it("turns a meal description into USDA-backed foods", { timeout: 60_000 }, async () => {
    const reply = await generateJson(ParsedFoods, PARSE_TEXT_SYSTEM, [{ text: "2 rotis, a bowl of dal and 1 boiled egg" }]);
    const { items } = resolveFoods(reply.foods);
    console.log("parse:", items.map((i) => `${i.name} ${i.grams} g [${i.dataSource}]`).join(" | "));
    const ids = items.map((i) => i.foodId);
    expect(ids).toContain("roti");
    expect(ids).toContain("dal");
    expect(ids).toContain("egg-boiled");
  });

  it("writes a diet plan close to the targets", { timeout: 90_000 }, async () => {
    const targets = calculateTargets({ sex: "male", age: 21, weightKg: 70, heightCm: 175, activity: "moderate", goal: "muscle" });
    const request = `Daily target: ${targets.kcal} kcal, ${targets.protein} g protein, ${targets.carbs} g carbs, ${targets.fat} g fat.
Diet: Vegetarian.
Allergies to avoid: peanuts.
Cuisine: Indian.`;
    const plan = buildPlan(await generateJson(DietPlanReply, planSystem(), [{ text: request }]), targets);
    const names = plan.meals.flatMap((m) => m.items.map((i) => i.name.toLowerCase()));
    const usda = plan.meals.flatMap((m) => m.items).filter((i) => i.dataSource === "usda").length;
    console.log(
      `plan: ${plan.total.kcal}/${targets.kcal} kcal, P ${plan.total.protein}/${targets.protein} g; ` +
        `${usda}/${names.length} foods from USDA; ${plan.meals.map((m) => m.title).join(" | ")}`,
    );
    expect(plan.meals.length).toBeGreaterThanOrEqual(3);
    expect(names.join(" ")).not.toMatch(/peanut|chicken|egg|fish|mutton/);
    expect(Math.abs(plan.total.kcal - targets.kcal) / targets.kcal).toBeLessThan(0.2);
  });

  it("answers as the coach from the data it's given", { timeout: 60_000 }, async () => {
    const context = buildCoachContext({
      now: new Date(),
      body: { goal: "muscle", level: "beginner", equipment: ["mat"], weightKg: 70, heightCm: 175, completedAt: "" },
      sessions: [],
      nutrition: null,
      targets: null,
      meals: [],
    });
    let reply = "";
    for await (const chunk of streamChat(`${COACH_SYSTEM}\n\nUser data:\n${context}`, [
      { role: "user", parts: [{ text: "How was my training this week?" }] },
    ])) {
      reply += chunk;
    }
    console.log("coach:", reply.slice(0, 300).replace(/\s+/g, " "));
    // No workouts logged: the coach should say so rather than invent any.
    expect(reply.length).toBeGreaterThan(20);
    expect(reply).toMatch(/no (workouts|sessions)|haven.t logged|not logged|don.t see|no data|nothing logged/i);
  });
});

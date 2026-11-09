import { NextResponse } from "next/server";
import { generateJson } from "@/lib/ai/gemini";
import { buildPlan } from "@/lib/ai/plan";
import { planSystem } from "@/lib/ai/prompts";
import { handleAiError, startAiRequest } from "@/lib/ai/route";
import { DietPlanReply } from "@/lib/ai/schemas";
import { fetchProfile } from "@/lib/data/queries";
import { rowToAnswers, targetsFor } from "@/lib/nutrition/profile";
import { DIET_TYPES } from "@/lib/nutrition/targets";

export const maxDuration = 45;

/** A one-day plan for the user's targets and preferences, with USDA numbers where possible. */
export async function POST() {
  const start = await startAiRequest("plan");
  if ("error" in start) return start.error;
  const { supabase, id } = start.user;

  const [body, nutrition] = await Promise.all([
    fetchProfile(supabase, id),
    supabase.from("nutrition_profiles").select("*").eq("user_id", id).maybeSingle(),
  ]);
  const answers = nutrition.data ? rowToAnswers(nutrition.data) : null;
  if (!body || !answers) return NextResponse.json({ error: "Finish the diet setup first." }, { status: 400 });
  const targets = targetsFor(answers, body);

  const request = [
    `Daily target: ${targets.kcal} kcal, ${targets.protein} g protein, ${targets.carbs} g carbs, ${targets.fat} g fat.`,
    `Diet: ${DIET_TYPES.find((d) => d.id === answers.dietType)?.label}.`,
    `Allergies to avoid: ${answers.allergies.length ? answers.allergies.join(", ") : "none"}.`,
    `Cuisine: ${answers.cuisine}.`,
  ].join("\n");

  try {
    const reply = await generateJson(DietPlanReply, planSystem(), [{ text: request }]);
    const plan = buildPlan(reply, targets);
    await supabase.from("diet_plans").upsert({ user_id: id, plan, created_at: new Date().toISOString() });
    return NextResponse.json({ plan });
  } catch (err) {
    return handleAiError(err);
  }
}

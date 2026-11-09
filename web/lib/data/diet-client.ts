import type { DraftItem } from "@/lib/nutrition/items";
import { draftToRow } from "@/lib/nutrition/items";
import type { MealType } from "@/lib/nutrition/profile";
import { browserSupabase } from "@/lib/supabase/client";

// Diet writes go straight to Supabase (logging food is an online action, unlike a
// workout in a gym with no signal). RLS makes sure each user only touches their rows.

async function client() {
  const supabase = browserSupabase();
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  const userId = data.session?.user.id;
  if (!supabase || !userId) throw new Error("Please sign in again.");
  return { supabase, userId };
}

export async function saveNutritionProfile(row: Record<string, unknown>): Promise<void> {
  const { supabase, userId } = await client();
  const { error } = await supabase.from("nutrition_profiles").upsert({ ...row, user_id: userId } as never);
  if (error) throw new Error(error.message);
}

export async function saveMeal(items: readonly DraftItem[], mealType: MealType, source: "search" | "text" | "photo" | "plan") {
  const { supabase, userId } = await client();
  const mealId = crypto.randomUUID();
  const meal = await supabase.from("meals").insert({ id: mealId, user_id: userId, meal_type: mealType, source });
  if (meal.error) throw new Error(meal.error.message);
  const rows = await supabase.from("meal_items").insert(items.map((i) => draftToRow(i, mealId, userId)));
  if (rows.error) {
    await supabase.from("meals").delete().eq("id", mealId); // don't leave an empty meal behind
    throw new Error(rows.error.message);
  }
}

export async function deleteMealItem(itemId: string, mealId: string, lastInMeal: boolean): Promise<void> {
  const { supabase } = await client();
  // Removing the last item removes the meal; the items go with it (on delete cascade).
  const { error } = lastInMeal
    ? await supabase.from("meals").delete().eq("id", mealId)
    : await supabase.from("meal_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
}

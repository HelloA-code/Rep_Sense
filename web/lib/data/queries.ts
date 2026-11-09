import { rowToOnboarding } from "./rows";
import type { SessionWithSets } from "./stats";
import type { ServerSupabase } from "@/lib/supabase/server";

// Server-side reads. Each query also filters by user id for speed and clarity; RLS is
// what actually enforces it.

export async function fetchProfile(supabase: ServerSupabase, userId: string) {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data ? rowToOnboarding(data) : null;
}

/** The user's most recent sessions, newest first, each with its sets. */
export async function fetchSessions(supabase: ServerSupabase, userId: string, limit = 120): Promise<SessionWithSets[]> {
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (!sessions?.length) return [];

  const { data: sets } = await supabase
    .from("exercise_sets")
    .select("*")
    .in("session_id", sessions.map((s) => s.id))
    .order("created_at");
  return sessions.map((s) => ({ ...s, sets: (sets ?? []).filter((set) => set.session_id === s.id) }));
}

/** One session, or null if it doesn't exist or isn't this user's. */
export async function fetchSession(supabase: ServerSupabase, id: string): Promise<SessionWithSets | null> {
  const { data: session } = await supabase.from("workout_sessions").select("*").eq("id", id).maybeSingle();
  if (!session) return null;
  const { data: sets } = await supabase.from("exercise_sets").select("*").eq("session_id", id).order("created_at");
  return { ...session, sets: sets ?? [] };
}

/**
 * Everything the Diet tab needs. Meals from the last 36 h by default: the browser picks
 * "today" in its own timezone. The coach asks for a week.
 */
export async function fetchDiet(supabase: ServerSupabase, userId: string, hours = 36) {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const [profile, meals, plan] = await Promise.all([
    supabase.from("nutrition_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("meals").select("*").eq("user_id", userId).gte("eaten_at", since).order("eaten_at"),
    supabase.from("diet_plans").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  const mealRows = meals.data ?? [];
  const items = mealRows.length
    ? ((await supabase.from("meal_items").select("*").in("meal_id", mealRows.map((m) => m.id))).data ?? [])
    : [];
  return {
    nutrition: profile.data ?? null,
    meals: mealRows.map((m) => ({ ...m, items: items.filter((i) => i.meal_id === m.id) })),
    plan: plan.data?.plan ?? null,
  };
}

export type DietData = Awaited<ReturnType<typeof fetchDiet>>;

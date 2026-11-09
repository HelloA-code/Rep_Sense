import { TodayView } from "@/components/today/today-view";
import { fetchDiet, fetchProfile, fetchSessions } from "@/lib/data/queries";
import { currentUser } from "@/lib/supabase/server";

export default async function TodayPage() {
  const user = await currentUser();
  if (!user) return <TodayView signedIn={false} serverProfile={null} sessions={[]} />;
  const [profile, sessions, diet] = await Promise.all([
    fetchProfile(user.supabase, user.id),
    fetchSessions(user.supabase, user.id, 60),
    fetchDiet(user.supabase, user.id),
  ]);
  const calories = diet.nutrition && {
    target: diet.nutrition.target_kcal,
    meals: diet.meals.map((m) => ({ eaten_at: m.eaten_at, kcal: m.items.reduce((sum, i) => sum + Number(i.kcal), 0) })),
  };
  return <TodayView signedIn serverProfile={profile} sessions={sessions} calories={calories} />;
}

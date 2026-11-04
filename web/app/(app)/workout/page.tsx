import type { Metadata } from "next";
import { WorkoutFlow } from "@/components/workout/workout-flow";
import { fetchProfile } from "@/lib/data/queries";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Workout · RepSense" };

export default async function WorkoutPage() {
  const user = await currentUser();
  return <WorkoutFlow serverProfile={user ? await fetchProfile(user.supabase, user.id) : null} />;
}

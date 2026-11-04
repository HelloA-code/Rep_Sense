import { TodayView } from "@/components/today/today-view";
import { fetchProfile, fetchSessions } from "@/lib/data/queries";
import { currentUser } from "@/lib/supabase/server";

export default async function TodayPage() {
  const user = await currentUser();
  const [profile, sessions] = user
    ? await Promise.all([fetchProfile(user.supabase, user.id), fetchSessions(user.supabase, user.id, 60)])
    : [null, []];
  return <TodayView signedIn={!!user} serverProfile={profile} sessions={sessions} />;
}

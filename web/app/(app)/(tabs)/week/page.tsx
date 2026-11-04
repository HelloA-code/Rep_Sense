import { SignInCard } from "@/components/tabs/sign-in-card";
import { WeekView } from "@/components/tabs/week-view";
import { PageHeader } from "@/components/ui/page-header";
import { fetchSessions } from "@/lib/data/queries";
import { currentUser } from "@/lib/supabase/server";

export default async function WeekPage() {
  const user = await currentUser();
  return (
    <>
      <PageHeader title="Week" subtitle="Your training at a glance." />
      {user ? (
        <WeekView sessions={await fetchSessions(user.supabase, user.id, 60)} />
      ) : (
        <SignInCard text="Reps per day and your form-score trend appear once your workouts are saved." next="/week" />
      )}
    </>
  );
}

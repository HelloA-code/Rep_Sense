import { DietView } from "@/components/diet/diet-view";
import { SignInCard } from "@/components/tabs/sign-in-card";
import { PageHeader } from "@/components/ui/page-header";
import { fetchDiet, fetchProfile } from "@/lib/data/queries";
import { currentUser } from "@/lib/supabase/server";

export default async function DietPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const user = await currentUser();
  if (!user) {
    return (
      <>
        <PageHeader title="Diet" subtitle="Calories and macros for your goal." />
        <SignInCard text="Get daily calorie and macro targets, and log meals by search, text or photo." next="/diet" />
      </>
    );
  }
  const [profile, data] = await Promise.all([fetchProfile(user.supabase, user.id), fetchDiet(user.supabase, user.id)]);
  return <DietView data={data} serverProfile={profile} editSetup={(await searchParams).setup === "1"} />;
}

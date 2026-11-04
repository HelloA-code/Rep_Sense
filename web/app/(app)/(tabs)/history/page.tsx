import { HistoryList } from "@/components/tabs/history-list";
import { SignInCard } from "@/components/tabs/sign-in-card";
import { PageHeader } from "@/components/ui/page-header";
import { fetchSessions } from "@/lib/data/queries";
import { currentUser } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const user = await currentUser();
  return (
    <>
      <PageHeader title="History" subtitle="Every session, set by set." />
      {user ? (
        <HistoryList sessions={await fetchSessions(user.supabase, user.id)} />
      ) : (
        <SignInCard text="Finished sessions show up here with reps, form score and issues per set." next="/history" />
      )}
    </>
  );
}

import { ProfileView } from "@/components/tabs/profile-view";
import { PageHeader } from "@/components/ui/page-header";
import { fetchProfile } from "@/lib/data/queries";
import { currentUser } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const user = await currentUser();
  return (
    <>
      <PageHeader title="Profile" subtitle="Body stats, equipment and settings." />
      <ProfileView
        email={user?.email ?? null}
        serverProfile={user ? await fetchProfile(user.supabase, user.id) : null}
      />
    </>
  );
}

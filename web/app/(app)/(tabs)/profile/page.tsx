import { ProfileView } from "@/components/tabs/profile-view";
import { fetchProfile, fetchSessions } from "@/lib/data/queries";
import { currentUser } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const user = await currentUser();
  const [profile, sessions] = user
    ? await Promise.all([fetchProfile(user.supabase, user.id), fetchSessions(user.supabase, user.id, 500)])
    : [null, []];
  return (
    <ProfileView
      account={user && { email: user.email, name: user.name, hasPassword: user.hasPassword }}
      serverProfile={profile}
      sessions={sessions}
    />
  );
}

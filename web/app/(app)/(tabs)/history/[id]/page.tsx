import { notFound, redirect } from "next/navigation";
import { SessionDetail } from "@/components/tabs/session-detail";
import { fetchSession } from "@/lib/data/queries";
import { currentUser } from "@/lib/supabase/server";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/history/${id}`)}`);
  const session = await fetchSession(user.supabase, id);
  if (!session) notFound();
  return <SessionDetail session={session} />;
}

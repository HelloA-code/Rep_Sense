import { MessageCircleIcon } from "lucide-react";
import { CoachChat, type ChatMessage } from "@/components/coach/coach-chat";
import { SignInCard } from "@/components/tabs/sign-in-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { geminiConfigured } from "@/lib/ai/gemini";
import { currentUser } from "@/lib/supabase/server";

export default async function CoachPage() {
  const header = <PageHeader title="Coach" subtitle="Ask about your own training data." right={<Badge>Beta</Badge>} />;
  if (!geminiConfigured()) {
    return (
      <>
        {header}
        <EmptyState icon={MessageCircleIcon} title="Coming soon" text="The AI coach isn't switched on for this server yet." />
      </>
    );
  }
  const user = await currentUser();
  if (!user) {
    return (
      <>
        {header}
        <SignInCard text="Your coach answers from your saved workouts and food log." next="/coach" />
      </>
    );
  }
  const { data } = await user.supabase
    .from("coach_messages")
    .select("id, role, content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  const initial: ChatMessage[] = [...(data ?? [])]
    .reverse()
    .map((m) => ({ id: m.id, role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
  return <CoachChat initial={initial} />;
}

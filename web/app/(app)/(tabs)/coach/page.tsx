import { MessageCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

const SUGGESTIONS = [
  "How did my squat depth change this week?",
  "Which exercise has my lowest form score?",
  "Am I training enough pull-ups?",
];

export default function CoachPage() {
  return (
    <>
      <PageHeader title="Coach" subtitle="Ask about your own training data." right={<Badge>Beta</Badge>} />
      <EmptyState
        icon={MessageCircleIcon}
        title="Coming soon"
        text="Your coach will answer questions using only your workout numbers."
      />
      <p className="mt-6 mb-3 text-[15px] font-bold">You&rsquo;ll be able to ask</p>
      <ul className="flex flex-col gap-2">
        {SUGGESTIONS.map((q) => (
          <li
            key={q}
            className="rounded-tile border border-border-strong bg-surface px-4 py-3 text-[14px] font-medium text-text/80"
          >
            {q}
          </li>
        ))}
      </ul>
    </>
  );
}

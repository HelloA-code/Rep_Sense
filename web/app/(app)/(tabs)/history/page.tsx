import { HistoryIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export default function HistoryPage() {
  return (
    <>
      <PageHeader title="History" subtitle="Every session, set by set." />
      <EmptyState
        icon={HistoryIcon}
        title="Nothing logged yet"
        text="Finished sessions show up here with reps, form score and issues per set."
      />
    </>
  );
}

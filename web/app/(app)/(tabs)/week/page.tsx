import { BarChart3Icon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export default function WeekPage() {
  return (
    <>
      <PageHeader title="Week" subtitle="Your training at a glance." />
      <EmptyState
        icon={BarChart3Icon}
        title="No workouts yet"
        text="Reps per day and your form-score trend will appear after your first session."
      />
    </>
  );
}

import Link from "next/link";
import { FilmIcon, UserIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { secondaryButtonClass } from "@/components/ui/styles";

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" subtitle="Body stats, equipment and settings." />
      <EmptyState
        icon={UserIcon}
        title="Account coming soon"
        text="Sign-in, units and voice cues arrive with accounts. Your answers are saved on this device."
      />
      <div className="mt-4 flex flex-col gap-3">
        <Link href="/clips" className={secondaryButtonClass}>
          <FilmIcon className="size-4" />
          Recorded clips
        </Link>
        <Link href="/onboarding" className={secondaryButtonClass}>
          Edit onboarding answers
        </Link>
      </div>
    </>
  );
}

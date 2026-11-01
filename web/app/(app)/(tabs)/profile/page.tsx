import Link from "next/link";
import { UserIcon } from "lucide-react";
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
      <Link href="/onboarding" className={`${secondaryButtonClass} mt-4`}>
        Edit onboarding answers
      </Link>
    </>
  );
}

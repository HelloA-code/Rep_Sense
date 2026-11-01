import type { Metadata } from "next";
import { ClipLibrary } from "@/components/clips/clip-library";
import { AppShell } from "@/components/ui/app-shell";
import { TopBar } from "@/components/ui/top-bar";

export const metadata: Metadata = { title: "Clips · RepSense" };

export default function ClipsPage() {
  return (
    <AppShell>
      <TopBar title="Recorded clips" backHref="/profile" />
      <p className="mb-5 text-[14px] font-medium text-muted">
        Pose landmarks you recorded, stored on this device. No video is kept.
      </p>
      <div className="pb-10">
        <ClipLibrary />
      </div>
    </AppShell>
  );
}

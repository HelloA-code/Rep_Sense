import type { Metadata } from "next";
import { ComponentsPreview } from "@/components/dev/components-preview";
import { AppShell } from "@/components/ui/app-shell";

export const metadata: Metadata = { title: "Components · RepSense", robots: { index: false } };

export default function DevComponentsPage() {
  return (
    <AppShell tabBar>
      <ComponentsPreview />
    </AppShell>
  );
}

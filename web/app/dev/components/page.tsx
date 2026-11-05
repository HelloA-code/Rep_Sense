import type { Metadata } from "next";
import { ComponentsPreview } from "@/components/dev/components-preview";
import { AppShell } from "@/components/ui/app-shell";
import { MotionProvider } from "@/components/ui/motion-provider";

export const metadata: Metadata = { title: "Components · RepSense", robots: { index: false } };

export default function DevComponentsPage() {
  return (
    <MotionProvider>
      <AppShell tabBar>
        <ComponentsPreview />
      </AppShell>
    </MotionProvider>
  );
}

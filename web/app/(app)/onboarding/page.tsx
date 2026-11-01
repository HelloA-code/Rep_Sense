import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { AppShell } from "@/components/ui/app-shell";

export const metadata: Metadata = { title: "Get started · RepSense" };

export default function OnboardingPage() {
  return (
    <AppShell>
      <OnboardingFlow />
    </AppShell>
  );
}

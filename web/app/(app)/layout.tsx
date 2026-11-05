import { SessionSync } from "@/components/auth/session-sync";
import { MotionProvider } from "@/components/ui/motion-provider";

// Providers live here, not in the root layout, so the landing page doesn't load them.

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <SessionSync />
      {children}
    </MotionProvider>
  );
}

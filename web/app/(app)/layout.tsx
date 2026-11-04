import { SessionSync } from "@/components/auth/session-sync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionSync />
      {children}
    </>
  );
}

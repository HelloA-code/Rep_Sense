import { AppShell } from "@/components/ui/app-shell";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell tabBar>{children}</AppShell>;
}

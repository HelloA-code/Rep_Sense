import { cn } from "@/lib/utils";
import { BottomTabBar } from "./bottom-tab-bar";

type AppShellProps = {
  children: React.ReactNode;
  tabBar?: boolean;
  className?: string;
};

/**
 * Phone-width column (max 440px, centred on desktop) on black with the warm
 * top glow and cool bottom glow. Screen padding is 20px.
 */
export function AppShell({ children, tabBar = false, className }: AppShellProps) {
  return (
    <div className="relative isolate mx-auto flex min-h-dvh w-full max-w-[440px] flex-col overflow-x-clip bg-bg md:border-x md:border-border">
      <div aria-hidden className="glow-warm pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px]" />
      <div aria-hidden className="glow-cool pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[520px]" />
      <main className={cn("flex flex-1 flex-col px-5", tabBar && "pb-32", className)}>{children}</main>
      {tabBar && <BottomTabBar />}
    </div>
  );
}

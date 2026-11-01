"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  CalendarDaysIcon,
  FlameIcon,
  HistoryIcon,
  MessageCircleIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/today", label: "Today", icon: FlameIcon },
  { href: "/week", label: "Week", icon: CalendarDaysIcon },
  { href: "/coach", label: "Coach", icon: MessageCircleIcon },
  { href: "/history", label: "History", icon: HistoryIcon },
  { href: "/profile", label: "Profile", icon: UserIcon },
];

/** Floating tab bar inset from the screen edges; active tab gets a raised pill. */
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[440px] px-4"
    >
      <ul className="flex rounded-[28px] border border-border-strong bg-[#0c0c0c]/85 p-1.5 backdrop-blur-xl">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 rounded-[22px] py-2 text-[11px] font-semibold transition-colors",
                  active ? "text-accent" : "text-muted hover:text-text",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 -z-10 rounded-[22px] border border-border-strong bg-white/10"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <Icon className="size-[22px]" strokeWidth={1.75} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

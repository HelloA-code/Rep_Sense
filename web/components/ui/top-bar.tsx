"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./button";
import { iconButtonClass } from "./styles";

type TopBarProps = {
  title?: string;
  /** Back button as a link… */
  backHref?: string;
  /** …or as a handler (e.g. previous onboarding step). */
  onBack?: () => void;
  right?: React.ReactNode;
  /** Onboarding variant: thin yellow progress bar + "3 / 5" counter. */
  progress?: { step: number; total: number };
  className?: string;
};

export function TopBar({ title, backHref, onBack, right, progress, className }: TopBarProps) {
  const back = backHref ? (
    <Link href={backHref} aria-label="Back" className={iconButtonClass}>
      <ChevronLeftIcon className="size-5" />
    </Link>
  ) : onBack ? (
    <IconButton label="Back" onClick={onBack}>
      <ChevronLeftIcon className="size-5" />
    </IconButton>
  ) : null;

  return (
    <div className={cn("pt-safe flex min-h-[64px] items-center gap-4", className)}>
      {back}
      {progress ? (
        <div className="flex flex-1 items-center gap-4">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.step}
            className="h-1 flex-1 overflow-hidden rounded-full bg-white/12"
          >
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={false}
              animate={{ width: `${(progress.step / progress.total) * 100}%` }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            />
          </div>
          <span className="text-[13px] font-semibold text-muted tabular-nums">
            {progress.step} / {progress.total}
          </span>
        </div>
      ) : (
        <h1 className="flex-1 truncate text-[22px] font-extrabold tracking-tight">{title}</h1>
      )}
      {right}
    </div>
  );
}

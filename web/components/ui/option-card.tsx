"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type OptionCardProps = {
  title: string;
  description?: string;
  /** Solid yellow with a "Recommended ·" prefix. */
  recommended?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
};

/** Full-width choice row: bold title + muted description. */
export function OptionCard({
  title,
  description,
  recommended = false,
  selected = false,
  onClick,
  className,
}: OptionCardProps) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "w-full rounded-tile border px-4 py-4 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        recommended
          ? "border-accent bg-accent text-accent-fg"
          : selected
            ? "border-accent-border bg-accent-tint"
            : "border-border-strong bg-surface hover:bg-surface-raised",
        recommended && selected && "ring-2 ring-accent ring-offset-2 ring-offset-bg",
        className,
      )}
    >
      <span className={cn("block text-[15px] font-bold", selected && !recommended && "text-accent")}>
        {title}
      </span>
      {(description || recommended) && (
        <span
          className={cn(
            "mt-1 block text-[13px] leading-snug font-medium",
            recommended ? "text-accent-fg/70" : "text-muted",
          )}
        >
          {recommended && "Recommended"}
          {recommended && description && " · "}
          {description}
        </span>
      )}
    </motion.button>
  );
}

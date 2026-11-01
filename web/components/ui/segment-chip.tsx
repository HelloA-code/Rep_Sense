"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type SegmentChipProps = {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
};

/** Preset / filter chip. Put several in a `flex gap-2` row; they share the width. */
export function SegmentChip({ selected, onClick, children, className }: SegmentChipProps) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "h-10 flex-1 rounded-chip border px-3 text-[14px] font-bold whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-accent",
        selected
          ? "border-accent-border bg-accent-tint text-accent"
          : "border-border-strong bg-surface text-text hover:bg-surface-raised",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

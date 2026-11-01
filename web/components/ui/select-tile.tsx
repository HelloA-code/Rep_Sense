"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectTileProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  selected: boolean;
  onToggle: () => void;
  className?: string;
};

/** Icon + label toggle tile. Selected: accent tint/border/text + check badge. */
export function SelectTile({ icon: Icon, label, selected, onToggle, className }: SelectTileProps) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "relative flex min-h-[80px] flex-col items-center justify-center gap-2 rounded-tile border px-2 py-3 text-center text-[13px] leading-tight font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-accent",
        selected
          ? "border-accent-border bg-accent-tint text-accent"
          : "border-border-strong bg-surface text-text/60 hover:bg-surface-raised",
        className,
      )}
    >
      <Icon className={cn("size-7 transition-colors", !selected && "text-muted")} />
      <span>{label}</span>
      <AnimatePresence>
        {selected && (
          <motion.span
            aria-hidden
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 600, damping: 24 }}
            className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-accent text-accent-fg"
          >
            <CheckIcon className="size-3.5" strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { GOOD_REP_SCORE } from "@/lib/workout/form";

export function formatClock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Score of the rep just counted, shown briefly under the number. */
export type RepFlash = { score: number; key: number };

type RepDisplayProps = {
  /** Reps, or for planks the seconds held. */
  value: number;
  mode: "reps" | "hold";
  phase: string;
  /** Highlights the phase pill (at the bottom of a rep / holding a plank). */
  active: boolean;
  setMs: number;
  flash?: RepFlash | null;
};

/** Huge hero number that springs on every new rep, with the phase and set timer under it. */
export function RepDisplay({ value, mode, phase, active, setMs, flash }: RepDisplayProps) {
  const text = mode === "hold" ? formatClock(value * 1000) : String(value);
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[12px] font-semibold text-white/60">{mode === "hold" ? "Held" : "Reps"}</p>
      <div className="relative h-[60px] overflow-hidden">
        <AnimatePresence>
          {flash && (
            <motion.span
              key={flash.key}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "badge-text absolute top-1 right-0 rounded-full px-2 py-0.5",
                flash.score >= GOOD_REP_SCORE ? "bg-accent text-accent-fg" : "bg-danger text-white",
              )}
            >
              Form {flash.score}
            </motion.span>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.p
            key={text}
            initial={mode === "reps" ? { y: 40, scale: 0.6, opacity: 0 } : false}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            className="absolute text-[56px] leading-none font-extrabold tracking-tight tabular-nums"
          >
            {text}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span
          className={cn(
            "badge-text rounded-full border px-2 py-0.5 transition-colors",
            active ? "border-accent-border bg-accent-tint text-accent" : "border-white/15 text-white/70",
          )}
        >
          {phase}
        </span>
        <span className="text-[12px] font-semibold text-muted tabular-nums">Set {formatClock(setMs)}</span>
      </div>
    </div>
  );
}

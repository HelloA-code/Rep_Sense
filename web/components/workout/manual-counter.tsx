"use client";

import { motion } from "framer-motion";
import { MinusIcon, PlusIcon } from "lucide-react";

type ManualCounterProps = {
  /** Holds can't be counted by hand: just say the timer has paused. */
  hold: boolean;
  /** Reps added by hand so far this set. */
  value: number;
  onChange: (value: number) => void;
};

const button =
  "grid size-14 place-items-center rounded-full border border-white/15 bg-black/60 text-text active:bg-white/10 focus-visible:outline-2 focus-visible:outline-accent";

/**
 * Shown when the camera has lost the joints it counts on: count by hand until it finds
 * you again. Reps added here are kept apart from camera-counted ones ("by hand").
 */
export function ManualCounter({ hold, value, onChange }: ManualCounterProps) {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 rounded-card border border-white/15 bg-black/70 p-3 backdrop-blur-sm"
    >
      <p className="text-[13px] font-bold text-text">
        {hold ? "Camera lost you: timer paused" : "Camera lost you: count by hand"}
      </p>
      <p className="text-[12px] font-medium text-muted">
        {hold ? "Step back into view to keep timing." : "Tap + for each rep. Counting resumes when you're back in view."}
      </p>
      {!hold && (
        <div className="mt-3 flex items-center justify-between">
          <button type="button" aria-label="One rep fewer" className={button} onClick={() => onChange(value - 1)}>
            <MinusIcon className="size-6" />
          </button>
          <p className="text-center">
            <span className="block text-[32px] leading-none font-extrabold tabular-nums">{value}</span>
            <span className="text-[12px] font-semibold text-muted">by hand</span>
          </p>
          <button type="button" aria-label="One more rep" className={button} onClick={() => onChange(value + 1)}>
            <PlusIcon className="size-6" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

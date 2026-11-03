"use client";

import { motion } from "framer-motion";
import { DeleteIcon } from "lucide-react";
import { KEYPAD_KEYS, type KeypadKey } from "@/lib/keypad";
import { cn } from "@/lib/utils";

type KeypadProps = {
  onKey: (key: KeypadKey) => void;
  /** Hide/disable the decimal key for whole numbers. */
  allowDecimal?: boolean;
  className?: string;
};

/** 3×4 grid of surface keys: 1–9, decimal, 0, backspace. Pair with applyKey() from lib/keypad. */
export function Keypad({ onKey, allowDecimal = false, className }: KeypadProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-2.5", className)}>
      {KEYPAD_KEYS.map((key) => {
        const disabled = key === "." && !allowDecimal;
        return (
          <motion.button
            key={key}
            type="button"
            disabled={disabled}
            aria-label={key === "back" ? "Delete" : key === "." ? "Decimal point" : key}
            onClick={() => onKey(key)}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="grid h-[60px] place-items-center rounded-tile border border-border bg-surface text-[26px] font-extrabold transition-colors hover:bg-surface-raised disabled:opacity-0 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {key === "back" ? <DeleteIcon className="size-6" /> : key === "." ? "," : key}
          </motion.button>
        );
      })}
    </div>
  );
}

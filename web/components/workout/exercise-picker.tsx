"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CheckIcon, FilmIcon } from "lucide-react";
import { PrimaryButton } from "@/components/ui/button";
import { SegmentChip } from "@/components/ui/segment-chip";
import { TopBar } from "@/components/ui/top-bar";
import type { Exercise, ExerciseId } from "@/lib/equipment";
import { EXERCISE_CONFIGS } from "@/lib/exercises";
import { cn } from "@/lib/utils";

export const SET_OPTIONS = [1, 2, 3, 4, 5] as const;

type ExercisePickerProps = {
  available: readonly Exercise[];
  selected: readonly ExerciseId[];
  sets: number;
  onToggle: (id: ExerciseId) => void;
  onSets: (n: number) => void;
  onStart: () => void;
};

/** Step 1 of a workout: which exercises (only those your equipment allows) and how many sets. */
export function ExercisePicker({ available, selected, sets, onToggle, onSets, onStart }: ExercisePickerProps) {
  const total = selected.length * sets;
  return (
    <div className="flex flex-1 flex-col pb-8">
      <TopBar title="New workout" backHref="/today" />
      <p className="-mt-1 text-[14px] font-medium text-muted">
        Pick exercises in the order you&rsquo;ll do them. Only ones your equipment allows are shown.
      </p>

      <ul className="mt-5 flex flex-col gap-2.5">
        {available.map((ex) => {
          const on = selected.includes(ex.id);
          const order = selected.indexOf(ex.id) + 1;
          const cfg = EXERCISE_CONFIGS[ex.id];
          return (
            <li key={ex.id}>
              <motion.button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(ex.id)}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex w-full items-center gap-4 rounded-tile border px-4 py-3.5 text-left transition-colors",
                  on ? "border-accent-border bg-accent-tint" : "border-border bg-surface hover:bg-surface-raised",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border text-[13px] font-extrabold",
                    on ? "border-accent bg-accent text-accent-fg" : "border-border-strong text-transparent",
                  )}
                >
                  {on ? order : <CheckIcon className="size-4" />}
                </span>
                <span className="flex-1">
                  <span className={cn("block text-[15px] font-bold", on && "text-accent")}>{ex.name}</span>
                  <span className="block text-[12px] font-medium text-muted">
                    {cfg.mode === "hold" ? "Timed hold" : "Reps"} · {cfg.setupHint}
                  </span>
                </span>
              </motion.button>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-[12px] font-semibold text-muted">Sets per exercise</p>
      <div className="mt-2 flex gap-2">
        {SET_OPTIONS.map((n) => (
          <SegmentChip key={n} selected={sets === n} onClick={() => onSets(n)}>
            {n}
          </SegmentChip>
        ))}
      </div>

      <div className="mt-auto pt-8">
        <PrimaryButton onClick={onStart} disabled={selected.length === 0}>
          {selected.length === 0 ? "Pick at least one exercise" : `Start workout · ${total} ${total === 1 ? "set" : "sets"}`}
        </PrimaryButton>
        <Link
          href="/record"
          className="mt-3 flex items-center justify-center gap-2 py-2 text-[13px] font-semibold text-muted hover:text-text"
        >
          <FilmIcon className="size-4" />
          Just start moving (free camera &amp; recorder)
        </Link>
      </div>
    </div>
  );
}

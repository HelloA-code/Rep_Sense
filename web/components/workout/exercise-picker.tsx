"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckIcon, FilmIcon } from "lucide-react";
import { PrimaryButton } from "@/components/ui/button";
import { SegmentChip } from "@/components/ui/segment-chip";
import { TopBar } from "@/components/ui/top-bar";
import type { Exercise, ExerciseId } from "@/lib/equipment";
import { EXERCISE_CONFIGS } from "@/lib/exercises";
import { FAMILIES, FAMILY_ORDER, type FamilyId } from "@/lib/exercises/families";
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
  const [filter, setFilter] = useState<FamilyId | null>(null);
  const families = FAMILY_ORDER.filter((f) => available.some((ex) => ex.family === f));
  return (
    <div className="flex flex-1 flex-col pb-8">
      <TopBar title="New workout" backHref="/today" />
      <p className="-mt-1 text-[14px] font-medium text-muted">
        Pick exercises in the order you&rsquo;ll do them. Only ones your equipment allows are shown.
      </p>

      <div
        className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
        role="group"
        aria-label="Filter by family"
      >
        <SegmentChip
          selected={filter === null}
          onClick={() => setFilter(null)}
          className="h-8 flex-none px-3 text-[12px]"
        >
          All
        </SegmentChip>
        {families.map((f) => (
          <SegmentChip
            key={f}
            selected={filter === f}
            onClick={() => setFilter(f)}
            className="h-8 flex-none px-3 text-[12px]"
          >
            {FAMILIES[f].name}
          </SegmentChip>
        ))}
      </div>

      {families
        .filter((f) => filter === null || filter === f)
        .map((f) => (
          <section key={f} className="mt-5">
            <h2 className="mb-2 text-[12px] font-semibold text-muted">{FAMILIES[f].name}</h2>
            <ul className="flex flex-col gap-2.5">
              {available
                .filter((ex) => ex.family === f)
                .map((ex) => {
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
                          on
                            ? "border-accent-border bg-accent-tint"
                            : "border-border bg-surface hover:bg-surface-raised",
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
          </section>
        ))}

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
          {selected.length === 0
            ? "Pick at least one exercise"
            : `Start workout · ${total} ${total === 1 ? "set" : "sets"}`}
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

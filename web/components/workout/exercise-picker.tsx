"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckIcon, FilmIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { PrimaryButton } from "@/components/ui/button";
import { SegmentChip } from "@/components/ui/segment-chip";
import { secondaryButtonClass } from "@/components/ui/styles";
import { TopBar } from "@/components/ui/top-bar";
import type { Exercise } from "@/lib/equipment";
import { EXERCISE_CONFIGS } from "@/lib/exercises";
import { buildCustomExercise, type CustomExercise } from "@/lib/exercises/custom";
import { FAMILIES, FAMILY_ORDER, type FamilyId } from "@/lib/exercises/families";
import type { AnyExerciseId } from "@/lib/exercises/ids";
import { cn } from "@/lib/utils";

export const SET_OPTIONS = [1, 2, 3, 4, 5] as const;

type Filter = FamilyId | "mine" | null;

type ExercisePickerProps = {
  available: readonly Exercise[];
  /** Exercises the user taught the app (not archived). */
  custom: readonly CustomExercise[];
  onArchive: (id: AnyExerciseId) => void;
  selected: readonly AnyExerciseId[];
  sets: number;
  onToggle: (id: AnyExerciseId) => void;
  onSets: (n: number) => void;
  onStart: () => void;
};

const chip = "h-8 flex-none px-3 text-[12px]";

function ExerciseRow({
  name,
  detail,
  order,
  onToggle,
  onRemove,
}: {
  name: string;
  detail: string;
  /** Position in the workout (1-based), or 0 if not picked. */
  order: number;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  const on = order > 0;
  return (
    <li className="flex items-stretch gap-2">
      <motion.button
        type="button"
        aria-pressed={on}
        onClick={onToggle}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-4 rounded-tile border px-4 py-3.5 text-left transition-colors",
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
        <span className="min-w-0 flex-1">
          <span className={cn("block text-[15px] font-bold", on && "text-accent")}>{name}</span>
          <span className="block text-[12px] font-medium text-muted">{detail}</span>
        </span>
      </motion.button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="grid w-11 shrink-0 place-items-center rounded-tile border border-border bg-surface text-muted hover:text-danger"
        >
          <Trash2Icon className="size-4" />
        </button>
      )}
    </li>
  );
}

/** Step 1 of a workout: which exercises (only those your equipment allows) and how many sets. */
export function ExercisePicker({
  available,
  custom,
  onArchive,
  selected,
  sets,
  onToggle,
  onSets,
  onStart,
}: ExercisePickerProps) {
  const total = selected.length * sets;
  const [filter, setFilter] = useState<Filter>(null);
  const families = FAMILY_ORDER.filter((f) => available.some((ex) => ex.family === f));
  const order = (id: AnyExerciseId) => selected.indexOf(id) + 1;

  function remove(c: CustomExercise) {
    if (window.confirm(`Remove "${c.name}"? Past workouts keep it.`)) onArchive(c.id);
  }

  return (
    <div className="flex flex-1 flex-col pb-8">
      <TopBar title="New workout" backHref="/today" />
      <p className="-mt-1 text-[14px] font-medium text-muted">
        Pick exercises in the order you&rsquo;ll do them. Only ones your equipment allows are shown.
      </p>

      <Link href="/teach" className={cn(secondaryButtonClass, "mt-4 gap-2")}>
        <SparklesIcon className="size-4" />
        Teach a new exercise
      </Link>

      <div
        className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
        role="group"
        aria-label="Filter by family"
      >
        <SegmentChip selected={filter === null} onClick={() => setFilter(null)} className={chip}>
          All
        </SegmentChip>
        {custom.length > 0 && (
          <SegmentChip selected={filter === "mine"} onClick={() => setFilter("mine")} className={chip}>
            Mine
          </SegmentChip>
        )}
        {families.map((f) => (
          <SegmentChip key={f} selected={filter === f} onClick={() => setFilter(f)} className={chip}>
            {FAMILIES[f].name}
          </SegmentChip>
        ))}
      </div>

      {custom.length > 0 && (filter === null || filter === "mine") && (
        <section className="mt-5">
          <h2 className="mb-2 text-[12px] font-semibold text-muted">My exercises</h2>
          <ul className="flex flex-col gap-2.5">
            {custom.map((c) => (
              <ExerciseRow
                key={c.id}
                name={c.name}
                detail={`Taught · ${buildCustomExercise(c).setupHint}`}
                order={order(c.id)}
                onToggle={() => onToggle(c.id)}
                onRemove={() => remove(c)}
              />
            ))}
          </ul>
        </section>
      )}

      {families
        .filter((f) => filter === null || filter === f)
        .map((f) => (
          <section key={f} className="mt-5">
            <h2 className="mb-2 text-[12px] font-semibold text-muted">{FAMILIES[f].name}</h2>
            <ul className="flex flex-col gap-2.5">
              {available
                .filter((ex) => ex.family === f)
                .map((ex) => {
                  const cfg = EXERCISE_CONFIGS[ex.id];
                  return (
                    <ExerciseRow
                      key={ex.id}
                      name={ex.name}
                      detail={`${cfg.mode === "hold" ? "Timed hold" : "Reps"} · ${cfg.setupHint}`}
                      order={order(ex.id)}
                      onToggle={() => onToggle(ex.id)}
                    />
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

"use client";

import { useState } from "react";
import { SegmentChip } from "@/components/ui/segment-chip";
import { EXERCISES } from "@/lib/equipment";
import { FAMILIES, FAMILY_ORDER, type FamilyId } from "@/lib/exercises/families";

type Group = FamilyId | "mine" | "other";

type ExerciseChooserProps<T extends string> = {
  value: T;
  onChange: (id: T) => void;
  /** Taught exercises, shown first under "Mine". */
  custom?: readonly { id: T; name: string }[];
  /** Non-exercise choices (the recorder's "Idle"), shown under "Other". */
  extra?: readonly { id: T; name: string }[];
  /** Shown first in the family row (the camera's "Auto" chip). */
  leading?: React.ReactNode;
  /** Nothing selected in the exercise row (e.g. while Auto picks). */
  noneSelected?: boolean;
};

const ROW = "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]";

/**
 * Two rows of chips: movement families, then that family's exercises. With 46 exercises
 * one row of chips would be a long scroll; this keeps any exercise two taps away.
 */
export function ExerciseChooser<T extends string>({
  value,
  onChange,
  extra = [],
  custom = [],
  leading,
  noneSelected,
}: ExerciseChooserProps<T>) {
  const options = [
    ...custom.map((e) => ({ ...e, group: "mine" as Group })),
    ...EXERCISES.map((e) => ({ id: e.id as string as T, name: e.name, group: e.family as Group })),
    ...extra.map((e) => ({ ...e, group: "other" as Group })),
  ];
  const groupOf = (id: T): Group => options.find((o) => o.id === id)?.group ?? "squat";
  const groups: Group[] = [
    ...(custom.length ? (["mine"] as const) : []),
    ...FAMILY_ORDER,
    ...(extra.length ? (["other"] as const) : []),
  ];

  // Browsing another family keeps the selection; picking from outside (auto-detect,
  // a restored choice) jumps to the selected exercise's family.
  const [browsing, setBrowsing] = useState<Group | null>(null);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setBrowsing(null);
  }
  const group = browsing ?? groupOf(value);

  return (
    <div className="flex flex-col gap-2">
      <div className={ROW} role="group" aria-label="Movement family">
        {leading}
        {groups.map((g) => (
          <SegmentChip
            key={g}
            selected={g === group}
            onClick={() => setBrowsing(g)}
            className="h-8 flex-none px-3 text-[12px]"
          >
            {g === "other" ? "Other" : g === "mine" ? "Mine" : FAMILIES[g].name}
          </SegmentChip>
        ))}
      </div>
      <div className={ROW} role="group" aria-label="Exercise">
        {options
          .filter((o) => o.group === group)
          .map((o) => (
            <SegmentChip
              key={o.id}
              selected={!noneSelected && o.id === value}
              onClick={() => onChange(o.id)}
              className="h-9 flex-none px-3.5 text-[13px]"
            >
              {o.name}
            </SegmentChip>
          ))}
      </div>
    </div>
  );
}

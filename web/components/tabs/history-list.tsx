"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon, HistoryIcon } from "lucide-react";
import { formatClock } from "@/components/workout/rep-display";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useCustomExercises } from "@/components/workout/use-custom-exercises";
import type { SessionWithSets } from "@/lib/data/stats";
import { exerciseName } from "@/lib/exercises/registry";

/** "Tue 3 Nov, 6:30 pm" in the user's timezone. */
export function sessionDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function HistoryList({ sessions }: { sessions: SessionWithSets[] }) {
  // Dates render in the browser's timezone; the server would show UTC.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  // Taught exercises are named from this device's list.
  const custom = useCustomExercises();
  if (!ready) return null;

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={HistoryIcon}
        title="Nothing logged yet"
        text="Finished sessions show up here with reps, form score and issues per set."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {sessions.map((s) => {
        const reps = s.sets.reduce((sum, set) => sum + set.reps, 0);
        const names = [...new Set(s.sets.map((set) => exerciseName(set.exercise, custom)))].join(", ");
        return (
          <li key={s.id}>
            <Link href={`/history/${s.id}`} className="block">
              <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-raised">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">{sessionDate(s.started_at)}</span>
                  <span className="block truncate text-[13px] font-medium text-muted">{names || "No sets"}</span>
                  <span className="mt-1 block text-[12px] font-semibold text-muted tabular-nums">
                    {reps} reps · {s.sets.length} {s.sets.length === 1 ? "set" : "sets"} ·{" "}
                    {formatClock(s.duration_ms)}
                    {s.avg_form_score !== null && ` · form ${s.avg_form_score}`}
                  </span>
                </span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted" />
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

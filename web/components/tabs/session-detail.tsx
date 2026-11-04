"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/components/workout/rep-display";
import { Card } from "@/components/ui/card";
import { TopBar } from "@/components/ui/top-bar";
import type { SessionWithSets } from "@/lib/data/stats";
import type { SetRow } from "@/lib/supabase/database";
import { exerciseName, sessionDate } from "./history-list";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <p className="mt-0.5 text-[20px] font-extrabold tabular-nums">{value}</p>
    </Card>
  );
}

function issueText(set: SetRow) {
  return Object.entries(set.form_issues)
    .sort((a, b) => b[1] - a[1])
    .map(([cue, n]) => (n > 1 ? `${cue} ×${n}` : cue))
    .join(" · ");
}

export function SessionDetail({ session }: { session: SessionWithSets }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const groups = new Map<string, SetRow[]>();
  for (const set of session.sets) groups.set(set.exercise, [...(groups.get(set.exercise) ?? []), set]);
  const reps = session.sets.reduce((sum, s) => sum + s.reps, 0);

  return (
    <>
      <TopBar title={ready ? sessionDate(session.started_at) : "Workout"} backHref="/history" />
      <div className="mt-2 grid grid-cols-2 gap-2.5">
        <Stat label="Reps" value={String(reps)} />
        <Stat label="Avg form" value={session.avg_form_score === null ? "–" : String(session.avg_form_score)} />
        <Stat label="Duration" value={formatClock(session.duration_ms)} />
        <Stat label="Calories (est.)" value={`~${session.calories}`} />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {[...groups].map(([exercise, sets]) => (
          <Card key={exercise} className="p-0">
            <p className="px-5 pt-4 pb-2 text-[15px] font-bold">{exerciseName(exercise)}</p>
            <ul>
              {sets.map((s) => (
                <li key={s.id} className="border-t border-border px-5 py-2.5 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-muted">Set {s.set_number}</span>
                    <span className="font-bold tabular-nums">
                      {s.hold_seconds > 0 ? `${s.hold_seconds}s` : `${s.reps} reps`}
                      {Number(s.load_kg) > 0 && ` · +${Number(s.load_kg)} kg`}
                      {s.avg_form_score !== null && <span className="ml-2 text-muted">form {s.avg_form_score}</span>}
                    </span>
                  </div>
                  {(issueText(s) || s.missed > 0) && (
                    <p className="mt-0.5 text-[12px] font-semibold text-danger">
                      {[issueText(s), s.missed > 0 ? `${s.missed} missed` : ""].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}

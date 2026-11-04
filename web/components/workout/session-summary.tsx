import Link from "next/link";
import { CheckIcon, FlameIcon } from "lucide-react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EXERCISE_CONFIGS } from "@/lib/exercises";
import type { FlushResult } from "@/lib/data/sync";
import type { SessionSummary as Summary } from "@/lib/workout/summary";
import { formatClock } from "./rep-display";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[12px] font-semibold text-muted">{label}</p>
      <p className="mt-1 text-[26px] leading-none font-extrabold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-[11px] font-medium text-muted">{hint}</p>}
    </Card>
  );
}

function SaveStatus({ saved }: { saved: FlushResult | null }) {
  if (!saved) return <p className="text-center text-[12px] font-medium text-muted">Saving…</p>;
  if (!saved.signedIn) {
    return (
      <Link href="/login?next=/history" className="block">
        <Card className="p-4 text-center">
          <p className="text-[15px] font-bold text-accent">Sign in to save this workout</p>
          <p className="mt-0.5 text-[12px] font-medium text-muted">It&rsquo;s kept on this device until you do.</p>
        </Card>
      </Link>
    );
  }
  if (saved.remaining > 0) {
    return (
      <p className="text-center text-[12px] font-medium text-muted">
        Kept on this device. It&rsquo;ll upload when you&rsquo;re back online.
      </p>
    );
  }
  return (
    <p className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-accent">
      <CheckIcon className="size-4" />
      Saved to your history
    </p>
  );
}

/** End of workout: totals, form quality, per-exercise breakdown, and whether it was saved. */
export function SessionSummary({
  summary,
  weightKg,
  saved,
  onDone,
  onAgain,
}: {
  summary: Summary;
  weightKg: number;
  saved: FlushResult | null;
  onDone: () => void;
  onAgain: () => void;
}) {
  const scored = summary.goodReps + summary.badReps;
  return (
    <div className="flex flex-col pb-10">
      <div className="pt-safe flex min-h-[64px] items-center">
        <p className="badge-text text-accent">Workout complete</p>
      </div>
      <h1 className="text-[30px] leading-tight font-extrabold tracking-tight">Nice work.</h1>

      <div className="mt-6 flex items-end gap-6">
        <div>
          <p className="text-[12px] font-semibold text-muted">Total reps</p>
          <p className="text-[72px] leading-none font-extrabold tracking-tight tabular-nums">{summary.totalReps}</p>
        </div>
        {summary.totalHoldMs > 0 && (
          <div>
            <p className="text-[12px] font-semibold text-muted">Plank</p>
            <p className="text-[40px] leading-none font-extrabold tracking-tight tabular-nums">
              {formatClock(summary.totalHoldMs)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Stat
          label="Good reps"
          value={scored ? `${summary.goodReps}/${scored}` : "–"}
          hint={summary.badReps ? `${summary.badReps} need work` : undefined}
        />
        <Stat label="Avg form" value={summary.avgScore === null ? "–" : String(summary.avgScore)} hint="out of 100" />
        <Stat label="Missed" value={String(summary.missed)} hint="attempts that didn't count" />
        <Stat label="Duration" value={formatClock(summary.durationMs)} />
      </div>
      <Card className="mt-3 flex items-center gap-3 p-4">
        <FlameIcon className="size-6 text-accent" />
        <div className="flex-1">
          <p className="text-[15px] font-bold tabular-nums">~{summary.calories} kcal</p>
          <p className="text-[11px] font-medium text-muted">
            Estimate: MET × {weightKg} kg × time in sets
          </p>
        </div>
      </Card>

      <h2 className="mt-8 mb-3 text-[17px] font-bold">Exercises</h2>
      <div className="flex flex-col gap-3">
        {summary.exercises.map((ex) => {
          const cfg = EXERCISE_CONFIGS[ex.exerciseId];
          return (
            <Card key={ex.exerciseId} className="p-0">
              <p className="px-5 pt-4 pb-2 text-[15px] font-bold">{cfg.name}</p>
              <ul>
                {ex.sets.map((s, i) => (
                  <li key={i} className="flex items-center justify-between border-t border-border px-5 py-2.5 text-[13px]">
                    <span className="font-semibold text-muted">Set {i + 1}</span>
                    <span className="font-bold tabular-nums">
                      {s.mode === "hold" ? `${s.loggedValue}s` : `${s.loggedValue} reps`}
                      {s.loadKg > 0 && ` · +${s.loadKg} kg`}
                      {s.score !== null && <span className="ml-2 text-muted">form {s.score}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {ex.topIssues.length > 0 && (
                <p className="border-t border-border px-5 py-3 text-[12px] font-semibold text-muted">
                  Work on: <span className="text-danger">{ex.topIssues.slice(0, 3).join(" · ")}</span>
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mt-6">
        <SaveStatus saved={saved} />
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <PrimaryButton onClick={onDone}>Done</PrimaryButton>
        <SecondaryButton onClick={onAgain}>Start another workout</SecondaryButton>
      </div>
    </div>
  );
}

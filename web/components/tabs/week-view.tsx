"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { BarChart3Icon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formTrend, monthCalendar, repsPerDay, type SessionWithSets } from "@/lib/data/stats";
import { cn } from "@/lib/utils";

const RepsBarChart = dynamic(() => import("@/components/charts/reps-bar-chart").then((m) => m.RepsBarChart), {
  ssr: false,
});
const FormTrendChart = dynamic(() => import("@/components/charts/form-trend-chart").then((m) => m.FormTrendChart), {
  ssr: false,
});

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function WeekView({ sessions }: { sessions: SessionWithSets[] }) {
  // The local clock only exists in the browser; the server renders in UTC.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  if (!now) return null;

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={BarChart3Icon}
        title="No workouts yet"
        text="Reps per day and your form-score trend will appear after your first session."
      />
    );
  }

  const days = repsPerDay(sessions, now);
  const trend = formTrend(sessions);
  const weeks = monthCalendar(
    sessions.map((s) => s.started_at),
    now,
  );
  const total = days.reduce((sum, d) => sum + d.reps, 0);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <p className="text-[12px] font-semibold text-muted">Reps, last 7 days</p>
        <p className="text-[34px] leading-tight font-extrabold tracking-tight tabular-nums">{total}</p>
        <RepsBarChart data={days} />
      </Card>

      <Card>
        <p className="text-[15px] font-bold">Form score</p>
        {trend.length > 1 ? (
          <FormTrendChart data={trend} />
        ) : (
          <p className="mt-1 text-[13px] font-medium text-muted">Your trend appears after two scored workouts.</p>
        )}
      </Card>

      <Card>
        <p className="text-[15px] font-bold">{now.toLocaleDateString("en", { month: "long", year: "numeric" })}</p>
        <div className="mt-3 grid grid-cols-7 gap-1.5 text-center">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="text-[11px] font-semibold text-muted">
              {d}
            </span>
          ))}
          {weeks.flat().map((cell, i) =>
            cell ? (
              <span
                key={cell.day}
                aria-label={cell.trained ? `${cell.date}, trained` : undefined}
                className={cn(
                  "grid aspect-square place-items-center rounded-full text-[13px] font-bold tabular-nums",
                  cell.trained ? "bg-accent text-accent-fg" : "text-text/70",
                  cell.today && !cell.trained && "border border-accent-border text-accent",
                )}
              >
                {cell.date}
              </span>
            ) : (
              <span key={`pad-${i}`} />
            ),
          )}
        </div>
      </Card>
    </div>
  );
}

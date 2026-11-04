"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import type { DayReps } from "@/lib/data/stats";

/** Reps per day: accent bars on dark, no gridlines. */
export function RepsBarChart({ data, height = 160 }: { data: DayReps[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Reps per day for the last 7 days">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 0, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={{ fill: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}
          />
          <Bar
            dataKey="reps"
            fill="var(--accent)"
            radius={[6, 6, 6, 6]}
            maxBarSize={28}
            isAnimationActive={false}
            label={{
              position: "top",
              fill: "var(--text)",
              fontSize: 11,
              fontWeight: 700,
              formatter: (v: unknown) => (v ? String(v) : ""),
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

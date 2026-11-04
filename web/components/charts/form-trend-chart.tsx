"use client";

import { LabelList, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/data/stats";

/** Form score per session, oldest to newest. */
export function FormTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-[160px]" role="img" aria-label="Form score across recent workouts">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 22, right: 14, bottom: 0, left: 14 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            tick={{ fill: "var(--text-muted)", fontSize: 11, fontWeight: 600 }}
          />
          <YAxis hide domain={[0, 100]} />
          <Line
            dataKey="score"
            type="monotone"
            stroke="var(--accent)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "var(--accent)", strokeWidth: 0 }}
            isAnimationActive={false}
          >
            {data.length <= 8 && (
              <LabelList dataKey="score" position="top" fill="var(--text)" fontSize={11} fontWeight={700} />
            )}
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

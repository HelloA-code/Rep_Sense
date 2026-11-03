"use client";

import { useMemo } from "react";
import { EXERCISES } from "@/lib/equipment";
import { EXERCISE_CONFIGS } from "@/lib/exercises";
import type { Recording } from "@/lib/recording/format";
import { formatClock } from "@/components/workout/rep-display";
import { countRepsInRecording } from "@/lib/workout/replay";

/**
 * What the app counts in this clip, replayed through the same engine as the live
 * camera. Compare with your own count for ml/reports/rep_counting.md.
 */
export function ClipAppCount({ recording }: { recording: Recording }) {
  const exercise = EXERCISES.find((e) => e.id === recording.label);
  const result = useMemo(
    () => (exercise ? countRepsInRecording(recording, EXERCISE_CONFIGS[exercise.id]) : null),
    [recording, exercise],
  );
  if (!result) return null;
  const main =
    result.mode === "hold" ? `held ${formatClock(result.heldMs)}` : `${result.reps} ${result.reps === 1 ? "rep" : "reps"}`;
  const parts = [
    result.score !== null ? `form ${result.score}` : null,
    result.missed ? `${result.missed} missed` : null,
  ].filter(Boolean);
  return (
    <p className="mt-1 text-[12px] font-semibold text-muted">
      App count: <span className="font-bold text-accent">{main}</span>
      {parts.length > 0 && ` · ${parts.join(" · ")}`}
    </p>
  );
}

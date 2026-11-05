"use client";

import { Badge } from "@/components/ui/badge";
import { EXERCISES } from "@/lib/equipment";
import type { ModelLabel } from "@/lib/ml/features";

export type AutoStatus =
  | { state: "loading" }
  | { state: "watching" }
  | { state: "detected"; label: ModelLabel; confidence: number };

function labelName(label: ModelLabel) {
  return label === "idle" ? "Resting" : (EXERCISES.find((e) => e.id === label)?.name ?? label);
}

/** What the classifier sees right now, how sure it is, and which counter is running. */
export function AutoDetectBar({
  status,
  synthetic,
  exercise,
}: {
  status: AutoStatus;
  /** The stand-in model isn't trained on real people, so say so. */
  synthetic: boolean;
  exercise: string;
}) {
  const detected = status.state === "detected";
  const percent = detected ? Math.round(status.confidence * 100) : 0;
  const title =
    status.state === "loading" ? "Loading auto-detect…" : detected ? labelName(status.label) : "Start moving…";
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 text-[12px] font-semibold">
        <span className="min-w-0 flex-1 truncate text-white/85">
          {title}
          {detected && ` · ${percent}%`}
        </span>
        {synthetic && <Badge tone="neutral">Preview</Badge>}
      </div>
      <div
        role="meter"
        aria-label="Auto-detect confidence"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/12"
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-[11px] font-medium text-muted">
        {synthetic ? "Test model, not trained on real people yet. " : ""}Counting: {exercise}
      </p>
    </div>
  );
}

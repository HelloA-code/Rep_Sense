"use client";

import { SegmentChip } from "@/components/ui/segment-chip";
import { ExerciseChooser } from "@/components/workout/exercise-chooser";
import { CAMERA_VIEWS, type CameraView, type RecordingLabel } from "@/lib/recording/format";

const IDLE = [{ id: "idle", name: "Idle" }] as const;

type ClipFieldsProps = {
  label: RecordingLabel;
  view: CameraView;
  onLabel: (l: RecordingLabel) => void;
  onView: (v: CameraView) => void;
};

/** Label + camera-view chips, for fixing a clip's tags before or after saving. */
export function ClipFields({ label, view, onLabel, onView }: ClipFieldsProps) {
  const chip = "h-9 flex-none px-3.5 text-[13px]";
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] font-semibold text-muted">Exercise</p>
      <ExerciseChooser<RecordingLabel> value={label} onChange={onLabel} extra={IDLE} />
      <p className="mt-2 text-[12px] font-semibold text-muted">Camera view</p>
      <div className="flex gap-2">
        {CAMERA_VIEWS.map((v) => (
          <SegmentChip key={v} selected={view === v} onClick={() => onView(v)} className={`${chip} capitalize`}>
            {v}
          </SegmentChip>
        ))}
      </div>
    </div>
  );
}

export function clipSummary(c: { durationMs: number; frameCount: number; subject: string }) {
  return `${(c.durationMs / 1000).toFixed(1)}s · ${c.frameCount} frames · ${c.subject}`;
}

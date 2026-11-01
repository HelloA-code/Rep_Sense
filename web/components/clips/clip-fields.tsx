"use client";

import { SegmentChip } from "@/components/ui/segment-chip";
import { CAMERA_VIEWS, RECORDING_LABELS, type CameraView, type RecordingLabel } from "@/lib/recording/format";

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
      <div className="flex flex-wrap gap-2">
        {RECORDING_LABELS.map((l) => (
          <SegmentChip key={l.id} selected={label === l.id} onClick={() => onLabel(l.id)} className={chip}>
            {l.name}
          </SegmentChip>
        ))}
      </div>
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

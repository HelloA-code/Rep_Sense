"use client";

import { motion } from "framer-motion";
import { VideoIcon } from "lucide-react";
import { SegmentChip } from "@/components/ui/segment-chip";
import { cn } from "@/lib/utils";
import {
  CAMERA_VIEWS,
  RECORDING_LABELS,
  type CameraView,
  type RecordingLabel,
} from "@/lib/recording/format";

export type RecorderPhase = "off" | "countdown" | "recording";

type RecorderControlsProps = {
  phase: RecorderPhase;
  label: RecordingLabel;
  view: CameraView;
  subject: string;
  /** null = this browser can't record video, so only landmarks are saved. */
  withVideo: boolean | null;
  onLabel: (l: RecordingLabel) => void;
  onView: (v: CameraView) => void;
  onSubject: (s: string) => void;
  onWithVideo: (v: boolean) => void;
};

/** Label, camera view and subject for the next clip. Locked while recording. */
export function RecorderSettings({
  phase,
  label,
  view,
  subject,
  withVideo,
  onLabel,
  onView,
  onSubject,
  onWithVideo,
}: RecorderControlsProps) {
  const locked = phase !== "off";
  return (
    <fieldset disabled={locked} className={cn("min-w-0 transition-opacity", locked && "opacity-50")}>
      <legend className="sr-only">Recording settings</legend>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {RECORDING_LABELS.map((l) => (
          <SegmentChip
            key={l.id}
            selected={label === l.id}
            onClick={() => onLabel(l.id)}
            className="h-9 flex-none px-3.5 text-[13px]"
          >
            {l.name}
          </SegmentChip>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {CAMERA_VIEWS.map((v) => (
          <SegmentChip
            key={v}
            selected={view === v}
            onClick={() => onView(v)}
            className="h-9 flex-none px-3.5 text-[13px] capitalize"
          >
            {v}
          </SegmentChip>
        ))}
        {withVideo !== null && (
          <SegmentChip
            selected={withVideo}
            onClick={() => onWithVideo(!withVideo)}
            className="h-9 flex-none gap-1.5 px-3 text-[13px]"
          >
            <span className="flex items-center gap-1.5">
              <VideoIcon className="size-4" />
              {withVideo ? "Video" : "No video"}
            </span>
          </SegmentChip>
        )}
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-chip border border-border-strong bg-surface px-3 focus-within:border-accent-border">
          <span className="text-[12px] font-semibold text-muted">Who</span>
          <input
            value={subject}
            onChange={(e) => onSubject(e.target.value.slice(0, 24))}
            placeholder="your name"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[13px] font-bold outline-none placeholder:text-white/30"
          />
        </label>
      </div>
    </fieldset>
  );
}

/** Round shutter-style button: white ring, red dot that turns into a square while recording. */
export function RecordButton({ phase, onClick }: { phase: RecorderPhase; onClick: () => void }) {
  const active = phase !== "off";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? "Stop recording" : "Start recording"}
      className="grid size-[64px] shrink-0 place-items-center rounded-full border-[3px] border-white/85 transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <motion.span
        className="block bg-danger"
        initial={false}
        animate={active ? { width: 24, height: 24, borderRadius: 6 } : { width: 48, height: 48, borderRadius: 24 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

"use client";

import { useEffect, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";
import { Sheet } from "@/components/ui/sheet";
import type { CameraView, Recording, RecordingLabel } from "@/lib/recording/format";
import { ClipFields, clipSummary } from "./clip-fields";
import { ClipAppCount } from "./clip-app-count";
import { ClipPreview } from "./clip-preview";

export type PendingClip = { recording: Recording; video: Blob | null };

type SaveClipSheetProps = {
  clip: PendingClip | null;
  saving: boolean;
  onSave: (clip: PendingClip) => void;
  onDiscard: () => void;
  /** Ask who's in it (an imported video: training splits by person). */
  askSubject?: boolean;
};

/** Shown after a recording stops: watch it back, fix the tags, keep it or throw it away. */
export function SaveClipSheet({ clip, saving, onSave, onDiscard, askSubject }: SaveClipSheetProps) {
  const [label, setLabel] = useState<RecordingLabel>("squat");
  const [view, setView] = useState<CameraView>("side");
  const [subject, setSubject] = useState("");

  useEffect(() => {
    if (!clip) return;
    setLabel(clip.recording.label);
    setView(clip.recording.view);
    setSubject(clip.recording.subject === "anonymous" ? "" : clip.recording.subject);
  }, [clip]);

  function close() {
    if (window.confirm("Discard this clip?")) onDiscard();
  }

  return (
    <Sheet
      open={clip !== null}
      onClose={close}
      title="Keep this clip?"
      footer={
        <div className="flex gap-3">
          <SecondaryButton onClick={onDiscard} disabled={saving}>
            Discard
          </SecondaryButton>
          <PrimaryButton
            onClick={() =>
              clip &&
              onSave({
                ...clip,
                recording: {
                  ...clip.recording,
                  label,
                  view,
                  ...(askSubject ? { subject: subject.trim() || "anonymous" } : {}),
                },
              })
            }
            disabled={saving || (askSubject === true && !subject.trim())}
          >
            {saving ? "Saving…" : "Save clip"}
          </PrimaryButton>
        </div>
      }
    >
      {clip && (
        <>
          <ClipPreview recording={clip.recording} video={clip.video} />
          <p className="mt-2 text-[12px] font-semibold text-muted">
            {clipSummary(clip.recording)}
            {clip.video ? ` · video ${(clip.video.size / 1e6).toFixed(1)} MB` : " · no video"}
          </p>
          <ClipAppCount recording={{ ...clip.recording, label }} />
          <div className="mt-5">
            <ClipFields label={label} view={view} onLabel={setLabel} onView={setView} />
          </div>
          {askSubject && (
            <label className="mt-4 block">
              <span className="text-[12px] font-semibold text-muted">
                Who&rsquo;s in the video? (for a reel, the creator&rsquo;s name)
              </span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={40}
                placeholder="e.g. alex"
                className={`${inputClass} mt-2`}
              />
              <span className="mt-1 block text-[12px] font-medium text-muted">
                Training tests on people the model hasn&rsquo;t seen, so each person needs their own name.
              </span>
            </label>
          )}
          <p className="mt-5 text-[12px] font-medium text-muted">
            Saved clips stay on this device and are never uploaded. Find them in Profile → Recorded clips.
          </p>
        </>
      )}
    </Sheet>
  );
}

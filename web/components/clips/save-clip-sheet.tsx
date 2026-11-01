"use client";

import { useEffect, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { CameraView, Recording, RecordingLabel } from "@/lib/recording/format";
import { ClipFields, clipSummary } from "./clip-fields";
import { ClipPreview } from "./clip-preview";

type SaveClipSheetProps = {
  recording: Recording | null;
  saving: boolean;
  onSave: (rec: Recording) => void;
  onDiscard: () => void;
};

/** Shown after a recording stops: watch it back, fix the tags, keep it or throw it away. */
export function SaveClipSheet({ recording, saving, onSave, onDiscard }: SaveClipSheetProps) {
  const [label, setLabel] = useState<RecordingLabel>("squat");
  const [view, setView] = useState<CameraView>("side");

  useEffect(() => {
    if (!recording) return;
    setLabel(recording.label);
    setView(recording.view);
  }, [recording]);

  function close() {
    if (window.confirm("Discard this clip?")) onDiscard();
  }

  return (
    <Sheet
      open={recording !== null}
      onClose={close}
      title="Keep this clip?"
      footer={
        <div className="flex gap-3">
          <SecondaryButton onClick={onDiscard} disabled={saving}>
            Discard
          </SecondaryButton>
          <PrimaryButton onClick={() => recording && onSave({ ...recording, label, view })} disabled={saving}>
            {saving ? "Saving…" : "Save clip"}
          </PrimaryButton>
        </div>
      }
    >
      {recording && (
        <>
          <ClipPreview recording={recording} />
          <p className="mt-2 text-[12px] font-semibold text-muted">{clipSummary(recording)}</p>
          <div className="mt-5">
            <ClipFields label={label} view={view} onLabel={setLabel} onView={setView} />
          </div>
          <p className="mt-5 text-[12px] font-medium text-muted">
            Saved clips stay on this device (landmark numbers only, no video). Find them in Profile → Recorded clips.
          </p>
        </>
      )}
    </Sheet>
  );
}

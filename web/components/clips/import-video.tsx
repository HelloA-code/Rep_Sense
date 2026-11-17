"use client";

import { useRef, useState } from "react";
import { FileVideoIcon } from "lucide-react";
import { SecondaryButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { saveClip } from "@/lib/recording/clip-store";
import { recordingFromVideo, type CameraView } from "@/lib/recording/format";
import { estimateView } from "@/lib/pose/view";
import { VideoReadError, extractFromVideo, type VideoFrame } from "@/lib/pose/video-landmarks";
import { SaveClipSheet, type PendingClip } from "./save-clip-sheet";

/** Fewer frames with a person than this (~1 s) isn't worth keeping as a clip. */
const MIN_FRAMES = 15;

const ERRORS: Record<VideoReadError["reason"], string> = {
  unsupported: "This phone can't open that video. Try an MP4 or MOV file.",
  empty: "That video seems to be empty or too short.",
  model: "Couldn't load body tracking. Check your connection and try again.",
  cancelled: "",
};

/** Most frames' camera view, so the save sheet starts with the right one. */
function guessView(frames: readonly VideoFrame[], width: number, height: number): CameraView {
  let view: CameraView | null = null;
  const counts = { front: 0, side: 0 };
  for (const f of frames) {
    view = estimateView(f.landmarks, width, height, view);
    if (view) counts[view] += 1;
  }
  return counts.front > counts.side ? "front" : "side";
}

/**
 * Turns a video already on the phone (an old recording, a saved reel) into a training clip:
 * landmarks are read on this device, then the usual save sheet lets you check and label it.
 */
export function ImportVideo({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingClip | null>(null);
  const [saving, setSaving] = useState(false);

  async function read(file: File) {
    const controller = new AbortController();
    abortRef.current = controller;
    setNote(null);
    setProgress(0);
    try {
      const video = await extractFromVideo(file, { onProgress: setProgress, signal: controller.signal });
      if (video.frames.length < MIN_FRAMES) {
        setNote("Couldn't find a person in this video. The whole body needs to be in view.");
        return;
      }
      const recording = recordingFromVideo(video.frames, {
        label: "squat",
        subject: "",
        view: guessView(video.frames, video.width, video.height),
        width: video.width,
        height: video.height,
      });
      if (video.truncated) setNote("Only the first 60 seconds were used.");
      setPending({ recording, video: file });
    } catch (e) {
      setNote(ERRORS[e instanceof VideoReadError ? e.reason : "unsupported"] || null);
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  }

  async function save(clip: PendingClip) {
    setSaving(true);
    try {
      await saveClip(clip.recording, clip.video);
      setPending(null);
      onImported();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void read(file);
        }}
      />
      {progress === null ? (
        <SecondaryButton onClick={() => fileRef.current?.click()}>
          <FileVideoIcon className="size-4" />
          Import a video
        </SecondaryButton>
      ) : (
        <Card className="p-5">
          <p className="text-[15px] font-bold">Reading your video… {Math.round(progress * 100)}%</p>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} />
          </div>
          <SecondaryButton onClick={() => abortRef.current?.abort()} className="mt-4">
            Cancel
          </SecondaryButton>
        </Card>
      )}
      {note && <p className="text-[13px] font-semibold text-muted">{note}</p>}
      <SaveClipSheet
        clip={pending}
        saving={saving}
        askSubject
        onSave={(clip) => void save(clip)}
        onDiscard={() => setPending(null)}
      />
    </>
  );
}

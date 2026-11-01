"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ActivityIcon, CameraIcon, FilmIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { SaveClipSheet } from "@/components/clips/save-clip-sheet";
import { PrimaryButton } from "@/components/ui/button";
import { iconButtonClass } from "@/components/ui/styles";
import { drawSkeleton } from "@/lib/pose/draw";
import { checkBodyInFrame } from "@/lib/pose/frame-check";
import { createFpsMeter, type FrameStats } from "@/lib/pose/fps";
import { getPoseLandmarker, type Delegate } from "@/lib/pose/landmarker";
import { saveClip } from "@/lib/recording/clip-store";
import {
  RECORDING_LABELS,
  createRecorder,
  type CameraView,
  type Recording,
  type RecordingLabel,
} from "@/lib/recording/format";
import { cn } from "@/lib/utils";
import { RecordButton, RecorderSettings, type RecorderPhase } from "./recorder-controls";
import { CAMERA_ERROR_TEXT, useCamera } from "./use-camera";

type ModelStatus = "idle" | "loading" | "ready" | "error";
type Recorder = ReturnType<typeof createRecorder>;

const SUBJECT_KEY = "repsense.recorder.subject";
/** Only warn when the body has been out of frame for a moment, so it doesn't flicker. */
const WARNING_DELAY_MS = 700;
const UI_UPDATE_MS = 250;

const glassButton = cn(iconButtonClass, "border-white/15 bg-black/35 backdrop-blur-md");

export function WorkoutCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camera = useCamera(videoRef);

  const [model, setModel] = useState<ModelStatus>("idle");
  const [delegate, setDelegate] = useState<Delegate | null>(null);
  const landmarkerRef = useRef<Awaited<ReturnType<typeof getPoseLandmarker>>["landmarker"] | null>(null);

  const [stats, setStats] = useState<FrameStats>({ fps: 0, latencyMs: 0 });
  const [showDebug, setShowDebug] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  // Recorder
  const [phase, setPhase] = useState<RecorderPhase>("off");
  const [countdown, setCountdown] = useState(3);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [label, setLabel] = useState<RecordingLabel>("squat");
  const [view, setView] = useState<CameraView>("side");
  const [subject, setSubject] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  /** Finished clip waiting for Save / Discard. */
  const [pending, setPending] = useState<Recording | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      setSubject(window.localStorage.getItem(SUBJECT_KEY) ?? "");
    } catch {
      // storage blocked: keep empty
    }
  }, []);

  function changeSubject(s: string) {
    setSubject(s);
    try {
      window.localStorage.setItem(SUBJECT_KEY, s);
    } catch {
      // ignore
    }
  }

  async function begin() {
    setModel("loading");
    const loading = getPoseLandmarker(); // starts downloading while the permission prompt is open
    await camera.start(camera.facing);
    try {
      const { landmarker, delegate } = await loading;
      landmarkerRef.current = landmarker;
      setDelegate(delegate);
      setModel("ready");
    } catch {
      setModel("error");
    }
  }

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    setPhase("off");
    setElapsedMs(0);
    if (!rec) return;
    const data = rec.finish();
    if (data.frameCount === 0) {
      setToast("Nothing saved: no body was detected.");
      return;
    }
    setPending(data);
  }, []);

  async function keepClip(rec: Recording) {
    setSaving(true);
    try {
      await saveClip(rec);
      const name = RECORDING_LABELS.find((l) => l.id === rec.label)?.name ?? rec.label;
      setToast(`${name} clip saved to Clips`);
      setPending(null);
    } catch {
      setToast("Couldn't save: storage is blocked in this browser.");
    } finally {
      setSaving(false);
    }
  }

  // The loop calls this when the 60 s cap is hit; a ref avoids restarting the loop.
  const stopRecordingRef = useRef(stopRecording);
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  function toggleRecording() {
    if (phase === "off") {
      setCountdown(3);
      setPhase("countdown");
    } else {
      stopRecording();
    }
  }

  // 3-2-1 so you have time to get into position, then start capturing.
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown === 0) {
      const video = videoRef.current;
      recorderRef.current = createRecorder({
        label,
        subject,
        view,
        source: { facing: camera.facing, width: video?.videoWidth ?? 0, height: video?.videoHeight ?? 0 },
        startedAt: performance.now(),
        createdAt: new Date(),
      });
      setPhase("recording");
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, countdown, label, subject, view, camera.facing]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // The frame loop: one detection per new video frame, drawn straight to the canvas.
  // Per-frame data lives in refs/locals; React state is only touched ~4×/s.
  const live = camera.status === "live" && model === "ready";
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    const ctx = canvas?.getContext("2d");
    if (!live || !video || !canvas || !landmarker || !ctx) return;

    const meter = createFpsMeter();
    let raf = 0;
    let lastVideoTime = -1;
    let lastUiUpdate = 0;
    let lastInFrame = performance.now();

    const loop = () => {
      raf = requestAnimationFrame(loop);
      // rAF runs at screen rate (60–120 Hz); only process frames the camera actually produced.
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const start = performance.now();
      const result = landmarker.detectForVideo(video, start); // timestamps must keep increasing
      const now = performance.now();
      meter.tick(now, now - start);

      const landmarks = result.landmarks[0] ?? null;
      const world = result.worldLandmarks[0] ?? null;
      drawSkeleton(ctx, landmarks, canvas.width, canvas.height);

      const check = checkBodyInFrame(landmarks);
      if (check.ok) lastInFrame = now;

      const rec = recorderRef.current;
      if (rec && landmarks && !rec.push(now, landmarks, world)) stopRecordingRef.current();

      if (now - lastUiUpdate > UI_UPDATE_MS) {
        lastUiUpdate = now;
        setStats(meter.stats());
        setWarning(!check.ok && now - lastInFrame > WARNING_DELAY_MS ? check.message : null);
        if (rec) setElapsedMs(rec.elapsedMs(now));
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [live]);

  const mirrored = camera.facing === "user";
  const recording = phase === "recording";
  const showGate = !live;
  const cameraError = camera.status === "error" ? camera.error : null;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black select-none">
      {/* Same intrinsic size + same object-fit keeps the canvas aligned with the video. */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={cn("absolute inset-0 size-full object-cover md:object-contain", mirrored && "-scale-x-100")}
      />
      <canvas
        ref={canvasRef}
        className={cn("absolute inset-0 size-full object-cover md:object-contain", mirrored && "-scale-x-100")}
      />

      {/* Top bar */}
      <div className="pt-safe absolute inset-x-0 top-0 z-10 mx-auto flex max-w-[440px] items-center justify-between px-4">
        <Link href="/today" aria-label="Close" className={glassButton}>
          <XIcon className="size-5" />
        </Link>
        {live && (
          <span className="badge-text flex h-8 items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3.5 text-white/90 backdrop-blur-md tabular-nums">
            <span className={cn("size-2 rounded-full", recording ? "animate-pulse bg-danger" : "bg-white/50")} />
            {recording ? `Rec ${Math.floor(elapsedMs / 1000)}s` : "Live"} · 0 reps
          </span>
        )}
        <button
          type="button"
          aria-label="Switch camera"
          disabled={!live || phase !== "off"}
          onClick={() => camera.start(camera.facing === "user" ? "environment" : "user")}
          className={cn(glassButton, "disabled:opacity-40")}
        >
          <RefreshCwIcon className="size-[18px]" />
        </button>
      </div>

      {/* Debug panel */}
      {live && showDebug && (
        <div className="absolute top-[calc(max(env(safe-area-inset-top),12px)+56px)] left-4 z-10 rounded-tile border border-white/10 bg-black/60 px-3 py-2 font-mono text-[11px] leading-relaxed text-white/85 backdrop-blur-md">
          <div>
            fps <b className={stats.fps >= 25 ? "text-accent" : "text-danger"}>{stats.fps.toFixed(1)}</b>
          </div>
          <div>infer {stats.latencyMs.toFixed(1)} ms</div>
          <div>{delegate}</div>
          <div>
            {camera.size?.width}×{camera.size?.height}
          </div>
        </div>
      )}

      {/* Body-in-frame warning / save toast */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(max(env(safe-area-inset-top),12px)+64px)] z-10 flex justify-center px-6">
        <AnimatePresence mode="wait">
          {live && (warning || toast) && (
            <motion.p
              key={warning ?? toast}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              role="status"
              className={cn(
                "rounded-full border px-4 py-2 text-center text-[13px] font-bold backdrop-blur-md",
                warning ? "border-accent-border bg-black/60 text-accent" : "border-white/10 bg-black/60 text-white",
              )}
            >
              {warning ?? toast}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Countdown */}
      <AnimatePresence>
        {phase === "countdown" && countdown > 0 && (
          <motion.div
            key={countdown}
            initial={{ scale: 1.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-[120px] font-extrabold text-white [text-shadow:0_4px_30px_rgba(0,0,0,0.6)]"
          >
            {countdown}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom panel */}
      {live && (
        <div className="pb-safe absolute inset-x-0 bottom-0 z-10 mx-auto max-w-[440px] px-3">
          <div className="rounded-card border border-white/10 bg-black/55 p-4 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-[12px] font-semibold text-white/60">Reps</p>
                <p className="text-[56px] leading-none font-extrabold tracking-tight tabular-nums">0</p>
                <p className="mt-1 text-[12px] font-semibold text-muted">Rep counting arrives next</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDebug((d) => !d)}
                aria-pressed={showDebug}
                className={cn(
                  "badge-text flex h-8 items-center gap-1.5 rounded-full border px-3",
                  showDebug ? "border-accent-border bg-accent-tint text-accent" : "border-white/15 text-white/70",
                )}
              >
                <ActivityIcon className="size-3.5" />
                FPS
              </button>
              <Link
                href="/clips"
                aria-label="Recorded clips"
                className={cn(glassButton, phase !== "off" && "pointer-events-none opacity-40")}
              >
                <FilmIcon className="size-[18px]" />
              </Link>
              <RecordButton phase={phase} onClick={toggleRecording} />
            </div>
            <div className="mt-4 border-t border-white/10 pt-3">
              <RecorderSettings
                phase={phase}
                label={label}
                view={view}
                subject={subject}
                onLabel={setLabel}
                onView={setView}
                onSubject={changeSubject}
              />
            </div>
          </div>
        </div>
      )}

      <SaveClipSheet
        recording={pending}
        saving={saving}
        onSave={keepClip}
        onDiscard={() => setPending(null)}
      />

      {/* Start / loading / error gate */}
      {showGate && (
        <div className="absolute inset-0 z-20 mx-auto flex max-w-[440px] flex-col justify-end bg-black px-5">
          <div aria-hidden className="glow-warm pointer-events-none absolute inset-x-0 top-0 h-[520px]" />
          <div className="relative flex flex-1 flex-col items-center justify-center text-center">
            <span className="grid size-16 place-items-center rounded-full border border-accent-border bg-accent-tint text-accent">
              <CameraIcon className="size-7" strokeWidth={1.75} />
            </span>
            {cameraError ? (
              <>
                <h1 className="mt-5 text-[24px] font-extrabold tracking-tight">{CAMERA_ERROR_TEXT[cameraError].title}</h1>
                <p className="mt-2 max-w-[32ch] text-[14px] font-medium text-muted">{CAMERA_ERROR_TEXT[cameraError].text}</p>
              </>
            ) : model === "error" ? (
              <>
                <h1 className="mt-5 text-[24px] font-extrabold tracking-tight">Couldn&rsquo;t load the pose model</h1>
                <p className="mt-2 max-w-[32ch] text-[14px] font-medium text-muted">Check your connection and try again.</p>
              </>
            ) : model === "loading" || camera.status === "starting" ? (
              <>
                <h1 className="mt-5 text-[24px] font-extrabold tracking-tight">Getting ready…</h1>
                <p className="mt-2 max-w-[32ch] text-[14px] font-medium text-muted">
                  Loading the pose model. It runs on this device, so this only takes a moment.
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-5 text-[24px] font-extrabold tracking-tight">Ready when you are</h1>
                <p className="mt-2 max-w-[32ch] text-[14px] font-medium text-muted">
                  Prop your phone 2–3 m away with your whole body in view. Video stays on this device.
                </p>
              </>
            )}
          </div>
          <div className="pb-safe relative pt-6">
            <PrimaryButton
              onClick={begin}
              disabled={(model === "loading" || camera.status === "starting") && !cameraError}
            >
              {cameraError || model === "error" ? "Try again" : "Allow camera"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}

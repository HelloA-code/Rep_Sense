"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ActivityIcon, CameraIcon, FilmIcon, RefreshCwIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { SaveClipSheet, type PendingClip } from "@/components/clips/save-clip-sheet";
import { PrimaryButton } from "@/components/ui/button";
import { SegmentChip } from "@/components/ui/segment-chip";
import { iconButtonClass } from "@/components/ui/styles";
import { EXERCISES, type ExerciseId } from "@/lib/equipment";
import { EXERCISE_CONFIGS, type ExerciseConfig } from "@/lib/exercises";
import {
  createHoldTimer,
  createRepCounter,
  type HoldTimer,
  type RepCounter,
  type RepPhase,
} from "@/lib/exercises/state-machine";
import { drawSkeleton } from "@/lib/pose/draw";
import { createLandmarkSmoother } from "@/lib/pose/filters";
import { checkBodyInFrame } from "@/lib/pose/frame-check";
import { createFpsMeter, type FrameStats } from "@/lib/pose/fps";
import { getPoseLandmarker, type Delegate } from "@/lib/pose/landmarker";
import { pickSide, type Side } from "@/lib/pose/side";
import { saveClip } from "@/lib/recording/clip-store";
import { RECORDING_LABELS, createRecorder, type CameraView, type RecordingLabel } from "@/lib/recording/format";
import { cn } from "@/lib/utils";
import { AngleGraph, GRAPH_WINDOW_MS, type GraphSample } from "./angle-graph";
import { RecordButton, RecorderSettings, type RecorderPhase } from "./recorder-controls";
import { RepDisplay, formatClock } from "./rep-display";
import { CAMERA_ERROR_TEXT, useCamera } from "./use-camera";
import { pickVideoMimeType, startVideoRecording, type VideoRecording } from "./video-recorder";

type ModelStatus = "idle" | "loading" | "ready" | "error";
type Recorder = ReturnType<typeof createRecorder>;

const SUBJECT_KEY = "repsense.recorder.subject";
const EXERCISE_KEY = "repsense.workout.exercise";
const VIDEO_KEY = "repsense.recorder.video";
/** Only warn when the body has been out of frame for a moment, so it doesn't flicker. */
const WARNING_DELAY_MS = 700;
const UI_UPDATE_MS = 250;
/** Lost the person for longer than this: restart smoothing instead of gliding across the gap. */
const SMOOTHER_RESET_MS = 300;

const glassButton = cn(iconButtonClass, "border-white/15 bg-black/35 backdrop-blur-md");

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage blocked: not worth bothering the user
  }
}

function isExerciseId(v: string | null): v is ExerciseId {
  return EXERCISES.some((e) => e.id === v);
}

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

  // Exercise + counting. The frame loop reads refs; React state is what's on screen.
  const [exerciseId, setExerciseId] = useState<ExerciseId>("squat");
  const exercise = EXERCISE_CONFIGS[exerciseId];
  const exerciseRef = useRef<ExerciseConfig>(exercise);
  const counterRef = useRef<RepCounter | null>(null);
  const holdRef = useRef<HoldTimer | null>(null);
  const setStartRef = useRef<number | null>(null);
  const [count, setCount] = useState<{ reps: number; phase: RepPhase }>({ reps: 0, phase: "up" });
  const [hold, setHold] = useState({ holding: false, heldMs: 0 });
  const [setMs, setSetMs] = useState(0);
  const [setStarted, setSetStarted] = useState(false);
  const [metric, setMetric] = useState<{ raw: number | null; smooth: number | null; side: Side | null }>({
    raw: null,
    smooth: null,
    side: null,
  });
  const samplesRef = useRef<GraphSample[]>([]);

  // Recorder
  const [phase, setPhase] = useState<RecorderPhase>("off");
  const [countdown, setCountdown] = useState(3);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [label, setLabel] = useState<RecordingLabel>("squat");
  const [view, setView] = useState<CameraView>("side");
  const [subject, setSubject] = useState("");
  const [withVideo, setWithVideo] = useState<boolean | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const videoRecRef = useRef<VideoRecording | null>(null);
  const [pending, setPending] = useState<PendingClip | null>(null);
  const [saving, setSaving] = useState(false);

  /** New set: fresh counter/timer for the given exercise. */
  const resetSet = useCallback((ex: ExerciseConfig) => {
    exerciseRef.current = ex;
    counterRef.current = ex.mode === "reps" ? createRepCounter(ex.counter) : null;
    holdRef.current = ex.mode === "hold" ? createHoldTimer(ex.hold) : null;
    setStartRef.current = null;
    samplesRef.current = [];
    setCount({ reps: 0, phase: "up" });
    setHold({ holding: false, heldMs: 0 });
    setSetMs(0);
    setSetStarted(false);
  }, []);

  const changeExercise = useCallback(
    (id: ExerciseId) => {
      setExerciseId(id);
      setLabel(id);
      setView(EXERCISE_CONFIGS[id].preferredView);
      resetSet(EXERCISE_CONFIGS[id]);
      writeStorage(EXERCISE_KEY, id);
    },
    [resetSet],
  );

  // Restore last choices (browser-only APIs, so after mount).
  useEffect(() => {
    setSubject(readStorage(SUBJECT_KEY) ?? "");
    const saved = readStorage(EXERCISE_KEY);
    changeExercise(isExerciseId(saved) ? saved : "squat");
    setWithVideo(pickVideoMimeType() ? readStorage(VIDEO_KEY) !== "off" : null);
  }, [changeExercise]);

  function changeSubject(s: string) {
    setSubject(s);
    writeStorage(SUBJECT_KEY, s);
  }

  function changeWithVideo(v: boolean) {
    setWithVideo(v);
    writeStorage(VIDEO_KEY, v ? "on" : "off");
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

  const stopRecording = useCallback(async () => {
    const rec = recorderRef.current;
    const videoRec = videoRecRef.current;
    recorderRef.current = null;
    videoRecRef.current = null;
    setPhase("off");
    setElapsedMs(0);
    if (!rec) return;
    const data = rec.finish();
    const video = videoRec ? await videoRec.stop() : null;
    if (data.frameCount === 0) {
      setToast("Nothing saved: no body was detected.");
      return;
    }
    setPending({ recording: data, video });
  }, []);

  async function keepClip(clip: PendingClip) {
    setSaving(true);
    try {
      await saveClip(clip.recording, clip.video);
      const name = RECORDING_LABELS.find((l) => l.id === clip.recording.label)?.name ?? clip.recording.label;
      setToast(`${name} clip saved to Clips`);
      setPending(null);
    } catch {
      setToast("Couldn't save: storage is full or blocked in this browser.");
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
      void stopRecording();
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
      // Started on the same tick as the landmark clock, so landmark t ≈ video time.
      const stream = video?.srcObject;
      videoRecRef.current = withVideo && stream instanceof MediaStream ? startVideoRecording(stream) : null;
      setPhase("recording");
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, countdown, label, subject, view, camera.facing, withVideo]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // The frame loop: one detection per new video frame → smooth → measure → count → draw.
  // Per-frame data lives in refs/locals; React state is only touched ~4×/s (or on a rep).
  const live = camera.status === "live" && model === "ready";
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    const ctx = canvas?.getContext("2d");
    if (!live || !video || !canvas || !landmarker || !ctx) return;

    const meter = createFpsMeter();
    const smoother = createLandmarkSmoother();
    let side: Side | null = null;
    let raf = 0;
    let lastVideoTime = -1;
    let lastUiUpdate = 0;
    let lastInFrame = performance.now();
    let lastPose = 0;
    let shown: { reps: number; phase: RepPhase } = { reps: 0, phase: "up" };
    let shownCounter: RepCounter | null = null;

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

      const raw = result.landmarks[0] ?? null;
      const world = result.worldLandmarks[0] ?? null;

      let smooth = null;
      if (raw) {
        if (now - lastPose > SMOOTHER_RESET_MS) smoother.reset();
        lastPose = now;
        smooth = smoother.smooth(raw, now);
      }
      drawSkeleton(ctx, smooth, canvas.width, canvas.height);

      const check = checkBodyInFrame(raw);
      if (check.ok) lastInFrame = now;

      // Measure + count on the smoothed pose. The raw value is only for the debug graph.
      const ex = exerciseRef.current;
      let rawValue: number | null = null;
      let smoothValue: number | null = null;
      if (raw && smooth) {
        side = pickSide(smooth, side);
        const frame = { lm: smooth, width: canvas.width, height: canvas.height, side };
        smoothValue = ex.measure(frame);
        rawValue = ex.measure({ ...frame, lm: raw });

        const counter = counterRef.current;
        if (ex.mode === "reps" && counter && smoothValue !== null) {
          if (counter !== shownCounter) {
            shownCounter = counter; // the set was reset
            shown = { reps: 0, phase: "up" };
          }
          const s = counter.update(smoothValue, now, ex.goal ? ex.goal(frame) : true);
          if (s.phase === "down" && setStartRef.current === null) setStartRef.current = now;
          if (s.reps !== shown.reps || s.phase !== shown.phase) {
            shown = { reps: s.reps, phase: s.phase };
            setCount(shown);
          }
        }
      }
      if (ex.mode === "hold" && holdRef.current) {
        const h = holdRef.current.update(smoothValue, now);
        if (h.holding && setStartRef.current === null) setStartRef.current = now;
      }

      const samples = samplesRef.current;
      samples.push({ t: now, raw: rawValue, smooth: smoothValue });
      while (samples.length && now - samples[0].t > GRAPH_WINDOW_MS) samples.shift();

      const rec = recorderRef.current;
      if (rec && raw && !rec.push(now, raw, world)) void stopRecordingRef.current(); // record raw, not smoothed

      if (now - lastUiUpdate > UI_UPDATE_MS) {
        lastUiUpdate = now;
        setStats(meter.stats());
        setWarning(!check.ok && now - lastInFrame > WARNING_DELAY_MS ? check.message : null);
        if (rec) setElapsedMs(rec.elapsedMs(now));
        setSetMs(setStartRef.current === null ? 0 : now - setStartRef.current);
        setSetStarted(setStartRef.current !== null);
        if (holdRef.current) setHold(holdRef.current.state);
        setMetric({ raw: rawValue, smooth: smoothValue, side });
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

  const isHold = exercise.mode === "hold";
  const displayValue = isHold ? Math.floor(hold.heldMs / 1000) : count.reps;
  const phaseText = isHold
    ? hold.holding
      ? "Holding"
      : setStarted
        ? "Paused"
        : "Get in position"
    : exercise.phaseLabel[count.phase];
  const pillCount = isHold ? formatClock(hold.heldMs) : `${count.reps} ${count.reps === 1 ? "rep" : "reps"}`;
  const graphLines =
    exercise.mode === "reps" ? [exercise.counter.downBelow, exercise.counter.upAbove] : [exercise.hold.maxDeviation];

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
      <div className="pt-safe absolute inset-x-0 top-0 z-10 mx-auto flex max-w-[440px] items-center justify-between gap-2 px-4">
        <Link href="/today" aria-label="Close" className={glassButton}>
          <XIcon className="size-5" />
        </Link>
        {live && (
          <span className="badge-text flex h-8 items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3.5 text-white/90 backdrop-blur-md tabular-nums">
            <span className={cn("size-2 rounded-full", recording ? "animate-pulse bg-danger" : "bg-white/50")} />
            {recording ? `Rec ${Math.floor(elapsedMs / 1000)}s` : "Live"} · {pillCount}
          </span>
        )}
        <div className="flex gap-2">
          {live && (
            <button
              type="button"
              aria-label="Debug panel"
              aria-pressed={showDebug}
              onClick={() => setShowDebug((d) => !d)}
              className={cn(glassButton, showDebug && "border-accent-border text-accent")}
            >
              <ActivityIcon className="size-[18px]" />
            </button>
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
      </div>

      {/* Debug panel: performance + raw vs smoothed metric */}
      {live && showDebug && (
        <div className="absolute top-[calc(max(env(safe-area-inset-top),12px)+56px)] left-4 z-10 rounded-tile border border-white/10 bg-black/60 px-3 py-2 font-mono text-[11px] leading-relaxed text-white/85 backdrop-blur-md">
          <div>
            fps <b className={stats.fps >= 25 ? "text-accent" : "text-danger"}>{stats.fps.toFixed(1)}</b> · infer{" "}
            {stats.latencyMs.toFixed(1)} ms
          </div>
          <div>
            {delegate} · {camera.size?.width}×{camera.size?.height} · side {metric.side ?? "–"}
          </div>
          <div>
            {exercise.metric.toLowerCase()} <span className="text-white/50">raw {metric.raw?.toFixed(0) ?? "–"}°</span>{" "}
            <b className="text-accent">smooth {metric.smooth?.toFixed(0) ?? "–"}°</b>
          </div>
          <div className="mt-1">
            <AngleGraph samples={samplesRef} lines={graphLines} min={0} max={isHold ? 45 : 180} />
          </div>
        </div>
      )}

      {/* Body-in-frame warning / save toast */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(max(env(safe-area-inset-top),12px)+64px)] z-10 flex justify-center px-6">
        <AnimatePresence mode="wait">
          {live && !showDebug && (warning || toast) && (
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
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {EXERCISES.map((e) => (
                <SegmentChip
                  key={e.id}
                  selected={exerciseId === e.id}
                  onClick={() => changeExercise(e.id)}
                  className="h-9 flex-none px-3.5 text-[13px]"
                >
                  {e.name}
                </SegmentChip>
              ))}
            </div>
            <p className="mt-2 text-[12px] font-semibold text-muted">
              {exercise.setupHint}
              {metric.smooth !== null && ` · ${exercise.metric} ${metric.smooth.toFixed(0)}°`}
            </p>

            <div className="mt-3 flex items-center gap-3">
              <RepDisplay
                value={displayValue}
                mode={exercise.mode}
                phase={phaseText}
                active={isHold ? hold.holding : count.phase === "down"}
                setMs={setMs}
              />
              <button type="button" aria-label="Reset set" onClick={() => resetSet(exercise)} className={glassButton}>
                <RotateCcwIcon className="size-[18px]" />
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

            <details className="group mt-3 border-t border-white/10 pt-3">
              <summary className="cursor-pointer list-none text-[12px] font-semibold text-muted">
                Recording settings · {RECORDING_LABELS.find((l) => l.id === label)?.name} · {view}
                {withVideo ? " · video" : ""}
                <span className="ml-1 inline-block transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div className="mt-3">
                <RecorderSettings
                  phase={phase}
                  label={label}
                  view={view}
                  subject={subject}
                  withVideo={withVideo}
                  onLabel={setLabel}
                  onView={setView}
                  onSubject={changeSubject}
                  onWithVideo={changeWithVideo}
                />
              </div>
            </details>
          </div>
        </div>
      )}

      <SaveClipSheet clip={pending} saving={saving} onSave={keepClip} onDiscard={() => setPending(null)} />

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
                  Prop your phone 2–3 m away with your whole body in view. Video never leaves this device.
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

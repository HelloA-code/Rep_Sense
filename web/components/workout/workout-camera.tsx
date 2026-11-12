"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ActivityIcon,
  CameraIcon,
  FilmIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SparklesIcon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
} from "lucide-react";
import { SaveClipSheet, type PendingClip } from "@/components/clips/save-clip-sheet";
import { PrimaryButton } from "@/components/ui/button";
import { SegmentChip } from "@/components/ui/segment-chip";
import { iconButtonClass } from "@/components/ui/styles";
import { EXERCISES, type ExerciseId } from "@/lib/equipment";
import { ExerciseChooser } from "./exercise-chooser";
import { EXERCISE_CONFIGS, type ExerciseConfig } from "@/lib/exercises";
import type { RepPhase } from "@/lib/exercises/state-machine";
import { createAutoDetector } from "@/lib/ml/auto-detect";
import { loadClassifier, loadModelInfo, type Classifier, type ModelInfo } from "@/lib/ml/classifier";
import { createRollingWindow } from "@/lib/ml/rolling-window";
import { drawIssues, drawSkeleton } from "@/lib/pose/draw";
import { checkBodyInFrame } from "@/lib/pose/frame-check";
import { createFpsMeter, type FrameStats } from "@/lib/pose/fps";
import { getPoseLandmarker, type Delegate } from "@/lib/pose/landmarker";
import type { Side } from "@/lib/pose/side";
import { saveClip } from "@/lib/recording/clip-store";
import { RECORDING_LABELS, createRecorder, type CameraView, type RecordingLabel } from "@/lib/recording/format";
import { cn } from "@/lib/utils";
import { createSetEngine, type SetEngine, type SetResult } from "@/lib/workout/set-engine";
import { AngleGraph, GRAPH_WINDOW_MS, type GraphSample } from "./angle-graph";
import { AutoDetectBar, type AutoStatus } from "./auto-detect-bar";
import { PlacementTip } from "./placement-tip";
import { RecordButton, RecorderSettings, type RecorderPhase } from "./recorder-controls";
import { RepDisplay, formatClock, type RepFlash } from "./rep-display";
import { CAMERA_ERROR_TEXT, useCamera } from "./use-camera";
import { pickVideoMimeType, startVideoRecording, type VideoRecording } from "./video-recorder";
import { loadVoiceOn, saveVoiceOn, speak, stopVoice, unlockVoice, voiceSupported } from "./voice";

type ModelStatus = "idle" | "loading" | "ready" | "error";
type Recorder = ReturnType<typeof createRecorder>;

/** Guided workout: the flow drives which set is running and gets the result back. */
export type GuidedSet = {
  /** New value = a new set: shows the tip (first set of an exercise) or the countdown again. */
  key: string;
  exerciseId: ExerciseId;
  /** "Set 2 of 3" */
  title: string;
  showTip: boolean;
  /** True while the set-logging screen is on top: stop detecting to save battery. */
  paused: boolean;
  onFinish: (result: SetResult) => void;
  onExit: () => void;
};

/** tip → countdown → active → done (guided). Free mode is always "active". */
type Stage = "tip" | "countdown" | "active" | "done";

const SUBJECT_KEY = "repsense.recorder.subject";
const EXERCISE_KEY = "repsense.workout.exercise";
const VIDEO_KEY = "repsense.recorder.video";
/** Only warn when the body has been out of frame for a moment, so it doesn't flicker. */
const WARNING_DELAY_MS = 700;
const UI_UPDATE_MS = 250;
const CUE_TOAST_MS = 2200;
/** Run the classifier every this many 15 Hz ticks (three times a second). */
const CLASSIFY_EVERY_TICKS = 5;
/** Leave this much idle time per unit of detection time, to keep the UI responsive. */
const DETECT_IDLE_RATIO = 0.5;

const glassButton = cn(iconButtonClass, "border-white/15 bg-black/60");

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

export function WorkoutCamera({ guided }: { guided?: GuidedSet }) {
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
  const [freeExerciseId, setFreeExerciseId] = useState<ExerciseId>("squat");
  const exerciseId = guided?.exerciseId ?? freeExerciseId;
  const exercise = EXERCISE_CONFIGS[exerciseId];
  const engineRef = useRef<SetEngine | null>(null);
  const setStartRef = useRef<number | null>(null);
  const [stage, setStage] = useState<Stage>(guided ? (guided.showTip ? "tip" : "countdown") : "active");
  const stageRef = useRef(stage);
  const pausedRef = useRef(guided?.paused ?? false);
  const [goCount, setGoCount] = useState(3);
  const [count, setCount] = useState<{ reps: number; phase: RepPhase }>({ reps: 0, phase: "up" });
  const [hold, setHold] = useState({ holding: false, heldMs: 0 });
  const [setMs, setSetMs] = useState(0);
  const [setStarted, setSetStarted] = useState(false);
  const [metric, setMetric] = useState<{
    raw: number | null;
    smooth: number | null;
    side: Side | null;
    view: CameraView | null;
  }>({ raw: null, smooth: null, side: null, view: null });
  const samplesRef = useRef<GraphSample[]>([]);
  const [cue, setCue] = useState<{ text: string; key: number } | null>(null);
  const [flash, setFlash] = useState<RepFlash | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const voiceOnRef = useRef(true);

  // Auto-detect ("just start moving"): free mode only, and only if a model is available.
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [auto, setAuto] = useState<AutoStatus | null>(null);
  const [inferMs, setInferMs] = useState<number | null>(null);
  const classifierRef = useRef<Classifier | null>(null);
  const rollingRef = useRef(createRollingWindow());
  const detectorRef = useRef(createAutoDetector());
  const onDetectedRef = useRef<(id: ExerciseId) => void>(() => {});

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

  const changeStage = useCallback((s: Stage) => {
    stageRef.current = s;
    setStage(s);
  }, []);

  /** New set: fresh engine (counter, timer, form tracker) for the given exercise. */
  const resetSet = useCallback((ex: ExerciseConfig | null) => {
    engineRef.current = ex ? createSetEngine(ex) : null;
    setStartRef.current = null;
    samplesRef.current = [];
    setCount({ reps: 0, phase: "up" });
    setHold({ holding: false, heldMs: 0 });
    setSetMs(0);
    setSetStarted(false);
    setFlash(null);
  }, []);

  const changeExercise = useCallback(
    (id: ExerciseId) => {
      setFreeExerciseId(id);
      setLabel(id);
      setView(EXERCISE_CONFIGS[id].preferredView);
      resetSet(EXERCISE_CONFIGS[id]);
      writeStorage(EXERCISE_KEY, id);
    },
    [resetSet],
  );

  const pickExercise = useCallback(
    (id: ExerciseId) => {
      setAuto(null);
      classifierRef.current = null;
      detectorRef.current.setCurrent(id);
      changeExercise(id);
    },
    [changeExercise],
  );

  useEffect(() => {
    onDetectedRef.current = changeExercise;
  }, [changeExercise]);

  async function turnOnAuto() {
    setAuto({ state: "loading" });
    try {
      classifierRef.current = await loadClassifier();
      rollingRef.current.reset();
      detectorRef.current.setCurrent(null);
      setAuto({ state: "watching" });
    } catch {
      setAuto(null);
      setToast("Couldn't load auto-detect on this device.");
    }
  }

  useEffect(() => {
    if (!guided) void loadModelInfo().then(setModelInfo);
  }, [guided]);

  // Restore last choices (browser-only APIs, so after mount).
  useEffect(() => {
    setSubject(readStorage(SUBJECT_KEY) ?? "");
    setWithVideo(pickVideoMimeType() ? readStorage(VIDEO_KEY) !== "off" : null);
    const v = voiceSupported() && loadVoiceOn();
    setVoiceOn(v);
    voiceOnRef.current = v;
    if (!guided) {
      const saved = readStorage(EXERCISE_KEY);
      changeExercise(isExerciseId(saved) ? saved : "squat");
    }
    return stopVoice;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only; `guided` changes are handled below
  }, [changeExercise]);

  // Guided: every new set key restarts the tip/countdown; nothing counts until "active".
  const guidedKey = guided?.key;
  const guidedTip = guided?.showTip;
  useEffect(() => {
    if (guidedKey === undefined) return;
    resetSet(null);
    changeStage(guidedTip ? "tip" : "countdown");
    setGoCount(3);
  }, [guidedKey, guidedTip, resetSet, changeStage]);

  useEffect(() => {
    pausedRef.current = guided?.paused ?? false;
  }, [guided?.paused]);

  // Set countdown 3-2-1 → go. Then a fresh engine starts measuring.
  useEffect(() => {
    if (stage !== "countdown") return;
    if (goCount === 0) {
      resetSet(exercise);
      setStartRef.current = performance.now();
      changeStage("active");
      if (voiceOnRef.current) speak("Go");
      return;
    }
    if (voiceOnRef.current) speak(String(goCount));
    const id = setTimeout(() => setGoCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [stage, goCount, exercise, resetSet, changeStage]);

  function startGuidedSet() {
    unlockVoice(); // iOS: must happen inside a tap
    setGoCount(3);
    changeStage("countdown");
  }

  function finishGuidedSet() {
    const engine = engineRef.current;
    if (!guided || !engine) return;
    const result = engine.finish(performance.now());
    engineRef.current = null;
    changeStage("done");
    stopVoice();
    guided.onFinish(result);
  }

  function exitGuided() {
    if (!guided) return;
    if (window.confirm("End this workout? Sets you haven't finished won't be kept.")) guided.onExit();
  }

  function toggleVoice() {
    const v = !voiceOn;
    setVoiceOn(v);
    voiceOnRef.current = v;
    saveVoiceOn(v);
    if (v) {
      unlockVoice();
      speak("Voice on");
    } else stopVoice();
  }

  function changeSubject(s: string) {
    setSubject(s);
    writeStorage(SUBJECT_KEY, s);
  }

  function changeWithVideo(v: boolean) {
    setWithVideo(v);
    writeStorage(VIDEO_KEY, v ? "on" : "off");
  }

  async function begin() {
    unlockVoice();
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

  // Recorder 3-2-1, then start capturing.
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

  useEffect(() => {
    if (!cue) return;
    const id = setTimeout(() => setCue(null), CUE_TOAST_MS);
    return () => clearTimeout(id);
  }, [cue]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(id);
  }, [flash]);

  // The frame loop: detect → set engine (smooth, count, form) → draw skeleton + red rings.
  // Per-frame data lives in refs/locals; React state is touched ~4×/s, or on a rep/cue.
  const live = camera.status === "live" && model === "ready";
  const mirrored = camera.facing === "user";
  const mirroredRef = useRef(mirrored);
  useEffect(() => {
    mirroredRef.current = mirrored;
  }, [mirrored]);

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
    let shown: { reps: number; phase: RepPhase } = { reps: 0, phase: "up" };
    let shownEngine: SetEngine | null = null;
    let ticks = 0;
    let classifying = false;
    let lastDetectMs = 0;
    let lastDetectEnd = 0;

    // Async and skipped if the last one is still running, so it can never slow the camera.
    const classify = (classifier: Classifier) => {
      classifying = true;
      const started = performance.now();
      void classifier
        .predict(rollingRef.current.values())
        .then((probabilities) => {
          if (!classifierRef.current) return; // turned off meanwhile
          setInferMs(performance.now() - started);
          const detection = detectorRef.current.update(probabilities);
          setAuto({ state: "detected", label: detection.label, confidence: detection.confidence });
          if (detection.switchTo) onDetectedRef.current(detection.switchTo);
        })
        .finally(() => {
          classifying = false;
        });
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (pausedRef.current) return;
      // rAF runs at screen rate (60–120 Hz); only process frames the camera actually produced.
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
      // Detection runs on the main thread. On a slow phone, skip frames so taps and
      // animations still get time; counting works fine at a lower rate.
      if (performance.now() - lastDetectEnd < lastDetectMs * DETECT_IDLE_RATIO) return;
      lastVideoTime = video.currentTime;

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const start = performance.now();
      const result = landmarker.detectForVideo(video, start); // timestamps must keep increasing
      const now = performance.now();
      meter.tick(now, now - start);
      lastDetectMs = now - start;
      lastDetectEnd = now;

      const raw = result.landmarks[0] ?? null;
      const world = result.worldLandmarks[0] ?? null;
      const check = checkBodyInFrame(raw);
      if (check.ok) lastInFrame = now;

      const engine = stageRef.current === "active" ? engineRef.current : null;
      if (engine !== shownEngine) {
        shownEngine = engine; // the set was reset
        shown = { reps: 0, phase: "up" };
      }
      const out = engine ? engine.process(raw, now, canvas.width, canvas.height) : null;

      drawSkeleton(ctx, out ? out.smooth : raw, canvas.width, canvas.height);
      if (out) drawIssues(ctx, out.smooth, out.issues, canvas.width, canvas.height, mirroredRef.current);

      if (out) {
        if (setStartRef.current === null && (out.phase === "down" || out.holding)) setStartRef.current = now;
        if (out.reps !== shown.reps || out.phase !== shown.phase) {
          shown = { reps: out.reps, phase: out.phase };
          setCount(shown);
        }
        for (const ev of out.events) {
          if (ev.type === "cue") {
            setCue({ text: ev.text, key: now });
            if (voiceOnRef.current) speak(ev.text);
          } else if (ev.type === "rep") {
            setFlash({ score: ev.score, key: now });
          }
        }
        const samples = samplesRef.current;
        samples.push({ t: now, raw: out.rawValue, smooth: out.value });
        while (samples.length && now - samples[0].t > GRAPH_WINDOW_MS) samples.shift();
      }

      const classifier = classifierRef.current;
      if (classifier && raw) {
        // Raw landmarks: that's what the model was trained on.
        ticks += rollingRef.current.push({ landmarks: raw, width: canvas.width, height: canvas.height }, now);
        if (rollingRef.current.full && ticks >= CLASSIFY_EVERY_TICKS && !classifying) {
          ticks = 0;
          classify(classifier);
        }
      }

      const rec = recorderRef.current;
      if (rec && raw && !rec.push(now, raw, world)) void stopRecordingRef.current(); // record raw, not smoothed

      if (now - lastUiUpdate > UI_UPDATE_MS) {
        lastUiUpdate = now;
        setStats(meter.stats());
        setWarning(!check.ok && now - lastInFrame > WARNING_DELAY_MS ? check.message : null);
        if (rec) setElapsedMs(rec.elapsedMs(now));
        setSetMs(setStartRef.current === null ? 0 : now - setStartRef.current);
        setSetStarted(setStartRef.current !== null);
        if (out) {
          setHold({ holding: out.holding, heldMs: out.heldMs });
          setMetric({ raw: out.rawValue, smooth: out.value, side: out.side, view: out.view });
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [live]);

  const recording = phase === "recording";
  const showGate = !live;
  const cameraError = camera.status === "error" ? camera.error : null;

  const isHold = exercise.mode === "hold";
  const displayValue = isHold ? Math.floor(hold.heldMs / 1000) : count.reps;
  const waiting = guided && stage !== "active";
  const phaseText = waiting
    ? "Get ready"
    : isHold
      ? hold.holding
        ? "Holding"
        : setStarted
          ? "Paused"
          : "Get in position"
      : exercise.phaseLabel[count.phase];
  const pillCount = isHold ? formatClock(hold.heldMs) : `${count.reps} ${count.reps === 1 ? "rep" : "reps"}`;
  const graphLines =
    exercise.mode === "reps" ? [exercise.counter.downBelow, exercise.counter.upAbove] : [exercise.hold.maxDeviation];
  const topMessage = warning ?? (cue ? cue.text : toast);

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
        {guided ? (
          <button type="button" aria-label="End workout" onClick={exitGuided} className={glassButton}>
            <XIcon className="size-5" />
          </button>
        ) : (
          <Link href="/today" aria-label="Close" className={glassButton}>
            <XIcon className="size-5" />
          </Link>
        )}
        {live && (
          <span className="badge-text flex h-8 items-center gap-2 rounded-full border border-white/10 bg-black/65 px-3.5 text-white/90 tabular-nums">
            <span className={cn("size-2 rounded-full", recording ? "animate-pulse bg-danger" : "bg-white/50")} />
            {recording ? `Rec ${Math.floor(elapsedMs / 1000)}s` : "Live"} · {pillCount}
          </span>
        )}
        <div className="flex gap-2">
          {live && voiceSupported() && (
            <button
              type="button"
              aria-label={voiceOn ? "Mute voice cues" : "Turn on voice cues"}
              aria-pressed={voiceOn}
              onClick={toggleVoice}
              className={glassButton}
            >
              {voiceOn ? <Volume2Icon className="size-[18px]" /> : <VolumeXIcon className="size-[18px]" />}
            </button>
          )}
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
        <div className="absolute top-[calc(max(env(safe-area-inset-top),12px)+56px)] left-4 z-10 rounded-tile border border-white/10 bg-black/75 px-3 py-2 font-mono text-[11px] leading-relaxed text-white/85">
          <div>
            fps <b className={stats.fps >= 25 ? "text-accent" : "text-danger"}>{stats.fps.toFixed(1)}</b> · infer{" "}
            {stats.latencyMs.toFixed(1)} ms
          </div>
          <div>
            {delegate} · {camera.size?.width}×{camera.size?.height}
            {inferMs !== null && auto && ` · model ${inferMs.toFixed(1)} ms`}
          </div>
          <div>
            side {metric.side ?? "–"} · view {metric.view ?? "–"}
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

      {/* Body-in-frame warning / form cue / save toast */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(max(env(safe-area-inset-top),12px)+64px)] z-10 flex justify-center px-6">
        <AnimatePresence mode="wait">
          {live && !showDebug && topMessage && (
            <motion.p
              key={warning ?? (cue ? `cue-${cue.key}` : toast)}
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              role="status"
              className={cn(
                "rounded-full border px-4 py-2 text-center font-bold",
                warning
                  ? "border-accent-border bg-black/60 text-[13px] text-accent"
                  : cue
                    ? "border-danger/60 bg-danger/90 text-[15px] text-white"
                    : "border-white/10 bg-black/60 text-[13px] text-white",
              )}
            >
              {topMessage}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Countdown (recorder or set) */}
      <AnimatePresence>
        {((phase === "countdown" && countdown > 0) || (stage === "countdown" && goCount > 0)) && (
          <motion.div
            key={phase === "countdown" ? `r${countdown}` : `s${goCount}`}
            initial={{ scale: 1.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-[120px] font-extrabold text-white [text-shadow:0_4px_30px_rgba(0,0,0,0.6)]"
          >
            {phase === "countdown" ? countdown : goCount}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom panel */}
      {live && (
        <div className="pb-safe absolute inset-x-0 bottom-0 z-10 mx-auto max-w-[440px] px-3">
          <div className="rounded-card border border-white/10 bg-black/75 p-4">
            {guided ? (
              <p className="flex items-baseline justify-between gap-3">
                <span className="text-[16px] font-extrabold">{exercise.name}</span>
                <span className="text-[13px] font-semibold text-muted">{guided.title}</span>
              </p>
            ) : (
              <ExerciseChooser
                value={exerciseId}
                onChange={pickExercise}
                noneSelected={auto !== null}
                leading={
                  modelInfo && (
                    <SegmentChip
                      selected={auto !== null}
                      onClick={() => (auto ? pickExercise(exerciseId) : void turnOnAuto())}
                      className="h-8 flex-none gap-1.5 px-3 text-[12px]"
                    >
                      <span className="flex items-center gap-1.5">
                        <SparklesIcon className="size-3.5" />
                        Auto
                      </span>
                    </SegmentChip>
                  )
                }
              />
            )}
            {auto && <AutoDetectBar status={auto} synthetic={modelInfo?.provenance === "synthetic"} exercise={exercise.name} />}
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
                flash={flash}
              />
              {guided ? (
                <PrimaryButton onClick={finishGuidedSet} disabled={stage !== "active"} className="w-auto px-6">
                  Finish set
                </PrimaryButton>
              ) : (
                <>
                  <button
                    type="button"
                    aria-label="Reset set"
                    onClick={() => resetSet(exercise)}
                    className={glassButton}
                  >
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
                </>
              )}
            </div>

            {!guided && (
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
            )}
          </div>
        </div>
      )}

      {live && guided && stage === "tip" && <PlacementTip exercise={exercise} onStart={startGuidedSet} />}

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
          <div className="pb-safe relative flex flex-col gap-3 pt-6">
            <PrimaryButton
              onClick={begin}
              disabled={(model === "loading" || camera.status === "starting") && !cameraError}
            >
              {cameraError || model === "error" ? "Try again" : "Allow camera"}
            </PrimaryButton>
            {guided && (
              <button type="button" onClick={guided.onExit} className="py-2 text-[14px] font-semibold text-muted">
                Back to exercises
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

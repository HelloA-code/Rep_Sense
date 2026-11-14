"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraIcon, RotateCcwIcon, SparklesIcon } from "lucide-react";
import { AppShell } from "@/components/ui/app-shell";
import { PrimaryButton, SecondaryButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/styles";
import { TopBar } from "@/components/ui/top-bar";
import { CAMERA_ERROR_TEXT, useCamera } from "@/components/workout/use-camera";
import { saveCustomExercise } from "@/lib/data/sync";
import { MAX_NAME_LENGTH, customFromTeach } from "@/lib/exercises/custom";
import type { AnyExerciseId } from "@/lib/exercises/ids";
import { exerciseInfo } from "@/lib/exercises/library";
import { analyseTeach, type TeachFrame, type TeachResult, type TeachSuccess } from "@/lib/exercises/teach";
import { drawIssues, drawSkeleton } from "@/lib/pose/draw";
import { getPoseLandmarker } from "@/lib/pose/landmarker";
import { cn } from "@/lib/utils";
import { loadPlan, savePlan } from "@/lib/workout/plan-store";

// Teach a rep: record ~3 reps, find the joint that moves, name it, save. Its own small
// camera loop (detect → draw → collect frames) so the workout camera stays as it is.

type Stage = "intro" | "live" | "countdown" | "recording" | "result";

const MAX_RECORDING_MS = 20_000;

const SIGNAL_TEXT: Record<TeachSuccess["signal"], string> = {
  elbow: "your elbow bending",
  knee: "your knee bending",
  hip: "your hip bending",
  shoulder: "your arm lifting at the shoulder",
  "wrist-spread": "your hands moving apart and together",
  "knee-spread": "your knees moving apart and together",
};

/** The counted value over the recording, with the two threshold lines. */
function TraceChart({ result }: { result: TeachSuccess }) {
  const points = result.trace.filter((p): p is { t: number; value: number } => p.value !== null);
  if (points.length < 2) return null;
  const tMax = points[points.length - 1].t || 1;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values, result.counter.downBelow);
  const hi = Math.max(...values, result.counter.upAbove);
  const y = (v: number) => 90 - ((v - lo) / (hi - lo || 1)) * 80;
  const line = points.map((p) => `${((p.t / tMax) * 300).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 300 100" className="mt-3 h-24 w-full" role="img" aria-label="Your movement over the recording">
      {[result.counter.upAbove, result.counter.downBelow].map((v) => (
        <line key={v} x1="0" x2="300" y1={y(v)} y2={y(v)} stroke="var(--color-muted)" strokeDasharray="4 4" strokeWidth="1" />
      ))}
      <polyline points={line} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

/** The pose at the bottom of a rep, with the counted joint ringed. */
function BottomPose({ result, width, height }: { result: TeachSuccess; width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !result.bottomPose) return;
    drawSkeleton(ctx, result.bottomPose, width, height);
    drawIssues(ctx, result.bottomPose, [{ cue: "", joints: result.joints }], width, height, true);
  }, [result, width, height]);
  if (!result.bottomPose) return null;
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      aria-label="Your position at the bottom of a rep, with the counted joint circled"
      className="mt-3 aspect-video w-full -scale-x-100 rounded-tile border border-border bg-black object-contain"
    />
  );
}

export function TeachCamera({ forId }: { forId?: string }) {
  // Teaching a library exercise ("Tap to teach"): its name is known, and it keeps its own id.
  const target = forId ? exerciseInfo(forId) : undefined;
  const library = target && target.tracking === "teach" ? target : undefined;
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camera = useCamera(videoRef);
  const landmarkerRef = useRef<Awaited<ReturnType<typeof getPoseLandmarker>>["landmarker"] | null>(null);
  const [modelError, setModelError] = useState(false);

  const [stage, setStage] = useState<Stage>("intro");
  const stageRef = useRef(stage);
  const [goCount, setGoCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const framesRef = useRef<TeachFrame[]>([]);
  const startRef = useRef(0);
  const [result, setResult] = useState<TeachResult | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 1280, height: 720 });
  const [name, setName] = useState(library?.name ?? "");
  const [saving, setSaving] = useState(false);

  const changeStage = useCallback((s: Stage) => {
    stageRef.current = s;
    setStage(s);
  }, []);

  async function begin() {
    setModelError(false);
    const loading = getPoseLandmarker(); // downloads while the permission prompt is open
    await camera.start("user");
    try {
      landmarkerRef.current = (await loading).landmarker;
      changeStage("live");
    } catch {
      setModelError(true);
    }
  }

  const finish = useCallback(() => {
    const canvas = canvasRef.current;
    const size = { width: canvas?.width || 1280, height: canvas?.height || 720 };
    setFrameSize(size);
    setResult(analyseTeach(framesRef.current, size.width, size.height));
    changeStage("result");
  }, [changeStage]);

  // 3-2-1, then record.
  useEffect(() => {
    if (stage !== "countdown") return;
    if (goCount === 0) {
      framesRef.current = [];
      startRef.current = performance.now();
      changeStage("recording");
      return;
    }
    const id = setTimeout(() => setGoCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [stage, goCount, changeStage]);

  // Detect → draw → collect frames while recording.
  const live = camera.status === "live" && landmarkerRef.current !== null && stage !== "intro";
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    const ctx = canvas?.getContext("2d");
    if (!live || !video || !canvas || !landmarker || !ctx) return;
    let raf = 0;
    let lastVideoTime = -1;
    let lastUi = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const now = performance.now();
      const pose = landmarker.detectForVideo(video, now).landmarks[0] ?? null;
      drawSkeleton(ctx, pose, canvas.width, canvas.height);
      if (stageRef.current !== "recording") return;
      const t = now - startRef.current;
      if (pose) framesRef.current.push({ t, landmarks: pose });
      if (now - lastUi > 250) {
        lastUi = now;
        setElapsed(t);
      }
      if (t >= MAX_RECORDING_MS) finish();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [live, finish]);

  function startRecording() {
    setGoCount(3);
    setElapsed(0);
    changeStage("countdown");
  }

  function retry() {
    setResult(null);
    changeStage("live");
  }

  async function save() {
    if (!result?.ok || !name.trim()) return;
    setSaving(true);
    const exercise = customFromTeach(name, result, new Date(), library?.id);
    void saveCustomExercise(exercise); // stored on this device now; uploads in the background
    // Picked in the workout straight away: by its library id when taught for one.
    const picked = (library?.id ?? exercise.id) as AnyExerciseId;
    const plan = loadPlan();
    const kept = (plan?.exercises ?? []).filter((id) => id !== picked);
    savePlan({ exercises: [...kept, picked], sets: plan?.sets ?? 3 });
    camera.stop();
    router.push("/workout");
  }

  const cameraError = camera.status === "error" && camera.error ? CAMERA_ERROR_TEXT[camera.error] : null;
  const showCamera = stage === "live" || stage === "countdown" || stage === "recording";

  return (
    <AppShell>
      <TopBar title={library ? `Teach: ${library.name}` : "Teach an exercise"} backHref="/workout" />

      {stage === "intro" && (
        <div className="flex flex-1 flex-col">
          <p className="-mt-1 text-[14px] font-medium text-muted">
            Show the app 3 reps of any exercise. It finds the joint that moves and counts it from then on. Nothing is
            recorded or uploaded: only the counting rule is saved.
          </p>
          <Card className="mt-5 p-5">
            <ol className="flex flex-col gap-3 text-[14px] font-semibold">
              <li>1. Put your phone 2–3 m away, so the moving part of your body is clearly in view.</li>
              <li>2. Start in your normal starting position.</li>
              <li>3. Do 3 slow, full reps with a short pause at the start of each.</li>
            </ol>
          </Card>
          {cameraError && (
            <p className="mt-4 text-[13px] font-semibold text-danger">
              {cameraError.title}. {cameraError.text}
            </p>
          )}
          {modelError && (
            <p className="mt-4 text-[13px] font-semibold text-danger">Couldn&rsquo;t load body tracking. Try again.</p>
          )}
          <div className="mt-auto pt-8 pb-8">
            <PrimaryButton onClick={() => void begin()} disabled={camera.status === "starting"}>
              <CameraIcon className="size-5" />
              {camera.status === "starting" ? "Starting camera…" : "Allow camera"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* Always mounted (the camera hook needs the <video>); only one display class at a time. */}
      <div className={cn("flex-1 flex-col", showCamera ? "flex" : "hidden")}>
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-card border border-border bg-black">
          <video ref={videoRef} playsInline muted className="absolute inset-0 size-full -scale-x-100 object-cover" />
          <canvas ref={canvasRef} className="absolute inset-0 size-full -scale-x-100 object-cover" />
          {stage === "countdown" && (
            <p className="absolute inset-0 grid place-items-center text-[96px] font-extrabold text-accent">{goCount}</p>
          )}
          {stage === "recording" && (
            <p className="absolute top-3 left-3 rounded-full bg-black/70 px-3 py-1 text-[13px] font-bold tabular-nums">
              <span className="mr-1.5 inline-block size-2 rounded-full bg-danger align-middle" />
              {Math.floor(elapsed / 1000)}s · do 3 slow reps
            </p>
          )}
        </div>
        <div className="mt-auto pt-6 pb-8">
          {stage === "recording" ? (
            <PrimaryButton onClick={finish}>Done</PrimaryButton>
          ) : (
            <PrimaryButton onClick={startRecording} disabled={stage === "countdown"}>
              {stage === "countdown" ? "Get ready…" : "Start: 3 slow reps"}
            </PrimaryButton>
          )}
        </div>
      </div>

      {stage === "result" && result && (
        <div className="flex flex-1 flex-col">
          {result.ok ? (
            <>
              <Card className="mt-1 p-5">
                <p className="flex items-center gap-2 text-[13px] font-bold text-accent">
                  <SparklesIcon className="size-4" />
                  Found {result.reps} reps
                </p>
                <p className="mt-1 text-[17px] font-extrabold">I&rsquo;ll count {SIGNAL_TEXT[result.signal]}.</p>
                <p className="mt-1 text-[13px] font-medium text-muted">
                  Best from the {result.view} view, like this recording.
                  {result.confidence === "ok" && " If counts look off later, teach it again with 3 slower reps."}
                </p>
                <TraceChart result={result} />
                <BottomPose result={result} width={frameSize.width} height={frameSize.height} />
              </Card>
              <label className="mt-5 text-[12px] font-semibold text-muted" htmlFor="teach-name">
                Name it
              </label>
              <input
                id="teach-name"
                value={name}
                maxLength={MAX_NAME_LENGTH}
                placeholder="e.g. Cable curl"
                onChange={(e) => setName(e.target.value)}
                className={cn(inputClass, "mt-2")}
              />
              <div className="mt-auto flex flex-col gap-3 pt-8 pb-8">
                <PrimaryButton onClick={() => void save()} disabled={!name.trim() || saving}>
                  Save exercise
                </PrimaryButton>
                <SecondaryButton onClick={retry}>
                  <RotateCcwIcon className="size-4" />
                  Try again
                </SecondaryButton>
              </div>
            </>
          ) : (
            <>
              <Card className="mt-1 p-5">
                <p className="text-[17px] font-extrabold">Let&rsquo;s try that again</p>
                <p className="mt-1 text-[14px] font-medium text-muted">{result.message}</p>
              </Card>
              <div className="mt-auto pt-8 pb-8">
                <PrimaryButton onClick={retry}>
                  <RotateCcwIcon className="size-4" />
                  Try again
                </PrimaryButton>
              </div>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}

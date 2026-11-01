"use client";

import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { drawSkeleton } from "@/lib/pose/draw";
import type { Recording } from "@/lib/recording/format";
import { frameIndexAt, frameLandmarks } from "@/lib/recording/replay";
import { cn } from "@/lib/utils";

const fmt = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

type ClipPreviewProps = {
  recording: Recording;
  /** The real video, if one was recorded. Without it we replay the skeleton alone. */
  video?: Blob | null;
  className?: string;
};

/**
 * Plays a clip back, looping, with play/pause and a scrub bar. With a video, the
 * skeleton is drawn on top in sync (landmark `t` = ms since recording start =
 * video time) and can be toggled off.
 */
export function ClipPreview({ recording, video, className }: ClipPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [skeleton, setSkeleton] = useState(true);
  const [src, setSrc] = useState<string | null>(null);
  const timeRef = useRef(0);

  const { width, height, facing } = recording.source;
  const w = width > 0 ? width : 1280;
  const h = height > 0 ? height : 720;
  const duration = Math.max(recording.durationMs, 1);

  useEffect(() => {
    if (!video) {
      setSrc(null);
      return;
    }
    const url = URL.createObjectURL(video);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [video]);

  // Play/pause the real video along with our state.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return;
    if (playing) el.play().catch(() => setPlaying(false));
    else el.pause();
  }, [playing, src]);

  // One loop for both modes: the clock is the video's time when there is a video,
  // otherwise our own. Each tick draws the landmark frame for that time.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const el = videoRef.current;
      if (src && el) {
        timeRef.current = el.currentTime * 1000;
        if (timeRef.current >= duration && !el.paused) el.currentTime = 0; // WebM may run past our duration
      } else if (playing) {
        timeRef.current = (timeRef.current + now - last) % duration;
      }
      last = now;
      const i = skeleton ? frameIndexAt(recording.frames, timeRef.current) : -1;
      drawSkeleton(ctx, i >= 0 ? frameLandmarks(recording.frames[i]) : null, w, h);
      if (now - lastUi > 100) {
        lastUi = now;
        setTime(timeRef.current);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [recording, playing, duration, w, h, src, skeleton]);

  function seek(t: number) {
    timeRef.current = t;
    setTime(t);
    if (videoRef.current) videoRef.current.currentTime = t / 1000;
  }

  const mirror = facing === "user" && "-scale-x-100";

  return (
    <div className={className}>
      <div
        className="relative mx-auto max-h-[46dvh] overflow-hidden rounded-tile border border-border bg-[#0b0b0b]"
        style={{ aspectRatio: `${w} / ${h}` }}
      >
        {src && (
          <video
            ref={videoRef}
            src={src}
            muted
            playsInline
            loop
            className={cn("absolute inset-0 size-full object-contain", mirror)}
          />
        )}
        <canvas ref={canvasRef} width={w} height={h} className={cn("absolute inset-0 size-full object-contain", mirror)} />
        {recording.frames.length === 0 && !src && (
          <p className="absolute inset-0 grid place-items-center text-[13px] font-semibold text-muted">No frames</p>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => setPlaying((p) => !p)}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-fg active:scale-95"
        >
          {playing ? <PauseIcon className="size-4" fill="currentColor" /> : <PlayIcon className="size-4" fill="currentColor" />}
        </button>
        <input
          type="range"
          aria-label="Playback position"
          min={0}
          max={duration}
          step={10}
          value={Math.min(time, duration)}
          onChange={(e) => seek(Number(e.target.value))}
          className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--accent)]"
        />
        <span className="text-right text-[12px] font-semibold text-muted tabular-nums">
          {fmt(Math.min(time, duration))} / {fmt(duration)}
        </span>
        {src && (
          <button
            type="button"
            aria-pressed={skeleton}
            onClick={() => setSkeleton((s) => !s)}
            className={cn(
              "badge-text h-7 shrink-0 rounded-full border px-2.5",
              skeleton ? "border-accent-border bg-accent-tint text-accent" : "border-white/15 text-white/70",
            )}
          >
            Skeleton
          </button>
        )}
      </div>
    </div>
  );
}

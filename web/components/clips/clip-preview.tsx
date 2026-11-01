"use client";

import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { drawSkeleton } from "@/lib/pose/draw";
import type { Recording } from "@/lib/recording/format";
import { frameIndexAt, frameLandmarks } from "@/lib/recording/replay";
import { cn } from "@/lib/utils";

const fmt = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** Replays a clip's skeleton on a canvas, looping, with play/pause and a scrub bar. */
export function ClipPreview({ recording, className }: { recording: Recording; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const timeRef = useRef(0);

  const { width, height, facing } = recording.source;
  // Draw at a modest fixed size with the camera's aspect ratio; CSS scales it.
  const w = 720;
  const h = width > 0 && height > 0 ? Math.round((w * height) / width) : 405;
  const duration = Math.max(recording.durationMs, 1);

  // Playback loop: advance the clock while playing, draw the matching frame.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;

    const draw = () => {
      const i = frameIndexAt(recording.frames, timeRef.current);
      drawSkeleton(ctx, i >= 0 ? frameLandmarks(recording.frames[i]) : null, w, h);
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = now - last;
      last = now;
      if (playing) timeRef.current = (timeRef.current + dt) % duration;
      draw();
      if (now - lastUi > 100) {
        lastUi = now;
        setTime(timeRef.current);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [recording, playing, duration, w, h]);

  function seek(t: number) {
    timeRef.current = t;
    setTime(t);
  }

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-tile border border-border bg-[#0b0b0b]">
        <canvas
          ref={canvasRef}
          width={w}
          height={h}
          className={cn("block max-h-[42dvh] w-full object-contain", facing === "user" && "-scale-x-100")}
        />
        {recording.frames.length === 0 && (
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
          className="h-1 flex-1 cursor-pointer accent-[var(--accent)]"
        />
        <span className="w-[76px] text-right text-[12px] font-semibold text-muted tabular-nums">
          {fmt(time)} / {fmt(duration)}
        </span>
      </div>
    </div>
  );
}

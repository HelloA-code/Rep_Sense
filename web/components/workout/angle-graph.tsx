"use client";

import { useEffect, useRef } from "react";

export type GraphSample = { t: number; raw: number | null; smooth: number | null };

/** How much history the graph shows. */
export const GRAPH_WINDOW_MS = 5000;

type AngleGraphProps = {
  /** Filled by the frame loop; the graph only reads it. */
  samples: React.RefObject<GraphSample[]>;
  /** Threshold lines, e.g. the counter's downBelow / upAbove. */
  lines: number[];
  min: number;
  max: number;
};

/** Live mini-graph of raw (grey) vs One-Euro smoothed (yellow) angle, redrawn each frame. */
export function AngleGraph({ samples, lines, min, max }: AngleGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const y = (v: number) => h - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * h;
    let raf = 0;

    const plot = (data: GraphSample[], key: "raw" | "smooth", now: number, color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      let pen = false;
      for (const s of data) {
        const v = s[key];
        if (v === null) {
          pen = false;
          continue;
        }
        const x = w - ((now - s.t) / GRAPH_WINDOW_MS) * w;
        if (pen) ctx.lineTo(x, y(v));
        else ctx.moveTo(x, y(v));
        pen = true;
      }
      ctx.stroke();
    };

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const data = samples.current;
      const now = data.length ? data[data.length - 1].t : 0;
      ctx.clearRect(0, 0, w, h);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1;
      for (const l of lines) {
        ctx.beginPath();
        ctx.moveTo(0, y(l));
        ctx.lineTo(w, y(l));
        ctx.stroke();
      }
      ctx.setLineDash([]);
      plot(data, "raw", now, "rgba(255,255,255,0.45)", 1.5);
      plot(data, "smooth", now, "#FFC53D", 2.5);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [samples, lines, min, max]);

  return <canvas ref={canvasRef} width={360} height={120} className="h-[60px] w-[180px]" aria-hidden />;
}

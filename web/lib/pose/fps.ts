export type FrameStats = { fps: number; latencyMs: number };

/** Rolling FPS and average inference latency over the last `windowMs`. */
export function createFpsMeter(windowMs = 1000) {
  const samples: { t: number; latency: number }[] = [];

  return {
    tick(now: number, latencyMs: number) {
      samples.push({ t: now, latency: latencyMs });
      while (samples.length > 0 && now - samples[0].t > windowMs) samples.shift();
    },
    stats(): FrameStats {
      if (samples.length === 0) return { fps: 0, latencyMs: 0 };
      const latencyMs = samples.reduce((sum, s) => sum + s.latency, 0) / samples.length;
      if (samples.length < 2) return { fps: 0, latencyMs };
      const span = samples[samples.length - 1].t - samples[0].t;
      return { fps: span > 0 ? ((samples.length - 1) * 1000) / span : 0, latencyMs };
    },
  };
}

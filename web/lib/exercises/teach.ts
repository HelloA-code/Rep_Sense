import { createLandmarkSmoother } from "@/lib/pose/filters";
import { LM, type Landmark } from "@/lib/pose/landmarks";
import { pickSide, type Side } from "@/lib/pose/side";
import { estimateView } from "@/lib/pose/view";
import type { CameraView } from "@/lib/recording/format";
import { SIGNALS, type SignalId } from "./signals";
import { createRepCounter, type RepCounterConfig } from "./state-machine";
import { SIDE_LM } from "./types";

// "Teach a rep": learn a new exercise from a short recording of ~3 reps. No training:
// it tries every teachable signal, sets thresholds from that signal's own range, replays
// the normal rep counter over the recording, and keeps the signal that moves the most
// while giving a clean handful of reps.

export const TEACHABLE_SIGNALS = ["elbow", "knee", "hip", "shoulder", "wrist-spread", "knee-spread"] as const;
export type TeachableSignal = (typeof TEACHABLE_SIGNALS)[number];

const isSpread = (s: SignalId) => s === "wrist-spread" || s === "knee-spread";
/** A full range for each kind of signal, to compare angles (degrees) with spreads (shoulder widths × 100). */
const SCALE = (s: SignalId) => (isSpread(s) ? 200 : 180);
/** Less movement than this is noise, not a rep. */
const MIN_RANGE = (s: SignalId) => (isSpread(s) ? 30 : 25);

/** The signal must be measurable in at least this share of frames. */
const MIN_COVERAGE = 0.7;
const MIN_REPS = 2;
const MAX_REPS = 6;
/** Thresholds as a share of the range: down = bottom + 30 %, up = top − 25 %. */
const DOWN_AT = 0.3;
const UP_AT = 0.25;

export type TeachFrame = { t: number; landmarks: readonly Landmark[] };

export type TeachSuccess = {
  ok: true;
  signal: TeachableSignal;
  /** Set when the signal is low at rest (a raise, limbs opening): count `mirror − value`. */
  mirror: number | null;
  counter: RepCounterConfig;
  view: CameraView;
  reps: number;
  confidence: "high" | "ok";
  /** The counted value over time (already mirrored), for the result chart. */
  trace: { t: number; value: number | null }[];
  /** A smoothed pose at the bottom of the first rep, and the joints to ring on it. */
  bottomPose: Landmark[] | null;
  joints: number[];
};

export type TeachFailure = {
  ok: false;
  reason: "too-short" | "not-visible" | "no-movement" | "no-reps";
  message: string;
};

export type TeachResult = TeachSuccess | TeachFailure;

const MESSAGES: Record<TeachFailure["reason"], string> = {
  "too-short": "That was too short. Record at least 3 full reps.",
  "not-visible": "Not enough of you was visible. Step back so your whole body is in frame.",
  "no-movement": "Nothing moved enough. Try 3 slow, full reps.",
  "no-reps": "Couldn't find clear reps. Do 3 slow reps with a short pause at the top.",
};

const fail = (reason: TeachFailure["reason"]): TeachFailure => ({ ok: false, reason, message: MESSAGES[reason] });

function quantile(sorted: number[], q: number): number {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i];
}

function median(values: number[]): number {
  return quantile([...values].sort((a, b) => a - b), 0.5);
}

/** Replays the rep counter; returns the reps and when each one finished. */
function replay(values: (number | null)[], times: number[], config: RepCounterConfig) {
  const counter = createRepCounter(config);
  const repTimes: number[] = [];
  values.forEach((v, i) => {
    if (v === null) return;
    const before = counter.state.reps;
    if (counter.update(v, times[i]).reps > before) repTimes.push(times[i]);
  });
  return repTimes;
}

/** The joints to highlight for a signal on the side the camera sees. */
export function signalJoints(signal: TeachableSignal, side: Side): number[] {
  const s = SIDE_LM[side];
  switch (signal) {
    case "elbow":
      return [s.elbow];
    case "knee":
      return [s.knee];
    case "hip":
      return [s.hip];
    case "shoulder":
      return [s.shoulder];
    case "wrist-spread":
      return [LM.LEFT_WRIST, LM.RIGHT_WRIST];
    case "knee-spread":
      return [LM.LEFT_KNEE, LM.RIGHT_KNEE];
  }
}

type Candidate = Omit<TeachSuccess, "ok" | "view" | "bottomPose" | "joints" | "confidence"> & {
  score: number;
  coverage: number;
  values: (number | null)[];
};

export function analyseTeach(frames: readonly TeachFrame[], width: number, height: number): TeachResult {
  if (frames.length < 15 || frames[frames.length - 1].t - frames[0].t < 2000) return fail("too-short");

  // Same steps as the set engine: smooth, pick the visible side, judge the view.
  const smoother = createLandmarkSmoother();
  let side: Side | null = null;
  let view: CameraView | null = null;
  const views: Record<CameraView, number> = { front: 0, side: 0 };
  const poses = frames.map((f) => {
    const lm = smoother.smooth(f.landmarks, f.t);
    side = pickSide(lm, side);
    view = estimateView(lm, width, height, view);
    if (view) views[view] += 1;
    return { lm, width, height, side };
  });
  const times = frames.map((f) => f.t);

  let anyVisible = false;
  let anyMoved = false;
  const candidates: Candidate[] = [];

  for (const signal of TEACHABLE_SIGNALS) {
    const raw = poses.map((p) => SIGNALS[signal].measure(p));
    const present = raw.filter((v): v is number => v !== null);
    const coverage = present.length / raw.length;
    if (coverage < MIN_COVERAGE) continue;
    anyVisible = true;

    const sorted = [...present].sort((a, b) => a - b);
    const bottom = quantile(sorted, 0.05);
    const top = quantile(sorted, 0.95);
    const range = top - bottom;
    if (range < MIN_RANGE(signal)) continue;
    anyMoved = true;

    // Where you start = rest. Low at rest means the movement goes up: mirror it so the
    // counter still sees "high at rest, low at the bottom of the rep".
    const rest = median(present.slice(0, Math.max(3, Math.round(present.length * 0.1))));
    const mirror = rest < (top + bottom) / 2 ? top + bottom : null;
    const values = raw.map((v) => (v === null || mirror === null ? v : mirror - v));

    const thresholds = { downBelow: bottom + DOWN_AT * range, upAbove: top - UP_AT * range };
    const first = replay(values, times, { ...thresholds, minRepMs: 200 });
    if (first.length < MIN_REPS || first.length > MAX_REPS) continue;

    // Ignore "reps" much faster than the ones you just did: tracking glitches.
    const gaps = first.slice(1).map((t, i) => t - first[i]);
    const typical = gaps.length ? median(gaps) : (times[times.length - 1] - times[0]) / first.length;
    const counter = { ...thresholds, minRepMs: Math.max(300, Math.round(typical * 0.3)) };
    const reps = replay(values, times, counter).length;
    if (reps < MIN_REPS || reps > MAX_REPS) continue;

    candidates.push({
      signal,
      mirror,
      counter,
      reps,
      coverage,
      values,
      score: range / SCALE(signal),
      trace: values.map((value, i) => ({ t: times[i] - times[0], value })),
    });
  }

  if (!anyVisible) return fail("not-visible");
  if (!anyMoved) return fail("no-movement");
  if (candidates.length === 0) return fail("no-reps");

  const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));

  // The bottom of the first rep: the lowest value before the counter first comes back up.
  let bottomIndex = -1;
  for (let i = 0; i < best.values.length; i++) {
    const v = best.values[i];
    if (v === null) continue;
    if (bottomIndex >= 0 && v > best.counter.upAbove) break;
    if (v < best.counter.downBelow && (bottomIndex < 0 || v < (best.values[bottomIndex] ?? Infinity))) bottomIndex = i;
  }
  const bottom = bottomIndex >= 0 ? poses[bottomIndex] : null;

  return {
    ok: true,
    signal: best.signal,
    mirror: best.mirror,
    counter: best.counter,
    view: views.front > views.side ? "front" : "side",
    reps: best.reps,
    confidence: best.reps === 3 && best.coverage >= 0.9 ? "high" : "ok",
    trace: best.trace,
    bottomPose: bottom ? bottom.lm : null,
    joints: bottom ? signalJoints(best.signal, bottom.side) : [],
  };
}

import type { CameraView } from "@/lib/recording/format";
import type { CustomExerciseId } from "./ids";
import { SIGNALS } from "./signals";
import type { RepCounterConfig } from "./state-machine";
import {
  POSTURE_SIGNALS,
  TEACHABLE_SIGNALS,
  teachThresholds,
  type PostureRange,
  type TeachSuccess,
  type TeachableSignal,
} from "./teach";
import type { PoseFrame } from "./types";
import type { RepExercise } from "./types";

// An exercise the user taught the app ("Teach a rep"). Stored as plain data (on the device,
// and in Supabase when signed in) and turned into a normal rep exercise when used.

export type { CustomExerciseId };

export type CustomExercise = {
  id: CustomExerciseId;
  name: string;
  signal: TeachableSignal;
  /** Count `mirror − value` (movements that go up from rest), or the value as is. */
  mirror: number | null;
  counter: RepCounterConfig;
  view: CameraView;
  createdAt: string;
  /** Removed from the picker, kept so old workouts still show its name. */
  archived: boolean;
  /** Set when taught for a library exercise ("Tap to teach"): picking that exercise uses this counter. */
  libraryId?: string;
  /**
   * 2 = stricter thresholds plus a posture check. Missing = taught before that (thresholds
   * are upgraded when used; there's no posture to check).
   */
  version?: 2;
  /** How the rest of the body stayed while teaching (version 2). */
  posture?: PostureRange[];
};

/**
 * Leeway around the taught posture ranges: degrees for angles, shoulder widths × 100 for
 * spreads. Wide enough for normal rep-to-rep variation, not for swinging or cheating.
 */
const POSTURE_MARGIN = { angle: 20, spread: 30 } as const;

export const MAX_NAME_LENGTH = 40;
const ID_PATTERN = /^custom-[a-z0-9]{8,32}$/;

export function isCustomId(id: string): id is CustomExerciseId {
  return ID_PATTERN.test(id);
}

export function newCustomId(random: () => number = Math.random): CustomExerciseId {
  let s = "";
  while (s.length < 12) s += Math.floor(random() * 36).toString(36);
  return `custom-${s}`;
}

export function customFromTeach(name: string, result: TeachSuccess, now = new Date(), libraryId?: string): CustomExercise {
  return {
    ...(libraryId ? { libraryId } : {}),
    id: newCustomId(),
    name: name.trim().slice(0, MAX_NAME_LENGTH),
    signal: result.signal,
    mirror: result.mirror,
    counter: result.counter,
    view: result.view,
    createdAt: now.toISOString(),
    archived: false,
    version: 2,
    posture: result.posture,
  };
}

/**
 * Exercises taught before version 2 counted from ~70 % of the taught depth. Their stored
 * thresholds give back the taught range (down = bottom + 30 %, up = top − 25 %), so they
 * get the stricter ones too without being taught again.
 */
export function upgradedCounter(c: CustomExercise) {
  if (c.version === 2) return c.counter;
  const range = (c.counter.upAbove - c.counter.downBelow) / (1 - 0.3 - 0.25);
  const bottom = c.counter.downBelow - 0.3 * range;
  const top = c.counter.upAbove + 0.25 * range;
  return { ...c.counter, ...teachThresholds(c.signal, bottom, top) };
}

/** Every posture joint that can be seen is within its taught range (plus a margin). */
export function postureMatches(posture: readonly PostureRange[], f: PoseFrame): boolean {
  return posture.every(({ signal, min, max }) => {
    const v = SIGNALS[signal].measure(f);
    if (v === null) return true; // hidden: can't judge, so don't fail the rep for it
    const margin = signal === "wrist-spread" || signal === "knee-spread" ? POSTURE_MARGIN.spread : POSTURE_MARGIN.angle;
    return v >= min - margin && v <= max + margin;
  });
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function isPosture(v: unknown): v is PostureRange[] {
  return (
    Array.isArray(v) &&
    v.every(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        (POSTURE_SIGNALS as readonly unknown[]).includes(p.signal) &&
        isNum(p.min) &&
        isNum(p.max) &&
        p.min <= p.max,
    )
  );
}

/** Anything read back from storage or the database is checked before it's used. */
export function isCustomExercise(v: unknown): v is CustomExercise {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  const counter = c.counter as Record<string, unknown> | undefined;
  return (
    typeof c.id === "string" &&
    isCustomId(c.id) &&
    typeof c.name === "string" &&
    c.name.trim().length > 0 &&
    c.name.length <= MAX_NAME_LENGTH &&
    (TEACHABLE_SIGNALS as readonly unknown[]).includes(c.signal) &&
    (c.mirror === null || isNum(c.mirror)) &&
    typeof counter === "object" &&
    counter !== null &&
    isNum(counter.downBelow) &&
    isNum(counter.upAbove) &&
    isNum(counter.minRepMs) &&
    counter.downBelow < counter.upAbove &&
    (c.view === "front" || c.view === "side") &&
    typeof c.createdAt === "string" &&
    typeof c.archived === "boolean" &&
    (c.libraryId === undefined || (typeof c.libraryId === "string" && /^[a-z0-9-]{1,40}$/.test(c.libraryId))) &&
    (c.version === undefined || c.version === 2) &&
    (c.posture === undefined || isPosture(c.posture))
  );
}

const PLACEMENT: Record<TeachableSignal, string> = {
  elbow: "arms",
  knee: "legs",
  hip: "whole body",
  shoulder: "arms",
  "wrist-spread": "both arms",
  "knee-spread": "both legs",
};

/**
 * A taught exercise as the set engine runs it. No form rules, but two checks: each rep must
 * get close to the taught depth, and the rest of the body must stay roughly as it was
 * when taught, for the whole bottom half of the rep.
 */
export function buildCustomExercise(c: CustomExercise): RepExercise {
  const signal = SIGNALS[c.signal];
  const posture = c.posture ?? [];
  return {
    id: c.id,
    name: c.name,
    mode: "reps",
    preferredView: c.view,
    setupHint: `${c.view === "front" ? "Front" : "Side"} view, same as when you taught it, ${PLACEMENT[c.signal]} in frame`,
    metric: c.mirror === null ? signal.metric : `${signal.metric} (flipped)`,
    counter: { ...upgradedCounter(c), goalMode: "all" },
    phaseLabel: { up: "Start", down: "Rep" },
    missCues: {
      shallow: "Full range, like when you taught it",
      "no-lockout": "Back to the start",
      goal: "Keep your body like when you taught it",
    },
    rules: [],
    ...(posture.length ? { goal: (f: PoseFrame) => postureMatches(posture, f) } : {}),
    measure(f) {
      const v = signal.measure(f);
      return v === null || c.mirror === null ? v : c.mirror - v;
    },
  };
}

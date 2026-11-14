import type { CameraView } from "@/lib/recording/format";
import type { CustomExerciseId } from "./ids";
import { SIGNALS } from "./signals";
import type { RepCounterConfig } from "./state-machine";
import { TEACHABLE_SIGNALS, type TeachSuccess, type TeachableSignal } from "./teach";
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
};

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
  };
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

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
    (c.libraryId === undefined || (typeof c.libraryId === "string" && /^[a-z0-9-]{1,40}$/.test(c.libraryId)))
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

/** A taught exercise as the set engine runs it: counting only, no form rules. */
export function buildCustomExercise(c: CustomExercise): RepExercise {
  const signal = SIGNALS[c.signal];
  return {
    id: c.id,
    name: c.name,
    mode: "reps",
    preferredView: c.view,
    setupHint: `${c.view === "front" ? "Front" : "Side"} view, same as when you taught it, ${PLACEMENT[c.signal]} in frame`,
    metric: c.mirror === null ? signal.metric : `${signal.metric} (flipped)`,
    counter: c.counter,
    phaseLabel: { up: "Start", down: "Rep" },
    missCues: { shallow: "Full range, like when you taught it", "no-lockout": "Back to the start" },
    rules: [],
    measure(f) {
      const v = signal.measure(f);
      return v === null || c.mirror === null ? v : c.mirror - v;
    },
  };
}

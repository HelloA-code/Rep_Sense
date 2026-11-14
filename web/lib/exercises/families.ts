import type { CameraView } from "@/lib/recording/format";
import type { RepPhase, RepRejection } from "./state-machine";
import type { SignalId } from "./signals";

// A family = exercises that move the same way, so they share what to measure, where to
// put the camera, and what to say. Each exercise only fills in what's different.

export type FamilyId =
  | "squat"
  | "hinge"
  | "lunge"
  | "push"
  | "overhead"
  | "row"
  | "vertical-pull"
  | "single-joint"
  | "core"
  | "hold";

/** Broad movement patterns, used to build a balanced session. */
export type Pattern = "legs" | "push" | "pull" | "core" | "accessory";

export type Family = {
  id: FamilyId;
  name: string;
  pattern: Pattern;
  /**
   * MET from the Compendium of Physical Activities (2011): calisthenics, vigorous effort
   * (push-ups, pull-ups) = 8.0; moderate effort (squats, lunges) = 3.8.
   */
  met: number;
  signal: SignalId;
  view: CameraView;
  setupHint: string;
  phaseLabel: Record<RepPhase, string>;
  missCues: Partial<Record<RepRejection, string>>;
};

const LEGS_CUES = { shallow: "Go lower", "no-lockout": "Stand up tall" } as const;
const PUSH_CUES = { shallow: "Go lower", "no-lockout": "Lock out your arms" } as const;
const PULL_CUES = { shallow: "Pull further", "no-lockout": "Straighten your arms" } as const;

export const FAMILIES: Record<FamilyId, Family> = {
  squat: {
    id: "squat",
    name: "Squat",
    pattern: "legs",
    met: 3.8,
    signal: "knee",
    view: "side",
    setupHint: "Side view, whole body in frame",
    phaseLabel: { up: "Standing", down: "Down" },
    missCues: LEGS_CUES,
  },
  hinge: {
    id: "hinge",
    name: "Hinge",
    pattern: "legs",
    met: 3.8,
    signal: "hip",
    view: "side",
    setupHint: "Side view, whole body in frame",
    phaseLabel: { up: "Standing", down: "Hinged" },
    missCues: { shallow: "Hinge deeper", "no-lockout": "Squeeze your hips through" },
  },
  lunge: {
    id: "lunge",
    name: "Lunge",
    pattern: "legs",
    met: 3.8,
    signal: "front-knee",
    view: "side",
    setupHint: "Side view, whole body in frame",
    phaseLabel: { up: "Standing", down: "Down" },
    missCues: LEGS_CUES,
  },
  push: {
    id: "push",
    name: "Push",
    pattern: "push",
    met: 8.0,
    signal: "elbow",
    view: "side",
    setupHint: "Side view, camera at floor height",
    phaseLabel: { up: "Top", down: "Bottom" },
    missCues: PUSH_CUES,
  },
  overhead: {
    id: "overhead",
    name: "Overhead",
    pattern: "push",
    met: 8.0,
    signal: "elbow",
    view: "front",
    setupHint: "Front view, arms fully in frame overhead",
    phaseLabel: { up: "Locked out", down: "Bottom" },
    missCues: { shallow: "Lower further", "no-lockout": "Press all the way up" },
  },
  row: {
    id: "row",
    name: "Row",
    pattern: "pull",
    met: 8.0,
    signal: "elbow",
    view: "side",
    setupHint: "Side view, whole body in frame",
    phaseLabel: { up: "Arms long", down: "Pulled" },
    missCues: PULL_CUES,
  },
  "vertical-pull": {
    id: "vertical-pull",
    name: "Pull-up",
    pattern: "pull",
    met: 8.0,
    signal: "elbow",
    view: "front",
    setupHint: "Front view, bar and feet in frame",
    phaseLabel: { up: "Hang", down: "Pull" },
    missCues: { shallow: "Pull higher", "no-lockout": "Full hang at the bottom" },
  },
  "single-joint": {
    id: "single-joint",
    name: "Isolation",
    // Accessory work: suggestions build sessions from the big patterns, not this one.
    pattern: "accessory",
    met: 3.8,
    signal: "elbow",
    view: "side",
    setupHint: "Side view, whole body in frame",
    phaseLabel: { up: "Arms long", down: "Curled" },
    missCues: { shallow: "Full range", "no-lockout": "All the way back" },
  },
  core: {
    id: "core",
    name: "Core",
    pattern: "core",
    met: 3.8,
    signal: "hip",
    view: "side",
    setupHint: "Side view, camera at floor height, whole body in frame",
    phaseLabel: { up: "Extended", down: "Crunched" },
    missCues: { shallow: "Further", "no-lockout": "All the way back" },
  },
  hold: {
    id: "hold",
    name: "Holds",
    pattern: "core",
    met: 3.8,
    signal: "body-line",
    view: "side",
    setupHint: "Side view, camera at floor height",
    phaseLabel: { up: "Holding", down: "Holding" },
    missCues: {},
  },
};

export const FAMILY_ORDER: readonly FamilyId[] = [
  "squat",
  "hinge",
  "lunge",
  "push",
  "overhead",
  "row",
  "vertical-pull",
  "single-joint",
  "core",
  "hold",
];

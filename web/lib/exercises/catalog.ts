import type { EquipmentId } from "@/lib/equipment";
import type { CameraView } from "@/lib/recording/format";
import type { FamilyId } from "./families";
import type { RuleRef } from "./rules";
import type { GateId, GoalId, SignalId } from "./signals";
import type { RepPhase, RepRejection } from "./state-machine";

// Every exercise as plain data. The family fills in the defaults (what to measure,
// camera view, cues); an entry only states what's different.
// Thresholds are degrees of the family's signal. For everything except the original 6
// they're first estimates from typical joint ranges, not measured yet: real clips
// (IMPLEMENTATION_PLAN_2.md, Step 4) will tune them.

type EntryBase = {
  id: string;
  name: string;
  family: FamilyId;
  /** Any one of these unlocks it; empty = bodyweight only. */
  requiresAny: readonly EquipmentId[];
  view?: CameraView;
  setupHint?: string;
  /** Overrides the family's MET (e.g. jump squats are vigorous). */
  met?: number;
  /** One of the original 6: suggested even before you've tried it. */
  classic?: boolean;
  rules?: readonly RuleRef[];
};

export type RepEntry = EntryBase & {
  signal?: SignalId;
  counter: { downBelow: number; upAbove: number; minRepMs: number };
  goal?: GoalId;
  phaseLabel?: Record<RepPhase, string>;
  missCues?: Partial<Record<RepRejection, string>>;
};

export type HoldEntry = EntryBase & {
  hold: {
    signal: SignalId;
    /** Target range for the signal; without it the signal itself is the deviation (body line). */
    band?: readonly [number, number];
    /** Must be in this position for the timer to run at all. */
    gate?: GateId;
    /** Degrees outside the target allowed before the timer pauses. */
    maxDeviation: number;
    graceMs?: number;
  };
};

export type CatalogEntry = RepEntry | HoldEntry;

// Shared bits of data, to keep entries short.
const CHEST_UP = { id: "torso-lean", cue: "Chest up", limit: 50 } as const;
const TORSO_UPRIGHT = { id: "torso-lean", cue: "Torso upright", limit: 25 } as const;
const PUSHUP_HIPS = { id: "hips", sagCue: "Hips up", pikeCue: "Lower your hips" } as const;
const CURL_LABELS = { up: "Arms long", down: "Curled" } as const;
const CURL_CUES = { shallow: "Curl all the way up", "no-lockout": "Straighten your arms" } as const;
const RAISE_LABELS = { up: "Arms down", down: "Raised" } as const;
const RAISE_CUES = { shallow: "Raise to shoulder height", "no-lockout": "Lower all the way" } as const;
const DUMBBELL_OR_KB = ["dumbbells", "kettlebell"] as const;
const BOX_OR_BENCH = ["box", "bench"] as const;
const BAR_OR_RINGS = ["pullup-bar", "rings"] as const;

export const CATALOG = [
  // ---------- Squat (knee angle) ----------
  {
    id: "squat",
    name: "Squat",
    family: "squat",
    requiresAny: [],
    classic: true,
    counter: { downBelow: 100, upAbove: 160, minRepMs: 400 },
    rules: [{ id: "knees-caving" }, CHEST_UP],
  },
  {
    id: "goblet-squat",
    name: "Goblet squat",
    family: "squat",
    requiresAny: DUMBBELL_OR_KB,
    counter: { downBelow: 100, upAbove: 160, minRepMs: 400 },
    rules: [{ id: "knees-caving" }, CHEST_UP],
  },
  {
    id: "sumo-squat",
    name: "Sumo squat",
    family: "squat",
    requiresAny: [],
    counter: { downBelow: 105, upAbove: 160, minRepMs: 400 },
    rules: [{ id: "knees-caving" }, CHEST_UP],
  },
  {
    id: "jump-squat",
    name: "Jump squat",
    family: "squat",
    requiresAny: [],
    met: 8.0,
    counter: { downBelow: 110, upAbove: 160, minRepMs: 300 },
    rules: [{ id: "knees-caving" }],
  },
  {
    id: "box-squat",
    name: "Box squat",
    family: "squat",
    requiresAny: BOX_OR_BENCH,
    setupHint: "Side view, whole body and box in frame",
    counter: { downBelow: 110, upAbove: 160, minRepMs: 400 },
    rules: [CHEST_UP],
  },
  {
    id: "assisted-pistol",
    name: "Assisted pistol squat",
    family: "squat",
    requiresAny: [],
    // One leg works and the other is held out straight: count the more bent knee.
    signal: "front-knee",
    setupHint: "Side view, holding a support, whole body in frame",
    counter: { downBelow: 100, upAbove: 155, minRepMs: 500 },
  },

  {
    id: "barbell-squat",
    name: "Barbell back squat",
    family: "squat",
    requiresAny: ["barbell"],
    counter: { downBelow: 100, upAbove: 160, minRepMs: 500 },
    rules: [{ id: "knees-caving" }, CHEST_UP],
  },
  {
    id: "front-squat",
    name: "Front squat",
    family: "squat",
    requiresAny: ["barbell", "kettlebell"],
    counter: { downBelow: 100, upAbove: 160, minRepMs: 500 },
    rules: [{ id: "knees-caving" }, CHEST_UP],
  },
  {
    id: "hack-squat",
    name: "Hack squat (machine)",
    family: "squat",
    requiresAny: ["machines"],
    setupHint: "Side view, whole body and machine in frame",
    counter: { downBelow: 100, upAbove: 160, minRepMs: 500 },
  },
  {
    id: "smith-squat",
    name: "Smith machine squat",
    family: "squat",
    requiresAny: ["machines"],
    counter: { downBelow: 100, upAbove: 160, minRepMs: 500 },
    rules: [CHEST_UP],
  },

  // ---------- Hinge (hip angle) ----------
  {
    id: "romanian-deadlift",
    name: "Romanian deadlift",
    family: "hinge",
    requiresAny: ["dumbbells", "barbell", "kettlebell"],
    counter: { downBelow: 120, upAbove: 160, minRepMs: 500 },
    rules: [{ id: "hinge-knees" }],
  },
  {
    id: "deadlift",
    name: "Deadlift",
    family: "hinge",
    requiresAny: ["barbell", "dumbbells", "kettlebell"],
    counter: { downBelow: 115, upAbove: 160, minRepMs: 500 },
  },
  {
    id: "good-morning",
    name: "Good morning",
    family: "hinge",
    requiresAny: [],
    counter: { downBelow: 120, upAbove: 160, minRepMs: 500 },
    rules: [{ id: "hinge-knees" }],
  },
  {
    id: "glute-bridge",
    name: "Glute bridge",
    family: "hinge",
    requiresAny: [],
    setupHint: "Side view, camera at floor height",
    phaseLabel: { up: "Hips up", down: "Hips down" },
    missCues: { "no-lockout": "Squeeze your hips all the way up" },
    // Lying down, the hip only opens from ~130° to ~170°: a narrow range.
    counter: { downBelow: 145, upAbove: 165, minRepMs: 400 },
  },
  {
    id: "hip-thrust",
    name: "Hip thrust",
    family: "hinge",
    requiresAny: ["bench"],
    setupHint: "Side view, shoulders on the bench, whole body in frame",
    phaseLabel: { up: "Hips up", down: "Hips down" },
    missCues: { shallow: "Lower your hips further", "no-lockout": "Squeeze your hips all the way up" },
    counter: { downBelow: 125, upAbove: 160, minRepMs: 400 },
  },
  {
    id: "kettlebell-swing",
    name: "Kettlebell swing",
    family: "hinge",
    requiresAny: ["kettlebell"],
    met: 8.0,
    counter: { downBelow: 125, upAbove: 160, minRepMs: 300 },
  },

  {
    id: "sumo-deadlift",
    name: "Sumo deadlift",
    family: "hinge",
    requiresAny: ["barbell", "kettlebell", "dumbbells"],
    counter: { downBelow: 115, upAbove: 160, minRepMs: 500 },
  },

  // ---------- Lunge (front knee) ----------
  {
    id: "lunge",
    name: "Lunge",
    family: "lunge",
    requiresAny: [],
    classic: true,
    counter: { downBelow: 110, upAbove: 155, minRepMs: 400 },
    rules: [{ id: "knee-past-toes" }, TORSO_UPRIGHT],
  },
  {
    id: "reverse-lunge",
    name: "Reverse lunge",
    family: "lunge",
    requiresAny: [],
    counter: { downBelow: 110, upAbove: 155, minRepMs: 400 },
    rules: [{ id: "knee-past-toes" }, TORSO_UPRIGHT],
  },
  {
    id: "walking-lunge",
    name: "Walking lunge",
    family: "lunge",
    requiresAny: [],
    setupHint: "Side view from far back, so you stay in frame as you walk",
    counter: { downBelow: 110, upAbove: 155, minRepMs: 400 },
    rules: [TORSO_UPRIGHT],
  },
  {
    id: "bulgarian-split-squat",
    name: "Bulgarian split squat",
    family: "lunge",
    requiresAny: BOX_OR_BENCH,
    setupHint: "Side view, back foot on the bench, whole body in frame",
    counter: { downBelow: 105, upAbove: 155, minRepMs: 400 },
    rules: [{ id: "knee-past-toes" }, TORSO_UPRIGHT],
  },
  {
    id: "step-up",
    name: "Step-up",
    family: "lunge",
    requiresAny: BOX_OR_BENCH,
    setupHint: "Side view, whole body and box in frame",
    phaseLabel: { up: "On top", down: "Stepping" },
    missCues: { "no-lockout": "Stand tall on the box" },
    counter: { downBelow: 110, upAbove: 160, minRepMs: 500 },
  },
  {
    id: "lateral-lunge",
    name: "Lateral lunge",
    family: "lunge",
    requiresAny: [],
    view: "front",
    setupHint: "Front view, whole body in frame",
    // From the front a bent knee looks less bent, so the bottom line is higher.
    counter: { downBelow: 120, upAbove: 160, minRepMs: 400 },
  },

  {
    id: "shrimp-squat",
    name: "Shrimp squat",
    family: "lunge",
    requiresAny: [],
    setupHint: "Side view, holding your back foot, whole body in frame",
    counter: { downBelow: 100, upAbove: 155, minRepMs: 500 },
  },
  {
    id: "cossack-squat",
    name: "Cossack squat",
    family: "lunge",
    requiresAny: [],
    view: "front",
    setupHint: "Front view, whole body in frame",
    counter: { downBelow: 115, upAbove: 160, minRepMs: 500 },
  },

  // ---------- Push (elbow) ----------
  {
    id: "pushup",
    name: "Push-up",
    family: "push",
    requiresAny: [],
    classic: true,
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
    rules: [PUSHUP_HIPS],
  },
  {
    id: "dip",
    name: "Dip",
    family: "push",
    requiresAny: ["dip-station", "rings"],
    classic: true,
    setupHint: "Side view, bars and whole body in frame",
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
    missCues: { shallow: "Go lower", "no-lockout": "Lock out at the top" },
  },
  {
    id: "knee-pushup",
    name: "Knee push-up",
    family: "push",
    requiresAny: [],
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
    rules: [{ id: "elbow-flare" }],
  },
  {
    id: "incline-pushup",
    name: "Incline push-up",
    family: "push",
    requiresAny: BOX_OR_BENCH,
    setupHint: "Side view, hands on the bench, whole body in frame",
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
    rules: [PUSHUP_HIPS, { id: "elbow-flare" }],
  },
  {
    id: "decline-pushup",
    name: "Decline push-up",
    family: "push",
    requiresAny: BOX_OR_BENCH,
    setupHint: "Side view, feet on the bench, camera at floor height",
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
    rules: [PUSHUP_HIPS, { id: "elbow-flare" }],
  },
  {
    id: "diamond-pushup",
    name: "Diamond push-up",
    family: "push",
    requiresAny: [],
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
    rules: [PUSHUP_HIPS],
  },
  {
    id: "bench-dip",
    name: "Bench dip",
    family: "push",
    requiresAny: BOX_OR_BENCH,
    setupHint: "Side view, bench and whole body in frame",
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
    missCues: { shallow: "Go lower", "no-lockout": "Lock out at the top" },
  },

  {
    id: "archer-pushup",
    name: "Archer push-up",
    family: "push",
    requiresAny: [],
    counter: { downBelow: 100, upAbove: 150, minRepMs: 500 },
    rules: [PUSHUP_HIPS],
  },
  {
    id: "pseudo-planche-pushup",
    name: "Pseudo-planche push-up",
    family: "push",
    requiresAny: [],
    // Hands by the hips and leaning forward: the elbows bend less than in a normal push-up.
    counter: { downBelow: 110, upAbove: 150, minRepMs: 500 },
    rules: [PUSHUP_HIPS],
  },
  {
    id: "ring-pushup",
    name: "Ring push-up",
    family: "push",
    requiresAny: ["rings"],
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
    rules: [PUSHUP_HIPS],
  },
  {
    id: "ring-dip",
    name: "Ring dip",
    family: "push",
    requiresAny: ["rings"],
    setupHint: "Side view, rings and whole body in frame",
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
    missCues: { shallow: "Go lower", "no-lockout": "Lock out at the top" },
  },
  {
    id: "straight-bar-dip",
    name: "Straight bar dip",
    family: "push",
    requiresAny: ["pullup-bar", "dip-station"],
    setupHint: "Side view, bar and whole body in frame",
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
    missCues: { shallow: "Go lower", "no-lockout": "Lock out at the top" },
  },
  {
    id: "chest-press-machine",
    name: "Chest press machine",
    family: "push",
    requiresAny: ["machines"],
    setupHint: "Side view, seated, arms in frame",
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
  },
  {
    id: "assisted-dip",
    name: "Assisted dip machine",
    family: "push",
    requiresAny: ["machines"],
    setupHint: "Side view, whole body and machine in frame",
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
    missCues: { shallow: "Go lower", "no-lockout": "Lock out at the top" },
  },

  // ---------- Overhead push (elbow) ----------
  {
    id: "pike-pushup",
    name: "Pike push-up",
    family: "overhead",
    requiresAny: [],
    view: "side",
    setupHint: "Side view, hips high, whole body in frame",
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
  },
  {
    id: "overhead-press",
    name: "Overhead press",
    family: "overhead",
    requiresAny: ["dumbbells", "barbell", "kettlebell"],
    counter: { downBelow: 100, upAbove: 155, minRepMs: 400 },
    rules: [{ id: "no-swing" }],
  },
  {
    id: "arnold-press",
    name: "Arnold press",
    family: "overhead",
    requiresAny: ["dumbbells"],
    counter: { downBelow: 100, upAbove: 155, minRepMs: 500 },
    rules: [{ id: "no-swing" }],
  },

  {
    id: "military-press",
    name: "Military press",
    family: "overhead",
    requiresAny: ["barbell"],
    counter: { downBelow: 100, upAbove: 155, minRepMs: 400 },
    rules: [{ id: "no-swing" }],
  },
  {
    id: "shoulder-press-machine",
    name: "Shoulder press machine",
    family: "overhead",
    requiresAny: ["machines"],
    setupHint: "Front view, seated, arms in frame",
    counter: { downBelow: 100, upAbove: 155, minRepMs: 400 },
  },
  {
    id: "handstand-pushup",
    name: "Handstand push-up (wall)",
    family: "overhead",
    requiresAny: [],
    view: "side",
    setupHint: "Side view against a wall, whole body in frame",
    counter: { downBelow: 100, upAbove: 150, minRepMs: 500 },
  },

  // ---------- Row (elbow) ----------
  {
    id: "inverted-row",
    name: "Inverted row",
    family: "row",
    requiresAny: ["rings", "barbell"],
    setupHint: "Side view, low bar or rings, whole body in frame",
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
    rules: [{ id: "hips", sagCue: "Hips up", pikeCue: "Keep your body straight" }],
  },
  {
    id: "dumbbell-row",
    name: "Dumbbell row",
    family: "row",
    requiresAny: DUMBBELL_OR_KB,
    setupHint: "Side view, working arm closest to the camera",
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
  },
  {
    id: "band-row",
    name: "Band row",
    family: "row",
    requiresAny: ["bands", "cable-machine"],
    setupHint: "Side view, arms and torso in frame",
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
    rules: [{ id: "no-swing" }],
  },

  {
    id: "barbell-row",
    name: "Bent-over barbell row",
    family: "row",
    requiresAny: ["barbell"],
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
  },
  {
    id: "seated-cable-row",
    name: "Seated cable row",
    family: "row",
    requiresAny: ["cable-machine"],
    setupHint: "Side view, seated, arms and torso in frame",
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
    rules: [{ id: "no-swing" }],
  },
  {
    id: "t-bar-row",
    name: "T-bar row",
    family: "row",
    requiresAny: ["barbell", "machines"],
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
  },

  // ---------- Vertical pull (elbow + chin over the bar) ----------
  {
    id: "pullup",
    name: "Pull-up",
    family: "vertical-pull",
    requiresAny: BAR_OR_RINGS,
    classic: true,
    counter: { downBelow: 90, upAbove: 150, minRepMs: 500 },
    goal: "chin-over-bar",
    missCues: { goal: "Chin over the bar", shallow: "Pull higher", "no-lockout": "Full hang at the bottom" },
  },
  {
    id: "chin-up",
    name: "Chin-up",
    family: "vertical-pull",
    requiresAny: BAR_OR_RINGS,
    counter: { downBelow: 90, upAbove: 150, minRepMs: 500 },
    goal: "chin-over-bar",
    missCues: { goal: "Chin over the bar", shallow: "Pull higher", "no-lockout": "Full hang at the bottom" },
  },
  {
    id: "negative-pullup",
    name: "Negative pull-up",
    family: "vertical-pull",
    requiresAny: BAR_OR_RINGS,
    setupHint: "Front view, jump to the top, then lower slowly",
    phaseLabel: { up: "Hang", down: "Top" },
    // A rep is the slow lowering: from reaching the top to a full hang must take 2.5 s+.
    counter: { downBelow: 90, upAbove: 150, minRepMs: 2500 },
    missCues: { "too-fast": "Lower slower" },
  },

  {
    id: "wide-pullup",
    name: "Wide-grip pull-up",
    family: "vertical-pull",
    requiresAny: ["pullup-bar"],
    counter: { downBelow: 90, upAbove: 150, minRepMs: 500 },
    goal: "chin-over-bar",
    missCues: { goal: "Chin over the bar", shallow: "Pull higher", "no-lockout": "Full hang at the bottom" },
  },
  {
    id: "assisted-pullup",
    name: "Assisted pull-up",
    family: "vertical-pull",
    requiresAny: ["assist-band", "machines"],
    counter: { downBelow: 90, upAbove: 150, minRepMs: 500 },
    goal: "chin-over-bar",
    missCues: { goal: "Chin over the bar", shallow: "Pull higher", "no-lockout": "Full hang at the bottom" },
  },
  {
    id: "lat-pulldown",
    name: "Lat pulldown",
    family: "vertical-pull",
    requiresAny: ["machines", "cable-machine"],
    setupHint: "Front view, seated, arms and bar in frame",
    phaseLabel: { up: "Arms up", down: "Pulled" },
    counter: { downBelow: 90, upAbove: 150, minRepMs: 500 },
    missCues: { shallow: "Pull the bar to your chest", "no-lockout": "Arms straight at the top" },
  },

  // ---------- Single joint ----------
  {
    id: "bicep-curl",
    name: "Bicep curl",
    family: "single-joint",
    requiresAny: ["dumbbells", "bands", "barbell", "ez-bar", "cable-machine"],
    phaseLabel: CURL_LABELS,
    missCues: CURL_CUES,
    counter: { downBelow: 70, upAbove: 150, minRepMs: 400 },
    rules: [{ id: "no-swing" }],
  },
  {
    id: "hammer-curl",
    name: "Hammer curl",
    family: "single-joint",
    requiresAny: ["dumbbells"],
    phaseLabel: CURL_LABELS,
    missCues: CURL_CUES,
    counter: { downBelow: 70, upAbove: 150, minRepMs: 400 },
    rules: [{ id: "no-swing" }],
  },
  {
    id: "lateral-raise",
    name: "Lateral raise",
    family: "single-joint",
    requiresAny: ["dumbbells", "bands", "cable-machine"],
    signal: "arm-raise",
    view: "front",
    setupHint: "Front view, arms and torso in frame",
    phaseLabel: RAISE_LABELS,
    missCues: RAISE_CUES,
    counter: { downBelow: 110, upAbove: 150, minRepMs: 400 },
    rules: [{ id: "raise-too-high" }, { id: "no-swing" }],
  },
  {
    id: "front-raise",
    name: "Front raise",
    family: "single-joint",
    requiresAny: ["dumbbells", "bands", "kettlebell"],
    signal: "arm-raise",
    setupHint: "Side view, arms and torso in frame",
    phaseLabel: RAISE_LABELS,
    missCues: RAISE_CUES,
    counter: { downBelow: 110, upAbove: 150, minRepMs: 400 },
    rules: [{ id: "raise-too-high" }, { id: "no-swing" }],
  },
  {
    id: "tricep-extension",
    name: "Overhead tricep extension",
    family: "single-joint",
    requiresAny: ["dumbbells", "kettlebell", "ez-bar", "bands"],
    setupHint: "Side view, arms overhead and in frame",
    phaseLabel: { up: "Arms straight", down: "Lowered" },
    missCues: { shallow: "Lower further behind your head", "no-lockout": "Straighten your arms" },
    counter: { downBelow: 80, upAbove: 150, minRepMs: 400 },
  },
  {
    id: "calf-raise",
    name: "Calf raise",
    family: "single-joint",
    requiresAny: [],
    signal: "heel-raise",
    setupHint: "Side view, camera at ankle height, feet clearly visible",
    phaseLabel: { up: "Heels down", down: "On toes" },
    missCues: { shallow: "Rise higher" },
    // Small movement: the foot tilts only ~30–40°, so the band is narrow.
    counter: { downBelow: 70, upAbove: 80, minRepMs: 300 },
  },

  {
    id: "concentration-curl",
    name: "Concentration curl",
    family: "single-joint",
    requiresAny: ["dumbbells"],
    setupHint: "Side view, seated, working arm closest to the camera",
    phaseLabel: CURL_LABELS,
    missCues: CURL_CUES,
    counter: { downBelow: 70, upAbove: 150, minRepMs: 400 },
  },
  {
    id: "cable-curl",
    name: "Cable curl",
    family: "single-joint",
    requiresAny: ["cable-machine"],
    phaseLabel: CURL_LABELS,
    missCues: CURL_CUES,
    counter: { downBelow: 70, upAbove: 150, minRepMs: 400 },
    rules: [{ id: "no-swing" }],
  },
  {
    id: "preacher-curl",
    name: "Preacher curl",
    family: "single-joint",
    requiresAny: ["barbell", "ez-bar", "dumbbells", "machines"],
    setupHint: "Side view, seated at the bench, arms in frame",
    phaseLabel: CURL_LABELS,
    missCues: CURL_CUES,
    counter: { downBelow: 70, upAbove: 150, minRepMs: 400 },
  },
  {
    id: "triceps-pushdown",
    name: "Triceps pushdown",
    family: "single-joint",
    requiresAny: ["cable-machine", "bands"],
    setupHint: "Side view, arms and torso in frame",
    // Starts with elbows bent: each push down to straight arms counts.
    phaseLabel: { up: "Arms straight", down: "Bent" },
    missCues: { "no-lockout": "Straighten your arms fully" },
    counter: { downBelow: 100, upAbove: 150, minRepMs: 400 },
    rules: [{ id: "no-swing" }],
  },

  // ---------- Core (hip angle) ----------
  {
    id: "sit-up",
    name: "Sit-up",
    family: "core",
    requiresAny: [],
    // Lying with bent knees the hip is ~135°; sitting up closes it to ~60°.
    counter: { downBelow: 80, upAbove: 115, minRepMs: 500 },
  },
  {
    id: "lying-leg-raise",
    name: "Lying leg raise",
    family: "core",
    requiresAny: [],
    counter: { downBelow: 115, upAbove: 155, minRepMs: 500 },
  },
  {
    id: "captains-chair-knee-raise",
    name: "Knee raise (captain's chair)",
    family: "core",
    requiresAny: ["dip-station", "machines"],
    setupHint: "Side view, whole body in frame",
    counter: { downBelow: 120, upAbove: 155, minRepMs: 500 },
  },
  {
    id: "hanging-leg-raise",
    name: "Hanging leg raise",
    family: "core",
    requiresAny: ["pullup-bar"],
    setupHint: "Side view, bar and whole body in frame",
    counter: { downBelow: 115, upAbove: 155, minRepMs: 500 },
  },
  {
    id: "v-up",
    name: "V-up",
    family: "core",
    requiresAny: [],
    counter: { downBelow: 110, upAbove: 155, minRepMs: 500 },
  },

  // ---------- Holds ----------
  {
    id: "plank",
    name: "Plank",
    family: "hold",
    requiresAny: [],
    classic: true,
    hold: { signal: "body-line", gate: "horizontal", maxDeviation: 15, graceMs: 600 },
    rules: [{ id: "hips", sagCue: "Lift your hips", pikeCue: "Lower your hips" }],
  },
  {
    id: "side-plank",
    name: "Side plank",
    family: "hold",
    requiresAny: [],
    view: "front",
    setupHint: "Facing the camera, whole body in frame",
    hold: { signal: "body-line", gate: "horizontal", maxDeviation: 15, graceMs: 600 },
  },
  {
    id: "hollow-hold",
    name: "Hollow hold",
    family: "hold",
    requiresAny: [],
    // Lying on your back, shoulders and legs up: a slight bend at the hips.
    hold: { signal: "hip", band: [135, 170], gate: "horizontal", maxDeviation: 5 },
  },
  {
    id: "l-sit",
    name: "L-sit",
    family: "hold",
    requiresAny: [],
    setupHint: "Side view, whole body in frame",
    hold: { signal: "hip", band: [70, 115], gate: "legs-straight", maxDeviation: 5 },
  },
  {
    id: "dead-hang",
    name: "Dead hang",
    family: "hold",
    requiresAny: BAR_OR_RINGS,
    view: "front",
    setupHint: "Front view, bar and whole body in frame",
    hold: { signal: "elbow", band: [150, 180], gate: "hanging", maxDeviation: 5 },
  },
  {
    id: "wall-sit",
    name: "Wall sit",
    family: "hold",
    requiresAny: [],
    setupHint: "Side view, whole body in frame",
    hold: { signal: "knee", band: [75, 110], gate: "upright", maxDeviation: 5 },
  },
] as const satisfies readonly CatalogEntry[];

export type ExerciseId = (typeof CATALOG)[number]["id"];

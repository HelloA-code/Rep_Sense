import type { EquipmentId } from "@/lib/equipment";
import { CATALOG, type CatalogEntry } from "./catalog";
import { FAMILIES } from "./families";
import { LIBRARY } from "./library-data";
import type { Level, LibraryDetails, LibraryEntry, LibraryGroup, LogMode, OtherLibraryEntry, Tracking } from "./library-types";

// Every exercise in one list: camera-tracked ones (catalog.ts) joined with their library
// details, plus the ones you teach or log. Pure data and functions, so it's easy to test.

export type { LibraryDetails, LibraryGroup, LogMode, Tracking };

/** An exercise the camera doesn't count out of the box: taught once, or logged by hand. */
export type LibraryExerciseId = Extract<(typeof LIBRARY)[number], { tracking: "teach" | "log" }>["id"];

export type ExerciseItem = {
  id: string;
  name: string;
  group: LibraryGroup;
  tracking: Tracking;
  mode: LogMode;
  requiresAny: readonly EquipmentId[];
  level: Level | null;
  muscles: readonly string[];
  /** Has instructions in free-exercise-db. */
  sourced: boolean;
};

const GROUP_NAMES: Record<Exclude<LibraryGroup, keyof typeof FAMILIES>, string> = {
  cardio: "Cardio & jumps",
  skills: "Skills",
  mobility: "Mobility",
};

export const GROUP_ORDER: readonly LibraryGroup[] = [
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
  "cardio",
  "skills",
  "mobility",
];

export function groupName(group: LibraryGroup): string {
  return group in FAMILIES ? FAMILIES[group as keyof typeof FAMILIES].name : GROUP_NAMES[group as keyof typeof GROUP_NAMES];
}

const entries: readonly LibraryEntry[] = LIBRARY;
const meta = new Map(entries.map((e) => [e.id, e]));

function fromCatalog(c: CatalogEntry): ExerciseItem {
  const m = meta.get(c.id);
  return {
    id: c.id,
    name: c.name,
    group: c.family,
    tracking: "camera",
    mode: "hold" in c ? "seconds" : "reps",
    requiresAny: c.requiresAny,
    level: m?.level ?? null,
    muscles: m?.muscles ?? [],
    sourced: Boolean(m?.source),
  };
}

function fromLibrary(e: OtherLibraryEntry): ExerciseItem {
  return {
    id: e.id,
    name: e.name,
    group: e.group,
    tracking: e.tracking,
    mode: e.mode,
    requiresAny: e.requiresAny,
    level: e.level,
    muscles: e.muscles,
    sourced: Boolean(e.source),
  };
}

const catalog: readonly CatalogEntry[] = CATALOG;

/** Camera exercises first (catalog order), then the rest (library order). */
export const ALL_EXERCISES: readonly ExerciseItem[] = [
  ...catalog.map(fromCatalog),
  ...entries.filter((e): e is OtherLibraryEntry => e.tracking !== "camera").map(fromLibrary),
];

const byId = new Map(ALL_EXERCISES.map((e) => [e.id, e]));

export function exerciseInfo(id: string): ExerciseItem | undefined {
  return byId.get(id);
}

export function isLibraryOnly(id: string): id is LibraryExerciseId {
  const e = byId.get(id);
  return e !== undefined && e.tracking !== "camera";
}

export type ExerciseFilter = {
  query?: string;
  group?: LibraryGroup | null;
  /** Only exercises the camera counts: camera ones, plus taught ones. */
  cameraOnly?: boolean;
  /** Library ids the user has already taught. */
  taught?: ReadonlySet<string>;
  /** The user's equipment; null = show everything. */
  owned?: readonly EquipmentId[] | null;
};

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Search by name or muscle ("curl", "chest"), within a group, your equipment, and/or camera-only. */
export function filterExercises(items: readonly ExerciseItem[], f: ExerciseFilter): ExerciseItem[] {
  const q = words(f.query ?? "");
  const owned = f.owned ? new Set(f.owned) : null;
  return items.filter((e) => {
    if (f.group && e.group !== f.group) return false;
    if (f.cameraOnly && e.tracking !== "camera" && !f.taught?.has(e.id)) return false;
    if (owned && e.requiresAny.length > 0 && !e.requiresAny.some((id) => owned.has(id))) return false;
    if (!q) return true;
    const haystack = words([e.name, groupName(e.group), ...e.muscles].join(" "));
    return q.split(" ").every((w) => haystack.includes(w));
  });
}

let details: Promise<Record<string, LibraryDetails>> | null = null;

/** Instructions and muscles for one exercise, loaded the first time a detail sheet opens. */
export async function loadDetails(id: string): Promise<LibraryDetails | null> {
  details ??= import("./library-details.json").then((m) => m.default as Record<string, LibraryDetails>);
  return (await details)[id] ?? null;
}

/**
 * MET for exercises outside the catalog (Compendium of Physical Activities, 2011):
 * cardio and jumps vigorous 8.0, stretching (mild) 2.3, everything else moderate 3.8.
 */
export function groupMet(group: LibraryGroup): number {
  if (group === "cardio") return 8.0;
  if (group === "mobility") return 2.3;
  return 3.8;
}

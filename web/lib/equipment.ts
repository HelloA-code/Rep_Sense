// Equipment the user owns decides which exercises we offer (no bar → no pull-ups).
// Pure data + functions, no React, so it is easy to test.

export const EQUIPMENT = [
  { id: "pullup-bar", label: "Pull-up bar" },
  { id: "rings", label: "Rings" },
  { id: "parallettes", label: "Parallettes" },
  { id: "dip-station", label: "Dip station" },
  { id: "bands", label: "Resistance bands" },
  { id: "weight-vest", label: "Weight vest" },
  { id: "backpack", label: "Backpack" },
  { id: "bench", label: "Bench" },
  { id: "box", label: "Box or step" },
  { id: "dumbbells", label: "Dumbbells" },
  { id: "kettlebell", label: "Kettlebell" },
  { id: "mat", label: "Mat" },
] as const;

export type EquipmentId = (typeof EQUIPMENT)[number]["id"];

const ALL_IDS: readonly EquipmentId[] = EQUIPMENT.map((e) => e.id);

export const PRESETS = [
  { id: "minimal", label: "Minimal", equipment: ["backpack", "mat"] },
  {
    id: "home",
    label: "Home gym",
    equipment: ["pullup-bar", "rings", "parallettes", "bands", "weight-vest", "backpack", "dumbbells", "mat"],
  },
  { id: "park", label: "Park", equipment: ["pullup-bar", "dip-station", "bench", "box"] },
  { id: "gym", label: "Gym", equipment: ALL_IDS },
] as const satisfies readonly { id: string; label: string; equipment: readonly EquipmentId[] }[];

export type PresetId = (typeof PRESETS)[number]["id"];

/** The 6 tracked exercises. `requiresAny` empty = bodyweight only. */
export const EXERCISES = [
  { id: "squat", name: "Squat", requiresAny: [] },
  { id: "pushup", name: "Push-up", requiresAny: [] },
  { id: "pullup", name: "Pull-up", requiresAny: ["pullup-bar", "rings"] },
  { id: "dip", name: "Dip", requiresAny: ["dip-station", "rings"] },
  { id: "lunge", name: "Lunge", requiresAny: [] },
  { id: "plank", name: "Plank", requiresAny: [] },
] as const satisfies readonly { id: string; name: string; requiresAny: readonly EquipmentId[] }[];

export type Exercise = (typeof EXERCISES)[number];
export type ExerciseId = Exercise["id"];

export function isEquipmentId(value: unknown): value is EquipmentId {
  return typeof value === "string" && (ALL_IDS as readonly string[]).includes(value);
}

/** Sorted in grid order, without duplicates. */
export function normalizeEquipment(selection: readonly EquipmentId[]): EquipmentId[] {
  const set = new Set(selection);
  return ALL_IDS.filter((id) => set.has(id));
}

export function toggleEquipment(selection: readonly EquipmentId[], id: EquipmentId): EquipmentId[] {
  return selection.includes(id)
    ? selection.filter((x) => x !== id)
    : normalizeEquipment([...selection, id]);
}

/** The preset whose equipment exactly matches the selection, or null if customised. */
export function matchPreset(selection: readonly EquipmentId[]): PresetId | null {
  const mine = normalizeEquipment(selection);
  const preset = PRESETS.find((p) => {
    const theirs = normalizeEquipment(p.equipment);
    return theirs.length === mine.length && theirs.every((id, i) => id === mine[i]);
  });
  return preset?.id ?? null;
}

export function availableExercises(selection: readonly EquipmentId[]): Exercise[] {
  const owned = new Set(selection);
  return EXERCISES.filter(
    (ex) => ex.requiresAny.length === 0 || ex.requiresAny.some((id: EquipmentId) => owned.has(id)),
  );
}

import { loadCustomExercises, taughtFor } from "@/lib/data/custom-store";
import { EXERCISES } from "@/lib/equipment";
import { buildCustomExercise, isCustomId, type CustomExercise } from "./custom";
import type { AnyExerciseId } from "./ids";
import { EXERCISE_CONFIGS } from "./index";
import { exerciseInfo, isLibraryOnly } from "./library";
import type { ExerciseConfig } from "./types";

// One place to look up any exercise, built in or taught. Built-in ones come from the
// catalog; taught ones from this device's list (lib/data/custom-store.ts).

export type { AnyExerciseId };

const built = new Map<string, { source: CustomExercise; config: ExerciseConfig }>();

function custom(id: string, list: readonly CustomExercise[]): CustomExercise | undefined {
  return list.find((c) => c.id === id);
}

/**
 * The runnable camera config, or null when the camera can't count it: a library exercise
 * that's logged by hand or not taught yet, or a taught exercise from another device.
 */
export function exerciseConfig(id: string, list: readonly CustomExercise[] = loadCustomExercises()): ExerciseConfig | null {
  if (id in EXERCISE_CONFIGS) return EXERCISE_CONFIGS[id as keyof typeof EXERCISE_CONFIGS];
  // A library exercise you've taught counts under its own id and name.
  const c = isCustomId(id) ? custom(id, list) : isLibraryOnly(id) ? taughtFor(id, list) : undefined;
  if (!c) return null;
  const cached = built.get(id);
  if (cached && cached.source === c) return cached.config;
  const base = buildCustomExercise(c);
  const config = isCustomId(id) ? base : { ...base, id: id as AnyExerciseId, name: exerciseInfo(id)?.name ?? base.name };
  built.set(id, { source: c, config });
  return config;
}

/** A name to show for any exercise id, even one this device doesn't know. */
export function exerciseName(id: string, list?: readonly CustomExercise[]): string {
  const known = EXERCISES.find((e) => e.id === id) ?? exerciseInfo(id);
  if (known) return known.name;
  if (isCustomId(id)) return custom(id, list ?? loadCustomExercises())?.name ?? "Taught exercise";
  return id;
}

/** Any exercise this device knows: built in, in the library, or taught here (counted or not). */
export function isKnownExercise(id: string, list?: readonly CustomExercise[]): id is AnyExerciseId {
  if (id in EXERCISE_CONFIGS || exerciseInfo(id)) return true;
  return isCustomId(id) && custom(id, list ?? loadCustomExercises()) !== undefined;
}

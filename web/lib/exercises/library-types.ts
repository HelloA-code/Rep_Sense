import type { EquipmentId } from "@/lib/equipment";
import type { FamilyId } from "./families";

// Shapes of the generated library (library-data.ts, written by ml/src/build_exercises.py).

/** Picker groups: the movement families plus three for exercises that aren't strength reps. */
export type LibraryGroup = FamilyId | "cardio" | "skills" | "mobility";

/**
 * - camera: counted and form-checked straight away (an entry in catalog.ts)
 * - teach: counted once you've shown the app 3 reps ("Teach a rep")
 * - log: you type what you did; the camera can't see it reliably
 */
export type Tracking = "camera" | "teach" | "log";

/** What you log: reps, or time (seconds for holds and stretches, minutes for cardio machines). */
export type LogMode = "reps" | "seconds" | "minutes";

export type Level = "beginner" | "intermediate" | "expert";

type Meta = {
  readonly id: string;
  readonly level: Level | null;
  readonly muscles: readonly string[];
  /** Exercise id in free-exercise-db, or null when it isn't in the dataset (no instructions). */
  readonly source: string | null;
};

/** Name, family and equipment come from catalog.ts. */
export type CameraLibraryEntry = Meta & { readonly tracking: "camera" };

export type OtherLibraryEntry = Meta & {
  readonly name: string;
  readonly group: LibraryGroup;
  readonly tracking: "teach" | "log";
  readonly mode: LogMode;
  readonly requiresAny: readonly EquipmentId[];
};

export type LibraryEntry = CameraLibraryEntry | OtherLibraryEntry;

/** Loaded on demand from library-details.json. */
export type LibraryDetails = {
  source: string | null;
  instructions: string[];
  secondaryMuscles: string[];
};

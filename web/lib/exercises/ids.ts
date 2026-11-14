import type { ExerciseId } from "./catalog";

/** An exercise the user taught the app: "custom-" + random letters and digits. */
export type CustomExerciseId = `custom-${string}`;

/** Any exercise the engine can run: built in (catalog) or taught. */
export type AnyExerciseId = ExerciseId | CustomExerciseId;

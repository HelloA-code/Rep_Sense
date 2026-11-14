import type { ExerciseId } from "./catalog";
import type { LibraryExerciseId } from "./library";

/** An exercise the user taught the app: "custom-" + random letters and digits. */
export type CustomExerciseId = `custom-${string}`;

/** Any exercise: camera-tracked (catalog), from the library (taught or logged), or taught from scratch. */
export type AnyExerciseId = ExerciseId | LibraryExerciseId | CustomExerciseId;

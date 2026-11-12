import { buildExercise } from "./build";
import { CATALOG, type ExerciseId } from "./catalog";
import type { ExerciseConfig } from "./types";

export const EXERCISE_CONFIGS = Object.fromEntries(CATALOG.map((entry) => [entry.id, buildExercise(entry)])) as Record<
  ExerciseId,
  ExerciseConfig
>;

export type { ExerciseConfig, HoldExercise, PoseFrame, RepExercise } from "./types";

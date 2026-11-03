import type { ExerciseConfig } from "@/lib/exercises/types";
import type { Recording } from "@/lib/recording/format";
import { frameLandmarks } from "@/lib/recording/replay";
import { createSetEngine, type SetResult } from "./set-engine";

/**
 * Runs a saved clip through the same set engine the live camera uses. Gives the
 * "app count" for comparing against a manual count (ml/reports/rep_counting.md).
 */
export function countRepsInRecording(rec: Recording, exercise: ExerciseConfig): SetResult {
  const engine = createSetEngine(exercise);
  const width = rec.source.width || 1280;
  const height = rec.source.height || 720;
  for (const frame of rec.frames) engine.process(frameLandmarks(frame), frame.t, width, height);
  return engine.finish(rec.frames.at(-1)?.t ?? 0);
}

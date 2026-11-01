import type { ExerciseId } from "@/lib/equipment";
import { config as dip } from "./dip";
import { config as lunge } from "./lunge";
import { config as plank } from "./plank";
import { config as pullup } from "./pullup";
import { config as pushup } from "./pushup";
import { config as squat } from "./squat";
import type { ExerciseConfig } from "./types";

export const EXERCISE_CONFIGS: Record<ExerciseId, ExerciseConfig> = { squat, pushup, pullup, dip, lunge, plank };

export type { ExerciseConfig, HoldExercise, PoseFrame, RepExercise } from "./types";

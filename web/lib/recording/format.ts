import { EXERCISES, type ExerciseId } from "@/lib/equipment";
import type { Landmark, WorldLandmark } from "@/lib/pose/landmarks";

// Landmark recording format v1, shared with the Python scripts in ml/.
// Documented in ml/README.md: change both together.

export const RECORDING_VERSION = 1;
export const MAX_RECORDING_MS = 60_000;

/**
 * Every catalog exercise plus "idle" (standing, walking, resting) as a negative class.
 * The classifier is only trained on some of them (ml/src/features.py LABELS); the others
 * can still be recorded for future training.
 */
export type RecordingLabel = ExerciseId | "idle";
export const RECORDING_LABELS: readonly { id: RecordingLabel; name: string }[] = [
  ...EXERCISES.map((e) => ({ id: e.id, name: e.name })),
  { id: "idle", name: "Idle" },
];

export const CAMERA_VIEWS = ["front", "side"] as const;
export type CameraView = (typeof CAMERA_VIEWS)[number];

export type RecordedFrame = {
  /** ms since recording start */
  t: number;
  /** 33 × [x, y, z, visibility], normalised image coords, NOT mirrored */
  lm: number[][];
  /** 33 × [x, y, z] in metres, hip-centred */
  world: number[][] | null;
};

export type Recording = {
  version: typeof RECORDING_VERSION;
  label: RecordingLabel;
  /** Who is recording; ml/ splits train/test by this so a person is never in both. */
  subject: string;
  view: CameraView;
  createdAt: string;
  durationMs: number;
  frameCount: number;
  fpsAvg: number;
  source: { facing: "user" | "environment"; width: number; height: number };
  frames: RecordedFrame[];
};

export type RecorderOptions = Pick<Recording, "label" | "subject" | "view" | "source"> & {
  /** performance.now() at start, same clock as push() */
  startedAt: number;
  createdAt: Date;
};

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

export function createRecorder(options: RecorderOptions) {
  const frames: RecordedFrame[] = [];
  let lastT = 0;

  return {
    /** Adds a frame; returns false once the 60 s cap is reached. Frames with no pose are skipped by the caller. */
    push(now: number, landmarks: readonly Landmark[], world: readonly WorldLandmark[] | null): boolean {
      const t = Math.round(now - options.startedAt);
      if (t > MAX_RECORDING_MS) return false;
      frames.push({
        t,
        lm: landmarks.map((l) => [r4(l.x), r4(l.y), r4(l.z), r4(l.visibility)]),
        world: world ? world.map((w) => [r4(w.x), r4(w.y), r4(w.z)]) : null,
      });
      lastT = t;
      return true;
    },
    elapsedMs(now: number) {
      return Math.max(0, now - options.startedAt);
    },
    get frameCount() {
      return frames.length;
    },
    finish(): Recording {
      const fpsAvg = frames.length > 1 && lastT > 0 ? ((frames.length - 1) * 1000) / lastT : 0;
      return {
        version: RECORDING_VERSION,
        label: options.label,
        subject: options.subject.trim() || "anonymous",
        view: options.view,
        createdAt: options.createdAt.toISOString(),
        durationMs: lastT,
        frameCount: frames.length,
        fpsAvg: Math.round(fpsAvg * 10) / 10,
        source: options.source,
        frames,
      };
    },
  };
}

/** e.g. repsense_squat_side_aditya_20261101-142530.json */
export function recordingFileName(rec: Recording): string {
  const stamp = rec.createdAt.replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const subject = rec.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "anonymous";
  return `repsense_${rec.label}_${rec.view}_${subject}_${stamp}.json`;
}

import type { PoseLandmarker } from "@mediapipe/tasks-vision";

// Both files are self-hosted: the model is committed in public/models, the WASM
// runtime is copied from node_modules by scripts/copy-mediapipe-wasm.mjs.
const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/models/pose_landmarker_lite.task";

export type Delegate = "GPU" | "CPU";
export type LoadedLandmarker = { landmarker: PoseLandmarker; delegate: Delegate };

let loading: Promise<LoadedLandmarker> | null = null;

async function create(delegate: Delegate): Promise<PoseLandmarker> {
  // Imported lazily so the ~1 MB bundle only loads on the workout screen.
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

/** One shared landmarker per page load. Tries the GPU first, then falls back to CPU. */
export function getPoseLandmarker(): Promise<LoadedLandmarker> {
  if (!loading) {
    loading = create("GPU")
      .then((landmarker): LoadedLandmarker => ({ landmarker, delegate: "GPU" }))
      .catch(async () => ({ landmarker: await create("CPU"), delegate: "CPU" as const }));
    // Let a later call retry if both attempts failed (e.g. offline).
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

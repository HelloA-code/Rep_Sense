import { FEATURE_VERSION, LABELS, NUM_FEATURES, WINDOW } from "./features";

// The exercise classifier in the browser. ONNX Runtime (~10 MB of WASM, self-hosted) only
// loads when auto-detect is turned on. Runs on this device; nothing is sent anywhere.

const MODEL_URL = "/models/exercise_classifier.onnx";
const META_URL = "/models/exercise_classifier.json";

export type ModelInfo = {
  /** "synthetic" = the stick-figure stand-in, not trained on real people. */
  provenance: "real" | "synthetic";
  featureVersion: number;
  labels: string[];
  window: number;
  numFeatures: number;
};

/** Null if there's no model, or it was built for different features than this code. */
export async function loadModelInfo(): Promise<ModelInfo | null> {
  try {
    const res = await fetch(META_URL);
    if (!res.ok) return null;
    const info = (await res.json()) as ModelInfo;
    const compatible =
      info.featureVersion === FEATURE_VERSION &&
      info.window === WINDOW &&
      info.numFeatures === NUM_FEATURES &&
      info.labels.join() === LABELS.join();
    return compatible ? info : null;
  } catch {
    return null;
  }
}

export type Classifier = {
  /** Input: WINDOW × NUM_FEATURES, flattened. Output: one probability per label. */
  predict(window: Float32Array): Promise<Float32Array>;
};

let loading: Promise<Classifier> | null = null;

export function loadClassifier(): Promise<Classifier> {
  loading ??= (async () => {
    const ort = await import("onnxruntime-web/wasm");
    ort.env.wasm.wasmPaths = "/ort/";
    // Threads need cross-origin isolation headers, which would break other things;
    // this model is small enough that one thread is plenty.
    ort.env.wasm.numThreads = 1;
    const session = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] });
    return {
      async predict(window: Float32Array) {
        const input = new ort.Tensor("float32", window, [1, WINDOW, NUM_FEATURES]);
        const output = await session.run({ input });
        return output.probabilities.data as Float32Array;
      },
    };
  })().catch((err: unknown) => {
    loading = null; // allow a retry
    throw err;
  });
  return loading;
}

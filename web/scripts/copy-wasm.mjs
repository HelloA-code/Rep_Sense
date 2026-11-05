// Copies the MediaPipe and ONNX Runtime WASM files into public/ so we self-host them (no CDN).
// Runs before `dev` and `build`; the output folders are gitignored.
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const modules = join(root, "node_modules");

const mediapipe = join(modules, "@mediapipe", "tasks-vision", "wasm");
const ort = join(modules, "onnxruntime-web", "dist");
const ORT_FILES = ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"];

if (!existsSync(mediapipe) || !existsSync(ort)) {
  console.error("copy-wasm: run npm install first");
  process.exit(1);
}

const mediapipeDest = join(root, "public", "mediapipe", "wasm");
mkdirSync(mediapipeDest, { recursive: true });
cpSync(mediapipe, mediapipeDest, { recursive: true });

const ortDest = join(root, "public", "ort");
mkdirSync(ortDest, { recursive: true });
for (const file of ORT_FILES) copyFileSync(join(ort, file), join(ortDest, file));

console.log("copy-wasm: copied to public/mediapipe/wasm and public/ort");

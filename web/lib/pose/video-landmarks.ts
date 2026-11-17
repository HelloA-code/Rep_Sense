import type { Landmark, WorldLandmark } from "./landmarks";
import { getPoseLandmarker } from "./landmarker";

// A video file → body landmarks, on this device. The video is never uploaded: it's read
// into a hidden <video>, and the pose model runs on frames picked at a steady rate.

/** The classifier and its training windows use 15 Hz, so sampling faster adds nothing. */
export const VIDEO_FPS = 15;
/** Same cap as a recording. */
export const MAX_VIDEO_MS = 60_000;

export type VideoFrame = { t: number; landmarks: Landmark[]; world: WorldLandmark[] | null };

export type VideoLandmarks = {
  /** Only frames where a person was found; `t` is the time in the video (ms). */
  frames: VideoFrame[];
  width: number;
  height: number;
  /** How much of the video was read (the first 60 s at most). */
  durationMs: number;
  /** The video was longer than the cap. */
  truncated: boolean;
};

/** The video times (ms) to read: every 1/fps seconds, up to the cap. */
export function sampleTimes(durationMs: number, fps = VIDEO_FPS, maxMs = MAX_VIDEO_MS): number[] {
  const end = Math.min(Math.max(0, durationMs), maxMs);
  const step = 1000 / fps;
  const times: number[] = [];
  for (let t = 0; t <= end; t += step) times.push(Math.round(t));
  return times;
}

export class VideoReadError extends Error {
  constructor(public readonly reason: "unsupported" | "empty" | "cancelled" | "model") {
    super(reason);
  }
}

function once(target: HTMLVideoElement, event: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(event, onEvent);
      target.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new VideoReadError("unsupported"));
    };
    const onAbort = () => {
      cleanup();
      reject(new VideoReadError("cancelled"));
    };
    target.addEventListener(event, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Video length in ms. Browser-recorded WebM files often don't store it (duration is
 * Infinity): seeking far past the end makes the browser work it out, then we go back.
 */
async function videoDurationMs(video: HTMLVideoElement, signal?: AbortSignal): Promise<number> {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration * 1000;
  video.currentTime = 1e7;
  await once(video, "seeked", signal);
  const ms = Number.isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : 0;
  video.currentTime = 0;
  await once(video, "seeked", signal);
  return ms;
}

export async function extractFromVideo(
  file: Blob,
  { onProgress, signal }: { onProgress?: (share: number) => void; signal?: AbortSignal } = {},
): Promise<VideoLandmarks> {
  let landmarker;
  try {
    ({ landmarker } = await getPoseLandmarker());
  } catch {
    throw new VideoReadError("model");
  }

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  // Kept in the page but invisible: some mobile browsers won't decode frames otherwise.
  video.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
  document.body.appendChild(video);
  video.src = url;
  try {
    if (video.readyState < 1) await once(video, "loadedmetadata", signal);
    const durationMs = await videoDurationMs(video, signal);
    const times = sampleTimes(durationMs);
    if (times.length < 2 || !video.videoWidth) throw new VideoReadError("empty");

    const frames: VideoFrame[] = [];
    for (let i = 0; i < times.length; i++) {
      if (signal?.aborted) throw new VideoReadError("cancelled");
      video.currentTime = times[i] / 1000;
      await once(video, "seeked", signal);
      // The shared model needs ever-increasing timestamps; the video's own time is kept in `t`.
      const result = landmarker.detectForVideo(video, performance.now());
      const pose = result.landmarks[0];
      if (pose) frames.push({ t: times[i], landmarks: pose, world: result.worldLandmarks[0] ?? null });
      onProgress?.((i + 1) / times.length);
    }
    return {
      frames,
      width: video.videoWidth,
      height: video.videoHeight,
      durationMs: times[times.length - 1],
      truncated: durationMs > MAX_VIDEO_MS,
    };
  } finally {
    video.remove();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

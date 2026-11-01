// Records the camera stream to a video file with MediaRecorder, kept only on this device.
// Safari records MP4 (H.264); Chrome/Firefox record WebM. We take the first one supported.

const MIME_TYPES = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

/** ~2.5 Mbit/s: a 60 s clip is about 19 MB. */
const VIDEO_BITRATE = 2_500_000;

export function pickVideoMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

export function videoExtension(type: string): "mp4" | "webm" {
  return type.startsWith("video/mp4") ? "mp4" : "webm";
}

export type VideoRecording = { stop(): Promise<Blob | null> };

/** Starts recording `stream` right away. Returns null if this browser can't record video. */
export function startVideoRecording(stream: MediaStream): VideoRecording | null {
  const mimeType = pickVideoMimeType();
  if (!mimeType) return null;
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VIDEO_BITRATE });
  } catch {
    return null;
  }
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  recorder.start(1000); // a chunk per second, so a crash doesn't lose everything

  return {
    stop() {
      return new Promise((resolve) => {
        if (recorder.state === "inactive") {
          resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType || mimeType }) : null);
          return;
        }
        recorder.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType || mimeType }) : null);
        recorder.stop();
      });
    },
  };
}

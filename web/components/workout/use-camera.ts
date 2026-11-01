"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Facing = "user" | "environment";
export type CameraError = "insecure" | "unsupported" | "denied" | "not-found" | "in-use" | "unknown";
export type CameraStatus = "idle" | "starting" | "live" | "error";

export const CAMERA_ERROR_TEXT: Record<CameraError, { title: string; text: string }> = {
  insecure: { title: "Camera needs HTTPS", text: "Open the app over https:// (or localhost) to use the camera." },
  unsupported: { title: "Camera not supported", text: "This browser can't access a camera. Try Chrome or Safari." },
  denied: {
    title: "Camera access blocked",
    text: "Allow camera access for this site in your browser settings, then try again.",
  },
  "not-found": { title: "No camera found", text: "Connect a camera or switch to a device that has one." },
  "in-use": { title: "Camera is busy", text: "Another app is using the camera. Close it and try again." },
  unknown: { title: "Couldn't start the camera", text: "Something went wrong opening the camera. Try again." },
};

function toCameraError(e: unknown): CameraError {
  const name = e instanceof DOMException || e instanceof Error ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "not-found";
  if (name === "NotReadableError" || name === "AbortError") return "in-use";
  return "unknown";
}

/** Opens the webcam into `videoRef` and stops every track on unmount. Video only, never audio. */
export function useCamera(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<CameraError | null>(null);
  const [facing, setFacing] = useState<Facing>("user");
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(
    async (nextFacing: Facing) => {
      if (!window.isSecureContext) {
        setError("insecure");
        setStatus("error");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("unsupported");
        setStatus("error");
        return;
      }
      stop();
      setStatus("starting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: nextFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setSize({ width: video.videoWidth, height: video.videoHeight });
        setFacing(nextFacing);
        setError(null);
        setStatus("live");
      } catch (e) {
        stop();
        setError(toCameraError(e));
        setStatus("error");
      }
    },
    [stop, videoRef],
  );

  useEffect(() => stop, [stop]);

  return { status, error, facing, size, start, stop };
}

"use client";

import { MotionConfig } from "framer-motion";

/** Turns off transform/layout animations for users with prefers-reduced-motion. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

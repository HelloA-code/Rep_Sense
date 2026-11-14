import type { Metadata } from "next";
import { TeachCamera } from "@/components/teach/teach-camera";

export const metadata: Metadata = { title: "Teach an exercise · RepSense" };

/** Teach a rep: learn a new exercise from 3 reps. */
export default function TeachPage() {
  return <TeachCamera />;
}

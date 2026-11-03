import type { Metadata } from "next";
import { WorkoutCamera } from "@/components/workout/workout-camera";

export const metadata: Metadata = { title: "Free camera · RepSense" };

/** Free mode: pick any exercise, count reps, record clips for the dataset. */
export default function RecordPage() {
  return <WorkoutCamera />;
}

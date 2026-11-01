import type { Metadata } from "next";
import { WorkoutCamera } from "@/components/workout/workout-camera";

export const metadata: Metadata = { title: "Workout · RepSense" };

export default function WorkoutPage() {
  return <WorkoutCamera />;
}

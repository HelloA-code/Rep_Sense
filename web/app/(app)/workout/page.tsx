import type { Metadata } from "next";
import { WorkoutFlow } from "@/components/workout/workout-flow";

export const metadata: Metadata = { title: "Workout · RepSense" };

export default function WorkoutPage() {
  return <WorkoutFlow />;
}

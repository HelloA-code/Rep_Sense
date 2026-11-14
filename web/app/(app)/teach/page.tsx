import type { Metadata } from "next";
import { TeachCamera } from "@/components/teach/teach-camera";

export const metadata: Metadata = { title: "Teach an exercise · RepSense" };

/** Teach a rep: learn a new exercise from 3 reps. `?for=<id>` teaches a library exercise. */
export default async function TeachPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const { for: forId } = await searchParams;
  return <TeachCamera forId={typeof forId === "string" ? forId : undefined} />;
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheckIcon } from "lucide-react";
import { PrimaryButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { availableExercises } from "@/lib/equipment";
import { loadOnboarding, type OnboardingData } from "@/lib/onboarding";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function TodayView() {
  const router = useRouter();
  const [data, setData] = useState<OnboardingData | null>(null);
  const [hour, setHour] = useState<number | null>(null);

  // localStorage only exists in the browser, so the onboarding check runs after mount.
  useEffect(() => {
    const saved = loadOnboarding();
    if (!saved) {
      router.replace("/onboarding");
      return;
    }
    setData(saved);
    setHour(new Date().getHours());
  }, [router]);

  if (!data || hour === null) return null;

  const exercises = availableExercises(data.equipment);

  return (
    <>
      <PageHeader title="Today" subtitle={`${greeting(hour)}. Ready to move?`} />

      <div className="flex flex-col gap-3">
        <Card>
          <p className="text-[15px] font-bold">Exercises for your setup</p>
          <p className="mt-1 text-[13px] font-medium text-muted">Based on the equipment you picked.</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {exercises.map((ex) => (
              <li
                key={ex.id}
                className="rounded-chip border border-border-strong bg-surface px-3 py-2 text-[13px] font-bold"
              >
                {ex.name}
              </li>
            ))}
          </ul>
        </Card>

        <EmptyState
          icon={CalendarCheckIcon}
          title="Suggested sessions coming soon"
          text="Your daily session, streak and weekly chart will show up here."
        />

        <PrimaryButton disabled className="mt-2">
          Start workout
        </PrimaryButton>
      </div>
    </>
  );
}

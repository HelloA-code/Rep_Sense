"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarCheckIcon, ChevronRightIcon, FlameIcon, UtensilsIcon } from "lucide-react";
import { SignInCard } from "@/components/tabs/sign-in-card";
import { PrimaryButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { dayKey, lastTrained, repsPerDay, streak, type SessionWithSets } from "@/lib/data/stats";
import { suggestSession } from "@/lib/data/suggest";
import { EXERCISES } from "@/lib/equipment";
import { loadOnboarding, saveOnboarding, type OnboardingData } from "@/lib/onboarding";
import { savePlan } from "@/lib/workout/plan-store";

// Recharts is heavy and only shown to signed-in users with workouts.
const RepsBarChart = dynamic(() => import("@/components/charts/reps-bar-chart").then((m) => m.RepsBarChart), {
  ssr: false,
});

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

type TodayViewProps = {
  signedIn: boolean;
  /** Calories eaten recently and the target, when the Diet tab is set up. */
  calories?: { meals: { eaten_at: string; kcal: number }[]; target: number } | null;
  serverProfile: OnboardingData | null;
  sessions: SessionWithSets[];
};

export function TodayView({ signedIn, serverProfile, sessions, calories }: TodayViewProps) {
  const router = useRouter();
  const [data, setData] = useState<OnboardingData | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  // localStorage and the user's clock only exist in the browser, so this runs after mount.
  useEffect(() => {
    if (serverProfile) saveOnboarding(serverProfile);
    const saved = serverProfile ?? loadOnboarding();
    if (!saved) {
      router.replace("/onboarding");
      return;
    }
    setData(saved);
    setNow(new Date());
  }, [router, serverProfile]);

  if (!data || !now) return null;

  const suggestion = suggestSession(data.equipment, data.level, lastTrained(sessions));
  const totalSets = suggestion.exercises.length * suggestion.sets;
  const days = streak(
    sessions.map((s) => s.started_at),
    now,
  );

  function startSuggested() {
    savePlan(suggestion);
    router.push("/workout");
  }

  return (
    <>
      <PageHeader title="Today" subtitle={`${greeting(now.getHours())}. Ready to move?`} />

      <div className="flex flex-col gap-3">
        <Card>
          <p className="badge-text text-accent">Suggested session</p>
          <p className="mt-2 text-[20px] font-extrabold tracking-tight">
            {suggestion.exercises.length} exercises · {totalSets} sets
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {suggestion.exercises.map((id) => (
              <li
                key={id}
                className="rounded-chip border border-border-strong bg-surface px-3 py-2 text-[13px] font-bold"
              >
                {EXERCISES.find((e) => e.id === id)?.name} · {suggestion.sets} sets
              </li>
            ))}
          </ul>
          <PrimaryButton onClick={startSuggested} className="mt-4">
            Start workout
          </PrimaryButton>
        </Card>

        {calories && (
          <Link href="/diet" className="block">
            <Card className="flex items-center gap-4 p-4">
              <span className="grid size-11 place-items-center rounded-full border border-accent-border bg-accent-tint text-accent">
                <UtensilsIcon className="size-5" />
              </span>
              <div className="flex-1">
                <p className="text-[22px] leading-none font-extrabold tabular-nums">
                  {Math.round(
                    calories.meals
                      .filter((m) => dayKey(new Date(m.eaten_at)) === dayKey(now))
                      .reduce((sum, m) => sum + m.kcal, 0),
                  ).toLocaleString("en")}{" "}
                  <span className="text-[14px] text-muted">/ {calories.target.toLocaleString("en")} kcal</span>
                </p>
                <p className="mt-1 text-[12px] font-semibold text-muted">Eaten today</p>
              </div>
              <ChevronRightIcon className="size-4 text-muted" />
            </Card>
          </Link>
        )}

        {signedIn ? (
          sessions.length > 0 ? (
            <>
              <Card className="flex items-center gap-4 p-4">
                <span className="grid size-11 place-items-center rounded-full border border-accent-border bg-accent-tint text-accent">
                  <FlameIcon className="size-5" />
                </span>
                <div>
                  <p className="text-[22px] leading-none font-extrabold tabular-nums">
                    {days} {days === 1 ? "day" : "days"}
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-muted">
                    {days > 0 ? "Current streak" : "Train today to start a streak"}
                  </p>
                </div>
              </Card>
              <Card>
                <p className="text-[15px] font-bold">Last 7 days</p>
                <RepsBarChart data={repsPerDay(sessions, now)} height={130} />
              </Card>
            </>
          ) : (
            <EmptyState
              icon={CalendarCheckIcon}
              title="No workouts yet"
              text="Your streak and weekly chart appear after your first session."
            />
          )
        ) : (
          <SignInCard text="Your streak and weekly chart appear once your workouts are saved." next="/today" />
        )}
      </div>
    </>
  );
}

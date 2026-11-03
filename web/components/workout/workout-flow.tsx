"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { availableExercises, type ExerciseId } from "@/lib/equipment";
import { loadOnboarding, type OnboardingData } from "@/lib/onboarding";
import type { SetResult } from "@/lib/workout/set-engine";
import { summarizeSession, type LoggedSet } from "@/lib/workout/summary";
import { ExercisePicker } from "./exercise-picker";
import { SessionSummary } from "./session-summary";
import { SetLogger } from "./set-logger";
import { WorkoutCamera } from "./workout-camera";

// pick → (per set: tip → 3-2-1 → set → log) → summary.
// The camera stays mounted for the whole run; the logger is an overlay on top of it.

const PLAN_KEY = "repsense.workout.plan";

type Step = "pick" | "run" | "summary";

function loadPlan(): { exercises: ExerciseId[]; sets: number } | null {
  try {
    const raw = window.localStorage.getItem(PLAN_KEY);
    return raw ? (JSON.parse(raw) as { exercises: ExerciseId[]; sets: number }) : null;
  } catch {
    return null;
  }
}

export function WorkoutFlow() {
  const router = useRouter();
  const [profile, setProfile] = useState<OnboardingData | null>(null);
  const [step, setStep] = useState<Step>("pick");
  const [selected, setSelected] = useState<ExerciseId[]>([]);
  const [setsPer, setSetsPer] = useState(3);
  const [setIndex, setSetIndex] = useState(0);
  const [logging, setLogging] = useState<SetResult | null>(null);
  const [logged, setLogged] = useState<LoggedSet[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [endedAt, setEndedAt] = useState(0);
  /** Bumped on "redo set" so the camera restarts the same set. */
  const [attempt, setAttempt] = useState(0);

  // Same gate as Today: equipment comes from onboarding (localStorage until Day 5).
  useEffect(() => {
    const saved = loadOnboarding();
    if (!saved) {
      router.replace("/onboarding");
      return;
    }
    setProfile(saved);
    const ids = availableExercises(saved.equipment).map((e) => e.id);
    const plan = loadPlan();
    const restored = plan?.exercises.filter((id) => ids.includes(id)) ?? [];
    setSelected(restored.length ? restored : ids.filter((id) => id === "squat" || id === "pushup"));
    if (plan && plan.sets >= 1 && plan.sets <= 5) setSetsPer(plan.sets);
  }, [router]);

  const available = useMemo(() => (profile ? availableExercises(profile.equipment) : []), [profile]);

  if (!profile) return null;

  const totalSets = selected.length * setsPer;
  const exerciseIndex = Math.floor(setIndex / setsPer);
  const setNumber = (setIndex % setsPer) + 1;
  const currentExercise = selected[exerciseIndex];
  const title = `Set ${setNumber} of ${setsPer}`;

  function toggle(id: ExerciseId) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function start() {
    try {
      window.localStorage.setItem(PLAN_KEY, JSON.stringify({ exercises: selected, sets: setsPer }));
    } catch {
      // not important
    }
    setSetIndex(0);
    setLogged([]);
    setLogging(null);
    setStartedAt(Date.now());
    setStep("run");
  }

  function finishWorkout(sets: LoggedSet[]) {
    setLogged(sets);
    setEndedAt(Date.now());
    setLogging(null);
    setStep("summary");
  }

  function logSet(values: { loggedValue: number; loadKg: number }) {
    if (!logging) return;
    const sets = [...logged, { ...logging, ...values }];
    if (setIndex + 1 >= totalSets) {
      finishWorkout(sets);
      return;
    }
    setLogged(sets);
    setLogging(null);
    setSetIndex((i) => i + 1);
  }

  function redoSet() {
    setLogging(null);
    setAttempt((a) => a + 1);
  }

  function exitRun() {
    if (logged.length > 0) finishWorkout(logged);
    else setStep("pick");
  }

  if (step === "summary") {
    return (
      <AppShell>
        <SessionSummary
          summary={summarizeSession(logged, profile.weightKg, endedAt - startedAt)}
          weightKg={profile.weightKg}
          onDone={() => router.push("/today")}
          onAgain={() => setStep("pick")}
        />
      </AppShell>
    );
  }

  if (step === "run" && currentExercise) {
    return (
      <div className="relative">
        <WorkoutCamera
          guided={{
            key: `${setIndex}-${attempt}`,
            exerciseId: currentExercise,
            title,
            showTip: setNumber === 1 && attempt === 0,
            paused: logging !== null,
            onFinish: setLogging,
            onExit: exitRun,
          }}
        />
        {logging && (
          <SetLogger
            result={logging}
            exercises={selected}
            title={title}
            sessionStartedAt={startedAt}
            onDone={logSet}
            onDiscard={redoSet}
          />
        )}
      </div>
    );
  }

  return (
    <AppShell>
      <ExercisePicker
        available={available}
        selected={selected}
        sets={setsPer}
        onToggle={toggle}
        onSets={setSetsPer}
        onStart={start}
      />
    </AppShell>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { adjustPlan, type CheckinAnswers, type CheckinChoice, type PlanItem } from "@/lib/data/checkin";
import type { OutboxItem } from "@/lib/data/outbox";
import { sessionToRow, setToRow } from "@/lib/data/rows";
import { saveToOutbox, type FlushResult } from "@/lib/data/sync";
import { availableExercises, type ExerciseId } from "@/lib/equipment";
import { loadOnboarding, saveOnboarding, type OnboardingData } from "@/lib/onboarding";
import { loadPlan, savePlan } from "@/lib/workout/plan-store";
import type { SetResult } from "@/lib/workout/set-engine";
import { summarizeSession, type LoggedSet } from "@/lib/workout/summary";
import { CheckinSheet } from "./checkin-sheet";
import { ExercisePicker } from "./exercise-picker";
import { SessionSummary } from "./session-summary";
import { SetLogger } from "./set-logger";
import { WorkoutCamera } from "./workout-camera";

// pick → check-in → (per set: tip → 3-2-1 → set → log) → summary.
// The camera stays mounted for the whole run; the logger is an overlay on top of it.
// Each logged set goes to the outbox straight away, so a closed tab loses at most one set.

type Step = "pick" | "run" | "summary";

export function WorkoutFlow({ serverProfile }: { serverProfile: OnboardingData | null }) {
  const router = useRouter();
  const [profile, setProfile] = useState<OnboardingData | null>(null);
  const [step, setStep] = useState<Step>("pick");
  const [checkingIn, setCheckingIn] = useState(false);
  const [selected, setSelected] = useState<ExerciseId[]>([]);
  const [setsPer, setSetsPer] = useState(3);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [setIndex, setSetIndex] = useState(0);
  const [logging, setLogging] = useState<SetResult | null>(null);
  const [logged, setLogged] = useState<LoggedSet[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [endedAt, setEndedAt] = useState(0);
  const [saved, setSaved] = useState<FlushResult | null>(null);
  /** Bumped on "redo set" so the camera restarts the same set. */
  const [attempt, setAttempt] = useState(0);
  const sessionId = useRef("");
  const pendingCheckin = useRef<Extract<OutboxItem, { kind: "checkin" }> | null>(null);

  // Same gate as Today: equipment comes from the profile, or localStorage if signed out.
  useEffect(() => {
    if (serverProfile) saveOnboarding(serverProfile);
    const saved = serverProfile ?? loadOnboarding();
    if (!saved) {
      router.replace("/onboarding");
      return;
    }
    setProfile(saved);
    const ids = availableExercises(saved.equipment).map((e) => e.id);
    const last = loadPlan();
    const restored = last?.exercises.filter((id) => ids.includes(id)) ?? [];
    setSelected(restored.length ? restored : ids.filter((id) => id === "squat" || id === "pushup"));
    if (last) setSetsPer(last.sets);
  }, [router, serverProfile]);

  const available = useMemo(() => (profile ? availableExercises(profile.equipment) : []), [profile]);
  const pickedPlan = useMemo(() => selected.map((exerciseId) => ({ exerciseId, sets: setsPer })), [selected, setsPer]);
  const queue = useMemo(
    () =>
      plan.flatMap((p) =>
        Array.from({ length: p.sets }, (_, i) => ({ exerciseId: p.exerciseId, setNumber: i + 1, total: p.sets })),
      ),
    [plan],
  );

  if (!profile) return null;

  const current = queue[setIndex];
  const title = current ? `Set ${current.setNumber} of ${current.total}` : "";

  function toggle(id: ExerciseId) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function start(runPlan: PlanItem[]) {
    savePlan({ exercises: selected, sets: setsPer });
    sessionId.current = crypto.randomUUID();
    setPlan(runPlan);
    setSetIndex(0);
    setLogged([]);
    setLogging(null);
    setSaved(null);
    setAttempt(0);
    setStartedAt(Date.now());
    setCheckingIn(false);
    setStep("run");
  }

  function finishCheckin(answers: CheckinAnswers, choice: CheckinChoice) {
    const item: OutboxItem = {
      kind: "checkin",
      row: { id: crypto.randomUUID(), session_id: null, ...answers, choice },
    };
    if (choice === "move") {
      void saveToOutbox([item]);
      router.push("/today");
      return;
    }
    pendingCheckin.current = item;
    start(adjustPlan(pickedPlan, choice));
  }

  function sessionItem(sets: LoggedSet[], endTime: number | null): OutboxItem {
    if (!profile) throw new Error("no profile");
    const now = endTime ?? Date.now();
    const summary = summarizeSession(sets, profile.weightKg, now - startedAt);
    return { kind: "session", row: sessionToRow(sessionId.current, startedAt, endTime, summary) };
  }

  function finishWorkout(sets: LoggedSet[]) {
    const end = Date.now();
    setLogged(sets);
    setEndedAt(end);
    setLogging(null);
    setStep("summary");
    void saveToOutbox([sessionItem(sets, end)]).then(setSaved);
  }

  function logSet(values: { loggedValue: number; loadKg: number }) {
    if (!logging || !profile || !current) return;
    const set: LoggedSet = { ...logging, ...values };
    const sets = [...logged, set];
    const items: OutboxItem[] = [
      sessionItem(sets, null),
      { kind: "set", row: setToRow(set, crypto.randomUUID(), sessionId.current, current.setNumber, profile.weightKg) },
    ];
    if (pendingCheckin.current) {
      // The session exists from now on, so the check-in can point at it.
      items.push({ ...pendingCheckin.current, row: { ...pendingCheckin.current.row, session_id: sessionId.current } });
      pendingCheckin.current = null;
    }
    void saveToOutbox(items);

    if (setIndex + 1 >= queue.length) {
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
    if (logged.length > 0) {
      finishWorkout(logged);
      return;
    }
    // Stopped before finishing a set: there's no session to attach the check-in to.
    if (pendingCheckin.current) void saveToOutbox([pendingCheckin.current]);
    pendingCheckin.current = null;
    setStep("pick");
  }

  if (step === "summary") {
    return (
      <AppShell>
        <SessionSummary
          summary={summarizeSession(logged, profile.weightKg, endedAt - startedAt)}
          weightKg={profile.weightKg}
          saved={saved}
          onDone={() => router.push("/today")}
          onAgain={() => setStep("pick")}
        />
      </AppShell>
    );
  }

  if (step === "run" && current) {
    return (
      <div className="relative">
        <WorkoutCamera
          guided={{
            key: `${setIndex}-${attempt}`,
            exerciseId: current.exerciseId,
            title,
            showTip: current.setNumber === 1 && attempt === 0,
            paused: logging !== null,
            onFinish: setLogging,
            onExit: exitRun,
          }}
        />
        {logging && (
          <SetLogger
            result={logging}
            exercises={plan.map((p) => p.exerciseId)}
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
        onStart={() => setCheckingIn(true)}
      />
      <CheckinSheet
        open={checkingIn}
        plan={pickedPlan}
        onClose={() => setCheckingIn(false)}
        onChoose={finishCheckin}
        onSkip={() => start(pickedPlan)}
      />
    </AppShell>
  );
}

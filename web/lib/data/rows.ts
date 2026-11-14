import { isEquipmentId } from "@/lib/equipment";
import { GOALS, LEVELS, type GoalId, type LevelId, type OnboardingData } from "@/lib/onboarding";
import type { CheckinRow, ProfileRow, SessionRow, SetRow } from "@/lib/supabase/database";
import { caloriesBurned } from "@/lib/workout/calories";
import type { LoggedSet } from "@/lib/workout/summary";

// Maps app objects to database rows. user_id is added when uploading: a workout
// finished before signing in has no user yet.

export type NewSession = Omit<SessionRow, "user_id">;
export type NewSet = Omit<SetRow, "user_id" | "created_at">;
export type NewCheckin = Omit<CheckinRow, "user_id" | "created_at">;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function setToRow(set: LoggedSet, id: string, sessionId: string, setNumber: number, weightKg: number): NewSet {
  const hold = set.mode === "hold";
  return {
    id,
    session_id: sessionId,
    exercise: set.exerciseId,
    set_number: setNumber,
    reps: hold ? 0 : Math.round(set.loggedValue),
    hold_seconds: hold ? Math.round(set.loggedValue) : 0,
    load_kg: round1(set.loadKg),
    duration_ms: Math.round(set.durationMs),
    avg_form_score: set.score,
    good_reps: set.goodReps,
    scored_reps: set.repScores.length,
    missed: set.missed,
    calories: Math.round(caloriesBurned(set.exerciseId, weightKg + set.loadKg, set.durationMs) * 100) / 100,
    form_issues: set.issueCounts,
    // Only sent when used, so ordinary sets still upload before migration 0004 adds the column.
    ...(set.manualReps > 0 ? { manual_reps: set.manualReps } : {}),
  };
}

export function sessionToRow(
  id: string,
  startedAt: number,
  endedAt: number | null,
  summary: { durationMs: number; calories: number; avgScore: number | null },
): NewSession {
  return {
    id,
    started_at: new Date(startedAt).toISOString(),
    ended_at: endedAt === null ? null : new Date(endedAt).toISOString(),
    duration_ms: Math.round(summary.durationMs),
    calories: summary.calories,
    avg_form_score: summary.avgScore,
  };
}

export function onboardingToRow(data: OnboardingData, userId: string, voiceOn: boolean) {
  return {
    id: userId,
    goal: data.goal,
    level: data.level,
    equipment: data.equipment,
    weight_kg: data.weightKg,
    height_cm: data.heightCm,
    voice_on: voiceOn,
    completed_at: data.completedAt,
    updated_at: new Date().toISOString(),
  };
}

/** Null if the row doesn't fit the app's types (e.g. edited by hand). */
export function rowToOnboarding(row: ProfileRow): OnboardingData | null {
  const goal = GOALS.find((g) => g.id === row.goal)?.id as GoalId | undefined;
  const level = LEVELS.find((l) => l.id === row.level)?.id as LevelId | undefined;
  if (!goal || !level) return null;
  return {
    goal,
    level,
    equipment: row.equipment.filter(isEquipmentId),
    weightKg: Number(row.weight_kg),
    heightCm: Number(row.height_cm),
    completedAt: row.completed_at,
  };
}

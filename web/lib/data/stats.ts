import type { SessionRow, SetRow } from "@/lib/supabase/database";

// Everything here takes dates in the user's own timezone, so it runs in the browser:
// a workout at 1 am belongs to the day the user sees, not to UTC.

export type SessionWithSets = SessionRow & { sets: SetRow[] };

/** "2026-11-04" in local time. */
export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function addDays(date: Date, n: number): Date {
  // Calendar arithmetic, not +24 h, so daylight-saving days don't skip or repeat.
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

/** Days trained in a row, ending today, or yesterday if today isn't done yet. */
export function streak(sessionDates: readonly string[], now: Date): number {
  const days = new Set(sessionDates.map((iso) => dayKey(new Date(iso))));
  let cursor = days.has(dayKey(now)) ? now : addDays(now, -1);
  let count = 0;
  while (days.has(dayKey(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export type DayReps = { day: string; label: string; reps: number };

/** Reps for each of the last 7 days, oldest first. */
export function repsPerDay(sessions: readonly SessionWithSets[], now: Date): DayReps[] {
  const totals = new Map<string, number>();
  for (const s of sessions) {
    const key = dayKey(new Date(s.started_at));
    totals.set(key, (totals.get(key) ?? 0) + s.sets.reduce((sum, set) => sum + set.reps, 0));
  }
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(now, i - 6);
    const day = dayKey(date);
    return { day, label: date.toLocaleDateString("en", { weekday: "narrow" }), reps: totals.get(day) ?? 0 };
  });
}

export type TrendPoint = { label: string; score: number };

/** Form score of the last `limit` scored sessions, oldest first. */
export function formTrend(sessions: readonly SessionWithSets[], limit = 12): TrendPoint[] {
  return sessions
    .filter((s) => s.avg_form_score !== null)
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
    .slice(-limit)
    .map((s) => ({
      label: new Date(s.started_at).toLocaleDateString("en", { day: "numeric", month: "short" }),
      score: s.avg_form_score as number,
    }));
}

export type CalendarDay = { day: string; date: number; trained: boolean; today: boolean };

/** This month as Monday-first weeks; null pads the days outside it. */
export function monthCalendar(sessionDates: readonly string[], now: Date): (CalendarDay | null)[][] {
  const trained = new Set(sessionDates.map((iso) => dayKey(new Date(iso))));
  const today = dayKey(now);
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const length = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const cells: (CalendarDay | null)[] = Array.from({ length: (first.getDay() + 6) % 7 }, () => null);
  for (let date = 1; date <= length; date++) {
    const day = dayKey(new Date(now.getFullYear(), now.getMonth(), date));
    cells.push({ day, date, trained: trained.has(day), today: day === today });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** When each exercise was last trained, for picking today's session. */
export function lastTrained(sessions: readonly SessionWithSets[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of sessions) {
    for (const set of s.sets) {
      if (!out[set.exercise] || s.started_at > out[set.exercise]) out[set.exercise] = s.started_at;
    }
  }
  return out;
}

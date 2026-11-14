import { exerciseName } from "@/lib/exercises/registry";
import { streak, type SessionWithSets } from "@/lib/data/stats";
import type { NutritionAnswers } from "@/lib/nutrition/profile";
import type { Targets } from "@/lib/nutrition/targets";
import { GOALS, LEVELS, type OnboardingData } from "@/lib/onboarding";

// The coach sees this summary and nothing else: numbers about training and food, no
// video, no photos, no email. Kept compact so it's cheap to send with every message.

type MealWithItems = { eaten_at: string; items: { kcal: number | string; protein: number | string }[] };

const DAY = 24 * 3600 * 1000;
// Server side: taught exercises have no name here, so they show as "Taught exercise".
const name = (id: string) => exerciseName(id, []);

export function buildCoachContext({
  now,
  body,
  sessions,
  nutrition,
  targets,
  meals,
}: {
  now: Date;
  body: OnboardingData | null;
  sessions: readonly SessionWithSets[];
  nutrition: NutritionAnswers | null;
  targets: Targets | null;
  meals: readonly MealWithItems[];
}): string {
  const lines: string[] = [`Today: ${now.toISOString().slice(0, 10)}`];

  if (body) {
    lines.push(
      `Profile: goal ${GOALS.find((g) => g.id === body.goal)?.title}, level ${LEVELS.find((l) => l.id === body.level)?.title}, ` +
        `${body.weightKg} kg, ${body.heightCm} cm, ${body.equipment.length} equipment items.`,
    );
  }

  const recent = sessions.filter((s) => now.getTime() - new Date(s.started_at).getTime() <= 30 * DAY);
  if (recent.length === 0) {
    lines.push("Workouts: none logged in the last 30 days.");
  } else {
    const last = recent.reduce((a, b) => (a.started_at > b.started_at ? a : b));
    const daysAgo = Math.floor((now.getTime() - new Date(last.started_at).getTime()) / DAY);
    lines.push(
      `Workouts (last 30 days): ${recent.length} sessions, current streak ${streak(recent.map((s) => s.started_at), now)} days, ` +
        `last workout ${daysAgo === 0 ? "today" : `${daysAgo} days ago`}.`,
    );
    type Totals = { sets: number; reps: number; hold: number; scores: number[]; missed: number; issues: Map<string, number>; weeks: Map<number, number> };
    const byExercise = new Map<string, Totals>();
    for (const s of recent) {
      for (const set of s.sets) {
        const empty: Totals = { sets: 0, reps: 0, hold: 0, scores: [], missed: 0, issues: new Map(), weeks: new Map() };
        const e = byExercise.get(set.exercise) ?? empty;
        e.sets += 1;
        e.reps += set.reps;
        e.hold += set.hold_seconds;
        e.missed += set.missed;
        if (set.avg_form_score !== null) e.scores.push(set.avg_form_score);
        for (const [cue, n] of Object.entries(set.form_issues ?? {})) e.issues.set(cue, (e.issues.get(cue) ?? 0) + n);
        const week = Math.floor((now.getTime() - new Date(s.started_at).getTime()) / (7 * DAY));
        e.weeks.set(week, (e.weeks.get(week) ?? 0) + set.reps);
        byExercise.set(set.exercise, e);
      }
    }
    for (const [id, e] of byExercise) {
      const avg = e.scores.length ? Math.round(e.scores.reduce((a, b) => a + b, 0) / e.scores.length) : null;
      const issues = [...e.issues].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cue, n]) => `${cue} ×${n}`);
      const amount = id === "plank" ? `${e.hold} s held` : `${e.reps} reps`;
      const trend = id === "plank" ? "" : `, reps this week ${e.weeks.get(0) ?? 0} vs last week ${e.weeks.get(1) ?? 0}`;
      lines.push(
        `- ${name(id)}: ${e.sets} sets, ${amount}${avg !== null ? `, avg form ${avg}/100` : ""}` +
          `${e.missed ? `, ${e.missed} missed reps` : ""}${issues.length ? `, form issues: ${issues.join(", ")}` : ""}${trend}`,
      );
    }
  }

  if (nutrition && targets) {
    lines.push(
      `Nutrition targets: ${targets.kcal} kcal, protein ${targets.protein} g, carbs ${targets.carbs} g, fat ${targets.fat} g; ` +
        `diet ${nutrition.dietType}; allergies ${nutrition.allergies.join(", ") || "none"}; age ${nutrition.age}; sex ${nutrition.sex}.`,
    );
    const byDay = new Map<string, { kcal: number; protein: number }>();
    for (const m of meals) {
      const day = m.eaten_at.slice(0, 10);
      const d = byDay.get(day) ?? { kcal: 0, protein: 0 };
      for (const i of m.items) {
        d.kcal += Number(i.kcal);
        d.protein += Number(i.protein);
      }
      byDay.set(day, d);
    }
    const today = byDay.get(now.toISOString().slice(0, 10));
    const days = [...byDay.values()];
    lines.push(
      days.length === 0
        ? "Food log: nothing logged in the last 7 days."
        : `Food log (last 7 days): ${days.length} days logged, average ${Math.round(days.reduce((a, d) => a + d.kcal, 0) / days.length)} kcal ` +
            `and ${Math.round(days.reduce((a, d) => a + d.protein, 0) / days.length)} g protein per logged day; ` +
            `today ${today ? `${Math.round(today.kcal)} kcal, ${Math.round(today.protein)} g protein` : "nothing yet"}.`,
    );
  } else {
    lines.push("Nutrition: diet setup not done yet.");
  }

  return lines.join("\n");
}

import { describe, expect, it } from "vitest";
import type { SessionWithSets } from "@/lib/data/stats";
import type { SetRow } from "@/lib/supabase/database";
import { calculateTargets } from "@/lib/nutrition/targets";
import { buildCoachContext } from "./coach-context";

const now = new Date("2026-11-09T10:00:00Z");
const set = (over: Partial<SetRow>) => ({ exercise: "squat", reps: 10, hold_seconds: 0, missed: 0, avg_form_score: 80, form_issues: {}, ...over }) as SetRow;
const session = (daysAgo: number, sets: SetRow[]) =>
  ({ started_at: new Date(now.getTime() - daysAgo * 864e5).toISOString(), sets }) as SessionWithSets;
const body = { goal: "muscle" as const, level: "beginner" as const, equipment: ["mat" as const], weightKg: 70, heightCm: 175, completedAt: "" };
const answers = { age: 21, sex: "male" as const, activity: "moderate" as const, dietType: "veg" as const, allergies: [], cuisine: "Indian" };

describe("buildCoachContext", () => {
  it("summarises workouts per exercise with form issues and a weekly trend", () => {
    const text = buildCoachContext({
      now,
      body,
      sessions: [
        session(0, [set({ reps: 12, avg_form_score: 90, form_issues: { "Knees out": 2 } }), set({ exercise: "plank", reps: 0, hold_seconds: 45, avg_form_score: 70 })]),
        session(1, [set({ reps: 8, avg_form_score: 70, missed: 2 })]),
        session(9, [set({ reps: 5 })]),
        session(40, [set({ reps: 99 })]), // too old
      ],
      nutrition: null,
      targets: null,
      meals: [],
    });
    expect(text).toContain("3 sessions");
    expect(text).toContain("current streak 2 days");
    expect(text).toContain("Squat: 3 sets, 25 reps, avg form 80/100, 2 missed reps, form issues: Knees out ×2, reps this week 20 vs last week 5");
    expect(text).toContain("Plank: 1 sets, 45 s held");
    expect(text).not.toContain("99");
    expect(text).toContain("diet setup not done yet");
  });

  it("includes targets and the food log, and never personal details like email", () => {
    const text = buildCoachContext({
      now,
      body,
      sessions: [],
      nutrition: answers,
      targets: calculateTargets({ ...answers, weightKg: 70, heightCm: 175, goal: "muscle" }),
      meals: [
        { eaten_at: "2026-11-09T08:00:00Z", items: [{ kcal: 400, protein: 20 }] },
        { eaten_at: "2026-11-08T08:00:00Z", items: [{ kcal: "600", protein: "30" }] },
      ],
    });
    expect(text).toContain("Workouts: none logged");
    expect(text).toContain("Nutrition targets: 2890 kcal");
    expect(text).toContain("2 days logged, average 500 kcal and 25 g protein");
    expect(text).toContain("today 400 kcal, 20 g protein");
    expect(text).not.toMatch(/@/);
  });
});

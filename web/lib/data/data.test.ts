import { describe, expect, it } from "vitest";
import type { OnboardingData } from "@/lib/onboarding";
import type { ProfileRow, SetRow } from "@/lib/supabase/database";
import type { LoggedSet } from "@/lib/workout/summary";
import { adjustPlan, checkinReason, describeAdjustment, recommend, type PlanItem } from "./checkin";
import { addToOutbox, drainOutbox, isPermanentError, type OutboxItem, type UploadResult } from "./outbox";
import { onboardingToRow, rowToOnboarding, sessionToRow, setToRow } from "./rows";
import { dayKey, formTrend, lastTrained, monthCalendar, profileStats, repsPerDay, streak, type SessionWithSets } from "./stats";
import { suggestSession } from "./suggest";

const logged = (over: Partial<LoggedSet> = {}): LoggedSet => ({
  exerciseId: "squat",
  mode: "reps",
  reps: 8,
  repScores: [100, 65],
  goodReps: 1,
  missed: 2,
  issueCounts: { "Knees out": 1 },
  durationMs: 30000.4,
  heldMs: 0,
  score: 83,
  loggedValue: 9,
  loadKg: 2.5,
  ...over,
});

describe("rows", () => {
  it("stores the user's corrected reps, not the counted ones", () => {
    const row = setToRow(logged(), "s1", "w1", 2, 70);
    expect(row).toMatchObject({ id: "s1", session_id: "w1", set_number: 2, reps: 9, hold_seconds: 0, load_kg: 2.5 });
    expect(row).toMatchObject({ duration_ms: 30000, good_reps: 1, scored_reps: 2, missed: 2 });
    expect(row.form_issues).toEqual({ "Knees out": 1 });
  });

  it("stores plank time as seconds", () => {
    const row = setToRow(logged({ exerciseId: "plank", mode: "hold", loggedValue: 45 }), "s", "w", 1, 70);
    expect(row).toMatchObject({ reps: 0, hold_seconds: 45 });
  });

  it("maps sessions with an open end", () => {
    const row = sessionToRow("w", 0, null, { durationMs: 1.2, calories: 5, avgScore: null });
    expect(row).toEqual({
      id: "w",
      started_at: "1970-01-01T00:00:00.000Z",
      ended_at: null,
      duration_ms: 1,
      calories: 5,
      avg_form_score: null,
    });
  });

  it("round-trips the profile and rejects unknown values", () => {
    const data: OnboardingData = {
      goal: "muscle",
      level: "advanced",
      equipment: ["mat"],
      weightKg: 70.5,
      heightCm: 175,
      completedAt: "2026-11-04T10:00:00.000Z",
    };
    const row = onboardingToRow(data, "u1", false) as ProfileRow;
    expect(row).toMatchObject({ id: "u1", voice_on: false });
    expect(rowToOnboarding(row)).toEqual(data);
    expect(rowToOnboarding({ ...row, goal: "nope" })).toBeNull();
    expect(rowToOnboarding({ ...row, equipment: ["mat", "jetpack"] })?.equipment).toEqual(["mat"]);
  });
});

describe("outbox", () => {
  const session = (id: string, calories = 0): OutboxItem => ({
    kind: "session",
    row: { id, started_at: "", ended_at: null, duration_ms: 0, calories, avg_form_score: null },
  });
  const set = (id: string): OutboxItem => ({ kind: "set", row: setToRow(logged(), id, "w", 1, 70) });

  it("replaces a queued row rather than queueing it twice", () => {
    const items = addToOutbox(addToOutbox([], session("w", 1)), session("w", 2));
    expect(items).toHaveLength(1);
    expect((items[0].row as { calories: number }).calories).toBe(2);
  });

  it("uploads parents first, whatever the queue order", async () => {
    const sent: string[] = [];
    const left = await drainOutbox([set("a"), session("w")], async (i) => {
      sent.push(i.row.id);
      return "sent";
    });
    expect(sent).toEqual(["w", "a"]);
    expect(left).toEqual([]);
  });

  it("stops at a failure and keeps everything not yet sent", async () => {
    const sent: string[] = [];
    const upload = async (i: OutboxItem): Promise<UploadResult> => {
      if (i.row.id === "a") return "retry";
      sent.push(i.row.id);
      return "sent";
    };
    const left = await drainOutbox([session("w"), set("a"), set("b")], upload);
    expect(sent).toEqual(["w"]);
    expect(left.map((i) => i.row.id)).toEqual(["a", "b"]);
  });

  it("treats a thrown error as retry, and skips a row the server will never take", async () => {
    const thrown = await drainOutbox([set("a")], async () => {
      throw new Error("offline");
    });
    expect(thrown).toHaveLength(1);
    const dropped = await drainOutbox([set("a"), set("b")], async (i) => (i.row.id === "a" ? "drop" : "sent"));
    expect(dropped).toEqual([]);
  });

  it("only gives up on data errors", () => {
    expect(isPermanentError("23514")).toBe(true);
    expect(isPermanentError("22P02")).toBe(true);
    expect(isPermanentError("42501")).toBe(false); // permissions can be fixed
    expect(isPermanentError(undefined)).toBe(false);
  });
});

describe("stats", () => {
  const now = new Date(2026, 10, 4, 12); // Wed 4 Nov 2026, local time
  const on = (day: number, hour = 10) => new Date(2026, 10, day, hour).toISOString();
  const row = (reps: number, exercise = "squat") => ({ reps, exercise }) as SetRow;
  const workout = (started_at: string, score: number | null, sets: SetRow[]) =>
    ({ started_at, avg_form_score: score, sets }) as SessionWithSets;

  it("counts a streak ending today or yesterday", () => {
    expect(streak([on(4), on(3), on(2)], now)).toBe(3);
    expect(streak([on(3), on(2)], now)).toBe(2);
    expect(streak([on(4), on(4, 18), on(2)], now)).toBe(1); // two sessions in a day count once
    expect(streak([on(1)], now)).toBe(0);
    expect(streak([], now)).toBe(0);
  });

  it("crosses a month boundary", () => {
    expect(streak([on(1), new Date(2026, 9, 31).toISOString()], new Date(2026, 10, 1, 9))).toBe(2);
  });

  it("uses local days", () => {
    expect(dayKey(new Date(2026, 10, 4, 23, 59))).toBe("2026-11-04");
    expect(dayKey(new Date(2026, 10, 5, 0, 1))).toBe("2026-11-05");
  });

  it("adds up the last 7 days and ignores older workouts", () => {
    const days = repsPerDay(
      [workout(on(4), 90, [row(5), row(7)]), workout(on(4, 18), 90, [row(3)]), workout(on(2), 90, [row(4)]), workout(new Date(2026, 9, 1).toISOString(), 90, [row(99)])],
      now,
    );
    expect(days).toHaveLength(7);
    expect(days.at(-1)).toMatchObject({ day: "2026-11-04", reps: 15 });
    expect(days[0].day).toBe("2026-10-29");
    expect(days.reduce((s, d) => s + d.reps, 0)).toBe(19);
  });

  it("orders the form trend and skips unscored sessions", () => {
    const trend = formTrend([workout(on(3), 80, []), workout(on(1), 60, []), workout(on(2), null, [])]);
    expect(trend.map((p) => p.score)).toEqual([60, 80]);
    const many = Array.from({ length: 20 }, (_, i) => workout(on(i + 1), i, []));
    expect(formTrend(many, 12)[0].score).toBe(8);
  });

  it("lays the month out in Monday-first weeks", () => {
    const weeks = monthCalendar([on(3)], now);
    expect(weeks[0].slice(0, 6)).toEqual([null, null, null, null, null, null]); // 1 Nov 2026 is a Sunday
    expect(weeks[0][6]).toMatchObject({ date: 1 });
    expect(weeks[1][1]).toMatchObject({ date: 3, trained: true, today: false });
    expect(weeks[1][2]).toMatchObject({ date: 4, trained: false, today: true });
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });

  it("adds up lifetime totals", () => {
    expect(profileStats([workout(on(4), 90, [row(5), row(7)]), workout(on(3), 80, [row(3)])], now)).toEqual({
      workouts: 2,
      reps: 15,
      streak: 2,
    });
    expect(profileStats([], now)).toEqual({ workouts: 0, reps: 0, streak: 0 });
  });

  it("finds when each exercise was last trained", () => {
    expect(lastTrained([workout(on(1), 1, [row(1)]), workout(on(3), 1, [row(1), row(1, "plank")])])).toEqual({
      squat: on(3),
      plank: on(3),
    });
  });
});

describe("check-in", () => {
  it("keeps the session when you feel fine", () => {
    expect(recommend({ sleep: 8, energy: 7, soreness: 2 })).toBe("keep");
    expect(recommend({ sleep: 5, energy: 5, soreness: 6 })).toBe("keep");
  });

  it("trims for one warning, halves for two or a severe one, moves for both", () => {
    expect(recommend({ sleep: 4, energy: 7, soreness: 2 })).toBe("trim");
    expect(recommend({ sleep: 4, energy: 4, soreness: 2 })).toBe("half");
    expect(recommend({ sleep: 2, energy: 7, soreness: 2 })).toBe("half");
    expect(recommend({ sleep: 2, energy: 3, soreness: 2 })).toBe("move");
    expect(recommend({ sleep: 8, energy: 8, soreness: 9 })).toBe("half");
  });

  it("explains the main reason", () => {
    expect(checkinReason({ sleep: 3, energy: 8, soreness: 8 })).toMatch(/sore/);
    expect(checkinReason({ sleep: 3, energy: 8, soreness: 2 })).toMatch(/slept/);
    expect(checkinReason({ sleep: 8, energy: 3, soreness: 2 })).toMatch(/energy/);
  });

  const plan: PlanItem[] = [
    { exerciseId: "squat", sets: 3 },
    { exerciseId: "pushup", sets: 3 },
  ];

  it("trims and halves sets evenly, keeping the plan otherwise", () => {
    expect(adjustPlan(plan, "keep")).toEqual(plan);
    expect(adjustPlan(plan, "trim")).toEqual([
      { exerciseId: "squat", sets: 2 },
      { exerciseId: "pushup", sets: 2 },
    ]);
    expect(adjustPlan(plan, "half").reduce((s, p) => s + p.sets, 0)).toBe(3);
  });

  it("never drops below one set and doesn't change the input", () => {
    expect(adjustPlan([{ exerciseId: "squat", sets: 1 }], "half")).toEqual([{ exerciseId: "squat", sets: 1 }]);
    const small: PlanItem[] = [
      { exerciseId: "squat", sets: 1 },
      { exerciseId: "pushup", sets: 1 },
      { exerciseId: "lunge", sets: 1 },
    ];
    expect(adjustPlan(small, "half").map((p) => p.exerciseId)).toEqual(["squat", "pushup"]);
    expect(plan[0].sets).toBe(3);
  });

  it("describes the change", () => {
    expect(describeAdjustment(plan, adjustPlan(plan, "trim"))).toBe("4 of 6 sets: fewer sets of Squat and Push-up");
  });
});

describe("suggestSession", () => {
  it("picks what you've rested longest, within your equipment and level", () => {
    const s = suggestSession(["mat"], "advanced", { squat: "2026-11-03", pushup: "2026-11-01" });
    expect(s.sets).toBe(4);
    expect(s.exercises).not.toContain("pullup");
    expect(s.exercises).toEqual(["lunge", "pushup", "plank"]); // never-trained first, plank last
  });

  it("sets scale with level", () => {
    expect(suggestSession([], "beginner", {}).sets).toBe(2);
  });
});

import { isEquipmentId, type EquipmentId } from "./equipment";

// Onboarding answers live in localStorage until Supabase profiles land (Day 5).

export const GOALS = [
  { id: "strength", title: "Get stronger", description: "More reps and harder variations over time." },
  { id: "muscle", title: "Build muscle", description: "Higher volume, steady progression." },
  { id: "fat-loss", title: "Lose fat", description: "Shorter rests, more total work." },
  { id: "habit", title: "Train consistently", description: "Short sessions you'll actually do." },
] as const;

export const LEVELS = [
  { id: "beginner", title: "Just starting", description: "Push-ups are hard; no pull-ups yet." },
  { id: "intermediate", title: "Some experience", description: "Around 10 push-ups and a few pull-ups." },
  { id: "advanced", title: "Trained", description: "20+ push-ups, 8+ strict pull-ups, dips." },
] as const;

export type GoalId = (typeof GOALS)[number]["id"];
export type LevelId = (typeof LEVELS)[number]["id"];

export type OnboardingData = {
  goal: GoalId;
  level: LevelId;
  equipment: EquipmentId[];
  weightKg: number;
  heightCm: number;
  completedAt: string;
};

export const BODY_LIMITS = {
  weightKg: { min: 30, max: 250 },
  heightCm: { min: 120, max: 230 },
} as const;

const STORAGE_KEY = "repsense.onboarding.v1";

function isOnboardingData(value: unknown): value is OnboardingData {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    GOALS.some((g) => g.id === v.goal) &&
    LEVELS.some((l) => l.id === v.level) &&
    Array.isArray(v.equipment) &&
    v.equipment.every(isEquipmentId) &&
    typeof v.weightKg === "number" &&
    typeof v.heightCm === "number"
  );
}

export function loadOnboarding(): OnboardingData | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isOnboardingData(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveOnboarding(data: OnboardingData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Private mode / storage full: the app still works for this visit.
  }
}

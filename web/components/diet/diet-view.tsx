"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Settings2Icon, Trash2Icon, UtensilsIcon } from "lucide-react";
import { PrimaryButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { dayKey } from "@/lib/data/stats";
import type { DietData } from "@/lib/data/queries";
import { FOOD_SOURCE, sumMacros } from "@/lib/nutrition/foods";
import type { DraftItem } from "@/lib/nutrition/items";
import {
  MEAL_TYPES,
  answersToRow,
  rowToAnswers,
  targetsFor,
  type MealType,
  type NutritionAnswers,
} from "@/lib/nutrition/profile";
import { loadOnboarding, saveOnboarding, type OnboardingData } from "@/lib/onboarding";
import { AddFoodSheet } from "./add-food-sheet";
import { CalorieRing, MacroBars } from "./macro-summary";
import { NutritionSetup } from "./nutrition-setup";

// Loaded on demand: the Supabase client is big.
const writes = () => import("@/lib/data/diet-client");

type DietViewProps = {
  data: DietData;
  serverProfile: OnboardingData | null;
  /** Opened from Profile → Nutrition: start with the setup sheet open. */
  editSetup: boolean;
  /** AI modes for the Add food sheet, when Gemini is configured. */
  aiModes?: React.ComponentProps<typeof AddFoodSheet>["extraModes"];
};

export function DietView({ data, serverProfile, editSetup, aiModes }: DietViewProps) {
  const router = useRouter();
  const [body, setBody] = useState<OnboardingData | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answers = data.nutrition ? rowToAnswers(data.nutrition) : null;

  useEffect(() => {
    if (serverProfile) saveOnboarding(serverProfile);
    const saved = serverProfile ?? loadOnboarding();
    if (!saved) {
      router.replace("/onboarding");
      return;
    }
    setBody(saved);
    setNow(new Date());
    if (!answers || editSetup) setSetupOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first load only
  }, [router, serverProfile]);

  async function run(task: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await task();
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveSetup(next: NutritionAnswers) {
    if (!body) return;
    const ok = await run(async () => (await writes()).saveNutritionProfile(answersToRow(next, targetsFor(next, body))));
    if (ok) setSetupOpen(false);
  }

  async function logFood(items: DraftItem[], mealType: MealType, source: "search" | "text" | "photo") {
    const ok = await run(async () => (await writes()).saveMeal(items, mealType, source));
    if (ok) setAdding(false);
  }

  if (!body || !now) return null;

  const targets = answers ? targetsFor(answers, body) : null;
  const today = dayKey(now);
  const meals = data.meals.filter((m) => dayKey(new Date(m.eaten_at)) === today);
  const items = meals.flatMap((m) => m.items);
  const eaten = sumMacros(items.map((i) => ({ kcal: Number(i.kcal), protein: Number(i.protein), carbs: Number(i.carbs), fat: Number(i.fat) })));

  return (
    <>
      <PageHeader
        title="Diet"
        subtitle={targets ? `Goal: ${targets.kcal.toLocaleString("en")} kcal a day` : "Calories and macros for your goal"}
        right={
          answers && (
            <button
              type="button"
              aria-label="Diet settings"
              onClick={() => setSetupOpen(true)}
              className="grid size-10 place-items-center rounded-full border border-border-strong bg-surface"
            >
              <Settings2Icon className="size-[18px]" />
            </button>
          )
        }
      />

      {!targets ? (
        <EmptyState
          icon={UtensilsIcon}
          title="Set up your diet"
          text="Four quick questions, then you get daily calorie and macro targets for your goal."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="flex items-center gap-5">
            <CalorieRing eaten={eaten.kcal} target={targets.kcal} />
            <MacroBars eaten={eaten} target={targets} />
          </Card>

          <PrimaryButton onClick={() => setAdding(true)}>
            <PlusIcon className="size-5" />
            Add food
          </PrimaryButton>

          {MEAL_TYPES.map((type) => {
            const group = meals.filter((m) => m.meal_type === type.id);
            const groupItems = group.flatMap((m) => m.items.map((i) => ({ ...i, lastInMeal: m.items.length === 1 })));
            if (groupItems.length === 0) return null;
            const total = sumMacros(groupItems.map((i) => ({ kcal: Number(i.kcal), protein: Number(i.protein), carbs: Number(i.carbs), fat: Number(i.fat) })));
            return (
              <Card key={type.id} className="p-0">
                <p className="flex items-baseline justify-between px-4 pt-4 pb-2">
                  <span className="text-[15px] font-bold">{type.label}</span>
                  <span className="text-[13px] font-semibold text-muted tabular-nums">{total.kcal} kcal</span>
                </p>
                <ul>
                  {groupItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 border-t border-border px-4 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{item.name}</span>
                        <span className="block text-[12px] font-medium text-muted tabular-nums">
                          {Number(item.grams)} g · {Math.round(Number(item.kcal))} kcal · P {Number(item.protein)} g
                          {item.data_source === "estimate" && " · estimate"}
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${item.name}`}
                        disabled={saving}
                        onClick={() => run(async () => (await writes()).deleteMealItem(item.id, item.meal_id, item.lastInMeal))}
                        className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-raised hover:text-danger"
                      >
                        <Trash2Icon className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}

          {targets.notes.map((n) => (
            <p key={n} className="text-[12px] font-semibold text-accent">
              {n}
            </p>
          ))}
          <p className="pb-2 text-center text-[11px] font-medium text-muted">Food values: {FOOD_SOURCE}</p>
        </div>
      )}

      {!targets && (
        <PrimaryButton onClick={() => setSetupOpen(true)} className="mt-4">
          Get my targets
        </PrimaryButton>
      )}

      {error && (
        <p role="alert" className="mt-3 text-center text-[13px] font-semibold text-danger">
          {error}
        </p>
      )}

      <NutritionSetup
        open={setupOpen}
        body={body}
        initial={answers}
        saving={saving}
        onClose={() => setSetupOpen(false)}
        onSave={saveSetup}
      />
      <AddFoodSheet open={adding} saving={saving} onClose={() => setAdding(false)} onSave={logFood} extraModes={aiModes} />
    </>
  );
}

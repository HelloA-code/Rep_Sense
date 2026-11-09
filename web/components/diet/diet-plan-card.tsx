"use client";

import { useState } from "react";
import { RefreshCwIcon, SparklesIcon } from "lucide-react";
import { SecondaryButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DietPlan, PlanMeal } from "@/lib/ai/plan";
import { MEAL_TYPES } from "@/lib/nutrition/profile";

/** Today's AI meal plan: totals vs targets, each meal one tap from being logged. */
export function DietPlanCard({
  plan,
  onPlan,
  onLog,
  logging,
}: {
  plan: DietPlan | null;
  onPlan: (plan: DietPlan) => void;
  onLog: (meal: PlanMeal) => void;
  logging: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/diet/plan", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { plan?: DietPlan; error?: string };
      if (!res.ok || !data.plan) throw new Error(data.error ?? "Couldn't make a plan. Try again.");
      onPlan(data.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make a plan.");
    } finally {
      setBusy(false);
    }
  }

  if (!plan) {
    return (
      <Card>
        <p className="flex items-center gap-2 text-[15px] font-bold">
          <SparklesIcon className="size-4 text-accent" />
          Diet plan for your goal
        </p>
        <p className="mt-1 text-[13px] font-medium text-muted">
          A one-day menu that fits your calories, macros, diet type and allergies.
        </p>
        <SecondaryButton onClick={generate} disabled={busy} className="mt-4">
          {busy ? "Making your plan…" : "Make my plan"}
        </SecondaryButton>
        {error && <p className="mt-2 text-[13px] font-semibold text-danger">{error}</p>}
      </Card>
    );
  }

  const off = Math.round(((plan.total.kcal - plan.target.kcal) / plan.target.kcal) * 100);
  return (
    <Card className="p-0">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div>
          <p className="flex items-center gap-2 text-[15px] font-bold">
            <SparklesIcon className="size-4 text-accent" />
            Your diet plan
          </p>
          <p className="mt-0.5 text-[12px] font-semibold text-muted tabular-nums">
            {plan.total.kcal} / {plan.target.kcal} kcal ({off >= 0 ? "+" : ""}
            {off}%) · P {Math.round(plan.total.protein)} / {plan.target.protein} g
          </p>
        </div>
        <button
          type="button"
          aria-label="Make a new plan"
          disabled={busy}
          onClick={generate}
          className="grid size-9 shrink-0 place-items-center rounded-full border border-border-strong text-muted disabled:opacity-40"
        >
          <RefreshCwIcon className={busy ? "size-4 animate-spin" : "size-4"} />
        </button>
      </div>
      <ul className="mt-3">
        {plan.meals.map((meal, i) => (
          <li key={i} className="border-t border-border px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[14px] font-bold">
                <span className="text-muted">{MEAL_TYPES.find((t) => t.id === meal.type)?.label} · </span>
                {meal.title}
              </p>
              <span className="shrink-0 text-[12px] font-semibold text-muted tabular-nums">{meal.total.kcal} kcal</span>
            </div>
            <p className="mt-1 text-[12px] font-medium text-text/75">
              {meal.items.map((it) => `${it.name} ${it.grams} g${it.dataSource === "estimate" ? "*" : ""}`).join(" · ")}
            </p>
            <button
              type="button"
              disabled={logging}
              onClick={() => onLog(meal)}
              className="mt-2 text-[13px] font-bold text-accent disabled:opacity-40"
            >
              Log this meal
            </button>
          </li>
        ))}
      </ul>
      <p className="border-t border-border px-4 py-3 text-[12px] font-medium text-muted">
        {plan.tip} {plan.meals.some((m) => m.items.some((i) => i.dataSource === "estimate")) && "* AI estimate, not in the food list."}
      </p>
      {error && <p className="px-4 pb-3 text-[13px] font-semibold text-danger">{error}</p>}
    </Card>
  );
}

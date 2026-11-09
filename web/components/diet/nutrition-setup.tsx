"use client";

import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/ui/button";
import { OptionCard } from "@/components/ui/option-card";
import { SegmentChip } from "@/components/ui/segment-chip";
import { Sheet } from "@/components/ui/sheet";
import type { OnboardingData } from "@/lib/onboarding";
import { parseAllergies, targetsFor, type NutritionAnswers } from "@/lib/nutrition/profile";
import { ACTIVITY_LEVELS, DIET_TYPES, MAX_AGE, MIN_AGE, SEXES, type ActivityId, type DietType, type Sex } from "@/lib/nutrition/targets";

const inputClass =
  "h-[52px] w-full rounded-tile border border-border-strong bg-surface px-4 text-[16px] font-semibold outline-none placeholder:text-white/30 focus:border-accent-border";

type NutritionSetupProps = {
  open: boolean;
  body: OnboardingData;
  initial: NutritionAnswers | null;
  saving: boolean;
  onClose: () => void;
  onSave: (answers: NutritionAnswers) => void;
};

/** Four questions the calorie equations need; shows the resulting targets before saving. */
export function NutritionSetup({ open, body, initial, saving, onClose, onSave }: NutritionSetupProps) {
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [activity, setActivity] = useState<ActivityId>("light");
  const [dietType, setDietType] = useState<DietType>("veg");
  const [allergies, setAllergies] = useState("");
  const [cuisine, setCuisine] = useState("Indian");

  useEffect(() => {
    if (!open) return;
    setAge(initial ? String(initial.age) : "");
    setSex(initial?.sex ?? null);
    setActivity(initial?.activity ?? "light");
    setDietType(initial?.dietType ?? "veg");
    setAllergies(initial?.allergies.join(", ") ?? "");
    setCuisine(initial?.cuisine ?? "Indian");
  }, [open, initial]);

  const ageNumber = Number(age);
  const valid = Number.isInteger(ageNumber) && ageNumber >= MIN_AGE && ageNumber <= MAX_AGE && sex !== null;
  const answers: NutritionAnswers | null = valid
    ? { age: ageNumber, sex, activity, dietType, allergies: parseAllergies(allergies), cuisine: cuisine.trim() || "Indian" }
    : null;
  const preview = answers ? targetsFor(answers, body) : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Set up your diet"
      footer={
        <PrimaryButton disabled={!answers || saving} onClick={() => answers && onSave(answers)}>
          {saving ? "Saving…" : "Save"}
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[13px] font-semibold text-muted">Age</span>
            <input
              inputMode="numeric"
              placeholder="21"
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
              className={`${inputClass} mt-1.5`}
            />
          </label>
          <div>
            <span className="text-[13px] font-semibold text-muted">Sex</span>
            <div className="mt-1.5 flex gap-2">
              {SEXES.map((s) => (
                <SegmentChip key={s.id} selected={sex === s.id} onClick={() => setSex(s.id)} className="h-[52px]">
                  {s.label}
                </SegmentChip>
              ))}
            </div>
          </div>
        </div>
        {age && ageNumber < MIN_AGE && (
          <p className="text-[13px] font-semibold text-danger">Diet targets are for ages {MIN_AGE} and up.</p>
        )}

        <div>
          <p className="mb-2 text-[13px] font-semibold text-muted">How active are you, outside RepSense workouts too?</p>
          <div className="flex flex-col gap-2">
            {ACTIVITY_LEVELS.map((a) => (
              <OptionCard
                key={a.id}
                title={a.label}
                description={a.description}
                selected={activity === a.id}
                onClick={() => setActivity(a.id)}
                className="py-3"
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-semibold text-muted">What do you eat?</p>
          <div className="grid grid-cols-2 gap-2">
            {DIET_TYPES.map((d) => (
              <SegmentChip key={d.id} selected={dietType === d.id} onClick={() => setDietType(d.id)}>
                {d.label}
              </SegmentChip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[13px] font-semibold text-muted">Allergies (optional)</span>
            <input placeholder="peanuts, lactose" value={allergies} onChange={(e) => setAllergies(e.target.value)} className={`${inputClass} mt-1.5`} />
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-muted">Cuisine</span>
            <input placeholder="Indian" value={cuisine} maxLength={40} onChange={(e) => setCuisine(e.target.value)} className={`${inputClass} mt-1.5`} />
          </label>
        </div>

        {preview && (
          <div className="rounded-tile border border-accent-border bg-accent-tint p-4">
            <p className="text-[13px] font-semibold text-muted">Your daily target</p>
            <p className="mt-1 text-[28px] leading-none font-extrabold tabular-nums">
              {preview.kcal.toLocaleString("en")} <span className="text-[15px] text-muted">kcal</span>
            </p>
            <p className="mt-2 text-[13px] font-bold tabular-nums">
              Protein {preview.protein} g · Carbs {preview.carbs} g · Fat {preview.fat} g
            </p>
            <p className="mt-2 text-[12px] font-medium text-muted">
              Resting burn {preview.bmr} kcal (Mifflin–St Jeor) × activity = {preview.tdee} kcal, adjusted for your goal.
            </p>
            {preview.notes.map((n) => (
              <p key={n} className="mt-2 text-[12px] font-semibold text-accent">
                {n}
              </p>
            ))}
          </div>
        )}
        <p className="text-[12px] font-medium text-muted">
          A starting point, not medical advice. If you have a health condition or are pregnant, ask a doctor or dietitian.
        </p>
      </div>
    </Sheet>
  );
}

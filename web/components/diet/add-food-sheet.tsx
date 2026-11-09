"use client";

import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/ui/button";
import { SegmentChip } from "@/components/ui/segment-chip";
import { Sheet } from "@/components/ui/sheet";
import type { DraftItem } from "@/lib/nutrition/items";
import { MEAL_TYPES, mealTypeAt, type MealType } from "@/lib/nutrition/profile";
import { FoodSearch } from "./food-search";
import { ReviewList } from "./review-list";

export type AddMode = "search";

type AddFoodSheetProps = {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (items: DraftItem[], mealType: MealType, source: "search" | "text" | "photo") => void;
  /** Extra ways to add food (AI text and photo) render here when available. */
  extraModes?: (add: (items: DraftItem[], source: "text" | "photo") => void) => React.ReactNode;
};

export function AddFoodSheet({ open, saving, onClose, onSave, extraModes }: AddFoodSheetProps) {
  const [items, setItems] = useState<DraftItem[]>([]);
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [source, setSource] = useState<"search" | "text" | "photo">("search");

  useEffect(() => {
    if (!open) return;
    setItems([]);
    setSource("search");
    setMealType(mealTypeAt(new Date().getHours()));
  }, [open]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add food"
      footer={
        <PrimaryButton
          disabled={items.length === 0 || items.some((i) => !(i.grams > 0)) || saving}
          onClick={() => onSave(items, mealType, source)}
        >
          {saving ? "Saving…" : items.length ? `Log ${items.length} ${items.length === 1 ? "item" : "items"}` : "Add something first"}
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none]">
          {MEAL_TYPES.map((m) => (
            <SegmentChip key={m.id} selected={mealType === m.id} onClick={() => setMealType(m.id)} className="h-9 flex-none px-3.5 text-[13px]">
              {m.label}
            </SegmentChip>
          ))}
        </div>
        {extraModes?.((found, from) => {
          setItems((current) => [...current, ...found]);
          setSource(from);
        })}
        <FoodSearch onAdd={(item) => setItems((current) => [...current, item])} />
        <ReviewList items={items} onChange={setItems} />
      </div>
    </Sheet>
  );
}

"use client";

import { useState } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";
import type { Food } from "@/lib/nutrition/foods";
import { draftFromFood, type DraftItem } from "@/lib/nutrition/items";
import { searchFoods } from "@/lib/nutrition/match";
import { defaultPortion } from "@/lib/nutrition/units";

/** Search the USDA food list and add a food at a typical serving. */
export function FoodSearch({ onAdd }: { onAdd: (item: DraftItem) => void }) {
  const [query, setQuery] = useState("");
  const results = searchFoods(query, 6);

  function add(food: Food) {
    const portion = defaultPortion(food, 1);
    onAdd(draftFromFood(food, portion?.grams ?? 100, portion?.basis ?? "100 g"));
    setQuery("");
  }

  return (
    <div>
      <label className="flex h-[52px] items-center gap-2 rounded-tile border border-border-strong bg-surface px-4 focus-within:border-accent-border">
        <SearchIcon className="size-4 text-muted" />
        <input
          aria-label="Search foods"
          placeholder="Search: roti, dal, banana…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none placeholder:text-white/30"
        />
      </label>
      {query && (
        <ul className="mt-2 overflow-hidden rounded-tile border border-border">
          {results.length === 0 && <li className="px-4 py-3 text-[13px] font-medium text-muted">No match in the food list.</li>}
          {results.map((food) => (
            <li key={food.id} className="border-t border-border first:border-t-0">
              <button
                type="button"
                onClick={() => add(food)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-raised"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{food.name}</span>
                  <span className="block text-[12px] font-medium text-muted tabular-nums">
                    {Math.round(food.per100g.kcal)} kcal · {food.per100g.protein} g protein per 100 g
                  </span>
                </span>
                <PlusIcon className="size-4 text-accent" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

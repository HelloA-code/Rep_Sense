"use client";

import { XIcon } from "lucide-react";
import { sumMacros } from "@/lib/nutrition/foods";
import { draftMacros, type DraftItem } from "@/lib/nutrition/items";

/** Editable list of foods about to be logged: change grams, remove, see the totals. */
export function ReviewList({
  items,
  onChange,
}: {
  items: readonly DraftItem[];
  onChange: (items: DraftItem[]) => void;
}) {
  const total = sumMacros(items.map(draftMacros));
  const setGrams = (key: string, grams: number) =>
    onChange(items.map((i) => (i.key === key ? { ...i, grams, basis: undefined } : i)));
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const m = draftMacros(item);
        return (
          <div key={item.key} className="rounded-tile border border-border bg-surface p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold">{item.name}</p>
                <p className="text-[12px] font-semibold text-muted tabular-nums">
                  {m.kcal} kcal · P {m.protein} · C {m.carbs} · F {m.fat}
                </p>
              </div>
              <label className="flex shrink-0 items-center gap-1 rounded-chip border border-border-strong px-2 focus-within:border-accent-border">
                <input
                  aria-label={`Grams of ${item.name}`}
                  inputMode="decimal"
                  value={item.grams || ""}
                  onChange={(e) => setGrams(item.key, Number(e.target.value.replace(/[^\d.]/g, "").slice(0, 6)) || 0)}
                  className="h-8 w-14 bg-transparent text-right text-[14px] font-bold outline-none tabular-nums"
                />
                <span className="text-[12px] font-semibold text-muted">g</span>
              </label>
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                onClick={() => onChange(items.filter((i) => i.key !== item.key))}
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-raised"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <p className="mt-1.5 flex flex-wrap gap-x-2 text-[11px] font-semibold">
              <span className={item.dataSource === "usda" ? "text-accent" : "text-danger"}>
                {item.dataSource === "usda" ? "USDA data" : "AI estimate"}
              </span>
              {item.basis && <span className="text-muted">{item.basis}</span>}
              {item.note && <span className="text-muted">{item.note}</span>}
            </p>
          </div>
        );
      })}
      {items.length > 0 && (
        <p className="px-1 pt-1 text-[13px] font-bold tabular-nums">
          Total {total.kcal} kcal · P {total.protein} g · C {total.carbs} g · F {total.fat} g
        </p>
      )}
    </div>
  );
}

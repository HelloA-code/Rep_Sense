import type { Macros } from "@/lib/nutrition/foods";
import { cn } from "@/lib/utils";

/** Calories left as a big ring, with eaten / target underneath. */
export function CalorieRing({ eaten, target }: { eaten: number; target: number }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const share = target > 0 ? Math.min(eaten / target, 1) : 0;
  const over = eaten > target;
  const left = Math.abs(target - eaten);
  return (
    <div className="relative grid size-[150px] shrink-0 place-items-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={over ? "var(--danger)" : "var(--accent)"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - share)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="text-center">
        <p className="text-[30px] leading-none font-extrabold tracking-tight tabular-nums">{left.toLocaleString("en")}</p>
        <p className={cn("mt-1 text-[12px] font-semibold", over ? "text-danger" : "text-muted")}>
          {over ? "kcal over" : "kcal left"}
        </p>
      </div>
    </div>
  );
}

const BARS = [
  { key: "protein", label: "Protein" },
  { key: "carbs", label: "Carbs" },
  { key: "fat", label: "Fat" },
] as const;

export function MacroBars({ eaten, target }: { eaten: Macros; target: Macros }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      {BARS.map(({ key, label }) => {
        const share = target[key] > 0 ? Math.min(eaten[key] / target[key], 1) : 0;
        return (
          <div key={key}>
            <p className="flex justify-between text-[12px] font-semibold">
              <span>{label}</span>
              <span className="text-muted tabular-nums">
                {Math.round(eaten[key])} / {target[key]} g
              </span>
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${share * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

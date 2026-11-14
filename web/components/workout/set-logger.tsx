"use client";

import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/ui/button";
import { Keypad } from "@/components/ui/keypad";
import { SegmentChip } from "@/components/ui/segment-chip";
import type { AnyExerciseId } from "@/lib/exercises/ids";
import { exerciseName } from "@/lib/exercises/registry";
import { applyKey, keypadNumber, type KeypadKey } from "@/lib/keypad";
import { cn } from "@/lib/utils";
import type { SetResult } from "@/lib/workout/set-engine";
import { formatClock } from "./rep-display";

type Field = "value" | "load";

type SetLoggerProps = {
  result: SetResult;
  /** Exercises in this session, for the page dots. */
  exercises: readonly AnyExerciseId[];
  /** "Set 2 of 3" */
  title: string;
  sessionStartedAt: number;
  onDone: (logged: { loggedValue: number; loadKg: number }) => void;
  onDiscard: () => void;
};

/**
 * After each set: confirm or correct the counted reps (plank: seconds) and enter any
 * added load. Styled after the keypad reference screen.
 */
export function SetLogger({ result, exercises, title, sessionStartedAt, onDone, onDiscard }: SetLoggerProps) {
  const isHold = result.mode === "hold";
  const [field, setField] = useState<Field>("value");
  const [value, setValue] = useState(String(isHold ? Math.round(result.heldMs / 1000) : result.reps));
  const [load, setLoad] = useState("0");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () => setElapsed(Date.now() - sessionStartedAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sessionStartedAt]);

  function press(key: KeypadKey) {
    if (field === "value") setValue((v) => applyKey(v, key, { maxInt: 3 }));
    else setLoad((v) => applyKey(v, key, { maxInt: 3, decimals: 1 }));
  }

  const shown = field === "value" ? value : load;
  const unit = field === "load" ? "kg" : isHold ? "s" : value === "1" ? "rep" : "reps";
  const counted = isHold ? `Held ${formatClock(result.heldMs)}` : `Counted ${result.reps}`;
  const extra = [
    result.score !== null ? `form ${result.score}` : null,
    result.missed ? `${result.missed} missed` : null,
  ].filter(Boolean);

  return (
    <div className="absolute inset-0 z-30 mx-auto flex max-w-[440px] flex-col bg-black px-5">
      <div aria-hidden className="glow-warm pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
      <div className="pt-safe relative flex min-h-[56px] items-center justify-center">
        <p className="text-[14px] font-semibold text-muted">
          Workout · <span className="font-bold text-text tabular-nums">{formatClock(elapsed)}</span>
        </p>
      </div>

      <div className="relative mt-2 flex flex-col items-center">
        <div className="flex gap-1.5" aria-label="Exercises in this workout">
          {exercises.map((id) => (
            <span
              key={id}
              className={cn("size-1.5 rounded-full", id === result.exerciseId ? "bg-accent" : "bg-white/25")}
            />
          ))}
        </div>
        <h1 className="mt-3 text-[22px] font-extrabold tracking-tight">{exerciseName(result.exerciseId)}</h1>
        <p className="text-[13px] font-semibold text-muted">{title}</p>
      </div>

      <div className="relative mt-5 flex gap-2">
        <SegmentChip selected={field === "value"} onClick={() => setField("value")}>
          {isHold ? "Time" : "Reps"}
        </SegmentChip>
        <SegmentChip selected={field === "load"} onClick={() => setField("load")}>
          Added load
        </SegmentChip>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center py-4">
        <p className="flex items-baseline gap-1.5">
          <span className="text-[88px] leading-none font-extrabold tracking-tight tabular-nums">
            {shown.replace(".", ",")}
          </span>
          <span className="text-[22px] font-bold text-muted">{unit}</span>
        </p>
        <p className="mt-3 text-[13px] font-semibold text-muted">
          {counted}
          {extra.length > 0 && ` · ${extra.join(" · ")}`}
        </p>
      </div>

      <div className="pb-safe relative">
        <Keypad onKey={press} allowDecimal={field === "load"} />
        <div className="pt-4 pb-1">
          <PrimaryButton onClick={() => onDone({ loggedValue: keypadNumber(value), loadKg: keypadNumber(load) })}>
            Done
          </PrimaryButton>
        </div>
        <button
          type="button"
          onClick={() => window.confirm("Throw this set away and redo it?") && onDiscard()}
          className="w-full py-3 text-[13px] font-semibold text-muted"
        >
          Redo this set
        </button>
      </div>
    </div>
  );
}

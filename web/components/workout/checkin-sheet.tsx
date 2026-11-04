"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/ui/button";
import { OptionCard } from "@/components/ui/option-card";
import { Sheet } from "@/components/ui/sheet";
import {
  adjustPlan,
  checkinReason,
  describeAdjustment,
  recommend,
  type CheckinAnswers,
  type CheckinChoice,
  type PlanItem,
} from "@/lib/data/checkin";

const QUESTIONS: { key: keyof CheckinAnswers; label: string; low: string; high: string }[] = [
  { key: "sleep", label: "How well did you sleep?", low: "Badly", high: "Great" },
  { key: "energy", label: "How's your energy?", low: "Drained", high: "High" },
  { key: "soreness", label: "How sore are you?", low: "Not at all", high: "Very" },
];

type CheckinSheetProps = {
  open: boolean;
  plan: readonly PlanItem[];
  onClose: () => void;
  onChoose: (answers: CheckinAnswers, choice: CheckinChoice) => void;
  /** Start as planned, recording nothing. */
  onSkip: () => void;
};

/** Three quick questions, then simple rules suggest how much to do today. */
export function CheckinSheet({ open, plan, onClose, onChoose, onSkip }: CheckinSheetProps) {
  const [answers, setAnswers] = useState<CheckinAnswers>({ sleep: 7, energy: 7, soreness: 2 });
  const [answered, setAnswered] = useState(false);
  const recommended = recommend(answers);

  function close() {
    setAnswered(false);
    onClose();
  }

  function choose(choice: CheckinChoice) {
    setAnswered(false);
    onChoose(answers, choice);
  }

  const total = plan.reduce((sum, p) => sum + p.sets, 0);
  const options: { id: CheckinChoice; title: string; description: string }[] = [
    { id: "move", title: "Move day instead", description: "Rest today and train another day." },
    { id: "trim", title: "Trim about a third", description: describeAdjustment(plan, adjustPlan(plan, "trim")) },
    { id: "half", title: "Cut about half", description: describeAdjustment(plan, adjustPlan(plan, "half")) },
    { id: "keep", title: "Keep the full session", description: `All ${total} sets as planned.` },
  ];

  return (
    <Sheet
      open={open}
      onClose={close}
      title={answered ? "Your session today" : "Quick check-in"}
      footer={
        answered ? undefined : (
          <>
            <PrimaryButton onClick={() => setAnswered(true)}>Continue</PrimaryButton>
            <button
              type="button"
              onClick={() => {
                setAnswered(false);
                onSkip();
              }}
              className="w-full py-3 text-[13px] font-semibold text-muted"
            >
              Skip check-in
            </button>
          </>
        )
      }
    >
      {answered ? (
        <div className="flex flex-col gap-2.5">
          <p className="mb-1 text-[14px] font-medium text-text/85">{checkinReason(answers)}</p>
          {options.map((o) => (
            <OptionCard
              key={o.id}
              title={o.title}
              description={o.description}
              recommended={o.id === recommended}
              onClick={() => choose(o.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6 pb-2">
          {QUESTIONS.map((q) => (
            <label key={q.key} className="block">
              <span className="flex items-baseline justify-between">
                <span className="text-[15px] font-bold">{q.label}</span>
                <span className="text-[20px] font-extrabold text-accent tabular-nums">{answers[q.key]}</span>
              </span>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={answers[q.key]}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: Number(e.target.value) }))}
                className="mt-2 h-2 w-full cursor-pointer accent-[var(--accent)]"
              />
              <span className="mt-1 flex justify-between text-[12px] font-semibold text-muted">
                <span>{q.low}</span>
                <span>{q.high}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </Sheet>
  );
}

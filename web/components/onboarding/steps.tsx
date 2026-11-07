"use client";

import { LightbulbIcon, ScanEyeIcon, ShieldCheckIcon, SmartphoneIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { OptionCard } from "@/components/ui/option-card";
import { GOALS, LEVELS, type GoalId, type LevelId } from "@/lib/onboarding";
import { StepHeader } from "./step-header";

export function GoalStep({ value, onChange }: { value: GoalId | null; onChange: (id: GoalId) => void }) {
  return (
    <div>
      <StepHeader title="What are you training for?" subtitle="This shapes your suggested sessions." />
      <div className="flex flex-col gap-2.5">
        {GOALS.map((g) => (
          <OptionCard
            key={g.id}
            title={g.title}
            description={g.description}
            selected={value === g.id}
            onClick={() => onChange(g.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function LevelStep({ value, onChange }: { value: LevelId | null; onChange: (id: LevelId) => void }) {
  return (
    <div>
      <StepHeader title="Where are you starting?" subtitle="Be honest; we'll adjust as you log sets." />
      <div className="flex flex-col gap-2.5">
        {LEVELS.map((l) => (
          <OptionCard
            key={l.id}
            title={l.title}
            description={l.description}
            selected={value === l.id}
            onClick={() => onChange(l.id)}
          />
        ))}
      </div>
    </div>
  );
}

type BodyStepProps = {
  weight: string;
  height: string;
  onWeight: (v: string) => void;
  onHeight: (v: string) => void;
};

export function BodyStep({ weight, height, onWeight, onHeight }: BodyStepProps) {
  return (
    <div>
      <StepHeader title="Your body stats" subtitle="Used for calorie estimates and added-load tracking." />
      <div className="grid grid-cols-2 gap-2.5">
        <StatField label="Bodyweight" unit="kg" value={weight} onChange={onWeight} placeholder="70" />
        <StatField label="Height" unit="cm" value={height} onChange={onHeight} placeholder="175" />
      </div>
      <p className="mt-4 text-[13px] font-medium text-muted">You can change this later in Profile.</p>
    </div>
  );
}

type StatFieldProps = {
  label: string;
  unit: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
};

function StatField({ label, unit, value, placeholder, onChange }: StatFieldProps) {
  const width = `${Math.max(value.length || placeholder.length, 2) + 0.2}ch`;
  return (
    <label className="block cursor-text rounded-card border border-border-strong bg-surface p-4 transition-colors focus-within:border-accent-border focus-within:bg-accent-tint">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <span className="mt-1 flex items-baseline gap-1">
        <input
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))}
          style={{ width }}
          className="bg-transparent text-[48px] leading-none font-extrabold tracking-tight tabular-nums outline-none placeholder:text-white/20"
        />
        <span className="text-[20px] font-bold text-muted">{unit}</span>
      </span>
    </label>
  );
}

const CAMERA_TIPS = [
  { icon: SmartphoneIcon, text: "Prop your phone at about hip height, 2–3 metres away." },
  { icon: ScanEyeIcon, text: "Keep your whole body in frame, head to feet." },
  { icon: LightbulbIcon, text: "Face the light. A bright window behind you hides your joints." },
];

export function CameraStep() {
  return (
    <div>
      <StepHeader title="Set up your camera" subtitle="We'll ask for camera access when you start a workout." />

      <Card className="flex items-end justify-between px-8 pt-8 pb-6" aria-hidden>
        <PhoneOnFloor />
        <div className="mb-10 flex-1 px-3">
          <div className="border-t border-dashed border-white/25" />
          <p className="mt-2 text-center text-[11px] font-bold tracking-[0.12em] text-muted uppercase">2–3 m</p>
        </div>
        <Figure />
      </Card>

      <ul className="mt-4 flex flex-col gap-3">
        {CAMERA_TIPS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 text-[14px] font-medium text-text/85">
            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border-strong bg-surface text-accent">
              <Icon className="size-[18px]" strokeWidth={1.75} />
            </span>
            <span className="pt-2">{text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-start gap-3 rounded-tile border border-accent-border bg-accent-tint p-4 text-[13px] font-medium text-text/85">
        <ShieldCheckIcon className="mt-px size-5 shrink-0 text-accent" strokeWidth={1.75} />
        Pose tracking runs on your device. Video is never uploaded; clips you record stay on this phone.
      </div>
    </div>
  );
}

function PhoneOnFloor() {
  return (
    <svg viewBox="0 0 40 70" className="h-[70px] w-10" fill="none">
      <rect x="10" y="6" width="22" height="44" rx="5" transform="rotate(-10 21 28)" stroke="white" strokeOpacity="0.7" strokeWidth="2" />
      <circle cx="18" cy="12" r="1.6" fill="#FFC53D" transform="rotate(-10 21 28)" />
      <path d="M2 66h36" stroke="white" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Tiny yellow skeleton, same style as the live camera overlay. */
function Figure() {
  const joints: [number, number][] = [[24, 22], [36, 22], [20, 40], [40, 40], [26, 50], [34, 50], [25, 72], [35, 72], [25, 92], [35, 92]];
  return (
    <svg viewBox="0 0 60 100" className="h-[100px] w-[60px]" fill="none" strokeLinecap="round">
      <circle cx="30" cy="10" r="6" stroke="#FFC53D" strokeWidth="2" />
      <path
        d="M24 22h12M24 22l-4 18M36 22l4 18M24 22l2 28M36 22l-2 28M26 50h8M26 50l-1 22-0 20M34 50l1 22 0 20"
        stroke="#FFC53D"
        strokeWidth="2"
      />
      {joints.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" fill="#FFC53D" stroke="#111" strokeWidth="1.2" />
      ))}
      <path d="M8 98h44" stroke="white" strokeOpacity="0.25" strokeWidth="2" />
    </svg>
  );
}

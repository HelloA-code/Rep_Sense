"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { PrimaryButton } from "@/components/ui/button";
import { TopBar } from "@/components/ui/top-bar";
import { PRESETS, type EquipmentId } from "@/lib/equipment";
import {
  BODY_LIMITS,
  loadOnboarding,
  saveOnboarding,
  type GoalId,
  type LevelId,
} from "@/lib/onboarding";
import { EquipmentStep } from "./equipment-step";
import { BodyStep, CameraStep, GoalStep, LevelStep } from "./steps";

const STEPS = ["goal", "level", "equipment", "body", "camera"] as const;

const slide: Variants = {
  enter: (dir: number) => ({ x: dir * 32, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -32, opacity: 0 }),
};

function inRange(raw: string, { min, max }: { min: number; max: number }) {
  const n = Number(raw);
  return raw !== "" && Number.isFinite(n) && n >= min && n <= max;
}

export function OnboardingFlow() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);

  const [goal, setGoal] = useState<GoalId | null>(null);
  const [level, setLevel] = useState<LevelId | null>(null);
  const [equipment, setEquipment] = useState<EquipmentId[]>(() => [
    ...PRESETS.find((p) => p.id === "home")!.equipment,
  ]);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  // Re-running onboarding (from Profile) starts from the saved answers.
  useEffect(() => {
    const saved = loadOnboarding();
    if (!saved) return;
    setGoal(saved.goal);
    setLevel(saved.level);
    setEquipment(saved.equipment);
    setWeight(String(saved.weightKg));
    setHeight(String(saved.heightCm));
  }, []);

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const canContinue = {
    goal: goal !== null,
    level: level !== null,
    equipment: true,
    body: inRange(weight, BODY_LIMITS.weightKg) && inRange(height, BODY_LIMITS.heightCm),
    camera: true,
  }[step];

  function go(delta: 1 | -1) {
    setDir(delta);
    setIndex((i) => i + delta);
    window.scrollTo({ top: 0 });
  }

  function next() {
    if (!canContinue) return;
    if (!isLast) return go(1);
    if (!goal || !level) return;
    const data = {
      goal,
      level,
      equipment,
      weightKg: Number(weight),
      heightCm: Number(height),
      completedAt: new Date().toISOString(),
    };
    saveOnboarding(data);
    // Loaded on demand so the first screens a new user sees stay light.
    void import("@/lib/data/sync").then(({ pushProfile }) => pushProfile(data)).finally(() => {
      router.push("/today");
      router.refresh();
    });
  }

  function back() {
    if (index === 0) router.push("/");
    else go(-1);
  }

  return (
    <>
      <TopBar onBack={back} progress={{ step: index + 1, total: STEPS.length }} />

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.section
          key={step}
          custom={dir}
          variants={slide}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="flex-1 pt-7 pb-4"
        >
          {step === "goal" && <GoalStep value={goal} onChange={setGoal} />}
          {step === "level" && <LevelStep value={level} onChange={setLevel} />}
          {step === "equipment" && <EquipmentStep value={equipment} onChange={setEquipment} />}
          {step === "body" && (
            <BodyStep weight={weight} height={height} onWeight={setWeight} onHeight={setHeight} />
          )}
          {step === "camera" && <CameraStep />}
        </motion.section>
      </AnimatePresence>

      <div className="pb-safe sticky bottom-0 -mx-5 bg-gradient-to-t from-bg via-bg/90 to-transparent px-5 pt-6">
        <PrimaryButton onClick={next} disabled={!canContinue}>
          {isLast ? "Finish" : "Continue"}
        </PrimaryButton>
      </div>
    </>
  );
}

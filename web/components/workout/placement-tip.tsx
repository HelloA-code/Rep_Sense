"use client";

import { motion } from "framer-motion";
import { ScanLineIcon, SmartphoneIcon, Volume2Icon } from "lucide-react";
import { PrimaryButton } from "@/components/ui/button";
import type { ExerciseConfig } from "@/lib/exercises";

/** Before the first set of an exercise: where to put the phone, which way to face. */
export function PlacementTip({ exercise, onStart }: { exercise: ExerciseConfig; onStart: () => void }) {
  const side = exercise.preferredView === "side";
  const tips = [
    { icon: SmartphoneIcon, text: exercise.setupHint },
    {
      icon: ScanLineIcon,
      text: side
        ? "Turn sideways to the camera so it sees one full side of your body."
        : "Face the camera so both arms and legs are visible.",
    },
    { icon: Volume2Icon, text: "Turn your sound up: form cues are spoken." },
  ];
  return (
    <div className="absolute inset-0 z-20 flex items-end bg-black/55 backdrop-blur-[2px]">
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="pb-safe mx-auto w-full max-w-[440px] rounded-t-[28px] border-t border-border-strong bg-[#111] px-5 pt-6"
      >
        <p className="badge-text text-accent">{side ? "Side view" : "Front view"}</p>
        <h2 className="mt-1 text-[24px] font-extrabold tracking-tight">Set up for {exercise.name.toLowerCase()}s</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {tips.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-[14px] font-medium text-text/85">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-accent-border bg-accent-tint text-accent">
                <Icon className="size-4" />
              </span>
              <span className="pt-1.5">{text}</span>
            </li>
          ))}
        </ul>
        <div className="pt-6 pb-2">
          <PrimaryButton onClick={onStart}>Start set</PrimaryButton>
        </div>
      </motion.div>
    </div>
  );
}

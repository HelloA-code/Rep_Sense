"use client";

import { SegmentChip } from "@/components/ui/segment-chip";
import { SelectTile } from "@/components/ui/select-tile";
import {
  EQUIPMENT,
  EXERCISES,
  PRESETS,
  availableExercises,
  matchPreset,
  toggleEquipment,
  type EquipmentId,
} from "@/lib/equipment";
import { EQUIPMENT_ICONS } from "./equipment-icons";
import { StepHeader } from "./step-header";

type EquipmentStepProps = {
  value: EquipmentId[];
  onChange: (next: EquipmentId[]) => void;
};

export function EquipmentStep({ value, onChange }: EquipmentStepProps) {
  const preset = matchPreset(value);
  const unlocked = availableExercises(value);

  return (
    <div>
      <StepHeader title="What do you have?" subtitle="Start from a preset, then tap to adjust." />

      <div className="-mt-1 flex gap-2">
        {PRESETS.map((p) => (
          <SegmentChip key={p.id} selected={preset === p.id} onClick={() => onChange([...p.equipment])}>
            {p.label}
          </SegmentChip>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {EQUIPMENT.map((item) => (
          <SelectTile
            key={item.id}
            icon={EQUIPMENT_ICONS[item.id]}
            label={item.label}
            selected={value.includes(item.id)}
            onToggle={() => onChange(toggleEquipment(value, item.id))}
          />
        ))}
      </div>

      <p className="mt-4 text-[13px] leading-relaxed font-medium text-muted" aria-live="polite">
        <span className="font-bold text-text">
          {unlocked.length} of {EXERCISES.length} exercises
        </span>{" "}
        available: {unlocked.map((e) => e.name).join(" · ")}
      </p>
    </div>
  );
}

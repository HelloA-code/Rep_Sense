"use client";

import { useState } from "react";
import { BellIcon, MoreHorizontalIcon } from "lucide-react";
import { EQUIPMENT_ICONS } from "@/components/onboarding/equipment-icons";
import { Badge } from "@/components/ui/badge";
import { IconButton, PrimaryButton, SecondaryButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OptionCard } from "@/components/ui/option-card";
import { SegmentChip } from "@/components/ui/segment-chip";
import { SelectTile } from "@/components/ui/select-tile";
import { Sheet } from "@/components/ui/sheet";
import { TopBar } from "@/components/ui/top-bar";
import { EQUIPMENT } from "@/lib/equipment";

const CHIPS = ["Minimal", "Home gym", "Park", "Gym"];
const OPTIONS = [
  { id: "move", title: "Move to another day" },
  { id: "trim", title: "Trim about a third", description: "Drop one set from your three hardest exercises." },
  { id: "half", title: "Cut about half", description: "Half the sets, same exercises.", recommended: true },
  { id: "full", title: "Keep the full session" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[15px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function ComponentsPreview() {
  const [chip, setChip] = useState("Home gym");
  const [tiles, setTiles] = useState<string[]>(["pullup-bar", "rings", "bands"]);
  const [option, setOption] = useState("half");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [step, setStep] = useState(3);

  return (
    <>
      <TopBar title="Components" backHref="/" right={<Badge>Dev</Badge>} />

      <Section title="TopBar · progress variant">
        <Card className="px-4 py-1">
          <TopBar
            className="pt-0"
            onBack={() => setStep((s) => Math.max(1, s - 1))}
            progress={{ step, total: 5 }}
            right={
              <IconButton label="Next step" onClick={() => setStep((s) => Math.min(5, s + 1))}>
                <MoreHorizontalIcon className="size-5" />
              </IconButton>
            }
          />
        </Card>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-col gap-3">
          <PrimaryButton>Continue</PrimaryButton>
          <SecondaryButton>Close</SecondaryButton>
          <PrimaryButton disabled>Disabled</PrimaryButton>
          <div className="flex gap-3">
            <IconButton label="Notifications">
              <BellIcon className="size-5" />
            </IconButton>
            <IconButton label="More">
              <MoreHorizontalIcon className="size-5" />
            </IconButton>
          </div>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex gap-2">
          <Badge>Beta</Badge>
          <Badge tone="neutral">Front</Badge>
        </div>
      </Section>

      <Section title="SegmentChip">
        <div className="flex gap-2">
          {CHIPS.map((c) => (
            <SegmentChip key={c} selected={chip === c} onClick={() => setChip(c)}>
              {c}
            </SegmentChip>
          ))}
        </div>
      </Section>

      <Section title="SelectTile">
        <div className="grid grid-cols-3 gap-2.5">
          {EQUIPMENT.slice(0, 6).map((e) => (
            <SelectTile
              key={e.id}
              icon={EQUIPMENT_ICONS[e.id]}
              label={e.label}
              selected={tiles.includes(e.id)}
              onToggle={() =>
                setTiles((t) => (t.includes(e.id) ? t.filter((x) => x !== e.id) : [...t, e.id]))
              }
            />
          ))}
        </div>
      </Section>

      <Section title="OptionCard">
        <div className="flex flex-col gap-2.5">
          {OPTIONS.map((o) => (
            <OptionCard
              key={o.id}
              title={o.title}
              description={o.description}
              recommended={o.recommended}
              selected={option === o.id}
              onClick={() => setOption(o.id)}
            />
          ))}
        </div>
      </Section>

      <Section title="Card">
        <Card>
          <p className="text-[15px] font-bold">Glass card</p>
          <p className="mt-1 text-[14px] font-medium text-muted">4% white surface, 1px border, 20px radius.</p>
          <p className="mt-4 text-[80px] leading-none font-extrabold tracking-tight">
            12<span className="ml-1 text-[24px] text-muted">reps</span>
          </p>
        </Card>
      </Section>

      <Section title="Sheet">
        <SecondaryButton onClick={() => setSheetOpen(true)}>Open sheet</SecondaryButton>
      </Section>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Check-in"
        footer={<PrimaryButton onClick={() => setSheetOpen(false)}>Done</PrimaryButton>}
      >
        <p className="text-[14px] font-medium text-muted">
          Bottom sheet with a grabber. Drag the header down, press Esc, or tap outside to close.
        </p>
        <div className="mt-4 flex flex-col gap-2.5">
          {OPTIONS.slice(1, 3).map((o) => (
            <OptionCard key={o.id} title={o.title} description={o.description} recommended={o.recommended} />
          ))}
        </div>
      </Sheet>
    </>
  );
}

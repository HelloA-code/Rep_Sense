"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CameraIcon, ChevronRightIcon, FilmIcon, LogOutIcon } from "lucide-react";
import { EquipmentStep } from "@/components/onboarding/equipment-step";
import { BodyStep } from "@/components/onboarding/steps";
import { PrimaryButton, SecondaryButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { secondaryButtonClass } from "@/components/ui/styles";
import { loadVoiceOn, saveVoiceOn, voiceSupported } from "@/components/workout/voice";
import { pushProfile, signOut, unsavedCount } from "@/lib/data/sync";
import { EQUIPMENT, type EquipmentId } from "@/lib/equipment";
import { BODY_LIMITS, loadOnboarding, saveOnboarding, type OnboardingData } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { SignInCard } from "./sign-in-card";

function Row({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-t border-border px-5 py-3.5 text-left first:border-t-0 hover:bg-surface-raised"
    >
      <span className="flex-1 text-[14px] font-semibold text-muted">{label}</span>
      <span className="truncate text-[14px] font-bold">{value}</span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted" />
    </button>
  );
}

type ProfileViewProps = {
  email: string | null;
  serverProfile: OnboardingData | null;
};

export function ProfileView({ email, serverProfile }: ProfileViewProps) {
  const router = useRouter();
  const [data, setData] = useState<OnboardingData | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [sheet, setSheet] = useState<"body" | "equipment" | null>(null);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [equipment, setEquipment] = useState<EquipmentId[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setData(serverProfile ?? loadOnboarding());
    setVoiceOn(loadVoiceOn());
  }, [serverProfile]);

  function save(next: OnboardingData) {
    setData(next);
    saveOnboarding(next);
    void pushProfile(next);
    setSheet(null);
  }

  function openBody() {
    if (!data) return;
    setWeight(String(data.weightKg));
    setHeight(String(data.heightCm));
    setSheet("body");
  }

  function openEquipment() {
    if (!data) return;
    setEquipment(data.equipment);
    setSheet("equipment");
  }

  function toggleVoice() {
    const on = !voiceOn;
    setVoiceOn(on);
    saveVoiceOn(on);
    void pushProfile(data);
  }

  async function leave() {
    setBusy(true);
    const unsaved = await unsavedCount();
    if (unsaved > 0 && !window.confirm("Some workout data hasn't uploaded yet and will be lost. Sign out anyway?")) {
      setBusy(false);
      return;
    }
    await signOut();
    router.replace("/");
    router.refresh();
  }

  const w = Number(weight);
  const h = Number(height);
  const bodyValid =
    w >= BODY_LIMITS.weightKg.min &&
    w <= BODY_LIMITS.weightKg.max &&
    h >= BODY_LIMITS.heightCm.min &&
    h <= BODY_LIMITS.heightCm.max;

  return (
    <div className="flex flex-col gap-3">
      {email ? (
        <Card className="p-4">
          <p className="text-[12px] font-semibold text-muted">Signed in as</p>
          <p className="truncate text-[15px] font-bold">{email}</p>
        </Card>
      ) : (
        <SignInCard text="Save workouts and keep your stats across devices." next="/profile" />
      )}

      {data && (
        <Card className="overflow-hidden p-0">
          <Row label="Body" value={`${data.weightKg} kg · ${data.heightCm} cm`} onClick={openBody} />
          <Row
            label="Equipment"
            value={
              data.equipment.length
                ? `${data.equipment.length} of ${EQUIPMENT.length} items`
                : "None"
            }
            onClick={openEquipment}
          />
          {voiceSupported() && (
            <button
              type="button"
              role="switch"
              aria-checked={voiceOn}
              onClick={toggleVoice}
              className="flex w-full items-center justify-between border-t border-border px-5 py-3.5 text-left hover:bg-surface-raised"
            >
              <span className="text-[14px] font-semibold text-muted">Voice cues</span>
              <span
                className={cn(
                  "flex h-6 w-10 items-center rounded-full p-0.5 transition-colors",
                  voiceOn ? "justify-end bg-accent" : "justify-start bg-white/15",
                )}
              >
                <span className={cn("size-5 rounded-full", voiceOn ? "bg-accent-fg" : "bg-white/70")} />
              </span>
            </button>
          )}
        </Card>
      )}

      <Link href="/clips" className={secondaryButtonClass}>
        <FilmIcon className="size-4" />
        Recorded clips
      </Link>
      <Link href="/record" className={secondaryButtonClass}>
        <CameraIcon className="size-4" />
        Free camera &amp; clip recorder
      </Link>
      <Link href="/onboarding" className={secondaryButtonClass}>
        Edit onboarding answers
      </Link>
      {email && (
        <SecondaryButton onClick={leave} disabled={busy} className="text-danger">
          <LogOutIcon className="size-4" />
          {busy ? "Signing out…" : "Sign out"}
        </SecondaryButton>
      )}

      <Sheet
        open={sheet === "body"}
        onClose={() => setSheet(null)}
        title="Body stats"
        footer={
          <PrimaryButton
            disabled={!bodyValid}
            onClick={() => data && save({ ...data, weightKg: w, heightCm: h })}
          >
            Save
          </PrimaryButton>
        }
      >
        <BodyStep weight={weight} height={height} onWeight={setWeight} onHeight={setHeight} />
      </Sheet>

      <Sheet
        open={sheet === "equipment"}
        onClose={() => setSheet(null)}
        title="Your equipment"
        footer={<PrimaryButton onClick={() => data && save({ ...data, equipment })}>Save</PrimaryButton>}
      >
        <EquipmentStep value={equipment} onChange={setEquipment} />
      </Sheet>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ActivityIcon,
  CameraIcon,
  DownloadIcon,
  DumbbellIcon,
  FilmIcon,
  KeyRoundIcon,
  LogOutIcon,
  PencilIcon,
  RulerIcon,
  ShieldCheckIcon,
  TargetIcon,
  UtensilsIcon,
  Volume2Icon,
} from "lucide-react";
import { shareOrDownload } from "@/components/clips/export";
import { EquipmentStep } from "@/components/onboarding/equipment-step";
import { BodyStep, GoalStep, LevelStep } from "@/components/onboarding/steps";
import { PrimaryButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SettingsButton, SettingsGroup, SettingsLink, SettingsSwitch } from "@/components/ui/settings-list";
import { Sheet } from "@/components/ui/sheet";
import { primaryButtonClass } from "@/components/ui/styles";
import { loadVoiceOn, saveVoiceOn, voiceSupported } from "@/components/workout/voice";
import { profileStats, type SessionWithSets } from "@/lib/data/stats";
import { EQUIPMENT, type EquipmentId } from "@/lib/equipment";
import {
  BODY_LIMITS,
  GOALS,
  LEVELS,
  loadOnboarding,
  saveOnboarding,
  type OnboardingData,
} from "@/lib/onboarding";

// The Supabase client is big, so it's only fetched when an action needs it.
const sync = () => import("@/lib/data/sync");

type SheetName = "name" | "goal" | "level" | "body" | "equipment" | "password" | "privacy";

const inputClass =
  "h-[52px] w-full rounded-tile border border-border-strong bg-surface px-4 text-[16px] font-semibold outline-none placeholder:text-white/30 focus:border-accent-border";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 py-4 text-center">
      <p className="text-[24px] leading-none font-extrabold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1.5 text-[12px] font-semibold text-muted">{label}</p>
    </div>
  );
}

export type ProfileAccount = {
  email: string | null;
  name: string | null;
  /** Signed up with a password, so changing it makes sense (not for Google). */
  hasPassword: boolean;
};

type ProfileViewProps = {
  account: ProfileAccount | null;
  serverProfile: OnboardingData | null;
  sessions: SessionWithSets[];
};

export function ProfileView({ account, serverProfile, sessions }: ProfileViewProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [name, setName] = useState(account?.name ?? "");
  const [nameDraft, setNameDraft] = useState("");
  const [voiceOn, setVoiceOn] = useState(true);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [equipment, setEquipment] = useState<EquipmentId[]>([]);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setData(serverProfile ?? loadOnboarding());
    setVoiceOn(loadVoiceOn());
    setReady(true);
  }, [serverProfile]);

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 3000);
    return () => clearTimeout(id);
  }, [note]);

  function save(next: OnboardingData) {
    setData(next);
    saveOnboarding(next);
    void sync().then(({ pushProfile }) => pushProfile(next));
    setSheet(null);
  }

  function open(name: SheetName) {
    if (name === "body" && data) {
      setWeight(String(data.weightKg));
      setHeight(String(data.heightCm));
    }
    if (name === "equipment" && data) setEquipment(data.equipment);
    if (name === "name") setNameDraft(displayName === "You" ? "" : displayName);
    if (name === "password") setPassword("");
    setSheet(name);
  }

  function toggleVoice(on: boolean) {
    setVoiceOn(on);
    saveVoiceOn(on);
    void sync().then(({ pushProfile }) => pushProfile(data));
  }

  async function saveName() {
    setBusy(true);
    const { updateAccount } = await sync();
    const error = await updateAccount({ data: { full_name: nameDraft.trim() } });
    setBusy(false);
    if (error) return setNote(error);
    setName(nameDraft.trim());
    setSheet(null);
  }

  async function savePassword() {
    setBusy(true);
    const { updateAccount } = await sync();
    const error = await updateAccount({ password });
    setBusy(false);
    setNote(error ?? "Password changed");
    if (!error) setSheet(null);
  }

  async function downloadData() {
    setBusy(true);
    try {
      const { exportMyData } = await sync();
      const stamp = new Date().toISOString().slice(0, 10);
      await shareOrDownload(`repsense_my_data_${stamp}.json`, await exportMyData());
    } catch {
      setNote("Couldn't get your data. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    const { signOut, unsavedCount } = await sync();
    const unsaved = await unsavedCount();
    if (unsaved > 0 && !window.confirm("Some workout data hasn't uploaded yet and will be lost. Sign out anyway?")) {
      setBusy(false);
      return;
    }
    await signOut();
    router.replace("/");
    router.refresh();
  }

  if (!ready) return null;

  const fromEmail = account?.email?.split("@")[0] ?? "";
  const displayName = name || fromEmail || "You";
  const initial = displayName.charAt(0).toUpperCase();
  const stats = profileStats(sessions, new Date());

  const w = Number(weight);
  const h = Number(height);
  const bodyValid =
    w >= BODY_LIMITS.weightKg.min &&
    w <= BODY_LIMITS.weightKg.max &&
    h >= BODY_LIMITS.heightCm.min &&
    h <= BODY_LIMITS.heightCm.max;

  return (
    <div className="flex flex-col gap-6">
      <div className="pt-safe flex flex-col items-center pt-6 text-center">
        <span className="grid size-24 place-items-center rounded-full bg-accent text-[40px] font-extrabold text-accent-fg">
          {account ? initial : "R"}
        </span>
        <h1 className="mt-4 max-w-full truncate text-[24px] font-extrabold tracking-tight">
          {account ? displayName : "Guest"}
        </h1>
        <p className="mt-0.5 max-w-full truncate text-[14px] font-medium text-muted">
          {account?.email ?? "Your workouts stay on this device"}
        </p>
        {account && (
          <button
            type="button"
            onClick={() => open("name")}
            className="mt-3 flex items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-[13px] font-bold"
          >
            <PencilIcon className="size-3.5" />
            Edit name
          </button>
        )}
      </div>

      {account ? (
        <Card className="flex divide-x divide-border p-0">
          <Stat value={String(stats.workouts)} label="Workouts" />
          <Stat value={stats.reps.toLocaleString("en")} label="Total reps" />
          <Stat value={String(stats.streak)} label="Day streak" />
        </Card>
      ) : (
        <Card className="text-center">
          <p className="text-[15px] font-bold">Save your progress</p>
          <p className="mt-1 mb-4 text-[13px] font-medium text-muted">
            Sign in to keep your workouts and stats across devices.
          </p>
          <Link href="/login?next=/profile" className={primaryButtonClass}>
            Sign in
          </Link>
        </Card>
      )}

      {data ? (
        <SettingsGroup title="Training">
          <SettingsButton
            icon={TargetIcon}
            label="Goal"
            value={GOALS.find((g) => g.id === data.goal)?.title}
            onClick={() => open("goal")}
          />
          <SettingsButton
            icon={ActivityIcon}
            label="Level"
            value={LEVELS.find((l) => l.id === data.level)?.title}
            onClick={() => open("level")}
          />
          <SettingsButton
            icon={RulerIcon}
            label="Body stats"
            value={`${data.weightKg} kg · ${data.heightCm} cm`}
            onClick={() => open("body")}
          />
          <SettingsButton
            icon={DumbbellIcon}
            label="Equipment"
            value={`${data.equipment.length} of ${EQUIPMENT.length}`}
            onClick={() => open("equipment")}
          />
        </SettingsGroup>
      ) : (
        <SettingsGroup title="Training">
          <SettingsLink icon={TargetIcon} label="Set up your training" href="/onboarding" />
        </SettingsGroup>
      )}

      {account && (
        <SettingsGroup title="Nutrition">
          <SettingsLink icon={UtensilsIcon} label="Diet targets and preferences" href="/diet?setup=1" />
        </SettingsGroup>
      )}

      {voiceSupported() && (
        <SettingsGroup title="Preferences">
          <SettingsSwitch icon={Volume2Icon} label="Voice cues" checked={voiceOn} onChange={toggleVoice} />
        </SettingsGroup>
      )}

      <SettingsGroup title="Your data">
        <SettingsLink icon={FilmIcon} label="Recorded clips" href="/clips" />
        <SettingsLink icon={CameraIcon} label="Free camera & recorder" href="/record" />
        {account && (
          <SettingsButton icon={DownloadIcon} label="Download my data" onClick={downloadData} disabled={busy} />
        )}
      </SettingsGroup>

      <SettingsGroup title="About">
        <SettingsButton icon={ShieldCheckIcon} label="Privacy" onClick={() => open("privacy")} />
      </SettingsGroup>

      {account && (
        <SettingsGroup title="Account">
          {account.hasPassword && (
            <SettingsButton icon={KeyRoundIcon} label="Change password" onClick={() => open("password")} />
          )}
          <SettingsButton icon={LogOutIcon} label={busy ? "One moment…" : "Sign out"} onClick={leave} disabled={busy} danger />
        </SettingsGroup>
      )}

      {note && (
        <p role="status" className="text-center text-[13px] font-semibold text-accent">
          {note}
        </p>
      )}

      <Sheet open={sheet === "name"} onClose={() => setSheet(null)} title="Your name" footer={
        <PrimaryButton disabled={busy || !nameDraft.trim()} onClick={saveName}>Save</PrimaryButton>
      }>
        <input
          aria-label="Your name"
          placeholder="Your name"
          maxLength={40}
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          className={inputClass}
        />
      </Sheet>

      <Sheet open={sheet === "goal"} onClose={() => setSheet(null)} title="Your goal">
        <GoalStep value={data?.goal ?? null} onChange={(goal) => data && save({ ...data, goal })} />
      </Sheet>

      <Sheet open={sheet === "level"} onClose={() => setSheet(null)} title="Your level">
        <LevelStep value={data?.level ?? null} onChange={(level) => data && save({ ...data, level })} />
      </Sheet>

      <Sheet open={sheet === "body"} onClose={() => setSheet(null)} title="Body stats" footer={
        <PrimaryButton disabled={!bodyValid} onClick={() => data && save({ ...data, weightKg: w, heightCm: h })}>
          Save
        </PrimaryButton>
      }>
        <BodyStep weight={weight} height={height} onWeight={setWeight} onHeight={setHeight} />
      </Sheet>

      <Sheet open={sheet === "equipment"} onClose={() => setSheet(null)} title="Your equipment" footer={
        <PrimaryButton onClick={() => data && save({ ...data, equipment })}>Save</PrimaryButton>
      }>
        <EquipmentStep value={equipment} onChange={setEquipment} />
      </Sheet>

      <Sheet open={sheet === "password"} onClose={() => setSheet(null)} title="Change password" footer={
        <PrimaryButton disabled={busy || password.length < 8} onClick={savePassword}>Save</PrimaryButton>
      }>
        <input
          type="password"
          aria-label="New password"
          autoComplete="new-password"
          placeholder="New password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </Sheet>

      <Sheet open={sheet === "privacy"} onClose={() => setSheet(null)} title="Privacy">
        <ul className="flex list-disc flex-col gap-2 pb-4 pl-5 text-[14px] font-medium text-text/85">
          <li>Pose tracking runs on your device. Video is never uploaded.</li>
          <li>Clips you record stay in this browser, on this device.</li>
          <li>With an account, only workout numbers are saved: reps, times, form scores and check-in answers.</li>
          <li>
            AI features (Coach chat, describing or photographing a meal, diet plans) send that text or photo, plus a
            numbers-only summary of your training and food log, to Google&rsquo;s Gemini. Photos aren&rsquo;t stored by
            RepSense. On Gemini&rsquo;s free tier, Google may use this content to improve its products.
          </li>
          <li>Only you can read your data. Use Download my data to get a copy.</li>
        </ul>
      </Sheet>
    </div>
  );
}

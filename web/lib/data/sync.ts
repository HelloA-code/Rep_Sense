import { loadVoiceOn, saveVoiceOn } from "@/components/workout/voice";
import { clearOnboarding, loadOnboarding, saveOnboarding, type OnboardingData } from "@/lib/onboarding";
import { browserSupabase, type BrowserSupabase } from "@/lib/supabase/client";
import { addToOutbox, drainOutbox, isPermanentError, type OutboxItem, type UploadResult } from "./outbox";
import type { CustomExercise } from "@/lib/exercises/custom";
import {
  customToRow,
  loadCustomExercises,
  mergeCustom,
  replaceCustomExercises,
  rowToCustom,
  storeCustomExercise,
} from "./custom-store";
import { onboardingToRow, rowToOnboarding } from "./rows";

// Browser side of saving: the localStorage outbox, uploading it, and keeping the
// onboarding cache in step with the signed-in profile.

const OUTBOX_KEY = "repsense.outbox.v1";

function readOutbox(): OutboxItem[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(OUTBOX_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: readonly OutboxItem[]) {
  try {
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked: this visit can still try uploading what it holds.
  }
}

async function signedInUserId(supabase: BrowserSupabase): Promise<string | null> {
  // Only picks whose id to stamp on the rows. The server verifies the token, and RLS
  // rejects a row carrying any other id.
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

const CHECK_VIOLATION = "23514";
/** A table or column a newer migration adds (0004) doesn't exist yet. */
const NOT_MIGRATED = new Set(["42P01", "42703", "PGRST204", "PGRST205"]);

async function upload(supabase: BrowserSupabase, item: OutboxItem, userId: string): Promise<UploadResult> {
  const { error } =
    item.kind === "session"
      ? await supabase.from("workout_sessions").upsert({ ...item.row, user_id: userId })
      : item.kind === "set"
        ? await supabase.from("exercise_sets").upsert({ ...item.row, user_id: userId })
        : item.kind === "custom"
          ? await supabase.from("custom_exercises").upsert({ ...item.row, user_id: userId })
          : await supabase.from("checkins").upsert({ ...item.row, user_id: userId });
  if (!error) return "sent";
  // Rows that need a migration the database hasn't had yet (0003, 0004): keep them until it has.
  if (item.kind === "set" && error.code === CHECK_VIOLATION) return "keep";
  if (NOT_MIGRATED.has(error.code ?? "")) return "keep";
  return isPermanentError(error.code) ? "drop" : "retry";
}

export type FlushResult = { signedIn: boolean; sent: number; remaining: number };

async function flushOnce(): Promise<FlushResult> {
  const supabase = browserSupabase();
  const userId = supabase ? await signedInUserId(supabase) : null;
  if (!supabase || !userId) return { signedIn: false, sent: 0, remaining: readOutbox().length };

  let sent = 0;
  await drainOutbox(
    readOutbox(),
    (item) => upload(supabase, item, userId),
    (done) => {
      sent += 1;
      // Re-read and match exactly: a set logged mid-upload, or a newer version of this
      // same row, was added after our snapshot and must stay queued.
      const uploaded = JSON.stringify(done);
      writeOutbox(readOutbox().filter((x) => JSON.stringify(x) !== uploaded));
    },
  );
  return { signedIn: true, sent, remaining: readOutbox().length };
}

let lastFlush: Promise<unknown> = Promise.resolve();

/** Uploads whatever is queued. Runs one after another, so a later call sees newer rows. */
export function flushOutbox(): Promise<FlushResult> {
  const run = lastFlush.then(flushOnce, flushOnce);
  lastFlush = run;
  return run;
}

/** Queues rows and tries to upload them. Returns the upload's outcome. */
export function saveToOutbox(items: readonly OutboxItem[]): Promise<FlushResult> {
  writeOutbox(items.reduce(addToOutbox, readOutbox()));
  return flushOutbox();
}

/** Uploads the local answers and voice setting to the profile, if signed in. */
export async function pushProfile(data: OnboardingData | null = loadOnboarding()): Promise<void> {
  const supabase = browserSupabase();
  const userId = supabase ? await signedInUserId(supabase) : null;
  if (!supabase || !userId || !data) return;
  await supabase.from("profiles").upsert(onboardingToRow(data, userId, loadVoiceOn()));
}

/** After login: the saved profile replaces the local cache; a first login uploads it. */
export async function syncProfile(): Promise<void> {
  const supabase = browserSupabase();
  const userId = supabase ? await signedInUserId(supabase) : null;
  if (!supabase || !userId) return;
  const { data: row, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) return;
  if (!row) return pushProfile();
  const saved = rowToOnboarding(row);
  if (saved) saveOnboarding(saved);
  saveVoiceOn(row.voice_on);
}

/** After login: taught exercises saved on the server join the ones on this device. */
export async function syncCustomExercises(): Promise<void> {
  const supabase = browserSupabase();
  const userId = supabase ? await signedInUserId(supabase) : null;
  if (!supabase || !userId) return;
  const { data, error } = await supabase.from("custom_exercises").select("*");
  if (error || !data) return; // table not there yet (0004 not run): local copies still work
  const remote = data.map(rowToCustom).filter((c): c is CustomExercise => c !== null);
  if (remote.length) replaceCustomExercises(mergeCustom(loadCustomExercises(), remote));
}

/** Saves a taught (or archived) exercise here, and to the account when signed in. */
export function saveCustomExercise(c: CustomExercise): Promise<FlushResult> {
  storeCustomExercise(c);
  return saveToOutbox([{ kind: "custom", row: customToRow(c) }]);
}

/** Removes a taught exercise from the pickers; kept (archived) so old workouts keep its name. */
export function archiveCustom(c: CustomExercise): Promise<FlushResult> {
  return saveCustomExercise({ ...c, archived: true });
}

/** Change the user's name or password. Returns an error message, or null on success. */
export async function updateAccount(attributes: { data?: { full_name: string }; password?: string }): Promise<string | null> {
  const supabase = browserSupabase();
  if (!supabase) return "Accounts aren't set up.";
  const { error } = await supabase.auth.updateUser(attributes);
  return error?.message ?? null;
}

/** A full copy of the user's saved data, for the Download my data button. */
export async function exportMyData() {
  const supabase = browserSupabase();
  if (!supabase) throw new Error("Accounts aren't set up.");
  const [profile, sessions, sets, checkins] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("workout_sessions").select("*").order("started_at"),
    supabase.from("exercise_sets").select("*").order("created_at"),
    supabase.from("checkins").select("*").order("created_at"),
  ]);
  const failed = [profile, sessions, sets, checkins].find((r) => r.error);
  if (failed?.error) throw failed.error;
  // Optional: the table only exists once 0004 has run.
  const custom = await supabase.from("custom_exercises").select("*").order("created_at");
  return {
    exportedAt: new Date().toISOString(),
    profile: profile.data?.[0] ?? null,
    workouts: sessions.data,
    sets: sets.data,
    checkins: checkins.data,
    customExercises: custom.error ? [] : custom.data,
  };
}

/** How many rows wouldn't make it if the user signed out right now. */
export async function unsavedCount(): Promise<number> {
  return (await flushOutbox()).remaining;
}

/** Signs out and clears this device, so the next person can't inherit the answers or queue. */
export async function signOut(): Promise<void> {
  await browserSupabase()?.auth.signOut();
  clearOnboarding();
  writeOutbox([]);
  replaceCustomExercises([]);
}

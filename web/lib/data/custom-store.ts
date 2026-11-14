import { isCustomExercise, type CustomExercise } from "@/lib/exercises/custom";
import type { CustomExerciseRow } from "@/lib/supabase/database";

// Taught exercises live on this device (localStorage), so they work signed out and
// offline. When signed in, changes also go through the outbox to Supabase, and the saved
// list is pulled back on login (sync.ts).

const KEY = "repsense.custom-exercises.v1";
/** Fired on this page when the list changes, so open screens can re-read it. */
export const CUSTOM_CHANGED = "repsense:custom-exercises";

let cache: { raw: string | null; list: CustomExercise[] } = { raw: null, list: [] };

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Every taught exercise, archived ones included (old workouts still need their names). */
export function loadCustomExercises(): CustomExercise[] {
  if (typeof window === "undefined") return [];
  const raw = readRaw();
  if (raw === cache.raw) return cache.list;
  let list: CustomExercise[] = [];
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    list = Array.isArray(parsed) ? parsed.filter(isCustomExercise) : [];
  } catch {
    list = [];
  }
  cache = { raw, list };
  return list;
}

/** The ones shown in pickers. */
export function activeCustomExercises(list: readonly CustomExercise[] = loadCustomExercises()): CustomExercise[] {
  return list.filter((c) => !c.archived);
}

/** Taught from scratch ("My exercises"); ones taught for a library exercise show under that exercise. */
export function ownCustomExercises(list: readonly CustomExercise[] = loadCustomExercises()): CustomExercise[] {
  return activeCustomExercises(list).filter((c) => !c.libraryId);
}

/** The newest active counter taught for a library exercise, if any. */
export function taughtFor(libraryId: string, list: readonly CustomExercise[] = loadCustomExercises()): CustomExercise | undefined {
  return activeCustomExercises(list)
    .filter((c) => c.libraryId === libraryId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function writeAll(list: readonly CustomExercise[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked: the exercise still works until the page closes.
  }
  window.dispatchEvent(new Event(CUSTOM_CHANGED));
}

/** Adds or replaces one exercise (by id). */
export function upsertCustom(list: readonly CustomExercise[], c: CustomExercise): CustomExercise[] {
  const i = list.findIndex((x) => x.id === c.id);
  if (i === -1) return [...list, c];
  const next = [...list];
  next[i] = c;
  return next;
}

/** Saved list from the server merged into the local one: the server's copy wins per id. */
export function mergeCustom(local: readonly CustomExercise[], remote: readonly CustomExercise[]): CustomExercise[] {
  return remote.reduce(upsertCustom, [...local]);
}

export function storeCustomExercise(c: CustomExercise) {
  writeAll(upsertCustom(loadCustomExercises(), c));
}

export function replaceCustomExercises(list: readonly CustomExercise[]) {
  writeAll(list);
}

// ---- database rows ----

export type NewCustomRow = Omit<CustomExerciseRow, "user_id" | "updated_at">;

export function customToRow(c: CustomExercise): NewCustomRow {
  return {
    id: c.id,
    name: c.name,
    definition: {
      signal: c.signal,
      mirror: c.mirror,
      counter: c.counter,
      view: c.view,
      ...(c.libraryId ? { libraryId: c.libraryId } : {}),
    },
    archived: c.archived,
    created_at: c.createdAt,
  };
}

/** Null if the row doesn't hold a valid exercise (e.g. edited by hand). */
export function rowToCustom(row: Pick<CustomExerciseRow, "id" | "name" | "definition" | "archived" | "created_at">) {
  const c: unknown = { ...row.definition, id: row.id, name: row.name, archived: row.archived, createdAt: row.created_at };
  return isCustomExercise(c) ? c : null;
}

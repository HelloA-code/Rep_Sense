import type { NewCheckin, NewSession, NewSet } from "./rows";

// Workouts are written here first, then uploaded. A dropped connection or a workout
// finished before signing in loses nothing, and because rows carry their own ids and
// upload as upserts, sending one twice is harmless.

export type OutboxItem =
  | { kind: "session"; row: NewSession }
  | { kind: "checkin"; row: NewCheckin }
  | { kind: "set"; row: NewSet };

/** Parents first: sets and check-ins reference a session that must already exist. */
const PRIORITY: Record<OutboxItem["kind"], number> = { session: 0, checkin: 1, set: 2 };

/** Adds an item, replacing any queued version of the same row. */
export function addToOutbox(items: readonly OutboxItem[], item: OutboxItem): OutboxItem[] {
  const i = items.findIndex((x) => x.kind === item.kind && x.row.id === item.row.id);
  if (i === -1) return [...items, item];
  const next = [...items];
  next[i] = item;
  return next;
}

/**
 * - "drop": the server will never accept this row, so don't block the queue on it.
 * - "keep": not accepted yet, but may be later (e.g. a new exercise before the database
 *   migration that allows it has run). Stays queued; the rest of the queue carries on.
 */
export type UploadResult = "sent" | "retry" | "drop" | "keep";

/**
 * Uploads in dependency order and stops at the first "retry" so nothing arrives before
 * its parent. Returns what's left to send.
 */
export async function drainOutbox(
  items: readonly OutboxItem[],
  upload: (item: OutboxItem) => Promise<UploadResult>,
  onDone?: (item: OutboxItem) => void,
): Promise<OutboxItem[]> {
  const queue = [...items].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind]);
  const kept: OutboxItem[] = [];
  while (queue.length > 0) {
    let result: UploadResult;
    try {
      result = await upload(queue[0]);
    } catch {
      result = "retry";
    }
    if (result === "retry") break;
    const item = queue.shift() as OutboxItem;
    if (result === "keep") kept.push(item);
    else onDone?.(item);
  }
  return [...kept, ...queue];
}

/** Postgres classes 22 (bad data) and 23 (constraint): retrying can't ever succeed. */
export function isPermanentError(code: string | undefined): boolean {
  return !!code && (code.startsWith("22") || code.startsWith("23"));
}

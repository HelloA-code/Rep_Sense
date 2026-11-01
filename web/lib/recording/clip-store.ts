import type { CameraView, Recording, RecordingLabel } from "./format";

// Saved clips live in IndexedDB on this device and are never uploaded.
// Three stores so the list screen can read small metadata rows without loading
// every clip's frames (~1–3 MB) or video (~19 MB per minute).

const DB_NAME = "repsense";
const DB_VERSION = 2;
const META = "clipMeta";
const DATA = "clipData";
const VIDEO = "clipVideo";

export type ClipMeta = {
  id: string;
  label: RecordingLabel;
  view: CameraView;
  subject: string;
  createdAt: string;
  durationMs: number;
  frameCount: number;
  /** Set when a real video was saved with the landmarks. */
  video?: { type: string; bytes: number };
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "id" });
      if (!db.objectStoreNames.contains(DATA)) db.createObjectStore(DATA);
      if (!db.objectStoreNames.contains(VIDEO)) db.createObjectStore(VIDEO);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((err: unknown) => {
    dbPromise = null; // allow a retry
    throw err;
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function result<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function toMeta(id: string, rec: Recording, video?: Blob | null): ClipMeta {
  return {
    ...(video ? { video: { type: video.type, bytes: video.size } } : {}),
    id,
    label: rec.label,
    view: rec.view,
    subject: rec.subject,
    createdAt: rec.createdAt,
    durationMs: rec.durationMs,
    frameCount: rec.frameCount,
  };
}

export async function saveClip(rec: Recording, video?: Blob | null): Promise<ClipMeta> {
  const db = await openDb();
  const meta = toMeta(crypto.randomUUID(), rec, video);
  const tx = db.transaction([META, DATA, VIDEO], "readwrite");
  tx.objectStore(META).put(meta);
  tx.objectStore(DATA).put(rec, meta.id);
  if (video) tx.objectStore(VIDEO).put(video, meta.id);
  await done(tx);
  // Ask the browser not to evict our data under storage pressure (Safari otherwise
  // may clear it after a few weeks without visits). Best effort.
  navigator.storage?.persist?.().catch(() => {});
  return meta;
}

/** Newest first. */
export async function listClips(): Promise<ClipMeta[]> {
  const db = await openDb();
  const rows = await result(db.transaction(META).objectStore(META).getAll() as IDBRequest<ClipMeta[]>);
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getClip(id: string): Promise<Recording | null> {
  const db = await openDb();
  const rec = await result(db.transaction(DATA).objectStore(DATA).get(id) as IDBRequest<Recording | undefined>);
  return rec ?? null;
}

export async function getClipVideo(id: string): Promise<Blob | null> {
  const db = await openDb();
  const blob = await result(db.transaction(VIDEO).objectStore(VIDEO).get(id) as IDBRequest<Blob | undefined>);
  return blob ?? null;
}

export async function getAllClips(): Promise<Recording[]> {
  const db = await openDb();
  const all = await result(db.transaction(DATA).objectStore(DATA).getAll() as IDBRequest<Recording[]>);
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Fix a wrong label or view after the fact. */
export async function updateClip(id: string, patch: Partial<Pick<Recording, "label" | "view">>): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([META, DATA], "readwrite");
  const metaStore = tx.objectStore(META);
  const dataStore = tx.objectStore(DATA);
  // Callbacks, not awaits: a transaction commits once it has no pending requests,
  // so the puts must be queued from inside the success handlers.
  const metaReq = metaStore.get(id) as IDBRequest<ClipMeta | undefined>;
  metaReq.onsuccess = () => metaReq.result && metaStore.put({ ...metaReq.result, ...patch });
  const dataReq = dataStore.get(id) as IDBRequest<Recording | undefined>;
  dataReq.onsuccess = () => dataReq.result && dataStore.put({ ...dataReq.result, ...patch }, id);
  await done(tx);
}

export async function deleteClip(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([META, DATA, VIDEO], "readwrite");
  tx.objectStore(META).delete(id);
  tx.objectStore(DATA).delete(id);
  tx.objectStore(VIDEO).delete(id);
  await done(tx);
}

import type { CandidateDocument, Context, ReviewRecord } from "./core.js";
const NAME = "cautious-review-private-v2";
const RETENTION = 7 * 24 * 60 * 60 * 1000;
interface Audit { id?: number; origin: string; key: string; action: string; at: string; before: ReviewRecord | null; after: ReviewRecord | null }
let connection: Promise<IDBDatabase> | undefined;
function db(): Promise<IDBDatabase> {
  return connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, 1);
    request.onupgradeneeded = () => {
      for (const name of ["documents", "reviews"]) request.result.createObjectStore(name, { keyPath: "key" });
      request.result.createObjectStore("audit", { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { connection = undefined; reject(request.error); };
  });
}
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? Error("Storage transaction aborted"));
    tx.onerror = () => reject(tx.error ?? Error("Storage error"));
  });
}
async function all<T>(name: string): Promise<T[]> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction(name).objectStore(name).getAll();
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
}
export async function documents(origin: string) {
  return (await all<CandidateDocument>("documents")).filter(v => v.origin === origin);
}
export async function reviews(origin: string) {
  return (await all<ReviewRecord>("reviews")).filter(v => v.origin === origin);
}
export async function saveDocument(document: CandidateDocument) {
  const d = await db(), tx = d.transaction("documents", "readwrite"), finished = done(tx);
  tx.objectStore("documents").put(document); await finished;
}
/** Save the decision and its previous value in ONE atomic IndexedDB transaction. */
export async function decide(record: ReviewRecord) {
  const d = await db(), tx = d.transaction(["reviews", "audit"], "readwrite"), finished = done(tx);
  const r = tx.objectStore("reviews").get(record.key);
  r.onsuccess = () => {
    tx.objectStore("audit").add({ origin: record.origin, key: record.key, action: "queue", at: record.createdAt, before: r.result ?? null, after: record });
    tx.objectStore("reviews").put(record);
  };
  await finished;
}
export async function undo(context: Context) {
  const d = await db(), tx = d.transaction(["reviews", "audit"], "readwrite"), finished = done(tx);
  const r = tx.objectStore("audit").getAll();
  let changed = false;
  r.onsuccess = () => {
    const list = r.result as Audit[];
    const entry = list.reverse().find(a => a.key === context.key && a.action === "queue");
    if (!entry) return;
    changed = true;
    if (entry.before) tx.objectStore("reviews").put(entry.before); else tx.objectStore("reviews").delete(context.key);
    tx.objectStore("audit").put({ ...entry, action: "queue-undone" });
    tx.objectStore("audit").add({ origin: context.origin, key: context.key, action: "undo", at: new Date().toISOString(), before: entry.after, after: entry.before });
  };
  await finished; return changed;
}
export async function purgeExpired() {
  const cutoff = Date.now() - RETENTION;
  const d = await db(), tx = d.transaction(["documents", "reviews", "audit"], "readwrite"), finished = done(tx);
  for (const name of ["documents", "reviews", "audit"]) {
    const r = tx.objectStore(name).openCursor();
    r.onsuccess = () => {
      const cursor = r.result; if (!cursor) return;
      const date = Date.parse(cursor.value.indexedAt ?? cursor.value.createdAt ?? cursor.value.at);
      if (!Number.isFinite(date) || date < cutoff) cursor.delete();
      cursor.continue();
    };
  }
  await finished;
}
export async function clear() {
  const d = await db(), tx = d.transaction(["documents", "reviews", "audit"], "readwrite"), finished = done(tx);
  for (const name of ["documents", "reviews", "audit"]) tx.objectStore(name).clear();
  await finished;
}

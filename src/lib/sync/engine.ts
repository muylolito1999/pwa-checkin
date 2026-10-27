import { db, deleteMeta, getMeta, setMeta } from "@/lib/db";
import {
  describeError,
  ensureSignedIn,
  getSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { processOutbox, STUCK_THRESHOLD, type PushResult } from "./outbox";
import type { Checkin, Guest, LocalCheckin, LocalGuest } from "@/types";

export interface SyncStatus {
  lastSync: string | null;
  pendingChanges: number;
  stuckChanges: number;
  isSyncing: boolean;
  error: string | null;
}

export interface SyncResult {
  pushed: PushResult;
  pulled: { guests: number; checkins: number };
}

const EMPTY_RESULT: SyncResult = {
  pushed: { processed: 0, failed: 0 },
  pulled: { guests: 0, checkins: 0 },
};

/** Supabase caps a single request at 1000 rows by default. */
const PAGE_SIZE = 1000;
/** Rows committed slightly before the watermark (long transactions) are re-read; puts are idempotent. */
const WATERMARK_MARGIN_MS = 60_000;
const EPOCH = "1970-01-01T00:00:00Z";

const tableWatermarkKey = (eventId: string, table: string) => `last-sync:${table}:${eventId}`;
const lastSyncKey = (eventId: string) => `last-sync:${eventId}`;

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

// Last-Write-Wins merge for guests. Timestamps are server-authoritative.
function mergeGuest(local: LocalGuest, remote: Guest): LocalGuest {
  // A local change that hasn't been pushed yet takes precedence (optimistic UI).
  if (local._pending_sync) return local;

  const localTime = new Date(local.updated_at).getTime();
  const remoteTime = new Date(remote.updated_at).getTime();
  if (remoteTime > localTime) {
    return { ...remote, _pending_sync: false };
  }
  return local;
}

async function readWatermark(eventId: string, table: string): Promise<string | null> {
  const stored = await getMeta(tableWatermarkKey(eventId, table));
  if (stored) return stored;
  // Pre-v2 builds kept a single per-event key in localStorage.
  try {
    return localStorage.getItem(`last-sync-${eventId}`);
  } catch {
    return null;
  }
}

function sinceWithMargin(watermark: string | null): string {
  if (!watermark) return EPOCH;
  const time = Date.parse(watermark);
  return Number.isNaN(time) ? EPOCH : new Date(time - WATERMARK_MARGIN_MS).toISOString();
}

async function pullTable<T extends { id: string }>(
  table: "guests" | "checkins",
  eventId: string,
  timestampColumn: "updated_at" | "created_at",
  apply: (rows: T[]) => Promise<number>
): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;

  const since = sinceWithMargin(await readWatermark(eventId, table));
  let from = 0;
  let applied = 0;
  let newest: string | null = null;

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("event_id", eventId)
      .gt(timestampColumn, since)
      .order(timestampColumn, { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;

    const rows = (data ?? []) as T[];
    if (rows.length === 0) break;

    applied += await apply(rows);
    for (const row of rows) {
      const stamp = (row as Record<string, unknown>)[timestampColumn];
      if (typeof stamp === "string" && (!newest || stamp > newest)) newest = stamp;
    }

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  // The watermark is the newest server timestamp actually received, never the device clock.
  if (newest) await setMeta(tableWatermarkKey(eventId, table), newest);
  return applied;
}

async function applyRemoteGuests(rows: Guest[]): Promise<number> {
  let changed = 0;
  await db.transaction("rw", db.guests, db.checkins, async () => {
    for (const remote of rows) {
      const local = await db.guests.get(remote.id);
      const merged = local ? mergeGuest(local, remote) : { ...remote, _pending_sync: false };
      if (merged === local) continue;

      await db.guests.put(merged);
      changed++;
      // A guest removed on another device takes its check-ins with it.
      if (merged.is_deleted && !local?.is_deleted) {
        await db.checkins.where("guest_id").equals(remote.id).delete();
      }
    }
  });
  return changed;
}

async function applyRemoteCheckins(rows: Checkin[]): Promise<number> {
  let added = 0;
  await db.transaction("rw", db.checkins, db.guests, async () => {
    const existing = await db.checkins.bulkGet(rows.map((row) => row.id));
    const known = new Set(existing.filter(Boolean).map((row) => row!.id));
    const guests = await db.guests.bulkGet([...new Set(rows.map((row) => row.guest_id))]);
    const deletedGuests = new Set(
      guests.filter((guest) => guest?.is_deleted).map((guest) => guest!.id)
    );

    const toAdd: LocalCheckin[] = rows
      .filter((row) => !known.has(row.id) && !deletedGuests.has(row.guest_id))
      .map((row) => ({ ...row, _pending_sync: false }));
    if (toAdd.length > 0) {
      await db.checkins.bulkPut(toAdd);
      added = toAdd.length;
    }
  });
  return added;
}

export async function pullFromServer(eventId: string): Promise<SyncResult["pulled"]> {
  if (!isSupabaseConfigured()) return { guests: 0, checkins: 0 };

  const guests = await pullTable<Guest>("guests", eventId, "updated_at", applyRemoteGuests);
  const checkins = await pullTable<Checkin>("checkins", eventId, "created_at", applyRemoteCheckins);

  // Legacy watermark is superseded by the per-table meta keys.
  try {
    localStorage.removeItem(`last-sync-${eventId}`);
  } catch {
    // ignore
  }

  return { guests, checkins };
}

export async function pushToServer(eventId: string): Promise<PushResult> {
  return processOutbox(eventId);
}

// ---------------------------------------------------------------------------
// Full sync with a single-flight lock
// ---------------------------------------------------------------------------

let inFlight: Promise<SyncResult> | null = null;

async function runFullSync(eventId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured()) return EMPTY_RESULT;

  await ensureSignedIn();
  // Push first, then pull (to avoid conflicts)
  const pushed = await pushToServer(eventId);
  const pulled = await pullFromServer(eventId);
  await setMeta(lastSyncKey(eventId), new Date().toISOString());

  return { pushed, pulled };
}

/** Runs a full sync; concurrent callers share the in-flight run instead of racing it. */
export function fullSync(eventId: string): Promise<SyncResult> {
  if (inFlight) return inFlight;
  inFlight = runFullSync(eventId).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Waits for any running sync, then runs `fn` while no new sync can start. */
export async function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  while (inFlight) {
    try {
      await inFlight;
    } catch {
      // A failed sync releases the lock just the same.
    }
  }
  let release: (() => void) | undefined;
  inFlight = new Promise<SyncResult>((resolve) => {
    release = () => resolve(EMPTY_RESULT);
  });
  try {
    return await fn();
  } finally {
    inFlight = null;
    release?.();
  }
}

// ---------------------------------------------------------------------------
// Status and recovery
// ---------------------------------------------------------------------------

export async function getSyncStatus(eventId: string, isSyncing = false): Promise<SyncStatus> {
  const entries = await db.outbox.where("event_id").equals(eventId).toArray();
  return {
    lastSync: await getMeta(lastSyncKey(eventId)),
    pendingChanges: entries.length,
    stuckChanges: entries.filter((entry) => entry.retries >= STUCK_THRESHOLD).length,
    isSyncing,
    error: null,
  };
}

export async function getStuckEntries(eventId: string) {
  return db.outbox
    .where("event_id")
    .equals(eventId)
    .filter((entry) => entry.retries >= STUCK_THRESHOLD)
    .toArray();
}

/** Resets backoff for stuck entries and syncs again. */
export async function retryStuck(eventId: string): Promise<SyncResult> {
  await db.outbox
    .where("event_id")
    .equals(eventId)
    .filter((entry) => entry.retries >= STUCK_THRESHOLD)
    .modify({ retries: 0, next_attempt_at: null, last_error: null });
  return fullSync(eventId);
}

/**
 * Drops stuck entries. Their local rows stop claiming a pending change so the
 * next pull can merge the server's version again.
 */
export async function discardStuck(eventId: string): Promise<number> {
  return db.transaction("rw", db.outbox, db.guests, db.checkins, async () => {
    const stuck = await getStuckEntries(eventId);
    for (const entry of stuck) {
      if (entry.table === "guests") {
        await db.guests.update(entry.record_id, { _pending_sync: false });
      } else {
        await db.checkins.update(entry.record_id, { _pending_sync: false });
      }
      await db.outbox.delete(entry.id!);
    }
    return stuck.length;
  });
}

/** Removes every local record and sync marker for an event (used after a server wipe). */
export async function clearLocalEventData(eventId: string): Promise<void> {
  await db.transaction("rw", db.guests, db.checkins, db.outbox, db.meta, async () => {
    await db.guests.where("event_id").equals(eventId).delete();
    await db.checkins.where("event_id").equals(eventId).delete();
    await db.outbox.where("event_id").equals(eventId).delete();
    await deleteMeta(lastSyncKey(eventId));
    await deleteMeta(tableWatermarkKey(eventId, "guests"));
    await deleteMeta(tableWatermarkKey(eventId, "checkins"));
  });
  try {
    localStorage.removeItem(`last-sync-${eventId}`);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Background sync
// ---------------------------------------------------------------------------

/**
 * Syncs immediately, then on an interval, when the device comes back online and
 * when the tab returns to the foreground (mobile browsers throttle timers).
 * Returns a disposer that removes every listener.
 */
export function startBackgroundSync(
  eventId: string,
  intervalMs: number = 30_000,
  onStatus?: (status: SyncStatus) => void
): () => void {
  const report = async (error: unknown = null) => {
    const status = await getSyncStatus(eventId);
    onStatus?.({ ...status, error: error ? describeError(error) : null });
  };

  const doSync = async () => {
    if (!navigator.onLine || !isSupabaseConfigured()) return;
    onStatus?.(await getSyncStatus(eventId, true));
    try {
      await fullSync(eventId);
      await report();
    } catch (error) {
      console.error("Background sync failed:", error);
      await report(error);
    }
  };

  const onOnline = () => void doSync();
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") void doSync();
  };

  void doSync();
  const interval = setInterval(doSync, intervalMs);
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    clearInterval(interval);
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

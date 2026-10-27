import Dexie, { type EntityTable } from "dexie";
import { v5 as uuidv5 } from "uuid";
import type {
  Event,
  LocalCheckin,
  LocalEventTable,
  LocalGuest,
  LocalTableArrival,
  OutboxEntry,
  SyncMeta,
} from "@/types";

// Database singleton
class CheckinDatabase extends Dexie {
  events!: EntityTable<Event, "id">;
  guests!: EntityTable<LocalGuest, "id">;
  checkins!: EntityTable<LocalCheckin, "id">;
  // Not `tables`: Dexie already exposes `db.tables` (the list of all stores).
  event_tables!: EntityTable<LocalEventTable, "id">;
  table_arrivals!: EntityTable<LocalTableArrival, "id">;
  outbox!: EntityTable<OutboxEntry, "id">;
  meta!: EntityTable<SyncMeta, "key">;

  constructor() {
    super("pwa-checkin-db");

    this.version(1).stores({
      events: "id, name, date",
      guests: "id, event_id, stable_key, is_deleted, _pending_sync, [event_id+stable_key]",
      checkins: "id, event_id, guest_id, checked_in_at, type, _pending_sync",
      outbox: "++id, table, timestamp, retries",
    });

    // v2: booleans are not valid IndexedDB keys, so the is_deleted/_pending_sync
    // indexes never worked (every query fell back to full-table scans). Index by
    // event instead, add a compound index for a guest's check-ins, scope the outbox
    // by event, and add a meta table for sync watermarks.
    this.version(2)
      .stores({
        events: "id",
        guests: "id, event_id, [event_id+stable_key]",
        checkins: "id, event_id, guest_id, [event_id+guest_id], checked_in_at",
        outbox: "++id, event_id, next_attempt_at",
        meta: "key",
      })
      .upgrade((tx) =>
        tx
          .table("outbox")
          .toCollection()
          .modify((entry: OutboxEntry) => {
            if (!entry.event_id) {
              const data = entry.data as { event_id?: unknown } | undefined;
              entry.event_id = typeof data?.event_id === "string" ? data.event_id : "";
            }
          })
      );

    // v3: tables (group reservations) and their append-only arrivals log.
    // Stores not listed here are carried over unchanged from v2.
    this.version(3).stores({
      event_tables: "id, event_id",
      table_arrivals: "id, event_id, table_id, [event_id+table_id], arrived_at",
    });
  }
}

// Export singleton instance
export const db = new CheckinDatabase();

// Helper to generate stable key for guest deduplication
export function generateStableKey(lastName: string, firstName: string): string {
  const normalized = `${lastName}_${firstName}`.toLowerCase().trim();
  // Use TextEncoder to handle Unicode characters properly
  const bytes = new TextEncoder().encode(normalized);
  return btoa(String.fromCharCode(...bytes));
}

// Fixed namespace for deterministic guest ids. Never change it: every device must
// derive the same id for the same (event, stable_key) pair.
const GUEST_ID_NAMESPACE = "6f1c2a7e-3b5d-4c8e-9a1f-2d4b6c8e0a12";

/**
 * Deterministic guest id. Two devices importing the same CSV (even offline)
 * produce identical ids, so upserts converge on one server row and check-ins
 * from both devices reference the same guest.
 */
export function generateGuestId(eventId: string, stableKey: string): string {
  return uuidv5(`${eventId}:${stableKey}`, GUEST_ID_NAMESPACE);
}

// Helper to get device ID (persistent per device)
export function getDeviceId(): string {
  const key = "pwa-checkin-device-id";
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}

// Helper to generate UUID
export function generateId(): string {
  return crypto.randomUUID();
}

export async function getMeta(key: string): Promise<string | null> {
  return (await db.meta.get(key))?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value });
}

export async function deleteMeta(key: string): Promise<void> {
  await db.meta.delete(key);
}

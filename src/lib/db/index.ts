import Dexie, { type EntityTable } from "dexie";
import type { LocalGuest, LocalCheckin, OutboxEntry, Event } from "@/types";

// Database singleton
class CheckinDatabase extends Dexie {
  events!: EntityTable<Event, "id">;
  guests!: EntityTable<LocalGuest, "id">;
  checkins!: EntityTable<LocalCheckin, "id">;
  outbox!: EntityTable<OutboxEntry, "id">;

  constructor() {
    super("pwa-checkin-db");

    this.version(1).stores({
      events: "id, name, date",
      guests: "id, event_id, stable_key, is_deleted, _pending_sync, [event_id+stable_key]",
      checkins: "id, event_id, guest_id, checked_in_at, type, _pending_sync",
      outbox: "++id, table, timestamp, retries",
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

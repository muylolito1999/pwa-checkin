// Database types
export interface Event {
  id: string;
  name: string;
  date: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Guest {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  notes: string | null;
  phone: string | null;
  group: string | null;
  ticket_code: string | null;
  stable_key: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Checkin {
  id: string;
  event_id: string;
  guest_id: string;
  checked_in_at: string;
  type: "IN" | "OUT";
  device_id: string;
  synced_at: string | null;
  created_at: string;
}

/** A group reservation ("Marco, 10 seats"), independent of the guest list. */
export interface EventTable {
  id: string;
  event_id: string;
  name: string;
  seats: number;
  notes: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Append-only log of arrivals at a table. The number of people who arrived is
 * the sum of `delta` (negative rows are corrections), so concurrent offline
 * increments from several devices never overwrite each other.
 */
export interface TableArrival {
  id: string;
  event_id: string;
  table_id: string;
  delta: number;
  arrived_at: string;
  device_id: string;
  synced_at: string | null;
  created_at: string;
}

// Local database types (with sync metadata)
export interface LocalGuest extends Guest {
  _pending_sync?: boolean;
}

export interface LocalCheckin extends Checkin {
  _pending_sync?: boolean;
}

export interface LocalEventTable extends EventTable {
  _pending_sync?: boolean;
}

export interface LocalTableArrival extends TableArrival {
  _pending_sync?: boolean;
}

// Outbox types for sync queue
export type OutboxOperation = "CREATE" | "UPDATE" | "DELETE";

/**
 * Synced tables. The same name is used for the Dexie store, the outbox entry
 * and the Supabase table, so the push can call `supabase.from(entry.table)`.
 */
export const SYNC_TABLES = ["guests", "checkins", "event_tables", "table_arrivals"] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

export interface OutboxEntry {
  id?: number;
  event_id: string;
  table: SyncTable;
  operation: OutboxOperation;
  record_id: string;
  data: Record<string, unknown>;
  timestamp: string;
  retries: number;
  /** ISO timestamp before which the entry is not retried (exponential backoff). */
  next_attempt_at?: string | null;
  last_error?: string | null;
}

/** Small key/value table for sync watermarks and other device-local state. */
export interface SyncMeta {
  key: string;
  value: string;
}

// CSV Import types
export interface CsvValidationError {
  row: number;
  field: string;
  message: string;
}

export interface CsvImportResult {
  success: boolean;
  imported: number;
  updated: number;
  /** Rows skipped because the same name appeared earlier in the file. */
  duplicates: number;
  errors: CsvValidationError[];
}

// Stats types
export interface GuestStats {
  total: number;
  checkedIn: number;
  notArrived: number;
  /** Guests whose latest record is a check-out. */
  left: number;
}

/** Seats and arrivals summed over every live table of an event. */
export interface TableTotals {
  tables: number;
  seats: number;
  arrived: number;
  remaining: number;
  over: number;
}

export interface TimeSlotStats {
  time: string;
  count: number;
}

export interface RecentCheckin {
  id: string;
  name: string;
  time: string;
  type: "IN" | "OUT";
  source: "guest" | "table";
  /** Number of people for a table arrival (always positive). */
  count?: number;
}

// Auth types
export interface Session {
  eventId: string;
  eventName: string;
  eventDate?: string | null;
  authenticated: boolean;
}

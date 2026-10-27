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

// Local database types (with sync metadata)
export interface LocalGuest extends Guest {
  _pending_sync?: boolean;
}

export interface LocalCheckin extends Checkin {
  _pending_sync?: boolean;
}

// Outbox types for sync queue
export type OutboxOperation = "CREATE" | "UPDATE" | "DELETE";

export interface OutboxEntry {
  id?: number;
  event_id: string;
  table: "guests" | "checkins";
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
export interface CsvRow {
  first_name: string;
  last_name: string;
  notes?: string;
  phone?: string;
  group?: string;
  ticket_code?: string;
}

export interface CsvValidationError {
  row: number;
  field: string;
  message: string;
}

export interface CsvImportResult {
  success: boolean;
  imported: number;
  updated: number;
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

export interface TimeSlotStats {
  time: string;
  count: number;
}

export interface RecentCheckin {
  id: string;
  name: string;
  time: string;
  type: "IN" | "OUT";
}

// Auth types
export interface Session {
  eventId: string;
  eventName: string;
  eventDate?: string | null;
  authenticated: boolean;
}

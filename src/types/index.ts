// Database types
export interface Event {
  id: string;
  name: string;
  date: string;
  access_code: string | null;
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
  table: "guests" | "checkins";
  operation: OutboxOperation;
  record_id: string;
  data: Record<string, unknown>;
  timestamp: string;
  retries: number;
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
  checkouts: number;
}

export interface TimeSlotStats {
  time: string;
  count: number;
}

// Auth types
export interface Session {
  eventId: string;
  eventName: string;
  authenticated: boolean;
}

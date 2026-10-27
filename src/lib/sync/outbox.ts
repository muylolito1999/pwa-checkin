import { db } from "@/lib/db";
import {
  describeError,
  getSupabase,
  isAuthError,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type { OutboxEntry, OutboxOperation } from "@/types";

/** After this many failed attempts an entry is shown as "stuck" (it is still retried). */
export const STUCK_THRESHOLD = 5;

const RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000, 60_000];

/** Local-only fields and server-owned timestamps are never sent to Supabase. */
const STRIPPED_FIELDS = ["_pending_sync", "created_at", "updated_at", "synced_at"];

export function getRetryDelay(retries: number): number {
  const index = Math.min(Math.max(retries - 1, 0), RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index];
}

export async function addToOutbox(
  operation: OutboxOperation,
  table: OutboxEntry["table"],
  data: Record<string, unknown>
): Promise<void> {
  await db.outbox.add({
    event_id: typeof data.event_id === "string" ? data.event_id : "",
    table,
    operation,
    record_id: data.id as string,
    data,
    timestamp: new Date().toISOString(),
    retries: 0,
    next_attempt_at: null,
    last_error: null,
  });
}

export interface PushResult {
  processed: number;
  failed: number;
}

/**
 * Pushes queued changes in order. Entries are never dropped: a failure schedules
 * a retry with exponential backoff, and later entries for the same record wait
 * so per-record ordering (CREATE before UPDATE) is preserved.
 */
export async function processOutbox(eventId?: string): Promise<PushResult> {
  if (!isSupabaseConfigured()) {
    return { processed: 0, failed: 0 };
  }

  const entries = eventId
    ? await db.outbox.where("event_id").equals(eventId).sortBy("id")
    : await db.outbox.orderBy("id").toArray();

  const now = Date.now();
  const blockedRecords = new Set<string>();
  let processed = 0;
  let failed = 0;

  for (const entry of entries) {
    const recordKey = `${entry.table}:${entry.record_id}`;
    if (blockedRecords.has(recordKey)) continue;

    if (entry.next_attempt_at && Date.parse(entry.next_attempt_at) > now) {
      blockedRecords.add(recordKey);
      continue;
    }

    try {
      await processEntry(entry);
      await db.outbox.delete(entry.id!);
      processed++;
    } catch (error) {
      console.error(`Failed to process outbox entry ${entry.id}:`, error);
      const retries = entry.retries + 1;
      await db.outbox.update(entry.id!, {
        retries,
        next_attempt_at: new Date(Date.now() + getRetryDelay(retries)).toISOString(),
        last_error: describeError(error),
      });
      blockedRecords.add(recordKey);
      failed++;
      // Every remaining call would fail the same way; let the engine report it.
      if (isAuthError(error)) throw error;
    }
  }

  return { processed, failed };
}

function stripLocalFields(data: Record<string, unknown>): Record<string, unknown> {
  const payload = { ...data };
  for (const field of STRIPPED_FIELDS) delete payload[field];
  return payload;
}

async function markSynced(table: OutboxEntry["table"], recordId: string): Promise<void> {
  if (table === "guests") {
    await db.guests.update(recordId, { _pending_sync: false });
  } else {
    await db.checkins.update(recordId, {
      _pending_sync: false,
      synced_at: new Date().toISOString(),
    });
  }
}

async function processEntry(entry: OutboxEntry): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { table, operation, data, record_id } = entry;

  switch (operation) {
    // CREATE and UPDATE both carry the full row and converge on the server row
    // with the same id (ids are deterministic per guest). An upsert never rewrites
    // a primary key, and a record deleted server-side is simply recreated from the
    // device's copy instead of silently matching zero rows.
    case "CREATE":
    case "UPDATE": {
      const { error } = await supabase
        .from(table)
        .upsert(stripLocalFields(data), { onConflict: "id" });
      if (error) throw error;
      await markSynced(table, record_id);
      break;
    }

    case "DELETE": {
      if (table === "checkins") {
        const { error } = await supabase.from("checkins").delete().eq("id", record_id);
        if (error) throw error;
      } else {
        // Guests are soft-deleted so other devices learn about the removal via pull.
        const { error } = await supabase
          .from("guests")
          .update({ is_deleted: true })
          .eq("id", record_id);
        if (error) throw error;
      }
      break;
    }
  }
}

export async function getOutboxCount(eventId?: string): Promise<number> {
  return eventId ? db.outbox.where("event_id").equals(eventId).count() : db.outbox.count();
}

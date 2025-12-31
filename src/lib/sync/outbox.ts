import { db } from "@/lib/db";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { OutboxEntry } from "@/types";

const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff

export async function addToOutbox(
  operation: OutboxEntry["operation"],
  table: OutboxEntry["table"],
  data: Record<string, unknown>
): Promise<void> {
  await db.outbox.add({
    table,
    operation,
    record_id: data.id as string,
    data,
    timestamp: new Date().toISOString(),
    retries: 0,
  });
}

export async function processOutbox(): Promise<{
  processed: number;
  failed: number;
}> {
  if (!isSupabaseConfigured()) {
    return { processed: 0, failed: 0 };
  }

  const entries = await db.outbox.orderBy("timestamp").toArray();
  let processed = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      await processEntry(entry);
      await db.outbox.delete(entry.id!);
      processed++;
    } catch (error) {
      console.error(`Failed to process outbox entry ${entry.id}:`, error);

      if (entry.retries >= MAX_RETRIES) {
        // Move to dead letter queue or just delete after max retries
        console.error(`Entry ${entry.id} exceeded max retries, removing`);
        await db.outbox.delete(entry.id!);
        failed++;
      } else {
        // Increment retry count
        await db.outbox.update(entry.id!, {
          retries: entry.retries + 1,
        });
        failed++;
      }
    }
  }

  return { processed, failed };
}

async function processEntry(entry: OutboxEntry): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { table, operation, data, record_id } = entry;

  // Remove local-only fields before sending to Supabase
  const cleanData = { ...data };
  delete cleanData._pending_sync;

  switch (operation) {
    case "CREATE":
      const { error: createError } = await supabase
        .from(table)
        .upsert(cleanData, { onConflict: table === "guests" ? "event_id,stable_key" : "id" });
      if (createError) throw createError;

      // Mark as synced in local DB
      if (table === "guests") {
        await db.guests.update(record_id, { _pending_sync: false });
      } else if (table === "checkins") {
        await db.checkins.update(record_id, {
          _pending_sync: false,
          synced_at: new Date().toISOString(),
        });
      }
      break;

    case "UPDATE":
      const { error: updateError } = await supabase
        .from(table)
        .update(cleanData)
        .eq("id", record_id);
      if (updateError) throw updateError;

      if (table === "guests") {
        await db.guests.update(record_id, { _pending_sync: false });
      }
      break;

    case "DELETE":
      // Soft delete for guests
      if (table === "guests") {
        const { error: deleteError } = await supabase
          .from(table)
          .update({ is_deleted: true, updated_at: new Date().toISOString() })
          .eq("id", record_id);
        if (deleteError) throw deleteError;
      }
      break;
  }
}

export async function getOutboxCount(): Promise<number> {
  return db.outbox.count();
}

export async function clearOutbox(): Promise<void> {
  await db.outbox.clear();
}

export function getRetryDelay(retries: number): number {
  return RETRY_DELAYS[Math.min(retries, RETRY_DELAYS.length - 1)];
}

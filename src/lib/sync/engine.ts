import { db } from "@/lib/db";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { processOutbox, getOutboxCount } from "./outbox";
import type { Guest, Checkin, LocalGuest, LocalCheckin } from "@/types";

export interface SyncStatus {
  lastSync: string | null;
  pendingChanges: number;
  isSyncing: boolean;
  error: string | null;
}

// Last-Write-Wins merge for guests
function mergeGuest(local: LocalGuest, remote: Guest): LocalGuest {
  const localTime = new Date(local.updated_at).getTime();
  const remoteTime = new Date(remote.updated_at).getTime();

  // If local is pending sync, it takes precedence (optimistic UI)
  if (local._pending_sync) {
    return local;
  }

  // Otherwise, most recent update wins
  if (remoteTime > localTime) {
    return { ...remote, _pending_sync: false };
  }

  return local;
}

export async function pullFromServer(eventId: string): Promise<{
  guests: number;
  checkins: number;
}> {
  if (!isSupabaseConfigured()) {
    return { guests: 0, checkins: 0 };
  }

  let guestsUpdated = 0;
  let checkinsUpdated = 0;

  // Get last sync timestamp for this event
  const lastSync = localStorage.getItem(`last-sync-${eventId}`);
  const since = lastSync || "1970-01-01T00:00:00Z";

  const supabase = getSupabase();
  if (!supabase) return { guests: 0, checkins: 0 };

  // Pull guests updated since last sync
  const { data: remoteGuests, error: guestsError } = await supabase
    .from("guests")
    .select("*")
    .eq("event_id", eventId)
    .gt("updated_at", since);

  if (guestsError) throw guestsError;

  if (remoteGuests) {
    for (const remote of remoteGuests) {
      const local = await db.guests.get(remote.id);

      if (local) {
        const merged = mergeGuest(local, remote);
        if (merged !== local) {
          await db.guests.put(merged);
          guestsUpdated++;
        }
      } else {
        await db.guests.put({ ...remote, _pending_sync: false });
        guestsUpdated++;
      }
    }
  }

  // Pull checkins created since last sync
  const { data: remoteCheckins, error: checkinsError } = await supabase
    .from("checkins")
    .select("*")
    .eq("event_id", eventId)
    .gt("created_at", since);

  if (checkinsError) throw checkinsError;

  if (remoteCheckins) {
    for (const remote of remoteCheckins) {
      const local = await db.checkins.get(remote.id);

      if (!local) {
        await db.checkins.put({
          ...remote,
          _pending_sync: false,
        } as LocalCheckin);
        checkinsUpdated++;
      }
    }
  }

  // Update last sync timestamp
  localStorage.setItem(`last-sync-${eventId}`, new Date().toISOString());

  return { guests: guestsUpdated, checkins: checkinsUpdated };
}

export async function pushToServer(): Promise<{
  processed: number;
  failed: number;
}> {
  return processOutbox();
}

export async function fullSync(eventId: string): Promise<{
  pushed: { processed: number; failed: number };
  pulled: { guests: number; checkins: number };
}> {
  // Push first, then pull (to avoid conflicts)
  const pushed = await pushToServer();
  const pulled = await pullFromServer(eventId);

  return { pushed, pulled };
}

export async function getSyncStatus(eventId: string): Promise<SyncStatus> {
  const pendingChanges = await getOutboxCount();
  const lastSync = localStorage.getItem(`last-sync-${eventId}`);

  return {
    lastSync,
    pendingChanges,
    isSyncing: false,
    error: null,
  };
}

// Background sync manager
let syncInterval: NodeJS.Timeout | null = null;

export function startBackgroundSync(
  eventId: string,
  intervalMs: number = 30000,
  onSync?: (status: SyncStatus) => void
): void {
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  const doSync = async () => {
    if (!navigator.onLine || !isSupabaseConfigured()) return;

    try {
      await fullSync(eventId);
      const status = await getSyncStatus(eventId);
      onSync?.(status);
    } catch (error) {
      console.error("Background sync failed:", error);
      onSync?.({
        lastSync: localStorage.getItem(`last-sync-${eventId}`),
        pendingChanges: await getOutboxCount(),
        isSyncing: false,
        error: (error as Error).message,
      });
    }
  };

  // Sync immediately, then at intervals
  doSync();
  syncInterval = setInterval(doSync, intervalMs);

  // Also sync when coming back online
  window.addEventListener("online", doSync);
}

export function stopBackgroundSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

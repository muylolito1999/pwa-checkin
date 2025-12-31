"use client";

import { useState, useEffect, useCallback } from "react";
import {
  startBackgroundSync,
  stopBackgroundSync,
  fullSync,
  getSyncStatus,
  type SyncStatus,
} from "@/lib/sync/engine";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function useSync(eventId: string) {
  const [status, setStatus] = useState<SyncStatus>({
    lastSync: null,
    pendingChanges: 0,
    isSyncing: false,
    error: null,
  });

  useEffect(() => {
    if (!eventId || !isSupabaseConfigured()) return;

    // Get initial status
    getSyncStatus(eventId).then(setStatus);

    // Start background sync
    startBackgroundSync(eventId, 30000, setStatus);

    return () => {
      stopBackgroundSync();
    };
  }, [eventId]);

  const syncNow = useCallback(async () => {
    if (!eventId || !isSupabaseConfigured()) return;

    setStatus((s) => ({ ...s, isSyncing: true, error: null }));

    try {
      await fullSync(eventId);
      const newStatus = await getSyncStatus(eventId);
      setStatus({ ...newStatus, isSyncing: false });
    } catch (error) {
      setStatus((s) => ({
        ...s,
        isSyncing: false,
        error: (error as Error).message,
      }));
    }
  }, [eventId]);

  return {
    ...status,
    syncNow,
    isConfigured: isSupabaseConfigured(),
  };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  discardStuck,
  fullSync,
  getSyncStatus,
  retryStuck,
  startBackgroundSync,
  type SyncStatus,
} from "@/lib/sync/engine";
import { describeError, isSupabaseConfigured } from "@/lib/supabase/client";
import { SYNC_INTERVAL_MS } from "@/lib/event-config";

const INITIAL_STATUS: SyncStatus = {
  lastSync: null,
  pendingChanges: 0,
  stuckChanges: 0,
  isSyncing: false,
  error: null,
};

export function useSync(eventId: string) {
  const [status, setStatus] = useState<SyncStatus>(INITIAL_STATUS);
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    if (!eventId || !isSupabaseConfigured()) return;

    let active = true;
    const update = (next: SyncStatus) => {
      if (active) setStatus(next);
    };

    getSyncStatus(eventId).then(update);
    const dispose = startBackgroundSync(eventId, SYNC_INTERVAL_MS, update);

    return () => {
      active = false;
      dispose();
    };
  }, [eventId]);

  const runAndReport = useCallback(
    async (action: () => Promise<unknown>) => {
      if (!eventId || !isSupabaseConfigured()) return;
      setStatus((current) => ({ ...current, isSyncing: true, error: null }));
      try {
        await action();
        setStatus({ ...(await getSyncStatus(eventId)), isSyncing: false });
      } catch (error) {
        setStatus({
          ...(await getSyncStatus(eventId)),
          isSyncing: false,
          error: describeError(error),
        });
        throw error;
      }
    },
    [eventId]
  );

  const syncNow = useCallback(() => runAndReport(() => fullSync(eventId)), [eventId, runAndReport]);
  const retry = useCallback(() => runAndReport(() => retryStuck(eventId)), [eventId, runAndReport]);
  const discard = useCallback(() => runAndReport(() => discardStuck(eventId)), [eventId, runAndReport]);
  const refresh = useCallback(async () => {
    if (!eventId) return;
    setStatus({ ...(await getSyncStatus(eventId)), isSyncing: false });
  }, [eventId]);

  return {
    ...status,
    syncNow,
    retryStuck: retry,
    discardStuck: discard,
    refreshStatus: refresh,
    isConfigured,
  };
}

export type SyncContextValue = ReturnType<typeof useSync>;

"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSync, type SyncContextValue } from "@/hooks/use-sync";

const SyncContext = createContext<SyncContextValue | null>(null);

/** Runs background sync for the whole dashboard, not just while Settings is open. */
export function SyncProvider({ eventId, children }: { eventId: string; children: ReactNode }) {
  const sync = useSync(eventId);
  return <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>;
}

export function useSyncContext(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSyncContext must be used inside <SyncProvider>");
  }
  return context;
}

"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  getServerSessionSnapshot,
  getSessionSnapshot,
  subscribeSession,
  writeSession,
} from "@/lib/session-store";

const noopSubscribe = () => () => {};

/** `false` during SSR and hydration, `true` once mounted on the client. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

export function useSession() {
  const router = useRouter();
  const session = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot
  );
  const hydrated = useHydrated();

  const login = useCallback(
    (eventId: string, eventName: string, eventDate: string | null = null) => {
      writeSession({ eventId, eventName, eventDate, authenticated: true });
    },
    []
  );

  const logout = useCallback(() => {
    writeSession(null);
    router.push("/");
  }, [router]);

  return {
    session,
    // Keeps the dashboard's loading gate during hydration so a prerendered page
    // never redirects to /login before localStorage has been read.
    loading: !hydrated,
    login,
    logout,
    isAuthenticated: session?.authenticated ?? false,
  };
}

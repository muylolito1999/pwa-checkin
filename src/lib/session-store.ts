import type { Session } from "@/types";

/**
 * localStorage-backed session store consumed through `useSyncExternalStore`.
 * One source of truth for every `useSession()` instance (and across tabs via
 * the `storage` event), instead of each hook keeping a private copy.
 */
const SESSION_KEY = "pwa-checkin-session";

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: Session | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    // Storage unavailable (private mode, blocked storage): behave as signed out.
    return null;
  }
}

/** Referentially stable while the stored value is unchanged (required by uSES). */
export function getSessionSnapshot(): Session | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    if (raw) {
      try {
        cached = JSON.parse(raw) as Session;
      } catch {
        cached = null;
        try {
          localStorage.removeItem(SESSION_KEY);
        } catch {
          // ignore: nothing to clean up if storage is unavailable
        }
      }
    } else {
      cached = null;
    }
  }
  return cached;
}

export function getServerSessionSnapshot(): Session | null {
  return null;
}

export function subscribeSession(callback: () => void) {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SESSION_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function writeSession(session: Session | null) {
  try {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Storage unavailable: listeners still get notified so the UI reflects the in-memory state.
  }
  listeners.forEach((listener) => listener());
}

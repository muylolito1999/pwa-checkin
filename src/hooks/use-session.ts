"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@/types";

const SESSION_KEY = "pwa-checkin-session";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback((eventId: string, eventName: string) => {
    const newSession: Session = {
      eventId,
      eventName,
      authenticated: true,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    setSession(newSession);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    router.push("/");
  }, [router]);

  return {
    session,
    loading,
    login,
    logout,
    isAuthenticated: session?.authenticated ?? false,
  };
}

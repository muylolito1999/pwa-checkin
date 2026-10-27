"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STANDALONE_QUERY = "(display-mode: standalone)";
const DISMISSED_KEY = "pwa-install-dismissed";

function subscribeStandalone(callback: () => void) {
  const mql = window.matchMedia(STANDALONE_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
const getStandalone = () => window.matchMedia(STANDALONE_QUERY).matches;
const getStandaloneServer = () => false;

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);
  // Safe as a lazy initializer: nothing renders differently until `installPrompt`
  // arrives (always after mount), so there is no hydration mismatch.
  const [dismissed, setDismissed] = useState(readDismissed);
  const isStandalone = useSyncExternalStore(subscribeStandalone, getStandalone, getStandaloneServer);

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setJustInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const isInstalled = isStandalone || justInstalled;

  const install = useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setJustInstalled(true);
    setInstallPrompt(null);
    return outcome === "accepted";
  }, [installPrompt]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // ignore: the dismissal simply won't persist across reloads
    }
  }, []);

  return {
    canInstall: !!installPrompt && !isInstalled && !dismissed,
    isInstalled,
    install,
    dismiss,
  };
}

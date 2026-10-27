"use client";

import { useEffect } from "react";
import { useSerwist } from "@serwist/turbopack/react";
import { toast } from "sonner";

/**
 * Shows an "Update available" prompt when a new service worker is waiting.
 * The worker uses skipWaiting: false, so nothing changes until the user accepts.
 */
export function SwUpdateToast() {
  const { serwist } = useSerwist();

  useEffect(() => {
    if (!serwist) return;

    const onWaiting = () => {
      toast.info("A new version is available", {
        id: "sw-update",
        duration: Infinity,
        action: {
          label: "Reload",
          onClick: () => {
            serwist.addEventListener("controlling", () => window.location.reload());
            serwist.messageSkipWaiting();
          },
        },
      });
    };

    serwist.addEventListener("waiting", onWaiting);
    return () => serwist.removeEventListener("waiting", onWaiting);
  }, [serwist]);

  return null;
}

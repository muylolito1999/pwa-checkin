import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const isSupabaseRequest = (url: URL) =>
  url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.in");

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // A new worker waits until the user accepts the "Update available" prompt
  // (see SwUpdateToast), so a deploy never breaks a tab mid-check-in.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Supabase traffic must never be served from the cache: a stale pull would
    // advance the sync watermark past real changes, and guest data must not sit
    // in Cache Storage. This rule has to precede defaultCache, whose cross-origin
    // rule would otherwise cache these responses for an hour.
    {
      matcher: ({ url }) => isSupabaseRequest(url),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

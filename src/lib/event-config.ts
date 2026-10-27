/**
 * App-level configuration. The event itself (name, date, access code) lives in the
 * `events` table and is loaded at login, so a new event needs no code change.
 */
export const APP_NAME = "PROM HALLOWEEN";
export const APP_SHORT_NAME = "PROM HALLOWEEN";
export const APP_DESCRIPTION = "Guest check-in for PROM HALLOWEEN";
export const THEME_COLOR_DARK = "#0a0a0a";
export const THEME_COLOR_LIGHT = "#ffffff";
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
/** How often a device pushes and pulls while online. */
export const SYNC_INTERVAL_MS = 30_000;

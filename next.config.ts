import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    // Shown on the Settings page; npm sets npm_package_version during `npm run build`.
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "dev",
    // The Vercel <-> Supabase integration injects SUPABASE_URL / SUPABASE_ANON_KEY;
    // accept those names so a deployment works without extra manual variables.
    // (The anon key is public by design; access is governed by RLS.)
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
  },
};

// Service worker is built by the route handler at src/app/serwist/[path]/route.ts
// (Turbopack-compatible); withSerwist only marks esbuild as a server-external package.
export default withSerwist(nextConfig);

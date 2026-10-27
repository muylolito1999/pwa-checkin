import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    // Shown on the Settings page; npm sets npm_package_version during `npm run build`.
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "dev",
  },
};

// Service worker is built by the route handler at src/app/serwist/[path]/route.ts
// (Turbopack-compatible); withSerwist only marks esbuild as a server-external package.
export default withSerwist(nextConfig);

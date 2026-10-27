import { createSerwistRoute } from "@serwist/turbopack";

// Changes on every deploy so the precached offline page is refreshed alongside
// the hashed assets it references.
const BUILD_REVISION = process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now());

// Serves the bundled service worker at /serwist/sw.js. The handler is statically
// prerendered at build time, so nothing is written into public/.
export const { GET, generateStaticParams, dynamic, dynamicParams, revalidate } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
    additionalPrecacheEntries: [{ url: "/~offline", revision: BUILD_REVISION }],
  });

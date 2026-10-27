import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME, THEME_COLOR_DARK } from "@/lib/event-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
    start_url: "/guests",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    lang: "en",
    background_color: THEME_COLOR_DARK,
    theme_color: THEME_COLOR_DARK,
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Guests", url: "/guests" },
      { name: "Tables", url: "/tables" },
      { name: "Statistics", url: "/stats" },
    ],
  };
}

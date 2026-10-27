import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SwUpdateToast } from "@/components/providers/sw-update-toast";
import { Toaster } from "@/components/ui/sonner";
import {
  APP_DESCRIPTION,
  APP_NAME,
  APP_SHORT_NAME,
  THEME_COLOR_DARK,
  THEME_COLOR_LIGHT,
} from "@/lib/event-config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_SHORT_NAME,
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR_DARK },
  ],
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays enabled (WCAG 1.4.4).
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SerwistProvider
          swUrl="/serwist/sw.js"
          // Never auto-reload a device mid-check-in when it comes back online.
          reloadOnOnline={false}
          disable={process.env.NODE_ENV !== "production"}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster richColors position="top-center" />
            <SwUpdateToast />
          </ThemeProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}

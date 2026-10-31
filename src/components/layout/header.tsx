"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Armchair,
  ChartColumn,
  LogOut,
  Settings,
  Upload,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { useIsOnline } from "@/hooks/use-is-online";
import { useSyncContext } from "@/components/providers/sync-provider";
import { APP_NAME } from "@/lib/event-config";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/guests", label: "Guests", icon: Users },
  { href: "/tables", label: "Tables", icon: Armchair },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/stats", label: "Stats", icon: ChartColumn },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Header() {
  const pathname = usePathname();
  const { session, logout } = useSession();
  const isOnline = useIsOnline();
  const sync = useSyncContext();

  const showPending = sync.isConfigured && sync.pendingChanges > 0;
  const hasStuck = sync.isConfigured && sync.stuckChanges > 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {/* The name truncates so a long event name never pushes the bar past the screen edge. */}
          <Link href="/guests" className="flex min-w-0 items-center gap-2">
            <span className="truncate font-bold text-base sm:text-lg">
              🎉 {session?.eventName ?? APP_NAME}
            </span>
          </Link>

          {/* Connectivity + sync indicator */}
          <div
            className={cn(
              "flex shrink-0 items-center gap-1 text-xs px-2 py-1 rounded-full",
              !isOnline
                ? "bg-yellow-500/10 text-yellow-500"
                : hasStuck
                  ? "bg-red-500/10 text-red-500"
                  : "bg-green-500/10 text-green-500"
            )}
            role="status"
            aria-live="polite"
          >
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {/* The colour already says it; the word only fits on wider screens. */}
            <span className="hidden sm:inline">{isOnline ? "Online" : "Offline"}</span>
            {showPending && (
              <span className="sm:ml-1">
                <span className="hidden sm:inline">· </span>
                {sync.pendingChanges} pending{hasStuck ? ` (${sync.stuckChanges} stuck)` : ""}
              </span>
            )}
          </div>
        </div>

        {/* Navigation - horizontal on larger screens, compact on mobile */}
        <nav className="flex shrink-0 items-center gap-1" aria-label="Main">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Button
                key={item.href}
                asChild
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className="gap-2 px-2 sm:px-3"
              >
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              </Button>
            );
          })}

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="ml-1 px-2 text-muted-foreground sm:ml-2 sm:px-3"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </nav>
      </div>

      {/* Offline warning banner */}
      {!isOnline && (
        <div className="bg-yellow-500/10 border-t border-yellow-500/20 px-4 py-2 text-center text-sm text-yellow-600 dark:text-yellow-400">
          You&apos;re offline. Changes will sync when connection is restored.
        </div>
      )}
    </header>
  );
}

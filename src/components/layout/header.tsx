"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Upload, BarChart3, Settings, LogOut, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { useIsOnline } from "@/hooks/use-is-online";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/guests", label: "Guests", icon: Users },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Header() {
  const pathname = usePathname();
  const { session, logout } = useSession();
  const isOnline = useIsOnline();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link href="/guests" className="flex items-center gap-2">
            <span className="font-bold text-lg">🎉 NYE 2026</span>
          </Link>

          {/* Online/Offline indicator */}
          <div
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded-full",
              isOnline
                ? "bg-green-500/10 text-green-500"
                : "bg-yellow-500/10 text-yellow-500"
            )}
          >
            {isOnline ? (
              <>
                <Wifi className="h-3 w-3" />
                Online
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                Offline
              </>
            )}
          </div>
        </div>

        {/* Navigation - horizontal on larger screens, compact on mobile */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              </Link>
            );
          })}

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="ml-2 text-muted-foreground"
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

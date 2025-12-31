"use client";

import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/use-pwa-install";

export function InstallBanner() {
  const { canInstall, install, dismiss } = usePwaInstall();

  if (!canInstall) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 sm:p-6">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <p className="font-medium">Install NYE Check-In</p>
          <p className="text-sm text-muted-foreground">
            Add to home screen for the best experience
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={dismiss}>
            <X className="h-4 w-4 mr-1" />
            Not now
          </Button>
          <Button size="sm" onClick={install}>
            <Download className="h-4 w-4 mr-2" />
            Install
          </Button>
        </div>
      </div>
    </div>
  );
}

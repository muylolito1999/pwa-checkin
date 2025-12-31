"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor, RefreshCw, Trash2, Database, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/hooks/use-session";
import { useSync } from "@/hooks/use-sync";
import { db } from "@/lib/db";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { session, logout } = useSession();
  const eventId = session?.eventId ?? "";
  const sync = useSync(eventId);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteServerData = async () => {
    if (!eventId || !isSupabaseConfigured()) {
      toast.error("Not connected to server");
      return;
    }

    const confirmed = confirm(
      "⚠️ DANGER: This will permanently delete ALL guests and check-ins from the server for this event.\n\n" +
      "This action cannot be undone!\n\n" +
      "Are you absolutely sure?"
    );
    if (!confirmed) return;

    const doubleConfirmed = confirm(
      "Final confirmation: Type 'DELETE' mentally and click OK to proceed with permanent deletion."
    );
    if (!doubleConfirmed) return;

    setIsDeleting(true);
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase not available");

      // Delete checkins first (foreign key constraint)
      const { error: checkinsError } = await supabase
        .from("checkins")
        .delete()
        .eq("event_id", eventId);
      if (checkinsError) throw checkinsError;

      // Delete guests
      const { error: guestsError } = await supabase
        .from("guests")
        .delete()
        .eq("event_id", eventId);
      if (guestsError) throw guestsError;

      // Clear local data too
      await db.guests.where("event_id").equals(eventId).delete();
      await db.checkins.where("event_id").equals(eventId).delete();
      await db.outbox.clear();

      toast.success("All server data deleted for this event");
      // Refresh the page to clear any cached data
      window.location.reload();
    } catch (error) {
      console.error("Failed to delete server data:", error);
      toast.error("Failed to delete server data: " + (error as Error).message);
      setIsDeleting(false);
    }
  };

  const handleClearLocalData = async () => {
    if (!confirm("This will delete all local data. Are you sure?")) return;

    try {
      await db.delete();
      localStorage.clear();
      toast.success("Local data cleared");
      window.location.href = "/login";
    } catch (error) {
      toast.error("Failed to clear data");
      console.error(error);
    }
  };

  const handleSyncNow = async () => {
    await sync.syncNow();
    toast.success("Sync completed");
  };

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return "Never";
    const date = new Date(lastSync);
    return date.toLocaleString("it-IT");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage app preferences and data
        </p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize the look and feel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Theme</Label>
            <div className="flex gap-2 mt-2">
              {[
                { value: "light", icon: Sun, label: "Light" },
                { value: "dark", icon: Moon, label: "Dark" },
                { value: "system", icon: Monitor, label: "System" },
              ].map((option) => {
                const Icon = option.icon;
                return (
                  <Button
                    key={option.value}
                    variant={theme === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme(option.value)}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Sync Status
          </CardTitle>
          <CardDescription>
            {sync.isConfigured
              ? "Connected to Supabase"
              : "Running in offline mode"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Last sync</p>
              <p className="font-medium">{formatLastSync(sync.lastSync)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Pending changes</p>
              <p
                className={cn(
                  "font-medium",
                  sync.pendingChanges > 0 && "text-orange-500"
                )}
              >
                {sync.pendingChanges}
              </p>
            </div>
          </div>

          {sync.error && (
            <p className="text-sm text-destructive">{sync.error}</p>
          )}

          <Button
            variant="outline"
            onClick={handleSyncNow}
            disabled={!sync.isConfigured || sync.isSyncing}
            className="gap-2"
          >
            <RefreshCw
              className={cn("h-4 w-4", sync.isSyncing && "animate-spin")}
            />
            {sync.isSyncing ? "Syncing..." : "Sync Now"}
          </Button>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Management
          </CardTitle>
          <CardDescription>Manage local app data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">
            <p className="text-muted-foreground">Current event</p>
            <p className="font-medium">{session?.eventName || "None"}</p>
            <p className="text-xs text-muted-foreground mt-1">{eventId}</p>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={logout}>
              Sign Out
            </Button>
            <Button
              variant="outline"
              onClick={handleClearLocalData}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear Local Data
            </Button>
            {isSupabaseConfigured() && (
              <Button
                variant="destructive"
                onClick={handleDeleteServerData}
                disabled={isDeleting || !eventId}
                className="gap-2"
              >
                <Database className="h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete All Server Data"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>NYE Party 2026 Check-In System</p>
          <p>Version 1.0.0</p>
          <p className="mt-2">
            Offline-first PWA for managing event check-ins with real-time sync.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

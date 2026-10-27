"use client";

import { useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import {
  Moon,
  Sun,
  Monitor,
  RefreshCw,
  Trash2,
  Database,
  Cloud,
  TriangleAlert,
  RotateCcw,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSession } from "@/hooks/use-session";
import { useSyncContext } from "@/components/providers/sync-provider";
import { db } from "@/lib/db";
import { clearLocalEventData, runExclusive } from "@/lib/sync/engine";
import { describeError, getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { APP_NAME, APP_VERSION } from "@/lib/event-config";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Device-local keys owned by this app (the theme preference is intentionally kept). */
const LOCAL_STORAGE_KEYS = ["pwa-checkin-session", "pwa-checkin-device-id", "pwa-install-dismissed"];

interface DangerConfirmDialogProps {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmWord: string;
  pending: boolean;
  onConfirm: () => Promise<void>;
}

/** Destructive action gated by typing a confirmation word. */
function DangerConfirmDialog({
  trigger,
  title,
  description,
  confirmWord,
  pending,
  onConfirm,
}: DangerConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const inputId = `confirm-${confirmWord.toLowerCase()}`;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-destructive" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor={inputId}>
            Type <span className="font-mono font-semibold">{confirmWord}</span> to confirm
          </Label>
          <Input
            id={inputId}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={typed !== confirmWord || pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={async (e) => {
              e.preventDefault();
              await onConfirm();
              setOpen(false);
            }}
          >
            {pending ? "Working..." : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { session, logout } = useSession();
  const eventId = session?.eventId ?? "";
  const sync = useSyncContext();
  const [busy, setBusy] = useState<"delete-server" | "clear-local" | null>(null);

  const handleDeleteServerData = async () => {
    if (!eventId || !isSupabaseConfigured()) {
      toast.error("Not connected to server");
      return;
    }

    setBusy("delete-server");
    try {
      // Hold the sync lock so a concurrent pull cannot re-insert rows mid-wipe.
      await runExclusive(async () => {
        const supabase = getSupabase();
        if (!supabase) throw new Error("Supabase not available");

        // One transaction server-side (migration 003); row level security applies.
        const { error } = await supabase.rpc("delete_event_data", { p_event_id: eventId });
        if (error) throw error;

        await clearLocalEventData(eventId);
      });
      await sync.refreshStatus();
      toast.success("All guests, tables and check-ins for this event were deleted");
    } catch (error) {
      console.error("Failed to delete server data:", error);
      toast.error(`Failed to delete server data: ${describeError(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const handleClearLocalData = async () => {
    setBusy("clear-local");
    try {
      await db.delete();
      await db.open();
      for (const key of LOCAL_STORAGE_KEYS) {
        localStorage.removeItem(key);
      }
      toast.success("Local data cleared");
      logout();
    } catch (error) {
      toast.error("Failed to clear data");
      console.error(error);
    } finally {
      setBusy(null);
    }
  };

  const runSyncAction = async (action: () => Promise<void>, successMessage: string) => {
    try {
      await action();
      toast.success(successMessage);
    } catch (error) {
      toast.error(describeError(error));
    }
  };

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return "Never";
    return new Date(lastSync).toLocaleString();
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
            <div className="flex gap-2 mt-2" role="group" aria-label="Theme">
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
                    aria-pressed={theme === option.value}
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
            <p className="text-sm text-destructive" role="alert">{sync.error}</p>
          )}

          {sync.stuckChanges > 0 && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm space-y-2">
              <p className="font-medium text-destructive">
                {sync.stuckChanges} change{sync.stuckChanges > 1 ? "s" : ""} keep failing to sync.
              </p>
              <p className="text-muted-foreground">
                They are still retried in the background. Retry now, or discard them to accept the
                server&apos;s version of those records.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={sync.isSyncing}
                  onClick={() => runSyncAction(sync.retryStuck, "Retried stuck changes")}
                >
                  <RotateCcw className="h-4 w-4" />
                  Retry
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 text-destructive"
                  disabled={sync.isSyncing}
                  onClick={() => runSyncAction(sync.discardStuck, "Discarded stuck changes")}
                >
                  <Ban className="h-4 w-4" />
                  Discard
                </Button>
              </div>
            </div>
          )}

          <Button
            variant="outline"
            onClick={() => runSyncAction(sync.syncNow, "Sync completed")}
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
            {session?.eventDate && (
              <p className="text-xs text-muted-foreground">{session.eventDate}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1 font-mono">{eventId}</p>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={logout}>
              Sign Out
            </Button>

            <DangerConfirmDialog
              trigger={
                <Button variant="outline" className="gap-2" disabled={busy !== null}>
                  <Trash2 className="h-4 w-4" />
                  Clear Local Data
                </Button>
              }
              title="Clear local data"
              description="Removes every guest, table, check-in and queued change stored on this device, and signs you out. Changes that were not synced yet are lost."
              confirmWord="CLEAR"
              pending={busy === "clear-local"}
              onConfirm={handleClearLocalData}
            />

            {isSupabaseConfigured() && (
              <DangerConfirmDialog
                trigger={
                  <Button variant="destructive" className="gap-2" disabled={busy !== null || !eventId}>
                    <Database className="h-4 w-4" />
                    Delete All Server Data
                  </Button>
                }
                title="Delete all server data"
                description={
                  <>
                    Permanently deletes <strong>all guests, tables and check-ins</strong> for{" "}
                    <strong>{session?.eventName}</strong> from the server and from this device.
                    Other devices will see them disappear on their next sync. This cannot be
                    undone.
                  </>
                }
                confirmWord="DELETE"
                pending={busy === "delete-server"}
                onConfirm={handleDeleteServerData}
              />
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
          <p>{APP_NAME}</p>
          <p>Version {APP_VERSION}</p>
          <p className="mt-2">
            Offline-first PWA for managing event check-ins with background sync.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

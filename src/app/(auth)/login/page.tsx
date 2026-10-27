"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, PartyPopper, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/hooks/use-session";
import { useIsOnline } from "@/hooks/use-is-online";
import { db, getMeta, setMeta } from "@/lib/db";
import {
  describeError,
  ensureSignedIn,
  getSupabase,
  isNetworkError,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/event-config";
import { loginSchema } from "@/schemas";
import { toast } from "sonner";

interface JoinedEvent {
  id: string;
  name: string;
  date: string | null;
}

const LOCAL_EVENT_KEY = "local-event-id";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, loading: sessionLoading } = useSession();
  const isOnline = useIsOnline();
  const serverConfigured = isSupabaseConfigured();

  const [eventId, setEventId] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionLoading && isAuthenticated) {
      router.replace("/guests");
    }
  }, [isAuthenticated, sessionLoading, router]);

  const finishLogin = async (event: JoinedEvent) => {
    const now = new Date().toISOString();
    const existing = await db.events.get(event.id);
    await db.events.put({
      id: event.id,
      name: event.name,
      date: event.date ?? existing?.date ?? "",
      settings: existing?.settings ?? {},
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });
    login(event.id, event.name, event.date ?? null);
    toast.success(`Welcome to ${event.name}!`);
    router.replace("/guests");
  };

  /** Offline: only events this device has already joined are available. */
  const loginOffline = async (id: string) => {
    const local = await db.events.get(id);
    if (!local) {
      toast.error("You're offline and this event hasn't been opened on this device yet.");
      return;
    }
    await finishLogin({ id: local.id, name: local.name, date: local.date || null });
  };

  const joinEvent = async (id: string, code: string | undefined) => {
    await ensureSignedIn();
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured");

    const { data, error } = await supabase.rpc("join_event", {
      p_event_id: id,
      p_code: code ?? null,
    });
    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : data) as JoinedEvent | undefined;
    if (!row) throw new Error("Event not found");
    await finishLogin(row);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = loginSchema.safeParse({ eventId: eventId.trim(), accessCode });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setLoading(true);
    try {
      if (!isOnline) {
        await loginOffline(parsed.data.eventId);
        return;
      }
      await joinEvent(parsed.data.eventId, parsed.data.accessCode);
    } catch (error) {
      if (isNetworkError(error)) {
        await loginOffline(parsed.data.eventId);
      } else {
        console.error(error);
        toast.error(describeError(error));
      }
    } finally {
      setLoading(false);
    }
  };

  /** Without a Supabase project the app runs as a single-device, local-only check-in list. */
  const handleLocalOnly = async () => {
    setLoading(true);
    try {
      let id = await getMeta(LOCAL_EVENT_KEY);
      if (!id || !(await db.events.get(id))) {
        id = crypto.randomUUID();
        await setMeta(LOCAL_EVENT_KEY, id);
      }
      await finishLogin({ id, name: `${APP_NAME} (local)`, date: null });
    } catch (error) {
      console.error(error);
      toast.error("Could not create a local event");
    } finally {
      setLoading(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-linear-to-b from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <PartyPopper className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">{APP_NAME}</CardTitle>
          <CardDescription>
            {serverConfigured
              ? "Enter your event credentials to access the check-in system"
              : "No server configured: data stays on this device"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {serverConfigured ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="eventId">Event ID</Label>
                <Input
                  id="eventId"
                  type="text"
                  placeholder="Enter event ID"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accessCode">Access Code</Label>
                <Input
                  id="accessCode"
                  type="password"
                  placeholder="Enter access code"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Sign In"}
              </Button>
              {!isOnline && (
                <p className="flex items-center justify-center gap-2 text-sm text-center text-muted-foreground">
                  <WifiOff className="h-4 w-4" />
                  Offline: only events already opened on this device are available.
                </p>
              )}
            </form>
          ) : (
            <Button className="w-full" onClick={handleLocalOnly} disabled={loading}>
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Continue on this device"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/hooks/use-session";
import { db } from "@/lib/db";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, loading: sessionLoading } = useSession();

  const [eventId, setEventId] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    if (!sessionLoading && isAuthenticated) {
      router.push("/guests");
    }
  }, [isAuthenticated, sessionLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let eventName = "NYE Party 2025";
      let authenticated = false;

      const supabase = getSupabase();
      if (supabase) {
        // Online: Validate against Supabase
        const { data, error } = await supabase
          .from("events")
          .select("id, name, access_code")
          .eq("id", eventId)
          .single();

        if (error || !data) {
          toast.error("Event not found");
          setLoading(false);
          return;
        }

        if (data.access_code && data.access_code !== accessCode) {
          toast.error("Invalid access code");
          setLoading(false);
          return;
        }

        eventName = data.name;
        authenticated = true;

        // Sync event to local DB
        await db.events.put({
          id: data.id,
          name: data.name,
          date: new Date().toISOString().split("T")[0],
          access_code: data.access_code,
          settings: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else {
        // Offline mode: Use local DB or default event
        const localEvent = await db.events.get(eventId);
        if (localEvent) {
          if (localEvent.access_code && localEvent.access_code !== accessCode) {
            toast.error("Invalid access code");
            setLoading(false);
            return;
          }
          eventName = localEvent.name;
          authenticated = true;
        } else if (offlineMode) {
          // Allow creating a local-only event
          const newEvent = {
            id: eventId || crypto.randomUUID(),
            name: "NYE Party 2025",
            date: "2025-12-31",
            access_code: accessCode || null,
            settings: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await db.events.put(newEvent);
          eventName = newEvent.name;
          authenticated = true;
          setEventId(newEvent.id);
        } else {
          setOfflineMode(true);
          toast.info("Supabase not configured. Click again to create a local event.");
          setLoading(false);
          return;
        }
      }

      if (authenticated) {
        login(eventId, eventName);
        toast.success(`Welcome to ${eventName}!`);
        router.push("/guests");
      }
    } catch (error) {
      console.error(error);
      toast.error("Login failed. Try offline mode.");
      setOfflineMode(true);
    } finally {
      setLoading(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-b from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <PartyPopper className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">NYE Party 2025</CardTitle>
          <CardDescription>
            Enter your event credentials to access the check-in system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="eventId">Event ID</Label>
              <Input
                id="eventId"
                type="text"
                placeholder="Enter event ID"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                required={!offlineMode}
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
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : offlineMode ? (
                "Create Local Event"
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {offlineMode && (
            <p className="mt-4 text-sm text-center text-muted-foreground">
              Running in offline mode. Data will be stored locally.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

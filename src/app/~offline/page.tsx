import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Offline" };

/** Served by the service worker when a page that was never cached is requested offline. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <WifiOff className="h-12 w-12 text-muted-foreground" />
      <h1 className="text-2xl font-bold tracking-tight">You&apos;re offline</h1>
      <p className="max-w-sm text-muted-foreground">
        This page hasn&apos;t been cached on this device yet. Pages you opened while online keep
        working, and check-ins are saved locally until the connection returns.
      </p>
      <Button asChild>
        <Link href="/guests">Go to guests</Link>
      </Button>
    </main>
  );
}

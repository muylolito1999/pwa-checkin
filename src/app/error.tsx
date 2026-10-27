"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert className="h-12 w-12 text-destructive" />
      <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="max-w-sm text-muted-foreground">
        Your data is safe on this device. Try again, or reload the app if the problem persists.
      </p>
      {error.digest && <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>}
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">That page doesn&apos;t exist.</p>
      <Button asChild>
        <Link href="/guests">Go to guests</Link>
      </Button>
    </main>
  );
}

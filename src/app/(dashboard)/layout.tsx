"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Header } from "@/components/layout/header";
import { InstallBanner } from "@/components/layout/install-banner";
import { SyncProvider } from "@/components/providers/sync-provider";
import { useSession } from "@/hooks/use-session";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, isAuthenticated, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !session) {
    return null;
  }

  return (
    <SyncProvider eventId={session.eventId}>
      <div className="min-h-screen bg-background pb-20">
        <Header />
        <main className="container mx-auto px-4 py-6">{children}</main>
        <InstallBanner />
      </div>
    </SyncProvider>
  );
}

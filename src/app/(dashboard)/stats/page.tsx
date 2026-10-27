"use client";

import { useSession } from "@/hooks/use-session";
import { useStats } from "@/hooks/use-stats";
import { StatCards } from "@/components/stats/stat-cards";
import { ArrivalChart } from "@/components/stats/arrival-chart";
import { RecentCheckins } from "@/components/stats/recent-checkins";
import { Skeleton } from "@/components/ui/skeleton";

export default function StatsPage() {
  const { session } = useSession();
  const eventId = session?.eventId ?? "";

  const stats = useStats({ eventId, bucketMinutes: 30 });

  if (!stats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statistics</h1>
          <p className="text-muted-foreground">
            Real-time event analytics
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Statistics</h1>
        <p className="text-muted-foreground">
          Real-time event analytics for {session?.eventName}
        </p>
      </div>

      <StatCards stats={stats.guestStats} tableTotals={stats.tableTotals} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ArrivalChart
            histogram={stats.histogram}
            timeline={stats.timeline}
            peakWindow={stats.peakWindow}
          />
        </div>
        <div>
          <RecentCheckins checkins={stats.recentCheckins} />
        </div>
      </div>
    </div>
  );
}

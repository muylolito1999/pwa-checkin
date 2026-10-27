"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { GuestStats, LocalCheckin, RecentCheckin, TimeSlotStats } from "@/types";

interface StatsOptions {
  eventId: string;
  bucketMinutes?: 15 | 30 | 60;
}

export interface EventStats {
  guestStats: GuestStats;
  histogram: TimeSlotStats[];
  timeline: TimeSlotStats[];
  peakWindow: { time: string; count: number } | null;
  recentCheckins: RecentCheckin[];
}

export function useStats({ eventId, bucketMinutes = 30 }: StatsOptions) {
  const stats = useLiveQuery(async (): Promise<EventStats | null> => {
    if (!eventId) return null;

    const guests = (await db.guests.where("event_id").equals(eventId).toArray()).filter(
      (g) => !g.is_deleted
    );
    const guestIds = new Set(guests.map((g) => g.id));

    // Only check-ins of guests who are still on the list count.
    const checkins = (await db.checkins.where("event_id").equals(eventId).toArray())
      .filter((c) => guestIds.has(c.guest_id))
      .sort((a, b) => new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime());

    // A guest's status is their latest record.
    const lastByGuest = new Map<string, LocalCheckin>();
    for (const checkin of checkins) lastByGuest.set(checkin.guest_id, checkin);

    let checkedIn = 0;
    let left = 0;
    for (const last of lastByGuest.values()) {
      if (last.type === "IN") checkedIn++;
      else left++;
    }

    const guestStats: GuestStats = {
      total: guests.length,
      checkedIn,
      notArrived: guests.length - checkedIn,
      left,
    };

    // Histogram of arrivals per time bucket, with empty buckets filled in so the
    // x-axis is linear.
    const bucketMs = bucketMinutes * 60_000;
    const bucketMap = new Map<number, number>();
    for (const checkin of checkins) {
      if (checkin.type !== "IN") continue;
      const bucket = Math.floor(new Date(checkin.checked_in_at).getTime() / bucketMs) * bucketMs;
      bucketMap.set(bucket, (bucketMap.get(bucket) ?? 0) + 1);
    }

    const histogram: TimeSlotStats[] = [];
    if (bucketMap.size > 0) {
      const buckets = [...bucketMap.keys()];
      const first = Math.min(...buckets);
      const last = Math.max(...buckets);
      for (let bucket = first; bucket <= last; bucket += bucketMs) {
        histogram.push({ time: new Date(bucket).toISOString(), count: bucketMap.get(bucket) ?? 0 });
      }
    }

    let cumulative = 0;
    const timeline: TimeSlotStats[] = histogram.map(({ time, count }) => {
      cumulative += count;
      return { time, count: cumulative };
    });

    const peakWindow = histogram.reduce<{ time: string; count: number } | null>(
      (max, curr) => (!max || curr.count > max.count ? curr : max),
      null
    );

    const guestNames = new Map(guests.map((g) => [g.id, `${g.first_name} ${g.last_name}`]));
    const recentCheckins: RecentCheckin[] = checkins
      .slice(-10)
      .reverse()
      .map((c) => ({
        id: c.id,
        name: guestNames.get(c.guest_id) ?? "Unknown",
        time: c.checked_in_at,
        type: c.type,
      }));

    return { guestStats, histogram, timeline, peakWindow, recentCheckins };
  }, [eventId, bucketMinutes]);

  return stats;
}

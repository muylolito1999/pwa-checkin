"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { GuestStats, TimeSlotStats, Checkin } from "@/types";

interface StatsOptions {
  eventId: string;
  bucketMinutes?: 15 | 30 | 60;
}

export function useStats({ eventId, bucketMinutes = 30 }: StatsOptions) {
  const stats = useLiveQuery(async (): Promise<{
    guestStats: GuestStats;
    histogram: TimeSlotStats[];
    timeline: TimeSlotStats[];
    peakWindow: { time: string; count: number } | null;
    recentCheckins: Array<{ name: string; time: string; type: "IN" | "OUT" }>;
  } | null> => {
    if (!eventId) return null;

    // Get all guests (using simple filter for Dexie compatibility)
    const allGuests = await db.guests.toArray();
    const guests = allGuests.filter(g => g.event_id === eventId && !g.is_deleted);

    // Get all checkins (using simple filter)
    const allCheckins = await db.checkins.toArray();
    const checkins = allCheckins
      .filter(c => c.event_id === eventId)
      .sort((a, b) => new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime());

    // Calculate check-in status per guest
    const guestCheckinStatus = new Map<string, boolean>();
    const guestLastCheckin = new Map<string, Checkin>();

    checkins.forEach((c) => {
      const current = guestCheckinStatus.get(c.guest_id);
      if (c.type === "IN") {
        guestCheckinStatus.set(c.guest_id, true);
      } else if (c.type === "OUT") {
        guestCheckinStatus.set(c.guest_id, false);
      }
      guestLastCheckin.set(c.guest_id, c);
    });

    const checkedIn = Array.from(guestCheckinStatus.values()).filter(Boolean).length;

    const guestStats: GuestStats = {
      total: guests.length,
      checkedIn,
      notArrived: guests.length - checkedIn,
      checkouts: checkins.filter((c) => c.type === "OUT").length,
    };

    // Build histogram (arrivals by time bucket)
    const inCheckins = checkins.filter((c) => c.type === "IN");
    const bucketMap = new Map<string, number>();

    inCheckins.forEach((c) => {
      const date = new Date(c.checked_in_at);
      const minutes = Math.floor(date.getMinutes() / bucketMinutes) * bucketMinutes;
      date.setMinutes(minutes, 0, 0);
      const key = date.toISOString();
      bucketMap.set(key, (bucketMap.get(key) || 0) + 1);
    });

    const histogram: TimeSlotStats[] = Array.from(bucketMap.entries())
      .map(([time, count]) => ({ time, count }))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    // Build cumulative timeline
    let cumulative = 0;
    const timeline: TimeSlotStats[] = histogram.map(({ time, count }) => {
      cumulative += count;
      return { time, count: cumulative };
    });

    // Find peak window
    const peakWindow = histogram.reduce<{ time: string; count: number } | null>(
      (max, curr) => (!max || curr.count > max.count ? curr : max),
      null
    );

    // Get recent checkins (last 10)
    const recentCheckins = checkins
      .slice(-10)
      .reverse()
      .map((c) => {
        const guest = guests.find((g) => g.id === c.guest_id);
        return {
          name: guest
            ? `${guest.first_name} ${guest.last_name}`
            : "Unknown",
          time: c.checked_in_at,
          type: c.type as "IN" | "OUT",
        };
      });

    return {
      guestStats,
      histogram,
      timeline,
      peakWindow,
      recentCheckins,
    };
  }, [eventId, bucketMinutes]);

  return stats;
}

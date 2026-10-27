"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { sumArrivals, tableStatus, tableTotals, type TableStatus } from "@/lib/tables";
import type {
  GuestStats,
  LocalCheckin,
  RecentCheckin,
  TableTotals,
  TimeSlotStats,
} from "@/types";

interface StatsOptions {
  eventId: string;
  bucketMinutes?: 15 | 30 | 60;
}

export interface EventStats {
  /** Guests plus table seats/arrivals, summed. */
  guestStats: GuestStats;
  /** The table share of the totals above. */
  tableTotals: TableTotals;
  histogram: TimeSlotStats[];
  timeline: TimeSlotStats[];
  peakWindow: { time: string; count: number } | null;
  recentCheckins: RecentCheckin[];
}

const byTime = (a: { time: string }, b: { time: string }) =>
  new Date(a.time).getTime() - new Date(b.time).getTime();

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

    // Tables: reserved seats count as expected people, arrivals as checked in.
    // "Not arrived" uses the free seats per table, so an over-full table never
    // subtracts from the others (checkedIn + notArrived may then exceed total).
    const tables = (await db.event_tables.where("event_id").equals(eventId).toArray()).filter(
      (t) => !t.is_deleted
    );
    const tableIds = new Set(tables.map((t) => t.id));
    const tableNames = new Map(tables.map((t) => [t.id, t.name]));
    const arrivals = (await db.table_arrivals.where("event_id").equals(eventId).toArray()).filter(
      (a) => tableIds.has(a.table_id)
    );
    const sums = sumArrivals(arrivals);
    const statuses = new Map<string, TableStatus>(
      tables.map((t) => [t.id, tableStatus(t.seats, sums.get(t.id))])
    );
    const totals = tableTotals(tables, statuses);

    const guestStats: GuestStats = {
      total: guests.length + totals.seats,
      checkedIn: checkedIn + totals.arrived,
      notArrived: guests.length - checkedIn + totals.remaining,
      left,
    };

    // Histogram of arrivals per time bucket, with empty buckets filled in so the
    // x-axis is linear. Check-outs and table corrections are not arrivals.
    const bucketMs = bucketMinutes * 60_000;
    const bucketMap = new Map<number, number>();
    const addToBucket = (time: string, count: number) => {
      const bucket = Math.floor(new Date(time).getTime() / bucketMs) * bucketMs;
      bucketMap.set(bucket, (bucketMap.get(bucket) ?? 0) + count);
    };
    for (const checkin of checkins) {
      if (checkin.type === "IN") addToBucket(checkin.checked_in_at, 1);
    }
    for (const arrival of arrivals) {
      if (arrival.delta > 0) addToBucket(arrival.arrived_at, arrival.delta);
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
    const recentGuestCheckins: RecentCheckin[] = checkins.map((c) => ({
      id: c.id,
      name: guestNames.get(c.guest_id) ?? "Unknown",
      time: c.checked_in_at,
      type: c.type,
      source: "guest",
    }));
    const recentArrivals: RecentCheckin[] = arrivals.map((a) => ({
      id: a.id,
      name: tableNames.get(a.table_id) ?? "Unknown table",
      time: a.arrived_at,
      type: a.delta > 0 ? "IN" : "OUT",
      source: "table",
      count: Math.abs(a.delta),
    }));
    const recentCheckins = [...recentGuestCheckins, ...recentArrivals]
      .sort(byTime)
      .slice(-10)
      .reverse();

    return { guestStats, tableTotals: totals, histogram, timeline, peakWindow, recentCheckins };
  }, [eventId, bucketMinutes]);

  return stats;
}

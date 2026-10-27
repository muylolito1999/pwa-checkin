"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { LocalCheckin, LocalGuest } from "@/types";

interface UseGuestsOptions {
  eventId: string;
  search?: string;
  groupFilter?: string;
  statusFilter?: "all" | "checked-in" | "not-arrived";
}

export interface GuestWithStatus extends LocalGuest {
  isCheckedIn: boolean;
  checkInTime: string | null;
  entryCount: number;
}

const byNewest = (a: LocalCheckin, b: LocalCheckin) =>
  new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime();

/** Returns `undefined` while the first query is running, then the filtered list. */
export function useGuests({
  eventId,
  search = "",
  groupFilter = "",
  statusFilter = "all",
}: UseGuestsOptions): GuestWithStatus[] | undefined {
  return useLiveQuery(async () => {
    if (!eventId) return [];

    let guestList = (await db.guests.where("event_id").equals(eventId).toArray()).filter(
      (g) => !g.is_deleted
    );

    if (search) {
      const searchLower = search.toLowerCase();
      guestList = guestList.filter(
        (g) =>
          g.first_name.toLowerCase().includes(searchLower) ||
          g.last_name.toLowerCase().includes(searchLower) ||
          g.ticket_code?.toLowerCase().includes(searchLower) ||
          g.phone?.includes(search)
      );
    }

    if (groupFilter) {
      guestList = guestList.filter((g) => g.group === groupFilter);
    }

    const checkins = await db.checkins.where("event_id").equals(eventId).toArray();
    const checkinsByGuest = new Map<string, LocalCheckin[]>();
    for (const checkin of checkins) {
      const list = checkinsByGuest.get(checkin.guest_id);
      if (list) list.push(checkin);
      else checkinsByGuest.set(checkin.guest_id, [checkin]);
    }

    const guestsWithStatus: GuestWithStatus[] = guestList.map((guest) => {
      const guestCheckins = (checkinsByGuest.get(guest.id) ?? []).sort(byNewest);
      const lastCheckin = guestCheckins[0];
      const isCheckedIn = lastCheckin?.type === "IN";
      return {
        ...guest,
        isCheckedIn,
        checkInTime: isCheckedIn ? lastCheckin.checked_in_at : null,
        entryCount: guestCheckins.filter((c) => c.type === "IN").length,
      };
    });

    if (statusFilter === "checked-in") {
      return guestsWithStatus.filter((g) => g.isCheckedIn);
    }
    if (statusFilter === "not-arrived") {
      return guestsWithStatus.filter((g) => !g.isCheckedIn);
    }
    return guestsWithStatus;
  }, [eventId, search, groupFilter, statusFilter]);
}

export function useGuestGroups(eventId: string): string[] {
  const groups = useLiveQuery(async () => {
    if (!eventId) return [];
    const guests = (await db.guests.where("event_id").equals(eventId).toArray()).filter(
      (g) => !g.is_deleted
    );
    const groupSet = new Set(guests.map((g) => g.group).filter((g): g is string => Boolean(g)));
    return Array.from(groupSet).sort();
  }, [eventId]);

  return groups ?? [];
}

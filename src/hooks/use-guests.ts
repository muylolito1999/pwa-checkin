"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, generateId, getDeviceId, generateStableKey } from "@/lib/db";
import type { LocalGuest, LocalCheckin, Guest } from "@/types";

interface UseGuestsOptions {
  eventId: string;
  search?: string;
  groupFilter?: string;
  statusFilter?: "all" | "checked-in" | "not-arrived";
}

interface GuestWithStatus extends LocalGuest {
  isCheckedIn: boolean;
  checkInTime: string | null;
  entryCount: number;
}

export function useGuests({
  eventId,
  search = "",
  groupFilter = "",
  statusFilter = "all",
}: UseGuestsOptions) {
  const guests = useLiveQuery(async () => {
    if (!eventId) return [];

    // Get all guests and filter in JavaScript for better Dexie compatibility
    const allGuests = await db.guests.toArray();
    let guestList = allGuests.filter(g => g.event_id === eventId && g.is_deleted === false);

    // Apply search filter
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

    // Apply group filter
    if (groupFilter) {
      guestList = guestList.filter((g) => g.group === groupFilter);
    }

    // Get all checkins for these guests
    const guestIds = guestList.map((g) => g.id);
    const checkins = await db.checkins
      .where("guest_id")
      .anyOf(guestIds)
      .toArray();

    // Calculate check-in status for each guest
    const guestsWithStatus: GuestWithStatus[] = guestList.map((guest) => {
      const guestCheckins = checkins
        .filter((c) => c.guest_id === guest.id)
        .sort(
          (a, b) =>
            new Date(b.checked_in_at).getTime() -
            new Date(a.checked_in_at).getTime()
        );

      const lastCheckin = guestCheckins[0];
      const isCheckedIn = lastCheckin?.type === "IN";
      const entryCount = guestCheckins.filter((c) => c.type === "IN").length;

      return {
        ...guest,
        isCheckedIn,
        checkInTime: isCheckedIn ? lastCheckin.checked_in_at : null,
        entryCount,
      };
    });

    // Apply status filter
    if (statusFilter === "checked-in") {
      return guestsWithStatus.filter((g) => g.isCheckedIn);
    } else if (statusFilter === "not-arrived") {
      return guestsWithStatus.filter((g) => !g.isCheckedIn);
    }

    return guestsWithStatus;
  }, [eventId, search, groupFilter, statusFilter]);

  return guests ?? [];
}

export function useGuestGroups(eventId: string) {
  const groups = useLiveQuery(async () => {
    if (!eventId) return [];

    // Get all guests and filter in JavaScript for better Dexie compatibility
    const allGuests = await db.guests.toArray();
    const guests = allGuests.filter(g => g.event_id === eventId && !g.is_deleted);

    const groupSet = new Set(guests.map((g) => g.group).filter(Boolean));
    return Array.from(groupSet).sort() as string[];
  }, [eventId]);

  return groups ?? [];
}

export async function toggleCheckIn(
  guestId: string,
  eventId: string,
  isCurrentlyCheckedIn: boolean
): Promise<void> {
  const now = new Date().toISOString();
  const checkin: LocalCheckin = {
    id: generateId(),
    event_id: eventId,
    guest_id: guestId,
    checked_in_at: now,
    type: isCurrentlyCheckedIn ? "OUT" : "IN",
    device_id: getDeviceId(),
    synced_at: null,
    created_at: now,
    _pending_sync: true,
  };

  await db.checkins.add(checkin);
  await addToOutbox("CREATE", "checkins", checkin as unknown as Record<string, unknown>);
}

export async function addGuest(
  guest: Omit<Guest, "id" | "stable_key" | "created_at" | "updated_at" | "is_deleted">
): Promise<string> {
  const now = new Date().toISOString();
  const stableKey = generateStableKey(guest.last_name, guest.first_name);

  const newGuest: LocalGuest = {
    ...guest,
    id: generateId(),
    stable_key: stableKey,
    is_deleted: false,
    created_at: now,
    updated_at: now,
    _pending_sync: true,
  };

  await db.guests.add(newGuest);
  await addToOutbox("CREATE", "guests", newGuest as unknown as Record<string, unknown>);

  return newGuest.id;
}

export async function updateGuest(
  id: string,
  updates: Partial<Pick<Guest, "first_name" | "last_name" | "notes" | "phone" | "group" | "ticket_code">>
): Promise<void> {
  const now = new Date().toISOString();

  await db.guests.update(id, {
    ...updates,
    updated_at: now,
    _pending_sync: true,
  });

  const guest = await db.guests.get(id);
  if (guest) {
    await addToOutbox("UPDATE", "guests", guest as unknown as Record<string, unknown>);
  }
}

export async function deleteGuest(id: string, eventId: string): Promise<void> {
  // Delete associated checkins first
  const checkins = await db.checkins.where("guest_id").equals(id).toArray();
  for (const checkin of checkins) {
    await db.checkins.delete(checkin.id);
    await addToOutbox("DELETE", "checkins", { id: checkin.id, event_id: eventId });
  }

  // Get guest data before deleting for sync
  const guest = await db.guests.get(id);

  // Permanently delete from local DB
  await db.guests.delete(id);

  // Queue deletion for server sync
  if (guest) {
    await addToOutbox("DELETE", "guests", { id, event_id: eventId });
  }
}

// Add guest manually with just first and last name
export async function addGuestManual(
  eventId: string,
  firstName: string,
  lastName: string
): Promise<string> {
  const now = new Date().toISOString();
  // Generate unique stable key with timestamp to allow duplicates
  const stableKey = generateStableKey(lastName, firstName) + "_" + Date.now();

  const newGuest: LocalGuest = {
    id: generateId(),
    event_id: eventId,
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    notes: null,
    phone: null,
    group: null,
    ticket_code: null,
    stable_key: stableKey,
    is_deleted: false,
    created_at: now,
    updated_at: now,
    _pending_sync: true,
  };

  await db.guests.add(newGuest);
  await addToOutbox("CREATE", "guests", newGuest as unknown as Record<string, unknown>);

  return newGuest.id;
}

// Check if a guest with same name already exists
export async function checkDuplicateGuest(
  eventId: string,
  firstName: string,
  lastName: string
): Promise<string | null> {
  const allGuests = await db.guests.toArray();
  const duplicates = allGuests.filter(
    (g) =>
      g.event_id === eventId &&
      !g.is_deleted &&
      g.first_name.toLowerCase() === firstName.toLowerCase().trim() &&
      g.last_name.toLowerCase() === lastName.toLowerCase().trim()
  );

  if (duplicates.length > 0) {
    return `A guest named "${firstName} ${lastName}" already exists (${duplicates.length} found)`;
  }
  return null;
}

async function addToOutbox(
  operation: "CREATE" | "UPDATE" | "DELETE",
  table: "guests" | "checkins",
  data: Record<string, unknown>
): Promise<void> {
  await db.outbox.add({
    table,
    operation,
    record_id: data.id as string,
    data,
    timestamp: new Date().toISOString(),
    retries: 0,
  });
}

import { db, generateGuestId, generateId, generateStableKey, getDeviceId } from "@/lib/db";
import { addToOutbox } from "@/lib/sync/outbox";
import type { LocalCheckin, LocalGuest } from "@/types";

const asRecord = (value: unknown) => value as Record<string, unknown>;

/**
 * Every mutation writes the local row and its outbox entry in one Dexie
 * transaction, so a crash can never leave a change that is never synced.
 * Only Dexie calls may be awaited inside the transaction callbacks.
 */

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

  await db.transaction("rw", db.checkins, db.outbox, async () => {
    await db.checkins.add(checkin);
    await addToOutbox("CREATE", "checkins", asRecord(checkin));
  });
}

/** Adds a guest by name. A deleted guest with the same name is revived instead. */
export async function addGuestManual(
  eventId: string,
  firstName: string,
  lastName: string
): Promise<string> {
  const first = firstName.trim();
  const last = lastName.trim();
  const now = new Date().toISOString();
  const baseKey = generateStableKey(last, first);

  return db.transaction("rw", db.guests, db.outbox, async () => {
    const existing = await db.guests.where({ event_id: eventId, stable_key: baseKey }).first();

    if (existing?.is_deleted) {
      const revived: LocalGuest = {
        ...existing,
        first_name: first,
        last_name: last,
        is_deleted: false,
        updated_at: now,
        _pending_sync: true,
      };
      await db.guests.put(revived);
      await addToOutbox("UPDATE", "guests", asRecord(revived));
      return revived.id;
    }

    // "Add anyway" for a real namesake: a timestamp suffix keeps the keys distinct.
    const stableKey = existing ? `${baseKey}_${Date.now()}` : baseKey;
    const newGuest: LocalGuest = {
      id: generateGuestId(eventId, stableKey),
      event_id: eventId,
      first_name: first,
      last_name: last,
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
    await addToOutbox("CREATE", "guests", asRecord(newGuest));
    return newGuest.id;
  });
}

/** Soft-deletes a guest (so other devices learn about it) and removes their check-ins. */
export async function deleteGuest(id: string, eventId: string): Promise<void> {
  const now = new Date().toISOString();

  await db.transaction("rw", db.guests, db.checkins, db.outbox, async () => {
    const guest = await db.guests.get(id);
    if (!guest) return;

    const checkins = await db.checkins.where("[event_id+guest_id]").equals([eventId, id]).toArray();
    for (const checkin of checkins) {
      await db.checkins.delete(checkin.id);
      await addToOutbox("DELETE", "checkins", { id: checkin.id, event_id: eventId });
    }

    const deleted: LocalGuest = { ...guest, is_deleted: true, updated_at: now, _pending_sync: true };
    await db.guests.put(deleted);
    await addToOutbox("UPDATE", "guests", asRecord(deleted));
  });
}

// Check if a guest with same name already exists
export async function checkDuplicateGuest(
  eventId: string,
  firstName: string,
  lastName: string
): Promise<string | null> {
  const first = firstName.trim().toLowerCase();
  const last = lastName.trim().toLowerCase();
  const duplicates = await db.guests
    .where("event_id")
    .equals(eventId)
    .filter(
      (g) =>
        !g.is_deleted &&
        g.first_name.toLowerCase() === first &&
        g.last_name.toLowerCase() === last
    )
    .count();

  if (duplicates > 0) {
    return `A guest named "${firstName} ${lastName}" already exists (${duplicates} found)`;
  }
  return null;
}

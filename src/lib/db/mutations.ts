import { db, generateGuestId, generateId, generateStableKey, getDeviceId } from "@/lib/db";
import { addToOutbox } from "@/lib/sync/outbox";
import type { LocalCheckin, LocalEventTable, LocalGuest, LocalTableArrival } from "@/types";

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

// ---------------------------------------------------------------------------
// Tables (group reservations)
// ---------------------------------------------------------------------------

export interface TableInput {
  name: string;
  seats: number;
  notes?: string | null;
}

function normalizeTableInput(input: TableInput) {
  const name = input.name.trim();
  const seats = Math.trunc(input.seats);
  if (!name) throw new Error("Table name is required");
  if (!Number.isFinite(seats) || seats < 1) throw new Error("Seats must be at least 1");
  return { name, seats, notes: input.notes?.trim() || null };
}

export async function addTable(eventId: string, input: TableInput): Promise<string> {
  const { name, seats, notes } = normalizeTableInput(input);
  const now = new Date().toISOString();
  const table: LocalEventTable = {
    id: generateId(),
    event_id: eventId,
    name,
    seats,
    notes,
    is_deleted: false,
    created_at: now,
    updated_at: now,
    _pending_sync: true,
  };

  await db.transaction("rw", db.event_tables, db.outbox, async () => {
    await db.event_tables.add(table);
    await addToOutbox("CREATE", "event_tables", asRecord(table));
  });
  return table.id;
}

export async function updateTable(id: string, eventId: string, input: TableInput): Promise<void> {
  const { name, seats, notes } = normalizeTableInput(input);
  const now = new Date().toISOString();

  await db.transaction("rw", db.event_tables, db.outbox, async () => {
    const existing = await db.event_tables.get(id);
    if (!existing || existing.event_id !== eventId) throw new Error("Table not found");
    const updated: LocalEventTable = {
      ...existing,
      name,
      seats,
      notes,
      updated_at: now,
      _pending_sync: true,
    };
    await db.event_tables.put(updated);
    await addToOutbox("UPDATE", "event_tables", asRecord(updated));
  });
}

/** Soft-deletes a table (so other devices learn about it) and removes its arrivals. */
export async function deleteTable(id: string, eventId: string): Promise<void> {
  const now = new Date().toISOString();

  await db.transaction("rw", db.event_tables, db.table_arrivals, db.outbox, async () => {
    const table = await db.event_tables.get(id);
    if (!table) return;

    const arrivals = await db.table_arrivals
      .where("[event_id+table_id]")
      .equals([eventId, id])
      .toArray();
    for (const arrival of arrivals) {
      await db.table_arrivals.delete(arrival.id);
      await addToOutbox("DELETE", "table_arrivals", { id: arrival.id, event_id: eventId });
    }

    const deleted: LocalEventTable = { ...table, is_deleted: true, updated_at: now, _pending_sync: true };
    await db.event_tables.put(deleted);
    await addToOutbox("UPDATE", "event_tables", asRecord(deleted));
  });
}

/**
 * Appends an arrival (positive) or a correction (negative) for a table.
 * A correction never takes the total below zero. Returns the delta applied
 * (0 when nothing was recorded).
 */
export async function recordTableArrival(
  tableId: string,
  eventId: string,
  delta: number
): Promise<number> {
  const requested = Math.trunc(delta);
  if (!Number.isFinite(requested) || requested === 0) return 0;

  return db.transaction("rw", db.table_arrivals, db.outbox, async () => {
    let applied = requested;
    if (requested < 0) {
      const arrivals = await db.table_arrivals
        .where("[event_id+table_id]")
        .equals([eventId, tableId])
        .toArray();
      const current = arrivals.reduce((sum, a) => sum + a.delta, 0);
      applied = Math.max(requested, -Math.max(0, current));
      if (applied === 0) return 0;
    }

    const now = new Date().toISOString();
    const arrival: LocalTableArrival = {
      id: generateId(),
      event_id: eventId,
      table_id: tableId,
      delta: applied,
      arrived_at: now,
      device_id: getDeviceId(),
      synced_at: null,
      created_at: now,
      _pending_sync: true,
    };
    await db.table_arrivals.add(arrival);
    await addToOutbox("CREATE", "table_arrivals", asRecord(arrival));
    return applied;
  });
}

/** Warns about an existing (non-deleted) table with the same name. */
export async function checkDuplicateTable(
  eventId: string,
  name: string,
  excludeId?: string
): Promise<string | null> {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  const duplicates = await db.event_tables
    .where("event_id")
    .equals(eventId)
    .filter((t) => !t.is_deleted && t.id !== excludeId && t.name.trim().toLowerCase() === normalized)
    .count();
  return duplicates > 0 ? `A table named "${name.trim()}" already exists` : null;
}

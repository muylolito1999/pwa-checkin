"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { sumArrivals, tableStatus, tableTotals, type TableStatus } from "@/lib/tables";
import type { LocalEventTable, TableTotals } from "@/types";

interface UseTablesOptions {
  eventId: string;
  search?: string;
}

export interface TableWithStatus extends LocalEventTable, TableStatus {}

export interface TablesResult {
  /** Tables matching the search, sorted by name. */
  tables: TableWithStatus[];
  /** Totals over every live table, independent of the search. */
  totals: TableTotals;
}

/** Returns `undefined` while the first query is running, then the tables with their arrival counts. */
export function useTables({ eventId, search = "" }: UseTablesOptions): TablesResult | undefined {
  return useLiveQuery(async () => {
    if (!eventId) return { tables: [], totals: tableTotals([], new Map()) };

    const tables = (await db.event_tables.where("event_id").equals(eventId).toArray()).filter(
      (t) => !t.is_deleted
    );
    const arrivals = await db.table_arrivals.where("event_id").equals(eventId).toArray();
    const sums = sumArrivals(arrivals);

    const statuses = new Map<string, TableStatus>(
      tables.map((table) => [table.id, tableStatus(table.seats, sums.get(table.id))])
    );
    const totals = tableTotals(tables, statuses);

    const searchLower = search.trim().toLowerCase();
    const withStatus: TableWithStatus[] = tables
      .filter(
        (t) =>
          !searchLower ||
          t.name.toLowerCase().includes(searchLower) ||
          t.notes?.toLowerCase().includes(searchLower)
      )
      .map((table) => ({ ...table, ...statuses.get(table.id)! }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    return { tables: withStatus, totals };
  }, [eventId, search]);
}

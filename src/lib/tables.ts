import type { EventTable, TableArrival, TableTotals } from "@/types";

/**
 * Pure arithmetic shared by the tables page and the stats page, so the two
 * never disagree on how many people arrived at a table.
 */

export interface ArrivalSum {
  sum: number;
  lastArrivalAt: string | null;
}

export type TableState = "normal" | "complete" | "over";

export interface TableStatus {
  /** People who arrived (never negative, even if corrections overshoot). */
  arrived: number;
  /** Reserved seats still free. */
  remaining: number;
  /** People beyond the reserved seats. */
  over: number;
  state: TableState;
  lastArrivalAt: string | null;
}

export function sumArrivals(arrivals: Pick<TableArrival, "table_id" | "delta" | "arrived_at">[]) {
  const sums = new Map<string, ArrivalSum>();
  for (const arrival of arrivals) {
    const current = sums.get(arrival.table_id) ?? { sum: 0, lastArrivalAt: null };
    current.sum += arrival.delta;
    if (arrival.delta > 0 && (!current.lastArrivalAt || arrival.arrived_at > current.lastArrivalAt)) {
      current.lastArrivalAt = arrival.arrived_at;
    }
    sums.set(arrival.table_id, current);
  }
  return sums;
}

export function tableStatus(seats: number, sum: ArrivalSum | undefined): TableStatus {
  const arrived = Math.max(0, sum?.sum ?? 0);
  const remaining = Math.max(0, seats - arrived);
  const over = Math.max(0, arrived - seats);
  const state: TableState = over > 0 ? "over" : remaining === 0 ? "complete" : "normal";
  return { arrived, remaining, over, state, lastArrivalAt: sum?.lastArrivalAt ?? null };
}

export function tableTotals(
  tables: Pick<EventTable, "id" | "seats">[],
  statuses: Map<string, TableStatus>
): TableTotals {
  const totals: TableTotals = { tables: tables.length, seats: 0, arrived: 0, remaining: 0, over: 0 };
  for (const table of tables) {
    const status = statuses.get(table.id);
    totals.seats += table.seats;
    totals.arrived += status?.arrived ?? 0;
    totals.remaining += status?.remaining ?? table.seats;
    totals.over += status?.over ?? 0;
  }
  return totals;
}

export const EMPTY_TABLE_TOTALS: TableTotals = { tables: 0, seats: 0, arrived: 0, remaining: 0, over: 0 };

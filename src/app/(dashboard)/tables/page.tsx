"use client";

import { useState } from "react";
import { Armchair, Plus, Search } from "lucide-react";
import { TableCard } from "@/components/tables/table-card";
import { TableFormDialog } from "@/components/tables/table-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { useSession } from "@/hooks/use-session";
import { useTables } from "@/hooks/use-tables";

export default function TablesPage() {
  const { session } = useSession();
  const eventId = session?.eventId ?? "";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const result = useTables({ eventId, search: debouncedSearch });
  const totals = result?.totals;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tables</h1>
          <p className="text-muted-foreground">
            {totals && totals.tables > 0 ? (
              <>
                {totals.arrived} of {totals.seats} seats arrived · {totals.remaining} remaining
                {totals.over > 0 && (
                  <span className="text-orange-500"> · {totals.over} over</span>
                )}
              </>
            ) : (
              <>Group reservations for {session?.eventName}</>
            )}
          </p>
        </div>
        <TableFormDialog
          eventId={eventId}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Table
            </Button>
          }
        />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search tables..."
          aria-label="Search tables"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {result === undefined ? (
        <div
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-label="Loading tables"
        >
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : result.tables.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Armchair className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p className="font-medium">{search ? "No tables match your search" : "No tables yet"}</p>
          {!search && <p className="text-sm">Add a table to track group arrivals.</p>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {result.tables.map((table) => (
            <TableCard key={table.id} table={table} eventId={eventId} />
          ))}
        </div>
      )}
    </div>
  );
}

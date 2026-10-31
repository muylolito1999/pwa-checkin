"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGuests, useGuestGroups } from "@/hooks/use-guests";
import { useSession } from "@/hooks/use-session";
import { GuestTable } from "@/components/guests/guest-table";
import { GuestFilters } from "@/components/guests/guest-filters";
import { AddGuestDialog } from "@/components/guests/add-guest-dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { Skeleton } from "@/components/ui/skeleton";

export default function GuestsPage() {
  const { session } = useSession();
  const eventId = session?.eventId ?? "";

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "checked-in" | "not-arrived"
  >("all");

  const debouncedSearch = useDebounce(search, 300);

  const guests = useGuests({
    eventId,
    search: debouncedSearch,
    groupFilter: groupFilter === "all" ? "" : groupFilter,
    statusFilter,
  });

  const groups = useGuestGroups(eventId);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const handleGroupFilterChange = useCallback((value: string) => {
    setGroupFilter(value);
  }, []);

  const handleStatusFilterChange = useCallback(
    (value: "all" | "checked-in" | "not-arrived") => {
      setStatusFilter(value);
    },
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Guest List</h1>
          <p className="text-muted-foreground">
            Manage check-ins for {session?.eventName}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" asChild>
            <Link href="/import">
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Import</span>
            </Link>
          </Button>
          <AddGuestDialog eventId={eventId} />
        </div>
      </div>

      <GuestFilters
        search={search}
        onSearchChange={handleSearchChange}
        groups={groups}
        groupFilter={groupFilter}
        onGroupFilterChange={handleGroupFilterChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
      />

      {guests === undefined ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading guests">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : (
        <GuestTable guests={guests} eventId={eventId} />
      )}
    </div>
  );
}

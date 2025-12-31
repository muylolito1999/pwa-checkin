"use client";

import { useState, useCallback } from "react";
import { useGuests, useGuestGroups } from "@/hooks/use-guests";
import { useSession } from "@/hooks/use-session";
import { GuestTable } from "@/components/guests/guest-table";
import { GuestFilters } from "@/components/guests/guest-filters";
import { AddGuestDialog } from "@/components/guests/add-guest-dialog";
import { useDebounce } from "@/hooks/use-debounce";

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Guest List</h1>
          <p className="text-muted-foreground">
            Manage check-ins for {session?.eventName}
          </p>
        </div>
        <AddGuestDialog eventId={eventId} />
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

      <GuestTable guests={guests} eventId={eventId} />
    </div>
  );
}

"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface GuestFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  groups: string[];
  groupFilter: string;
  onGroupFilterChange: (value: string) => void;
  statusFilter: "all" | "checked-in" | "not-arrived";
  onStatusFilterChange: (value: "all" | "checked-in" | "not-arrived") => void;
}

export function GuestFilters({
  search,
  onSearchChange,
  groups,
  groupFilter,
  onGroupFilterChange,
  statusFilter,
  onStatusFilterChange,
}: GuestFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name, ticket code..."
          aria-label="Search guests"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {groups.length > 0 && (
        <Select value={groupFilter} onValueChange={onGroupFilterChange}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="All groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group} value={group}>
                {group}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex gap-1 rounded-lg border p-1" role="group" aria-label="Filter by status">
        {(
          [
            { value: "all", label: "All" },
            { value: "checked-in", label: "In" },
            { value: "not-arrived", label: "Not arrived" },
          ] as const
        ).map((option) => (
          <Button
            key={option.value}
            variant="ghost"
            size="sm"
            onClick={() => onStatusFilterChange(option.value)}
            aria-pressed={statusFilter === option.value}
            className={cn(
              "px-3",
              statusFilter === option.value &&
                "bg-secondary text-secondary-foreground"
            )}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

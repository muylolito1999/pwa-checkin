"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Clock } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckInButton } from "./check-in-button";
import type { LocalGuest } from "@/types";
import { cn } from "@/lib/utils";

interface GuestWithStatus extends LocalGuest {
  isCheckedIn: boolean;
  checkInTime: string | null;
  entryCount: number;
}

interface GuestTableProps {
  guests: GuestWithStatus[];
  eventId: string;
}

function formatTime(isoString: string | null): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function GuestTable({ guests, eventId }: GuestTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<GuestWithStatus>[]>(
    () => [
      {
        accessorKey: "last_name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-semibold"
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">
              {row.original.last_name} {row.original.first_name}
            </div>
            {row.original.ticket_code && (
              <div className="text-xs text-muted-foreground">
                {row.original.ticket_code}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "group",
        header: "Group",
        cell: ({ row }) =>
          row.original.group ? (
            <Badge variant="outline">{row.original.group}</Badge>
          ) : null,
      },
      {
        accessorKey: "isCheckedIn",
        header: "Status",
        cell: ({ row }) => {
          const { isCheckedIn, checkInTime, entryCount } = row.original;
          return (
            <div className="flex flex-col gap-1">
              <Badge
                variant={isCheckedIn ? "default" : "secondary"}
                className={cn(
                  isCheckedIn
                    ? "bg-green-500/10 text-green-600 border-green-500/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isCheckedIn ? "Checked In" : "Not Arrived"}
              </Badge>
              {checkInTime && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatTime(checkInTime)}
                  {entryCount > 1 && (
                    <span className="text-orange-500">({entryCount}x)</span>
                  )}
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <CheckInButton
            guestId={row.original.id}
            eventId={eventId}
            guestName={`${row.original.first_name} ${row.original.last_name}`}
            isCheckedIn={row.original.isCheckedIn}
          />
        ),
      },
    ],
    [eventId]
  );

  const table = useReactTable({
    data: guests,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (guests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No guests found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Import guests from a CSV file to get started
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className={cn(
                row.original.isCheckedIn && "bg-green-500/5"
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

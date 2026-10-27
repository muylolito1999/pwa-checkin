"use client";

import { useState } from "react";
import { Clock, EllipsisVertical, Minus, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import type { TableWithStatus } from "@/hooks/use-tables";
import { deleteTable, recordTableArrival } from "@/lib/db/mutations";
import { cn } from "@/lib/utils";
import { RecordArrivalsDialog } from "./record-arrivals-dialog";
import { TableFormDialog } from "./table-form-dialog";

interface TableCardProps {
  table: TableWithStatus;
  eventId: string;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ table }: { table: TableWithStatus }) {
  switch (table.state) {
    case "over":
      return (
        <Badge className="border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400">
          <TriangleAlert />
          {table.over} over
        </Badge>
      );
    case "complete":
      return (
        <Badge className="border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400">
          Complete
        </Badge>
      );
    default:
      return <Badge variant="secondary">{table.remaining} remaining</Badge>;
  }
}

export function TableCard({ table, eventId }: TableCardProps) {
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [arrivalsOpen, setArrivalsOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const record = async (delta: number) => {
    setBusy(true);
    try {
      const applied = await recordTableArrival(table.id, eventId, delta);
      if (applied === 0) return;
      const arrived = table.arrived + applied;
      const over = arrived - table.seats;
      if (applied > 0 && over > 0) {
        toast.warning(`${table.name} is ${over} over capacity (${arrived} / ${table.seats})`);
      } else if (applied > 0) {
        toast.success(`+${applied} at ${table.name} (${arrived} / ${table.seats})`);
      } else {
        toast(`${table.name}: ${arrived} / ${table.seats}`);
      }
    } catch (error) {
      toast.error("Failed to record arrival");
      console.error(error);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await deleteTable(table.id, eventId);
      toast.success(`Removed table ${table.name}`);
    } catch (error) {
      toast.error("Failed to remove table");
      console.error(error);
    } finally {
      setBusy(false);
      setRemoveOpen(false);
    }
  };

  const progress = Math.min(100, Math.round((table.arrived / table.seats) * 100));

  return (
    <Card className={cn("gap-4 py-4", table.state === "over" && "border-orange-500/40")}>
      <CardHeader className="px-4">
        <CardTitle className="truncate text-lg">{table.name}</CardTitle>
        {table.notes && <p className="truncate text-sm text-muted-foreground">{table.notes}</p>}
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Options for ${table.name}`}>
                <EllipsisVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setRemoveOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3 px-4">
        <div className="flex items-end justify-between gap-2">
          <div className="leading-none">
            <span className="text-3xl font-bold tabular-nums">{table.arrived}</span>
            <span className="text-muted-foreground"> / {table.seats}</span>
          </div>
          <StatusBadge table={table} />
        </div>

        <Progress
          value={progress}
          aria-label={`${table.arrived} of ${table.seats} seats arrived`}
          className={cn(
            table.state === "complete" && "[&>[data-slot=progress-indicator]]:bg-green-500",
            table.state === "over" && "[&>[data-slot=progress-indicator]]:bg-orange-500"
          )}
        />

        <p className="flex h-4 items-center gap-1 text-xs text-muted-foreground">
          {table.lastArrivalAt && (
            <>
              <Clock className="h-3 w-3" />
              Last arrival {formatTime(table.lastArrivalAt)}
            </>
          )}
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-12 w-14 text-lg"
            disabled={busy || table.arrived === 0}
            onClick={() => record(-1)}
            aria-label={`Remove one arrival from ${table.name}`}
          >
            <Minus className="h-5 w-5" />
          </Button>
          <Button
            className="h-12 flex-1 bg-green-500 text-lg font-semibold text-white hover:bg-green-600"
            disabled={busy}
            onClick={() => record(1)}
            aria-label={`Add one arrival to ${table.name}`}
          >
            <Plus className="h-5 w-5" />1
          </Button>
          <Button
            variant="outline"
            className="h-12 px-4 text-base font-semibold"
            disabled={busy}
            onClick={() => setArrivalsOpen(true)}
            aria-label={`Add several arrivals to ${table.name}`}
          >
            +N
          </Button>
        </div>
      </CardContent>

      {/* Dialogs live outside the menu: Radix unmounts the menu when an item is selected. */}
      <TableFormDialog eventId={eventId} table={table} open={editOpen} onOpenChange={setEditOpen} />
      <RecordArrivalsDialog
        table={table}
        eventId={eventId}
        open={arrivalsOpen}
        onOpenChange={setArrivalsOpen}
      />
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Table</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove table <strong>{table.name}</strong>?
              {table.arrived > 0 && (
                <span className="mt-2 block text-orange-500">
                  Its {table.arrived} recorded arrival(s) will also be deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRemove();
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

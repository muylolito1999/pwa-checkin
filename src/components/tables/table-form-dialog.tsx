"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TableWithStatus } from "@/hooks/use-tables";
import { addTable, checkDuplicateTable, updateTable } from "@/lib/db/mutations";

interface TableFormDialogProps {
  eventId: string;
  /** When set, the dialog edits this table instead of creating a new one. */
  table?: TableWithStatus;
  /** Controlled open state (used when opened from a menu). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Trigger element for uncontrolled use. */
  trigger?: React.ReactNode;
}

export function TableFormDialog({ eventId, table, open, onOpenChange, trigger }: TableFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{table ? "Edit Table" : "Add Table"}</DialogTitle>
          <DialogDescription>
            {table
              ? "Change the name or the number of reserved seats."
              : "A table is a group reservation. Record arrivals as people show up."}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the fields always start from the current table. */}
        <TableForm eventId={eventId} table={table} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function parseSeats(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const seats = Number.parseInt(value, 10);
  return seats >= 1 ? seats : null;
}

function TableForm({
  eventId,
  table,
  onDone,
}: {
  eventId: string;
  table?: TableWithStatus;
  onDone: () => void;
}) {
  const [name, setName] = useState(table?.name ?? "");
  const [seats, setSeats] = useState(table ? String(table.seats) : "");
  const [notes, setNotes] = useState(table?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const seatsNumber = parseSeats(seats);
  const canSubmit = Boolean(name.trim()) && seatsNumber !== null && !loading;
  const overAfterEdit =
    table && seatsNumber !== null && table.arrived > seatsNumber ? table.arrived - seatsNumber : 0;

  const handleNameChange = async (value: string) => {
    setName(value);
    setDuplicateWarning(value.trim() ? await checkDuplicateTable(eventId, value, table?.id) : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || seatsNumber === null) {
      toast.error("A name and at least one seat are required");
      return;
    }

    setLoading(true);
    try {
      const input = { name: name.trim(), seats: seatsNumber, notes };
      if (table) {
        await updateTable(table.id, eventId, input);
        toast.success(`Updated table ${input.name}`);
      } else {
        await addTable(eventId, input);
        toast.success(`Added table ${input.name} (${seatsNumber} seats)`);
      }
      onDone();
    } catch (error) {
      toast.error(table ? "Failed to update table" : "Failed to add table");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="tableName">Name</Label>
          <Input
            id="tableName"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Marco"
            autoFocus
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tableSeats">Reserved seats</Label>
          <Input
            id="tableSeats"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            placeholder="10"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tableNotes">Notes (optional)</Label>
          <Input
            id="tableNotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Near the stage"
          />
        </div>
        {duplicateWarning && (
          <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            <span>{duplicateWarning}</span>
          </div>
        )}
        {overAfterEdit > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-orange-500/10 p-3 text-sm text-orange-600 dark:text-orange-400">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            <span>
              {table?.arrived} people already arrived: the table will be {overAfterEdit} over capacity.
            </span>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {loading
            ? "Saving..."
            : table
              ? "Save"
              : duplicateWarning
                ? "Add Anyway"
                : "Add Table"}
        </Button>
      </DialogFooter>
    </form>
  );
}

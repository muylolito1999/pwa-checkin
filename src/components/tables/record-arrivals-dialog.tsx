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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TableWithStatus } from "@/hooks/use-tables";
import { recordTableArrival } from "@/lib/db/mutations";
import { cn } from "@/lib/utils";

interface RecordArrivalsDialogProps {
  table: TableWithStatus;
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUICK_COUNTS = [1, 2, 3, 5];

/** Records several arrivals at once ("5 of Marco's 10 are here"). */
export function RecordArrivalsDialog({ table, eventId, open, onOpenChange }: RecordArrivalsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Arrivals for {table.name}</DialogTitle>
          <DialogDescription>
            {table.arrived} of {table.seats} arrived
            {table.over > 0 ? ` · ${table.over} over` : ` · ${table.remaining} remaining`}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the count always starts from the current state. */}
        <ArrivalsForm table={table} eventId={eventId} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ArrivalsForm({
  table,
  eventId,
  onDone,
}: {
  table: TableWithStatus;
  eventId: string;
  onDone: () => void;
}) {
  const [value, setValue] = useState(String(table.remaining || 1));
  const [loading, setLoading] = useState(false);

  const count = /^\d+$/.test(value.trim()) ? Number.parseInt(value, 10) : 0;
  const overAfter = Math.max(0, table.arrived + count - table.seats);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (count < 1) return;

    setLoading(true);
    try {
      const applied = await recordTableArrival(table.id, eventId, count);
      const arrived = table.arrived + applied;
      if (overAfter > 0) {
        toast.warning(`${table.name} is ${overAfter} over capacity (${arrived} / ${table.seats})`);
      } else {
        toast.success(`+${applied} at ${table.name} (${arrived} / ${table.seats})`);
      }
      onDone();
    } catch (error) {
      toast.error("Failed to record arrivals");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="arrivalCount">People arriving now</Label>
          <Input
            id="arrivalCount"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="h-14 text-center text-2xl font-bold md:text-2xl"
            autoFocus
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick counts">
          {QUICK_COUNTS.map((n) => (
            <Button
              key={n}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={count === n}
              className={cn(count === n && "bg-secondary text-secondary-foreground")}
              onClick={() => setValue(String(n))}
            >
              +{n}
            </Button>
          ))}
          {table.remaining > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={count === table.remaining}
              className={cn(count === table.remaining && "bg-secondary text-secondary-foreground")}
              onClick={() => setValue(String(table.remaining))}
            >
              All remaining ({table.remaining})
            </Button>
          )}
        </div>
        {overAfter > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-orange-500/10 p-3 text-sm text-orange-600 dark:text-orange-400">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            <span>
              {table.name} will be {overAfter} over capacity.
            </span>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || count < 1}>
          {loading ? "Saving..." : `Add ${count || ""}`}
        </Button>
      </DialogFooter>
    </form>
  );
}

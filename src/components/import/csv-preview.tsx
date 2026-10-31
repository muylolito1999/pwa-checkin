"use client";

import { ArrowLeftRight, CircleAlert, CircleCheck, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CanonicalField, ParsedGuestList, RawCsvRow } from "@/lib/csv/parse";
import type { CsvValidationError } from "@/types";

interface CsvPreviewProps {
  parsed: ParsedGuestList;
  /** Rows after the first/last split, in the orientation currently chosen. */
  rows: RawCsvRow[];
  errors: CsvValidationError[];
  duplicateRows: Set<number>;
  swap: boolean;
  onSwapChange: (swap: boolean) => void;
  maxRows?: number;
}

const OPTIONAL_COLUMNS: Array<{ field: CanonicalField; label: string }> = [
  { field: "group", label: "Group" },
  { field: "phone", label: "Phone" },
  { field: "notes", label: "Notes" },
  { field: "ticket_code", label: "Ticket" },
];

const DELIMITER_LABELS: Record<string, string> = {
  ",": "comma-separated",
  ";": "semicolon-separated",
  "\t": "tab-separated",
  "|": "pipe-separated",
};

export function CsvPreview({
  parsed,
  rows,
  errors,
  duplicateRows,
  swap,
  onSwapChange,
  maxRows = 10,
}: CsvPreviewProps) {
  const errorMap = new Map<number, CsvValidationError[]>();
  for (const error of errors) {
    const list = errorMap.get(error.row);
    if (list) list.push(error);
    else errorMap.set(error.row, [error]);
  }
  const rowsWithErrors = errorMap.size;
  const validRows = rows.length - rowsWithErrors;
  const optionalColumns = OPTIONAL_COLUMNS.filter((column) => parsed.columns[column.field] !== undefined);

  return (
    <div className="space-y-4">
      {/* What we detected and how many rows are usable */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {parsed.mode === "list"
            ? "Name list · one per line"
            : `CSV with header · ${DELIMITER_LABELS[parsed.delimiter] ?? "custom delimiter"}`}
        </Badge>
        <Badge variant="outline">{rows.length} rows</Badge>
        <Badge variant="outline" className="text-green-600">
          {validRows} valid
        </Badge>
        {rowsWithErrors > 0 && <Badge variant="destructive">{rowsWithErrors} with errors</Badge>}
        {duplicateRows.size > 0 && (
          <Badge variant="outline" className="text-yellow-600">
            {duplicateRows.size} duplicate{duplicateRows.size > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {parsed.swappable && (
        <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Names are read as &ldquo;First Last&rdquo; (or &ldquo;Last, First&rdquo; with a comma).
            Swap them if they come out reversed.
          </p>
          <Button
            type="button"
            variant={swap ? "default" : "outline"}
            size="sm"
            aria-pressed={swap}
            onClick={() => onSwapChange(!swap)}
            className="shrink-0 gap-2"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Swap first/last name
          </Button>
        </div>
      )}

      {parsed.nameSource === "none" && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <CircleAlert className="h-4 w-4 shrink-0" />
          No name column found. Use first_name and last_name (nome / cognome), or a single
          full-name column such as nominativo.
        </div>
      )}

      {/* Preview table with the resolved names */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>First name</TableHead>
              <TableHead>Last name</TableHead>
              {optionalColumns.map((column) => (
                <TableHead key={column.field}>{column.label}</TableHead>
              ))}
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, maxRows).map((row, index) => {
              const rowErrors = errorMap.get(index + 1);
              const isDuplicate = duplicateRows.has(index);
              return (
                <TableRow
                  key={index}
                  className={rowErrors ? "bg-destructive/5" : isDuplicate ? "bg-yellow-500/5" : ""}
                >
                  <TableCell className="font-mono text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{row.first_name || "–"}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{row.last_name || "–"}</TableCell>
                  {optionalColumns.map((column) => (
                    <TableCell key={column.field} className="max-w-[150px] truncate">
                      {row[column.field] || "–"}
                    </TableCell>
                  ))}
                  <TableCell>
                    {rowErrors ? (
                      <Badge variant="destructive" className="gap-1">
                        <CircleAlert className="h-3 w-3" />
                        {rowErrors.length} error{rowErrors.length > 1 ? "s" : ""}
                      </Badge>
                    ) : isDuplicate ? (
                      <Badge variant="outline" className="gap-1 text-yellow-600">
                        <Copy className="h-3 w-3" />
                        Duplicate
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-green-600">
                        <CircleCheck className="h-3 w-3" />
                        Valid
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {rows.length > maxRows && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {maxRows} of {rows.length} rows
        </p>
      )}

      <CsvErrorList errors={errors} />
    </div>
  );
}

export function CsvErrorList({ errors }: { errors: CsvValidationError[] }) {
  if (errors.length === 0) return null;

  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <h4 className="font-medium text-destructive mb-2">Validation Errors ({errors.length})</h4>
      <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
        {errors.slice(0, 10).map((error, i) => (
          <li key={i} className="text-destructive/80">
            Row {error.row}: {error.field} - {error.message}
          </li>
        ))}
        {errors.length > 10 && (
          <li className="text-destructive/80">...and {errors.length - 10} more errors</li>
        )}
      </ul>
    </div>
  );
}

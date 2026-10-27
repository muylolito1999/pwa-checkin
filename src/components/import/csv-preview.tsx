"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CircleAlert, CircleCheck } from "lucide-react";
import { normalizeHeader, type RawCsvRow } from "@/lib/csv/parser";
import type { CsvValidationError } from "@/types";

interface CsvPreviewProps {
  data: RawCsvRow[];
  headers: string[];
  errors: CsvValidationError[];
  maxRows?: number;
}

export function CsvPreview({
  data,
  headers,
  errors,
  maxRows = 10,
}: CsvPreviewProps) {
  const previewData = data.slice(0, maxRows);
  const errorMap = new Map<number, CsvValidationError[]>();

  errors.forEach((error) => {
    const existing = errorMap.get(error.row) || [];
    existing.push(error);
    errorMap.set(error.row, existing);
  });

  const expectedHeaders = [
    "first_name",
    "last_name",
    "group",
    "phone",
    "notes",
    "ticket_code",
  ];

  const normalizedHeaders = headers.map(normalizeHeader);
  const hasRequiredHeaders =
    normalizedHeaders.includes("first_name") && normalizedHeaders.includes("last_name");

  return (
    <div className="space-y-4">
      {/* Header validation */}
      <div className="flex flex-wrap gap-2">
        {expectedHeaders.map((expected) => {
          const found = normalizedHeaders.includes(expected);
          const isRequired = expected === "first_name" || expected === "last_name";

          return (
            <Badge
              key={expected}
              variant={found ? "default" : isRequired ? "destructive" : "secondary"}
              className="gap-1"
            >
              {found ? (
                <CircleCheck className="h-3 w-3" />
              ) : (
                <CircleAlert className="h-3 w-3" />
              )}
              {expected}
            </Badge>
          );
        })}
      </div>

      {!hasRequiredHeaders && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <CircleAlert className="h-4 w-4" />
          Missing required columns: first_name and/or last_name
        </div>
      )}

      {/* Preview table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              {headers.slice(0, 6).map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewData.map((row, index) => {
              const rowErrors = errorMap.get(index + 1);
              return (
                <TableRow
                  key={index}
                  className={rowErrors ? "bg-destructive/5" : ""}
                >
                  <TableCell className="font-mono text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  {headers.slice(0, 6).map((header) => (
                    <TableCell key={header} className="max-w-[150px] truncate">
                      {row[header] || "-"}
                    </TableCell>
                  ))}
                  <TableCell>
                    {rowErrors ? (
                      <Badge variant="destructive" className="gap-1">
                        <CircleAlert className="h-3 w-3" />
                        {rowErrors.length} error{rowErrors.length > 1 ? "s" : ""}
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

      {data.length > maxRows && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {maxRows} of {data.length} rows
        </p>
      )}

      {/* Error summary */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <h4 className="font-medium text-destructive mb-2">
            Validation Errors ({errors.length})
          </h4>
          <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
            {errors.slice(0, 10).map((error, i) => (
              <li key={i} className="text-destructive/80">
                Row {error.row}: {error.field} - {error.message}
              </li>
            ))}
            {errors.length > 10 && (
              <li className="text-destructive/80">
                ...and {errors.length - 10} more errors
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

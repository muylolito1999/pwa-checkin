"use client";

import { useState, useCallback } from "react";
import { Download, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CsvDropzone } from "@/components/import/csv-dropzone";
import { CsvPreview } from "@/components/import/csv-preview";
import {
  parseCsvFile,
  validateCsvRows,
  importCsvToDatabase,
  generateSampleCsv,
} from "@/lib/csv/parser";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";
import type { CsvValidationError } from "@/types";

interface RawCsvRow {
  [key: string]: string;
}

type ImportState = "idle" | "preview" | "importing" | "done";

export default function ImportPage() {
  const { session } = useSession();
  const eventId = session?.eventId ?? "";

  const [state, setState] = useState<ImportState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<RawCsvRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<CsvValidationError[]>([]);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    imported: number;
    updated: number;
  } | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    setState("preview");

    const { data, headers, errors } = await parseCsvFile(file);

    if (errors.length > 0) {
      toast.error(`Parse errors: ${errors.join(", ")}`);
    }

    setCsvData(data);
    setCsvHeaders(headers);

    const { errors: validationErrs } = validateCsvRows(data);
    setValidationErrors(validationErrs);
  }, []);

  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setValidationErrors([]);
    setProgress(0);
    setImportResult(null);
    setState("idle");
  }, []);

  const handleImport = useCallback(async () => {
    if (!eventId || csvData.length === 0) return;

    setState("importing");
    setProgress(0);

    try {
      const result = await importCsvToDatabase(csvData, eventId, (current, total) => {
        setProgress(Math.round((current / total) * 100));
      });

      setImportResult({ imported: result.imported, updated: result.updated });
      setValidationErrors(result.errors);
      setState("done");

      if (result.success) {
        toast.success(
          `Imported ${result.imported} new guests, updated ${result.updated} existing`
        );
      } else {
        toast.warning(
          `Import completed with ${result.errors.length} errors`
        );
      }
    } catch (error) {
      toast.error("Import failed");
      console.error(error);
      setState("preview");
    }
  }, [eventId, csvData]);

  const handleDownloadSample = useCallback(() => {
    const csv = generateSampleCsv();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample-guests.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Guests</h1>
        <p className="text-muted-foreground">
          Upload a CSV file to add or update guests
        </p>
      </div>

      {state === "idle" && (
        <div className="space-y-4">
          <CsvDropzone
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            onClear={handleClear}
          />

          <div className="flex justify-center">
            <Button variant="ghost" onClick={handleDownloadSample}>
              <Download className="mr-2 h-4 w-4" />
              Download Sample CSV
            </Button>
          </div>

          <div className="rounded-lg border p-4 bg-muted/30">
            <h3 className="font-medium mb-2">Expected Columns</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                <span className="font-mono">first_name</span> - Required
              </li>
              <li>
                <span className="font-mono">last_name</span> - Required
              </li>
              <li>
                <span className="font-mono">group</span> - Guest category (VIP,
                Staff, etc.)
              </li>
              <li>
                <span className="font-mono">phone</span> - Phone number
              </li>
              <li>
                <span className="font-mono">notes</span> - Additional notes
              </li>
              <li>
                <span className="font-mono">ticket_code</span> - Ticket
                identifier
              </li>
            </ul>
          </div>
        </div>
      )}

      {state === "preview" && (
        <div className="space-y-4">
          <CsvDropzone
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            onClear={handleClear}
          />

          <CsvPreview
            data={csvData}
            headers={csvHeaders}
            errors={validationErrors}
          />

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleClear}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={csvData.length === 0}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import {csvData.length} Guests
            </Button>
          </div>
        </div>
      )}

      {state === "importing" && (
        <div className="space-y-4 text-center py-8">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <div>
            <p className="text-lg font-medium">Importing guests...</p>
            <p className="text-muted-foreground">{progress}% complete</p>
          </div>
          <Progress value={progress} className="max-w-xs mx-auto" />
        </div>
      )}

      {state === "done" && importResult && (
        <div className="space-y-4">
          <div className="rounded-lg border p-6 text-center bg-green-500/10">
            <h3 className="text-xl font-semibold text-green-600 mb-2">
              Import Complete!
            </h3>
            <p className="text-muted-foreground">
              Added {importResult.imported} new guests, updated{" "}
              {importResult.updated} existing
            </p>
          </div>

          {validationErrors.length > 0 && (
            <CsvPreview
              data={[]}
              headers={[]}
              errors={validationErrors}
            />
          )}

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={handleClear}>
              Import Another
            </Button>
            <Button onClick={() => (window.location.href = "/guests")}>
              View Guests
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

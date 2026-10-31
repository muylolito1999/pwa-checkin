"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, Download, FileText, LoaderCircle, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CsvDropzone } from "@/components/import/csv-dropzone";
import { CsvErrorList, CsvPreview } from "@/components/import/csv-preview";
import { PasteArea } from "@/components/import/paste-area";
import {
  generateSampleCsv,
  importCsvToDatabase,
  parseGuestFile,
  parseGuestInput,
  validateCsvRows,
} from "@/lib/csv/parser";
import { findDuplicateRows, resolveGuestRows, type ParsedGuestList } from "@/lib/csv/parse";
import { useSession } from "@/hooks/use-session";
import type { CsvImportResult } from "@/types";

type ImportState = "idle" | "preview" | "importing" | "done";
type InputMode = "file" | "paste";
type ImportSource =
  | { kind: "file"; name: string; size: number }
  | { kind: "paste"; lines: number };

export default function ImportPage() {
  const router = useRouter();
  const { session } = useSession();
  const eventId = session?.eventId ?? "";

  const [state, setState] = useState<ImportState>("idle");
  const [inputMode, setInputMode] = useState<InputMode>("file");
  const [pasteText, setPasteText] = useState("");
  const [source, setSource] = useState<ImportSource | null>(null);
  const [parsed, setParsed] = useState<ParsedGuestList | null>(null);
  const [swap, setSwap] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);

  // The split and validation are cheap and pure, so flipping the swap toggle
  // re-derives everything without touching the file again.
  const rows = useMemo(() => (parsed ? resolveGuestRows(parsed, { swap }) : []), [parsed, swap]);
  const validation = useMemo(() => validateCsvRows(rows), [rows]);
  const duplicateRows = useMemo(() => findDuplicateRows(rows), [rows]);

  const showParsed = useCallback((result: ParsedGuestList, newSource: ImportSource) => {
    setParsed(result);
    setSource(newSource);
    setSwap(result.suggestedSwap);
    setImportResult(null);
    setState("preview");

    if (result.errors.length > 0) {
      const shown = result.errors.slice(0, 3).join("; ");
      const more = result.errors.length > 3 ? ` (+${result.errors.length - 3} more)` : "";
      toast.warning(`Parse warnings: ${shown}${more}`);
    }
    if (result.rows.length === 0) {
      toast.error("No names found");
    }
  }, []);

  const handleFileSelect = useCallback(
    async (file: File) => {
      try {
        const result = await parseGuestFile(file);
        showParsed(result, { kind: "file", name: file.name, size: file.size });
      } catch (error) {
        console.error(error);
        toast.error("Could not read this file");
      }
    },
    [showParsed]
  );

  const handlePasteContinue = useCallback(() => {
    const result = parseGuestInput(pasteText);
    showParsed(result, { kind: "paste", lines: result.rows.length });
  }, [pasteText, showParsed]);

  // Back to the input step. The pasted text is kept so a typo can be fixed.
  const resetPreview = useCallback(() => {
    setParsed(null);
    setSource(null);
    setSwap(false);
    setProgress(0);
    setImportResult(null);
    setState("idle");
  }, []);

  const handleImportAnother = useCallback(() => {
    resetPreview();
    setPasteText("");
  }, [resetPreview]);

  const handleImport = useCallback(async () => {
    if (!eventId || validation.valid === 0) return;

    setState("importing");
    setProgress(0);

    try {
      const result = await importCsvToDatabase(rows, eventId, (current, total) => {
        setProgress(total === 0 ? 100 : Math.round((current / total) * 100));
      });

      setImportResult(result);
      setState("done");

      if (result.success) {
        toast.success(`Imported ${result.imported} new guests, updated ${result.updated} existing`);
      } else {
        toast.warning(`Import completed with ${result.errors.length} errors`);
      }
    } catch (error) {
      toast.error("Import failed");
      console.error(error);
      setState("preview");
    }
  }, [eventId, rows, validation.valid]);

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
          Upload a file or paste a list of names to add or update guests
        </p>
      </div>

      {state === "idle" && (
        <div className="space-y-4">
          <Tabs value={inputMode} onValueChange={(value) => setInputMode(value as InputMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload file
              </TabsTrigger>
              <TabsTrigger value="paste" className="gap-2">
                <ClipboardPaste className="h-4 w-4" />
                Paste names
              </TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="space-y-4">
              <CsvDropzone onFileSelect={handleFileSelect} />
              <div className="flex justify-center">
                <Button variant="ghost" onClick={handleDownloadSample}>
                  <Download className="mr-2 h-4 w-4" />
                  Download sample CSV
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="paste">
              <PasteArea value={pasteText} onChange={setPasteText} onContinue={handlePasteContinue} />
            </TabsContent>
          </Tabs>

          <div className="rounded-lg border p-4 bg-muted/30 text-sm space-y-3">
            <div>
              <h3 className="font-medium mb-1">Plain list</h3>
              <p className="text-muted-foreground">
                One guest per line, first name then surname:{" "}
                <span className="font-mono">Mario Rossi</span>.{" "}
                <span className="font-mono">Rossi, Mario</span> works too. A single word is a guest
                without a surname.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-1">CSV or spreadsheet export</h3>
              <p className="text-muted-foreground">
                A header row with <span className="font-mono">first_name</span> and{" "}
                <span className="font-mono">last_name</span> (<span className="font-mono">nome</span> /{" "}
                <span className="font-mono">cognome</span>, or one{" "}
                <span className="font-mono">nominativo</span> column), plus optional{" "}
                <span className="font-mono">group</span>, <span className="font-mono">phone</span>,{" "}
                <span className="font-mono">notes</span>, <span className="font-mono">ticket_code</span>.
                Comma, semicolon or tab separated; UTF-8 or Windows encoding.
              </p>
            </div>
            <p className="text-muted-foreground">Re-importing updates existing guests by name.</p>
          </div>
        </div>
      )}

      {state === "preview" && parsed && source && (
        <div className="space-y-4">
          <SourceChip source={source} onClear={resetPreview} />

          <CsvPreview
            parsed={parsed}
            rows={rows}
            errors={validation.errors}
            duplicateRows={duplicateRows}
            swap={swap}
            onSwapChange={setSwap}
          />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={resetPreview}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={validation.valid === 0}>
              <Upload className="mr-2 h-4 w-4" />
              Import {validation.valid} {validation.valid === 1 ? "guest" : "guests"}
            </Button>
          </div>
        </div>
      )}

      {state === "importing" && (
        <div className="space-y-4 text-center py-8">
          <LoaderCircle className="h-12 w-12 animate-spin mx-auto text-primary" />
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
            <h3 className="text-xl font-semibold text-green-600 mb-2">Import Complete!</h3>
            <p className="text-muted-foreground">
              Added {importResult.imported} new guests, updated {importResult.updated} existing
              {importResult.duplicates > 0
                ? `, skipped ${importResult.duplicates} duplicate ${importResult.duplicates === 1 ? "line" : "lines"}`
                : ""}
            </p>
          </div>

          <CsvErrorList errors={importResult.errors} />

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={handleImportAnother}>
              Import Another
            </Button>
            <Button onClick={() => router.push("/guests")}>View Guests</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SourceChip({ source, onClear }: { source: ImportSource; onClear: () => void }) {
  const Icon = source.kind === "file" ? FileText : ClipboardPaste;
  const title = source.kind === "file" ? source.name : "Pasted text";
  const detail =
    source.kind === "file"
      ? `${(source.size / 1024).toFixed(1)} KB`
      : `${source.lines} ${source.lines === 1 ? "line" : "lines"}`;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-4 bg-muted/50">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-8 w-8 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{detail}</p>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onClear} aria-label="Discard and start over">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

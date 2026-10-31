"use client";

import { useCallback, useId, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CsvDropzoneProps {
  onFileSelect: (file: File) => void;
}

const ACCEPTED_EXTENSIONS = new Set(["csv", "txt", "tsv"]);
// MIME types vary by OS and browser; some systems send none at all.
const ACCEPTED_TYPES = new Set([
  "text/csv",
  "text/plain",
  "text/tab-separated-values",
  "application/csv",
  "application/vnd.ms-excel",
  "",
]);

export function isAcceptedFile(file: File): boolean {
  const dot = file.name.lastIndexOf(".");
  const extension = dot === -1 ? "" : file.name.slice(dot + 1).toLowerCase();
  if (extension) return ACCEPTED_EXTENSIONS.has(extension);
  return ACCEPTED_TYPES.has(file.type);
}

export function CsvDropzone({ onFileSelect }: CsvDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputId = useId();

  const accept = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!isAcceptedFile(file)) {
        toast.error("Only .csv, .tsv or .txt files are supported");
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect]
  );

  return (
    // The whole area is the label, so tapping anywhere opens the file picker.
    <label
      htmlFor={inputId}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        accept(e.dataTransfer.files[0]);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-8 text-center transition-colors sm:p-12",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        isDragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      )}
    >
      <Upload className={cn("h-12 w-12", isDragOver ? "text-primary" : "text-muted-foreground")} />
      <div>
        <p className="text-lg font-medium">Drop a CSV or text file here</p>
        <p className="text-sm text-muted-foreground">or tap to choose a file</p>
      </div>
      <Button variant="outline" asChild>
        <span>Choose file</span>
      </Button>
      <input
        id={inputId}
        type="file"
        accept=".csv,.txt,.tsv,text/csv,text/plain,text/tab-separated-values"
        className="sr-only"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          // Allow picking the same file again after a cancel.
          e.target.value = "";
        }}
      />
    </label>
  );
}

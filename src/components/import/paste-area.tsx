"use client";

import { ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface PasteAreaProps {
  value: string;
  onChange: (value: string) => void;
  onContinue: () => void;
}

export function PasteArea({ value, onChange, onContinue }: PasteAreaProps) {
  const lineCount = value.split("\n").filter((line) => line.trim() !== "").length;

  return (
    <div className="space-y-3">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        placeholder={"Mario Rossi\nGiulia Bianchi\nRossi, Luca"}
        className="min-h-48 font-mono text-sm"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Guest names, one per line"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {lineCount === 1 ? "1 line" : `${lineCount} lines`}
        </p>
        <Button onClick={onContinue} disabled={lineCount === 0}>
          <ClipboardPaste className="mr-2 h-4 w-4" />
          Preview
        </Button>
      </div>
    </div>
  );
}

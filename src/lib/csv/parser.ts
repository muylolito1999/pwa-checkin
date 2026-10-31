import { csvRowSchema, type CsvRowOutput } from "@/schemas";
import { db, generateGuestId, generateStableKey } from "@/lib/db";
import { addToOutbox } from "@/lib/sync/outbox";
import { cleanText, decodeTextFile } from "@/lib/csv/clean";
import { parseGuestText, titleCase, type ParsedGuestList, type RawCsvRow } from "@/lib/csv/parse";
import type { CsvValidationError, CsvImportResult, LocalGuest } from "@/types";

/** Rows per Dexie transaction during import. */
const IMPORT_CHUNK_SIZE = 200;

/**
 * Decodes an uploaded file (UTF-8, falling back to Windows-1252), cleans it and
 * parses it as either a CSV with a header row or a plain list of names.
 */
export async function parseGuestFile(file: File): Promise<ParsedGuestList> {
  return parseGuestText(cleanText(decodeTextFile(await file.arrayBuffer())));
}

/** Same pipeline for text pasted into the import page. */
export function parseGuestInput(text: string): ParsedGuestList {
  return parseGuestText(cleanText(text));
}

function validateRows(rows: RawCsvRow[]): {
  valid: Array<{ index: number; data: CsvRowOutput }>;
  errors: CsvValidationError[];
} {
  const valid: Array<{ index: number; data: CsvRowOutput }> = [];
  const errors: CsvValidationError[] = [];

  rows.forEach((row, index) => {
    const result = csvRowSchema.safeParse(row);
    if (result.success) {
      valid.push({ index, data: result.data });
    } else {
      for (const issue of result.error.issues) {
        errors.push({ row: index + 1, field: issue.path.join("."), message: issue.message });
      }
    }
  });

  return { valid, errors };
}

export function validateCsvRows(rows: RawCsvRow[]): {
  valid: CsvImportResult["imported"];
  errors: CsvValidationError[];
} {
  const { valid, errors } = validateRows(rows);
  return { valid: valid.length, errors };
}

export async function importCsvToDatabase(
  rows: RawCsvRow[],
  eventId: string,
  onProgress?: (current: number, total: number) => void
): Promise<CsvImportResult> {
  const { valid, errors } = validateRows(rows);

  // The same name twice in one file is one guest: the first occurrence wins.
  const seen = new Set<string>();
  const unique: Array<{ data: CsvRowOutput; stableKey: string }> = [];
  let duplicates = 0;
  for (const { data } of valid) {
    const stableKey = generateStableKey(data.last_name, data.first_name);
    if (seen.has(stableKey)) {
      duplicates++;
      continue;
    }
    seen.add(stableKey);
    unique.push({ data, stableKey });
  }

  let imported = 0;
  let updated = 0;

  for (let start = 0; start < unique.length; start += IMPORT_CHUNK_SIZE) {
    const chunk = unique.slice(start, start + IMPORT_CHUNK_SIZE);

    // One transaction per chunk: a row and its outbox entry always land together.
    await db.transaction("rw", db.guests, db.outbox, async () => {
      for (const { data, stableKey } of chunk) {
        const now = new Date().toISOString();
        const existing = await db.guests.where({ event_id: eventId, stable_key: stableKey }).first();

        if (existing) {
          const updatedGuest: LocalGuest = {
            ...existing,
            first_name: titleCase(data.first_name),
            last_name: titleCase(data.last_name),
            notes: data.notes,
            phone: data.phone,
            group: data.group,
            ticket_code: data.ticket_code,
            is_deleted: false,
            updated_at: now,
            _pending_sync: true,
          };
          await db.guests.put(updatedGuest);
          await addToOutbox("UPDATE", "guests", updatedGuest as unknown as Record<string, unknown>);
          updated++;
        } else {
          const newGuest: LocalGuest = {
            id: generateGuestId(eventId, stableKey),
            event_id: eventId,
            first_name: titleCase(data.first_name),
            last_name: titleCase(data.last_name),
            notes: data.notes,
            phone: data.phone,
            group: data.group,
            ticket_code: data.ticket_code,
            stable_key: stableKey,
            is_deleted: false,
            created_at: now,
            updated_at: now,
            _pending_sync: true,
          };
          await db.guests.add(newGuest);
          await addToOutbox("CREATE", "guests", newGuest as unknown as Record<string, unknown>);
          imported++;
        }
      }
    });

    onProgress?.(Math.min(start + IMPORT_CHUNK_SIZE, unique.length), unique.length);
  }

  return {
    success: errors.length === 0,
    imported,
    updated,
    duplicates,
    errors,
  };
}

export function generateSampleCsv(): string {
  const headers = ["last_name", "first_name", "group", "phone", "notes", "ticket_code"];
  const rows = [
    ["Rossi", "Mario", "VIP", "3331234567", "Plus one", "TKT001"],
    ["Bianchi", "Lucia", "Staff", "", "Event coordinator", "TKT002"],
    ["Verdi", "Giuseppe", "General", "3339876543", "", "TKT003"],
  ];

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

import Papa from "papaparse";
import { csvRowSchema, type CsvRowOutput } from "@/schemas";
import { db, generateGuestId, generateStableKey } from "@/lib/db";
import { addToOutbox } from "@/lib/sync/outbox";
import type { CsvValidationError, CsvImportResult, LocalGuest } from "@/types";

export interface RawCsvRow {
  [key: string]: string;
}

/** Rows per Dexie transaction during import. */
const IMPORT_CHUNK_SIZE = 200;

// Normalize header names to match our expected format
export function normalizeHeader(header: string): string {
  const normalized = header.toLowerCase().trim().replace(/[\s_-]+/g, "_");

  // Common aliases
  const aliases: Record<string, string> = {
    nome: "first_name",
    cognome: "last_name",
    name: "first_name",
    surname: "last_name",
    lastname: "last_name",
    firstname: "first_name",
    first: "first_name",
    last: "last_name",
    telefono: "phone",
    tel: "phone",
    telephone: "phone",
    mobile: "phone",
    gruppo: "group",
    categoria: "group",
    category: "group",
    note: "notes",
    ticket: "ticket_code",
    code: "ticket_code",
    codice: "ticket_code",
  };

  return aliases[normalized] || normalized;
}

// Normalize row data to expected structure
function normalizeRow(row: RawCsvRow): RawCsvRow {
  const normalized: RawCsvRow = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeHeader(key)] = value;
  }
  return normalized;
}

/** Title-cases a name, including accented letters and parts after apostrophes/hyphens. */
export function titleCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase());
}

export async function parseCsvFile(file: File): Promise<{
  data: RawCsvRow[];
  headers: string[];
  errors: string[];
}> {
  return new Promise((resolve) => {
    Papa.parse<RawCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const errors = results.errors.map((e) => `Row ${e.row}: ${e.message}`);
        resolve({
          data: results.data,
          headers: results.meta.fields || [],
          errors,
        });
      },
      error: (error) => {
        resolve({ data: [], headers: [], errors: [error.message] });
      },
    });
  });
}

function validateRows(rows: RawCsvRow[]): {
  valid: Array<{ index: number; data: CsvRowOutput }>;
  errors: CsvValidationError[];
} {
  const valid: Array<{ index: number; data: CsvRowOutput }> = [];
  const errors: CsvValidationError[] = [];

  rows.forEach((row, index) => {
    const result = csvRowSchema.safeParse(normalizeRow(row));
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
  let imported = 0;
  let updated = 0;

  for (let start = 0; start < valid.length; start += IMPORT_CHUNK_SIZE) {
    const chunk = valid.slice(start, start + IMPORT_CHUNK_SIZE);

    // One transaction per chunk: a row and its outbox entry always land together.
    await db.transaction("rw", db.guests, db.outbox, async () => {
      for (const { data } of chunk) {
        const stableKey = generateStableKey(data.last_name, data.first_name);
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

    onProgress?.(Math.min(start + IMPORT_CHUNK_SIZE, valid.length), valid.length);
  }

  return {
    success: errors.length === 0,
    imported,
    updated,
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

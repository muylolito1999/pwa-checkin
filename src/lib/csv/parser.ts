import Papa from "papaparse";
import { csvRowSchema } from "@/schemas";
import { generateStableKey, generateId, db } from "@/lib/db";
import type { CsvValidationError, CsvImportResult, LocalGuest } from "@/types";

interface RawCsvRow {
  [key: string]: string;
}

// Normalize header names to match our expected format
function normalizeHeader(header: string): string {
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
    const normalizedKey = normalizeHeader(key);
    normalized[normalizedKey] = value;
  }
  return normalized;
}

// Title case a name
function titleCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
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
        const errors = results.errors.map(
          (e) => `Row ${e.row}: ${e.message}`
        );
        resolve({
          data: results.data,
          headers: results.meta.fields || [],
          errors,
        });
      },
      error: (error) => {
        resolve({
          data: [],
          headers: [],
          errors: [error.message],
        });
      },
    });
  });
}

export function validateCsvRows(
  rows: RawCsvRow[]
): { valid: CsvImportResult["imported"]; errors: CsvValidationError[] } {
  const errors: CsvValidationError[] = [];
  let valid = 0;

  rows.forEach((row, index) => {
    const normalized = normalizeRow(row);
    const result = csvRowSchema.safeParse(normalized);

    if (!result.success) {
      result.error.issues.forEach((err) => {
        errors.push({
          row: index + 1,
          field: err.path.join("."),
          message: err.message,
        });
      });
    } else {
      valid++;
    }
  });

  return { valid, errors };
}

export async function importCsvToDatabase(
  rows: RawCsvRow[],
  eventId: string,
  onProgress?: (current: number, total: number) => void
): Promise<CsvImportResult> {
  const errors: CsvValidationError[] = [];
  let imported = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = normalizeRow(rows[i]);
    const result = csvRowSchema.safeParse(row);

    if (!result.success) {
      result.error.issues.forEach((err) => {
        errors.push({
          row: i + 1,
          field: err.path.join("."),
          message: err.message,
        });
      });
      continue;
    }

    const data = result.data;
    const stableKey = generateStableKey(data.last_name, data.first_name);
    const now = new Date().toISOString();

    // Check for existing guest with same stable_key
    const existing = await db.guests
      .where({ event_id: eventId, stable_key: stableKey })
      .first();

    if (existing) {
      // Update existing guest
      await db.guests.update(existing.id, {
        first_name: titleCase(data.first_name),
        last_name: titleCase(data.last_name),
        notes: data.notes,
        phone: data.phone,
        group: data.group,
        ticket_code: data.ticket_code,
        is_deleted: false,
        updated_at: now,
        _pending_sync: true,
      });
      updated++;
    } else {
      // Insert new guest
      const newGuest: LocalGuest = {
        id: generateId(),
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
      imported++;
    }

    onProgress?.(i + 1, rows.length);
  }

  return {
    success: errors.length === 0,
    imported,
    updated,
    errors,
  };
}

export function generateSampleCsv(): string {
  const headers = [
    "last_name",
    "first_name",
    "group",
    "phone",
    "notes",
    "ticket_code",
  ];
  const rows = [
    ["Rossi", "Mario", "VIP", "3331234567", "Plus one", "TKT001"],
    ["Bianchi", "Lucia", "Staff", "", "Event coordinator", "TKT002"],
    ["Verdi", "Giuseppe", "General", "3339876543", "", "TKT003"],
  ];

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

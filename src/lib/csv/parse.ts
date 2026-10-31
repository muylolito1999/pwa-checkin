/**
 * Turns cleaned text into guest rows. Accepts both a CSV with a header row and
 * a plain list with one name per line.
 *
 * Pure module: imports only papaparse, no DOM, no Dexie, no path aliases, so it
 * runs under `node --test`. Feed it the output of `cleanText()`.
 */
import Papa from "papaparse";

export type CanonicalField =
  | "first_name"
  | "last_name"
  | "full_name"
  | "group"
  | "phone"
  | "notes"
  | "ticket_code";

const CANONICAL_FIELDS: ReadonlySet<string> = new Set<CanonicalField>([
  "first_name",
  "last_name",
  "full_name",
  "group",
  "phone",
  "notes",
  "ticket_code",
]);

const OPTIONAL_FIELDS = ["group", "phone", "notes", "ticket_code"] as const;

/** A row with canonical keys, ready for validation. */
export interface RawCsvRow {
  [key: string]: string;
}

export type GuestListMode = "header" | "list";

/**
 * Where the names come from:
 * - `columns`: explicit first and last name columns
 * - `full_name` / `first_name` / `last_name`: one column holding the full name
 * - `line`: no header, one guest per line
 * - `none`: a header row without any name column
 */
export type NameSource = "columns" | "full_name" | "first_name" | "last_name" | "line" | "none";

/** A parsed row before the name is split; `fullName` is split at resolve time. */
export interface ParsedGuestRow {
  fullName?: string;
  first_name?: string;
  last_name?: string;
  group?: string;
  phone?: string;
  notes?: string;
  ticket_code?: string;
}

export interface ParsedGuestList {
  mode: GuestListMode;
  /** Delimiter papaparse settled on (`,` for a plain list). */
  delimiter: string;
  /** Canonical header names (header mode) or empty. */
  headers: string[];
  /** Column index of each canonical field that was found (header mode). */
  columns: Partial<Record<CanonicalField, number>>;
  nameSource: NameSource;
  /** True when the first/last split is a guess the user may need to flip. */
  swappable: boolean;
  /** True when the header itself says the surname comes first ("Cognome Nome"). */
  suggestedSwap: boolean;
  rows: ParsedGuestRow[];
  /** Real parse errors (an undetectable delimiter is not one). */
  errors: string[];
}

const HEADER_ALIASES: Record<string, CanonicalField> = {
  nome: "first_name",
  name: "first_name",
  firstname: "first_name",
  first: "first_name",
  given_name: "first_name",
  cognome: "last_name",
  surname: "last_name",
  lastname: "last_name",
  last: "last_name",
  family_name: "last_name",
  nominativo: "full_name",
  nome_cognome: "full_name",
  nome_e_cognome: "full_name",
  cognome_nome: "full_name",
  cognome_e_nome: "full_name",
  nome_completo: "full_name",
  full_name: "full_name",
  fullname: "full_name",
  ospite: "full_name",
  guest: "full_name",
  guest_name: "full_name",
  invitato: "full_name",
  partecipante: "full_name",
  telefono: "phone",
  tel: "phone",
  telephone: "phone",
  mobile: "phone",
  cellulare: "phone",
  cell: "phone",
  gruppo: "group",
  categoria: "group",
  category: "group",
  tipo: "group",
  type: "group",
  lista: "group",
  note: "notes",
  nota: "notes",
  comments: "notes",
  ticket: "ticket_code",
  code: "ticket_code",
  codice: "ticket_code",
  biglietto: "ticket_code",
};

// Headers that announce a "Surname Name" column.
const SURNAME_FIRST_HEADERS = new Set([
  "cognome_nome",
  "cognome_e_nome",
  "surname_name",
  "last_first",
  "lastname_firstname",
  "last_name_first_name",
]);

// Surname particles: in a "Surname Name" line, "De Donatis Laura" keeps both words together.
const SURNAME_PARTICLES = new Set([
  "de", "di", "del", "della", "dello", "dei", "degli", "delle", "da", "dal", "dalla",
  "la", "lo", "le", "van", "von", "der", "den", "mc", "mac", "san",
]);

// "1. Mario Rossi", "- Mario Rossi", "• Mario Rossi"
const LIST_MARKER = /^(?:[-\u2013\u2014\u2022*\u00B7]|\(?\d{1,3}[.)])\s+/;

function normalizeHeaderKey(header: string): string {
  return header.toLowerCase().trim().replace(/[\s_-]+/g, "_");
}

/** Maps a header cell to its canonical field name; unknown headers pass through normalised. */
export function normalizeHeader(header: string): string {
  const key = normalizeHeaderKey(header);
  return HEADER_ALIASES[key] ?? key;
}

/** The first row is a header when any cell names a field we know. */
export function detectHeader(cells: string[]): boolean {
  return cells.some((cell) => CANONICAL_FIELDS.has(normalizeHeader(cell)));
}

/** Trims a cell, drops wrapping quotes that survived parsing and collapses inner whitespace. */
export function cleanCell(cell: string): string {
  return cell
    .replace(/^[\s"\u201C\u201D\u201E]+|[\s"\u201C\u201D\u201E]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface NameParts {
  first_name: string;
  last_name: string;
}

/**
 * Splits "Mario Rossi" into first and last name.
 *
 * - "Rossi, Mario" (with a comma) is read as surname first.
 * - Otherwise the first word is the first name and the rest the surname, so
 *   "Laura De Donatis" and "Alexandre Crochemore Ciani" come out right.
 * - A single word is a first name with no surname.
 * - `swap` reverses the reading: comma lines are exchanged, space-separated
 *   lines are read as "Surname Name" (surname particles stay with the surname).
 */
export function splitFullName(fullName: string, options: { swap?: boolean } = {}): NameParts {
  const swap = options.swap ?? false;
  const text = cleanCell(fullName).replace(LIST_MARKER, "");
  if (!text) return { first_name: "", last_name: "" };

  const comma = text.indexOf(",");
  if (comma !== -1) {
    const before = text.slice(0, comma).trim();
    const after = text.slice(comma + 1).split(",")[0].trim();
    return swap
      ? { first_name: before, last_name: after }
      : { first_name: after, last_name: before };
  }

  const tokens = text.split(" ");
  if (tokens.length === 1) return { first_name: tokens[0], last_name: "" };

  if (swap) {
    const surnameWords =
      tokens.length >= 3 && SURNAME_PARTICLES.has(tokens[0].toLowerCase()) ? 2 : 1;
    return {
      last_name: tokens.slice(0, surnameWords).join(" "),
      first_name: tokens.slice(surnameWords).join(" "),
    };
  }

  return { first_name: tokens[0], last_name: tokens.slice(1).join(" ") };
}

/** Title-cases a name, including accented letters and parts after apostrophes/hyphens. */
export function titleCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'\u2019-])(\p{L})/gu, (_, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase());
}

/**
 * Parses cleaned text. Header detection and column mapping happen on the parsed
 * cells, so semicolon and tab files from Excel work the same as comma files.
 */
export function parseGuestText(text: string): ParsedGuestList {
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
    delimiter: "",
    newline: "\n",
    transform: cleanCell,
  });

  // A plain list has no delimiter to detect; papaparse reports that as an error
  // and falls back to ",", which is exactly what we want.
  const errors = result.errors
    .filter((error) => error.code !== "UndetectableDelimiter")
    .map((error) =>
      error.row === undefined ? error.message : `Row ${error.row + 1}: ${error.message}`
    );
  const delimiter = result.meta.delimiter;
  const rows = result.data.filter((cells) => cells.some((cell) => cell !== ""));

  if (rows.length === 0) {
    return {
      mode: "list",
      delimiter,
      headers: [],
      columns: {},
      nameSource: "none",
      swappable: false,
      suggestedSwap: false,
      rows: [],
      errors,
    };
  }

  if (detectHeader(rows[0])) {
    return parseWithHeader(rows, delimiter, errors);
  }
  return parseList(rows, delimiter, errors);
}

function parseWithHeader(rows: string[][], delimiter: string, errors: string[]): ParsedGuestList {
  const headers = rows[0].map(normalizeHeader);
  const columns: Partial<Record<CanonicalField, number>> = {};
  headers.forEach((header, index) => {
    if (CANONICAL_FIELDS.has(header) && columns[header as CanonicalField] === undefined) {
      columns[header as CanonicalField] = index;
    }
  });

  let nameSource: NameSource;
  if (columns.first_name !== undefined && columns.last_name !== undefined) nameSource = "columns";
  else if (columns.full_name !== undefined) nameSource = "full_name";
  else if (columns.first_name !== undefined) nameSource = "first_name";
  else if (columns.last_name !== undefined) nameSource = "last_name";
  else nameSource = "none";

  const headerSaysSurnameFirst = rows[0].some((cell) =>
    SURNAME_FIRST_HEADERS.has(normalizeHeaderKey(cell))
  );

  const cellAt = (cells: string[], field: CanonicalField): string | undefined => {
    const index = columns[field];
    return index === undefined ? undefined : (cells[index] ?? "");
  };

  const dataRows: ParsedGuestRow[] = rows.slice(1).map((cells) => {
    const row: ParsedGuestRow = {};
    switch (nameSource) {
      case "columns":
        row.first_name = cellAt(cells, "first_name");
        row.last_name = cellAt(cells, "last_name");
        break;
      case "full_name":
      case "first_name":
      case "last_name":
        row.fullName = cellAt(cells, nameSource);
        break;
      case "none":
        break;
    }
    for (const field of OPTIONAL_FIELDS) {
      const value = cellAt(cells, field);
      if (value !== undefined) row[field] = value;
    }
    return row;
  });

  return {
    mode: "header",
    delimiter,
    headers,
    columns,
    nameSource,
    // Explicit first/last columns are trusted; a single name column is a guess.
    swappable: nameSource !== "columns" && nameSource !== "none",
    suggestedSwap: headerSaysSurnameFirst || nameSource === "last_name",
    rows: dataRows,
    errors,
  };
}

function parseList(rows: string[][], delimiter: string, errors: string[]): ParsedGuestList {
  const dataRows: ParsedGuestRow[] = rows.map((cells) => {
    const filled = cells.filter((cell) => cell !== "");
    if (filled.length === 1) return { fullName: filled[0] };
    // "Rossi, Mario": a comma between two cells is the surname-first convention.
    // Columns separated by ; or tab come from a spreadsheet: first name, then surname.
    return delimiter === ","
      ? { last_name: filled[0], first_name: filled[1] }
      : { first_name: filled[0], last_name: filled[1] };
  });

  return {
    mode: "list",
    delimiter,
    headers: [],
    columns: {},
    nameSource: "line",
    swappable: true,
    suggestedSwap: false,
    rows: dataRows,
    errors,
  };
}

/**
 * Applies the first/last split (and the user's swap choice) to parsed rows.
 * Cheap and pure, so the preview can re-run it on every toggle without re-parsing.
 * Every row gets both name keys so validation reports "required" rather than "missing".
 */
export function resolveGuestRows(parsed: ParsedGuestList, options: { swap: boolean }): RawCsvRow[] {
  const swap = parsed.swappable && options.swap;

  return parsed.rows.map((row) => {
    let names: NameParts;
    if (row.fullName !== undefined) {
      names = splitFullName(row.fullName, { swap });
    } else {
      const first = row.first_name ?? "";
      const last = row.last_name ?? "";
      names = swap ? { first_name: last, last_name: first } : { first_name: first, last_name: last };
    }

    const resolved: RawCsvRow = { first_name: names.first_name, last_name: names.last_name };
    for (const field of OPTIONAL_FIELDS) {
      const value = row[field];
      if (value !== undefined) resolved[field] = value;
    }
    return resolved;
  });
}

/** Indexes of rows whose name repeats an earlier row (case-insensitive). */
export function findDuplicateRows(rows: RawCsvRow[]): Set<number> {
  const seen = new Set<string>();
  const duplicates = new Set<number>();
  rows.forEach((row, index) => {
    const key = `${row.last_name.trim().toLowerCase()}\u0000${row.first_name.trim().toLowerCase()}`;
    if (key === "\u0000") return;
    if (seen.has(key)) duplicates.add(index);
    else seen.add(key);
  });
  return duplicates;
}

/** "Mario Rossi", or just "Mario" when there is no surname. */
export function formatGuestName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

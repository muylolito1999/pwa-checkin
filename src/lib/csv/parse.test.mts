import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanText, decodeTextFile } from "./clean.ts";
import {
  detectHeader,
  findDuplicateRows,
  formatGuestName,
  normalizeHeader,
  parseGuestText,
  resolveGuestRows,
  splitFullName,
  titleCase,
} from "./parse.ts";

const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const parse = (text: string) => parseGuestText(cleanText(text));
const names = (text: string, swap = false) =>
  resolveGuestRows(parse(text), { swap }).map((r) => [r.first_name, r.last_name]);

test("a Windows-1252 list with one name per line, end to end", () => {
  const bytes = latin1(
    "Elia Zecchini\r\nSara Osti\xA0\r\nAlessandro D\x92Aniello\r\n\r\n   \r\n" +
      "Desir\xE8 Della Corte\r\nLaura De Donatis\r\nAlexandre Crochemore Ciani\r\namica asia\r\nMadonna\r\n"
  );
  const parsed = parseGuestText(cleanText(decodeTextFile(bytes)));

  assert.equal(parsed.mode, "list");
  assert.equal(parsed.nameSource, "line");
  assert.equal(parsed.swappable, true);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.rows.length, 8);

  const rows = resolveGuestRows(parsed, { swap: false });
  assert.deepEqual(rows[1], { first_name: "Sara", last_name: "Osti" });
  assert.deepEqual(rows[2], { first_name: "Alessandro", last_name: "D'Aniello" });
  assert.deepEqual(rows[3], { first_name: "Desirè", last_name: "Della Corte" });
  assert.deepEqual(rows[4], { first_name: "Laura", last_name: "De Donatis" });
  assert.deepEqual(rows[5], { first_name: "Alexandre", last_name: "Crochemore Ciani" });
  assert.deepEqual(rows[6], { first_name: "amica", last_name: "asia" });
  assert.deepEqual(rows[7], { first_name: "Madonna", last_name: "" });
});

test("swap reads a plain list as surname first", () => {
  assert.deepEqual(names("Rossi Mario\nDe Donatis Laura", true), [
    ["Mario", "Rossi"],
    ["Laura", "De Donatis"],
  ]);
});

test("a header CSV keeps explicit columns and optional fields", () => {
  const parsed = parse("last_name,first_name,group,phone,notes,ticket_code\nRossi,Mario,VIP,3331234567,Plus one,TKT001\n");
  assert.equal(parsed.mode, "header");
  assert.equal(parsed.nameSource, "columns");
  assert.equal(parsed.swappable, false);
  assert.deepEqual(resolveGuestRows(parsed, { swap: true }), [
    { first_name: "Mario", last_name: "Rossi", group: "VIP", phone: "3331234567", notes: "Plus one", ticket_code: "TKT001" },
  ]);
});

test("Italian headers with BOM and semicolons", () => {
  const parsed = parse("\uFEFFNome;Cognome;Telefono\nMario;Rossi;333 123 4567\n");
  assert.equal(parsed.mode, "header");
  assert.equal(parsed.delimiter, ";");
  assert.deepEqual(parsed.headers, ["first_name", "last_name", "phone"]);
  assert.deepEqual(resolveGuestRows(parsed, { swap: false }), [
    { first_name: "Mario", last_name: "Rossi", phone: "333 123 4567" },
  ]);
});

test("tab-separated header file", () => {
  const parsed = parse("first_name\tlast_name\nMario\tRossi\n");
  assert.equal(parsed.delimiter, "\t");
  assert.deepEqual(resolveGuestRows(parsed, { swap: false }), [{ first_name: "Mario", last_name: "Rossi" }]);
});

test("a single 'Nome' column holding full names is split", () => {
  const parsed = parse("Nome\nMario Rossi\nLaura De Donatis\n");
  assert.equal(parsed.mode, "header");
  assert.equal(parsed.nameSource, "first_name");
  assert.equal(parsed.swappable, true);
  assert.deepEqual(resolveGuestRows(parsed, { swap: false }), [
    { first_name: "Mario", last_name: "Rossi" },
    { first_name: "Laura", last_name: "De Donatis" },
  ]);
  assert.deepEqual(resolveGuestRows(parsed, { swap: true })[0], { first_name: "Rossi", last_name: "Mario" });
});

test("full-name header aliases", () => {
  for (const header of ["Nominativo", "Full Name", "Nome e Cognome", "nome-completo", "Ospite"]) {
    assert.equal(normalizeHeader(header), "full_name", header);
    assert.equal(parse(`${header}\nMario Rossi`).nameSource, "full_name", header);
  }
});

test("'Cognome Nome' header suggests swapping", () => {
  const parsed = parse("Cognome Nome\nRossi Mario\n");
  assert.equal(parsed.suggestedSwap, true);
  assert.deepEqual(resolveGuestRows(parsed, { swap: true }), [{ first_name: "Mario", last_name: "Rossi" }]);
});

test("a header without any name column", () => {
  const parsed = parse("phone,notes\n333,hi\n");
  assert.equal(parsed.mode, "header");
  assert.equal(parsed.nameSource, "none");
  assert.equal(parsed.swappable, false);
  assert.deepEqual(resolveGuestRows(parsed, { swap: false }), [{ first_name: "", last_name: "", phone: "333", notes: "hi" }]);
});

test("unknown first line is data, not a header", () => {
  const parsed = parse("foo,bar\nMario,Rossi\n");
  assert.equal(parsed.mode, "list");
  assert.equal(parsed.rows.length, 2);
});

test("headerless 'Rossi, Mario' lines are surname first", () => {
  assert.deepEqual(names("Rossi, Mario\nBianchi, Lucia"), [
    ["Mario", "Rossi"],
    ["Lucia", "Bianchi"],
  ]);
  assert.deepEqual(names("Rossi, Mario", true), [["Rossi", "Mario"]]);
});

test("a single comma line inside a plain list", () => {
  assert.deepEqual(names("Giulia Cretan\nRossi, Mario\nAnna Tabarelli"), [
    ["Giulia", "Cretan"],
    ["Mario", "Rossi"],
    ["Anna", "Tabarelli"],
  ]);
});

test("headerless semicolon columns are first;last", () => {
  const parsed = parse("Mario;Rossi\nLucia;Bianchi\n");
  assert.equal(parsed.delimiter, ";");
  assert.deepEqual(names("Mario;Rossi\nLucia;Bianchi"), [
    ["Mario", "Rossi"],
    ["Lucia", "Bianchi"],
  ]);
});

test("empty and whitespace-only input yield no rows", () => {
  assert.deepEqual(parse("").rows, []);
  assert.deepEqual(parse("\n  \n\u00A0\n").rows, []);
  assert.deepEqual(parse("").errors, []);
});

test("the undetectable-delimiter notice is not an error", () => {
  assert.deepEqual(parse("Mario Rossi\nLucia Bianchi").errors, []);
});

test("list markers and curly quotes are stripped", () => {
  assert.deepEqual(names("1. Mario Rossi\n- Lucia Bianchi\n• Anna Verdi\n“Luca Neri”"), [
    ["Mario", "Rossi"],
    ["Lucia", "Bianchi"],
    ["Anna", "Verdi"],
    ["Luca", "Neri"],
  ]);
});

test("splitFullName", () => {
  assert.deepEqual(splitFullName("Mario Rossi"), { first_name: "Mario", last_name: "Rossi" });
  assert.deepEqual(splitFullName("Alexandre Crochemore Ciani"), { first_name: "Alexandre", last_name: "Crochemore Ciani" });
  assert.deepEqual(splitFullName("Madonna"), { first_name: "Madonna", last_name: "" });
  assert.deepEqual(splitFullName("Rossi, Mario"), { first_name: "Mario", last_name: "Rossi" });
  assert.deepEqual(splitFullName("Rossi,Mario,extra"), { first_name: "Mario", last_name: "Rossi" });
  assert.deepEqual(splitFullName("Rossi Mario", { swap: true }), { first_name: "Mario", last_name: "Rossi" });
  assert.deepEqual(splitFullName("De Donatis Laura", { swap: true }), { first_name: "Laura", last_name: "De Donatis" });
  assert.deepEqual(splitFullName("Rossi, Mario", { swap: true }), { first_name: "Rossi", last_name: "Mario" });
  assert.deepEqual(splitFullName("   "), { first_name: "", last_name: "" });
});

test("detectHeader and normalizeHeader", () => {
  assert.equal(detectHeader(["Giulia Cretan"]), false);
  assert.equal(detectHeader(["Nome", "Cognome"]), true);
  assert.equal(detectHeader(["id", "Telefono"]), true);
  assert.equal(normalizeHeader(" Cognome "), "last_name");
  assert.equal(normalizeHeader("Ticket-Code"), "ticket_code");
  assert.equal(normalizeHeader("Cellulare"), "phone");
  assert.equal(normalizeHeader("whatever"), "whatever");
});

test("findDuplicateRows is case-insensitive and ignores empty names", () => {
  const rows = resolveGuestRows(parse("Giulia Cretan\ngiulia cretan\nMario Rossi\nGIULIA CRETAN"), { swap: false });
  assert.deepEqual([...findDuplicateRows(rows)], [1, 3]);
  assert.deepEqual([...findDuplicateRows([{ first_name: "", last_name: "" }, { first_name: "", last_name: "" }])], []);
});

test("titleCase and formatGuestName", () => {
  assert.equal(titleCase("amica asia"), "Amica Asia");
  assert.equal(titleCase("alessandro d'aniello"), "Alessandro D'Aniello");
  assert.equal(titleCase("desirè della corte"), "Desirè Della Corte");
  assert.equal(titleCase("anna-maria rossi"), "Anna-Maria Rossi");
  assert.equal(formatGuestName("Madonna", ""), "Madonna");
  assert.equal(formatGuestName("Mario", "Rossi"), "Mario Rossi");
});

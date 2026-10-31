import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanText, decodeTextFile } from "./clean.ts";

const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const utf8 = (s: string) => new TextEncoder().encode(s);

test("decodeTextFile keeps valid UTF-8 as is", () => {
  assert.equal(decodeTextFile(utf8("Desirè Della Corte")), "Desirè Della Corte");
});

test("decodeTextFile strips a UTF-8 BOM", () => {
  assert.equal(decodeTextFile(utf8("\uFEFFnome,cognome")), "nome,cognome");
});

test("decodeTextFile falls back to Windows-1252 for invalid UTF-8", () => {
  // 0x92 = ’, 0xE8 = è, 0xA0 = non-breaking space in Windows-1252
  assert.equal(decodeTextFile(latin1("D\x92Aniello")), "D’Aniello");
  assert.equal(decodeTextFile(latin1("Desir\xE8")), "Desirè");
  assert.equal(decodeTextFile(latin1("Osti\xA0")), "Osti\u00A0");
});

test("decodeTextFile accepts an ArrayBuffer", () => {
  const bytes = latin1("Sara Osti\xA0");
  assert.equal(decodeTextFile(bytes.buffer as ArrayBuffer), "Sara Osti\u00A0");
});

test("decodeTextFile handles UTF-16 with a byte order mark", () => {
  const le = new Uint8Array([0xff, 0xfe, 0x4d, 0x00, 0x61, 0x00]); // "Ma"
  assert.equal(decodeTextFile(le), "Ma");
  const be = new Uint8Array([0xfe, 0xff, 0x00, 0x4d, 0x00, 0x61]);
  assert.equal(decodeTextFile(be), "Ma");
});

test("cleanText normalises line endings", () => {
  assert.equal(cleanText("a\r\nb\rc\u2028d"), "a\nb\nc\nd");
});

test("cleanText removes non-breaking and invisible characters", () => {
  assert.equal(cleanText("Sara Osti\u00A0\r\n"), "Sara Osti\n");
  assert.equal(cleanText("\uFEFFMario\u200B Rossi\u00AD"), "Mario Rossi");
  assert.equal(cleanText("Mario\u202FRossi"), "Mario Rossi");
});

test("cleanText removes control characters but keeps tabs and newlines", () => {
  assert.equal(cleanText("Mario\u0007 Rossi\u0081\tVIP\n"), "Mario Rossi\tVIP\n");
});

test("cleanText unifies apostrophes", () => {
  assert.equal(cleanText("D’Aniello D‘Alonzo D´Este D`Urso"), "D'Aniello D'Alonzo D'Este D'Urso");
});

test("cleanText repairs replacement characters from an earlier bad decode", () => {
  assert.equal(cleanText("Alessandro D\uFFFDAniello"), "Alessandro D'Aniello");
  assert.equal(cleanText("Sara Osti\uFFFD"), "Sara Osti");
  assert.equal(cleanText("Desir\uFFFD Della Corte"), "Desir Della Corte");
});

test("cleanText collapses spaces and trims each line", () => {
  assert.equal(cleanText("  Mario   Rossi  \n Giulia Bianchi "), "Mario Rossi\nGiulia Bianchi");
});

test("cleanText leaves double quotes, commas and semicolons alone", () => {
  assert.equal(cleanText('"Rossi, Mario";VIP'), '"Rossi, Mario";VIP');
});

test("cleanText applies NFC normalisation", () => {
  assert.equal(cleanText("Desirè"), "Desirè");
});

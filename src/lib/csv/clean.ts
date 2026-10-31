/**
 * Text cleanup for imported guest lists.
 *
 * Pure module: no DOM, no Dexie, no path aliases. It runs unchanged in the
 * browser and under `node --test`.
 */

/**
 * Decodes an uploaded file. UTF-8 (with or without BOM) is tried first; bytes
 * that are not valid UTF-8 are treated as Windows-1252, which is what Excel and
 * Notepad on Italian Windows produce ("D’Aniello", "Desirè", trailing 0xA0).
 * UTF-16 files are recognised by their byte order mark.
 */
export function decodeTextFile(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  if (view.length >= 2 && view[0] === 0xff && view[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(view);
  }
  if (view.length >= 2 && view[0] === 0xfe && view[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(view);
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(view);
  } catch {
    return new TextDecoder("windows-1252").decode(view);
  }
}

// Characters that carry no meaning in a guest list.
const INVISIBLE = /[\uFEFF\u200B-\u200D\u2060\u00AD]/g;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
// Non-breaking and typographic spaces: Word and WhatsApp exports are full of them.
const ODD_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
// Curly, prime and accent-like apostrophes → the plain one, so "D’Aniello" and
// "D'Aniello" are the same guest.
const APOSTROPHES = /[\u2018\u2019\u201A\u201B\u00B4`\u02BC\uFF07]/g;

/**
 * Normalises a whole document before it is parsed. Line endings become `\n`,
 * invisible and control characters go away, odd spaces become plain spaces,
 * apostrophes are unified, replacement characters left by an earlier bad
 * decode are repaired where possible, and the text is NFC-normalised so the
 * same accented letter always has the same code points.
 *
 * Double quotes, tabs, commas and semicolons are left alone: they are the CSV
 * parser's business.
 */
export function cleanText(text: string): string {
  return (
    text
      .replace(/\r\n?|\u2028|\u2029/g, "\n")
      .replace(INVISIBLE, "")
      .replace(CONTROL_CHARS, "")
      .replace(ODD_SPACES, " ")
      .replace(APOSTROPHES, "'")
      // "D�Aniello": a replacement character between two letters was almost
      // certainly an apostrophe. Anywhere else (usually a trailing 0xA0 that
      // was decoded as UTF-8) it is noise.
      .replace(/(\p{L})\uFFFD(?=\p{L})/gu, "$1'")
      .replace(/\uFFFD/g, "")
      .replace(/ {2,}/g, " ")
      .replace(/^ +| +$/gm, "")
      .normalize("NFC")
  );
}

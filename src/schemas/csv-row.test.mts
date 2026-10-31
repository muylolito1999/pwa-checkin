import { test } from "node:test";
import assert from "node:assert/strict";
import { csvRowSchema } from "./index.ts";

test("last name is optional and defaults to an empty string", () => {
  const result = csvRowSchema.parse({ first_name: "Giulia" });
  assert.equal(result.first_name, "Giulia");
  assert.equal(result.last_name, "");
  assert.equal(result.phone, null);
  assert.equal(result.group, null);
});

test("a whitespace-only first name is rejected", () => {
  const result = csvRowSchema.safeParse({ first_name: "   ", last_name: "Rossi" });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues[0].message, "First name is required");
  }
});

test("names are trimmed", () => {
  const result = csvRowSchema.parse({ first_name: " Mario ", last_name: " Rossi " });
  assert.deepEqual([result.first_name, result.last_name], ["Mario", "Rossi"]);
});

test("phone keeps digits only and drops short numbers", () => {
  assert.equal(csvRowSchema.parse({ first_name: "M", phone: "333 123 4567" }).phone, "3331234567");
  assert.equal(csvRowSchema.parse({ first_name: "M", phone: "333" }).phone, null);
});

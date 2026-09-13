import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "../src/lib/csv.js";

test("parses simple CSV with header", () => {
  const { headers, records } = parseCsv("a,b,c\n1,2,3\n4,5,6\n");
  assert.deepEqual(headers, ["a", "b", "c"]);
  assert.deepEqual(records, [
    { a: "1", b: "2", c: "3" },
    { a: "4", b: "5", c: "6" },
  ]);
});

test("handles quoted fields with embedded commas and quotes", () => {
  const { records } = parseCsv('name,note\n"Acme, Inc.","She said ""hi"""\n');
  assert.deepEqual(records, [{ name: "Acme, Inc.", note: 'She said "hi"' }]);
});

test("handles CRLF line endings", () => {
  const { records } = parseCsv("a,b\r\n1,2\r\n3,4\r\n");
  assert.deepEqual(records, [
    { a: "1", b: "2" },
    { a: "3", b: "4" },
  ]);
});

test("strips a UTF-8 BOM", () => {
  const { headers } = parseCsv("﻿a,b\n1,2\n");
  assert.deepEqual(headers, ["a", "b"]);
});

test("handles a file with no trailing newline", () => {
  const { records } = parseCsv("a,b\n1,2");
  assert.deepEqual(records, [{ a: "1", b: "2" }]);
});

test("fills missing trailing columns with empty string", () => {
  const { records } = parseCsv("a,b,c\n1,2\n");
  assert.deepEqual(records, [{ a: "1", b: "2", c: "" }]);
});

test("skips blank lines", () => {
  const { records } = parseCsv("a,b\n1,2\n\n3,4\n");
  assert.equal(records.length, 2);
});

test("handles a quoted field containing a literal newline", () => {
  const { records } = parseCsv('name,note\nWidget,"line one\nline two"\n');
  assert.equal(records[0].note, "line one\nline two");
});

test("handles columns in any order (header-driven, not positional)", () => {
  const { records } = parseCsv("c,a,b\n3,1,2\n");
  assert.deepEqual(records, [{ a: "1", b: "2", c: "3" }]);
});

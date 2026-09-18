import { test } from "node:test";
import assert from "node:assert/strict";
import { money, moneyPrecise, pct } from "../public/src/lib/format.js";

test("money defaults to en-US formatting", () => {
  assert.equal(money(1234, "EUR"), "€1,234");
});

test("money accepts a numberLocale for es-ES formatting", () => {
  assert.equal(money(1234, "EUR", "es-ES"), "1234 €");
});

test("moneyPrecise respects numberLocale too", () => {
  assert.equal(moneyPrecise(1234.5, "EUR", "es-ES"), "1234,50 €");
});

test("money handles null/undefined/NaN regardless of locale", () => {
  assert.equal(money(null, "EUR", "es-ES"), "—");
  assert.equal(money(undefined, "EUR", "es-ES"), "—");
  assert.equal(money(NaN, "EUR", "es-ES"), "—");
});

test("pct stays locale-agnostic", () => {
  assert.equal(pct(0.125, 1), "12.5%");
});

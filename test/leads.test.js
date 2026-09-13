import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitize, ALLOWED_FIELDS } from "../public/src/lib/leads.js";

test("sanitize keeps only the allowed lead fields", () => {
  const clean = sanitize({ email: "a@x.com", source: "google.com", usedDemo: false, leaksCount: 3, marginUnlocked: true });
  assert.equal(clean.email, "a@x.com");
  assert.ok(clean.timestamp);
  for (const key of Object.keys(clean)) {
    assert.ok(key === "timestamp" || ALLOWED_FIELDS.includes(key), `unexpected key leaked through: ${key}`);
  }
});

test("sanitize drops any store data smuggled into the payload", () => {
  const malicious = {
    email: "a@x.com",
    csvText: "Name,Lineitem sku\n#1,SKU-1",
    ordersCsvText: "raw csv content",
    sku: "SUMMER-PACK",
    revenue: 12345.67,
    customerEmail: "customer@theirstore.com",
    fileName: "orders-export.csv",
  };
  const clean = sanitize(malicious);
  assert.deepEqual(Object.keys(clean).sort(), ["email", "timestamp"]);
  assert.ok(!("csvText" in clean));
  assert.ok(!("ordersCsvText" in clean));
  assert.ok(!("sku" in clean));
  assert.ok(!("revenue" in clean));
  assert.ok(!("customerEmail" in clean));
  assert.ok(!("fileName" in clean));
});

test("sanitize never includes keys outside the allowlist, no matter what's passed", () => {
  const clean = sanitize({ email: "a@x.com", __proto__: { polluted: true }, anythingElse: 1 });
  assert.deepEqual(Object.keys(clean).sort(), ["email", "timestamp"]);
});

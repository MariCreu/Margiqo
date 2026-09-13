import { test } from "node:test";
import assert from "node:assert/strict";
import { track, getEventBuffer, clearEventBuffer } from "../src/lib/analytics.js";

test("track records only the event name, timestamp, and allowed scalar props", () => {
  clearEventBuffer();
  const event = track("scan_completed", { is_demo: true, leaks_count: 3, margin_unlocked: true });
  assert.equal(event.event, "scan_completed");
  assert.ok(event.ts);
  assert.equal(event.is_demo, true);
  assert.equal(event.leaks_count, 3);
  assert.equal(event.margin_unlocked, true);
});

test("track drops any store data smuggled into event props", () => {
  clearEventBuffer();
  const event = track("scan_completed", {
    leaks_count: 2,
    ordersCsvText: "Name,Lineitem sku\n#1,SKU-1",
    sku: "SUMMER-PACK",
    revenue: 999.99,
    email: "customer@theirstore.com",
  });
  assert.deepEqual(Object.keys(event).sort(), ["event", "leaks_count", "ts"]);
});

test("getEventBuffer reflects tracked events and clearEventBuffer resets it", () => {
  clearEventBuffer();
  track("landing_viewed");
  track("demo_started");
  assert.equal(getEventBuffer().length, 2);
  clearEventBuffer();
  assert.equal(getEventBuffer().length, 0);
});

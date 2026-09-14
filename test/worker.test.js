import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { handleEarlyAccessPost, handleEarlyAccessGet } from "../src/worker.js";

// Minimal in-memory stand-in for the Cloudflare KV binding interface used by
// src/worker.js: get/put/list with the same call shape.
function createMockKV() {
  const store = new Map();
  return {
    store,
    async get(key, opts) {
      const value = store.get(key);
      if (value === undefined) return null;
      return opts?.type === "json" ? JSON.parse(value) : value;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async list({ prefix }) {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name }));
      return { keys, list_complete: true, cursor: undefined };
    },
  };
}

function postRequest(body, headers = {}) {
  return new Request("https://margiqo.com/api/early-access", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("POST /api/early-access stores only the allowlisted fields", async () => {
  const env = { EARLY_ACCESS_KV: createMockKV() };
  const res = await handleEarlyAccessPost(
    postRequest({ email: "a@x.com", source: "google.com", usedDemo: true, leaksCount: 3, marginUnlocked: true, csvText: "leaked" }),
    env,
  );
  assert.equal(res.status, 200);
  const stored = JSON.parse(env.EARLY_ACCESS_KV.store.get("lead:a@x.com"));
  assert.equal(stored.email, "a@x.com");
  assert.equal(stored.usedDemo, true);
  assert.ok(!("csvText" in stored));
});

test("POST rejects an invalid email", async () => {
  const env = { EARLY_ACCESS_KV: createMockKV() };
  const res = await handleEarlyAccessPost(postRequest({ email: "not-an-email" }), env);
  assert.equal(res.status, 400);
});

test("POST rejects a willingnessToPay value outside the fixed set", async () => {
  const env = { EARLY_ACCESS_KV: createMockKV() };
  const res = await handleEarlyAccessPost(postRequest({ email: "a@x.com", willingnessToPay: "1000000" }), env);
  assert.equal(res.status, 400);
});

test("POST merges a second submission (willingness-to-pay follow-up) into the same record", async () => {
  const env = { EARLY_ACCESS_KV: createMockKV() };
  await handleEarlyAccessPost(postRequest({ email: "a@x.com", usedDemo: false, leaksCount: 2 }), env);
  await handleEarlyAccessPost(postRequest({ email: "a@x.com", willingnessToPay: "19" }), env);

  assert.equal(env.EARLY_ACCESS_KV.store.size, 2); // 1 lead record + 1 rate-limit counter (same IP, same window)
  const stored = JSON.parse(env.EARLY_ACCESS_KV.store.get("lead:a@x.com"));
  assert.equal(stored.leaksCount, 2);
  assert.equal(stored.willingnessToPay, "19");
  assert.ok(stored.firstSeen);
});

test("POST enforces the per-IP rate limit", async () => {
  const env = { EARLY_ACCESS_KV: createMockKV() };
  const headers = { "cf-connecting-ip": "1.2.3.4" };
  let last;
  for (let i = 0; i < 21; i++) {
    last = await handleEarlyAccessPost(postRequest({ email: `u${i}@x.com` }, headers), env);
  }
  assert.equal(last.status, 429);
});

test("GET /api/early-access requires the admin token", async () => {
  const env = { EARLY_ACCESS_KV: createMockKV(), ADMIN_TOKEN: "secret" };
  const unauth = await handleEarlyAccessGet(new Request("https://margiqo.com/api/early-access"), env);
  assert.equal(unauth.status, 401);

  await handleEarlyAccessPost(postRequest({ email: "a@x.com" }), env);
  const authed = await handleEarlyAccessGet(
    new Request("https://margiqo.com/api/early-access", { headers: { Authorization: "Bearer secret" } }),
    env,
  );
  assert.equal(authed.status, 200);
  const { leads } = await authed.json();
  assert.equal(leads.length, 1);
  assert.equal(leads[0].email, "a@x.com");
});

test("everything except /api/early-access falls through to ASSETS", async () => {
  const env = {
    EARLY_ACCESS_KV: createMockKV(),
    ASSETS: { fetch: async () => new Response("static page") },
  };
  const res = await worker.fetch(new Request("https://margiqo.com/index.html"), env);
  assert.equal(await res.text(), "static page");
});

test("a malformed body still spends a rate-limit slot", async () => {
  // Regression: the counter used to be bumped only after validation passed, so
  // junk payloads were free and a bot could post them forever without ever
  // tripping the limit.
  const env = { EARLY_ACCESS_KV: createMockKV() };
  const bad = new Request("https://margiqo.com/api/early-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ not json",
  });
  const res = await handleEarlyAccessPost(bad, env);
  assert.equal(res.status, 400);

  const counters = [...env.EARLY_ACCESS_KV.store.entries()].filter(([k]) => k.startsWith("rl:"));
  assert.equal(counters.length, 1, "the rejected request should have consumed a slot");
  assert.equal(counters[0][1], "1");
});

test("a rejected payload still counts toward the rate limit", async () => {
  const env = { EARLY_ACCESS_KV: createMockKV() };
  for (let i = 0; i < 20; i++) {
    assert.equal((await handleEarlyAccessPost(postRequest({ email: "nope" }), env)).status, 400);
  }
  // The window is now spent, so even a perfectly valid signup is turned away.
  const res = await handleEarlyAccessPost(postRequest({ email: "real@shop.com" }), env);
  assert.equal(res.status, 429);
});

test("timingSafeEqual accepts only an exact match", async () => {
  const { timingSafeEqual } = await import("../src/lib/earlyAccess.js");
  assert.equal(timingSafeEqual("s3cret", "s3cret"), true);
  assert.equal(timingSafeEqual("s3cret", "s3creT"), false);
  assert.equal(timingSafeEqual("s3cret", "s3cre"), false, "a prefix must not pass");
  assert.equal(timingSafeEqual("", ""), true);
  assert.equal(timingSafeEqual("s3cret", undefined), false);
  assert.equal(timingSafeEqual(null, "s3cret"), false);
});

test("GET rejects a token that shares a prefix with the real one", async () => {
  const env = { EARLY_ACCESS_KV: createMockKV(), ADMIN_TOKEN: "abcdef123456" };
  const req = new Request("https://margiqo.com/api/early-access", {
    headers: { authorization: "Bearer abcdef123455" },
  });
  assert.equal((await handleEarlyAccessGet(req, env)).status, 401);
});

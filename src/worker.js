import { sanitizeLead, validateLead, leadKey, rateLimitKey, timingSafeEqual } from "./lib/earlyAccess.js";

const MAX_BODY_BYTES = 8192;
const RATE_LIMIT_MAX = 20; // per IP, per window — generous for ~20-30 expected real scans
const RATE_LIMIT_WINDOW_SECONDS = 3600;

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleEarlyAccessPost(request, env) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return json({ ok: false, error: "payload too large" }, 413);
  }

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const windowStart = Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW_SECONDS) * RATE_LIMIT_WINDOW_SECONDS;
  const rlKey = rateLimitKey(ip, windowStart);
  const count = Number((await env.EARLY_ACCESS_KV.get(rlKey)) || "0");
  if (count >= RATE_LIMIT_MAX) {
    return json({ ok: false, error: "rate limited" }, 429);
  }

  // Spend the slot before parsing: a request that turns out to be malformed
  // still consumed our work, and only counting valid ones let a bot post junk
  // forever without ever tripping the limit.
  await env.EARLY_ACCESS_KV.put(rlKey, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid json" }, 400);
  }

  const clean = sanitizeLead(body);
  const error = validateLead(clean);
  if (error) {
    return json({ ok: false, error }, 400);
  }

  const key = leadKey(clean.email);
  const existing = await env.EARLY_ACCESS_KV.get(key, { type: "json" });
  const now = new Date().toISOString();
  const merged = { ...existing, ...clean, timestamp: now, firstSeen: existing?.firstSeen || now };
  await env.EARLY_ACCESS_KV.put(key, JSON.stringify(merged));

  return json({ ok: true }, 200);
}

export async function handleEarlyAccessGet(request, env) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!env.ADMIN_TOKEN || !timingSafeEqual(token, env.ADMIN_TOKEN)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const leads = [];
  let cursor;
  for (;;) {
    const page = await env.EARLY_ACCESS_KV.list({ prefix: "lead:", cursor });
    for (const entry of page.keys) {
      const value = await env.EARLY_ACCESS_KV.get(entry.name, { type: "json" });
      if (value) leads.push(value);
    }
    if (page.list_complete) break;
    cursor = page.cursor;
  }
  leads.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return json({ ok: true, leads }, 200);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/early-access") {
      if (request.method === "POST") return handleEarlyAccessPost(request, env);
      if (request.method === "GET") return handleEarlyAccessGet(request, env);
      return json({ ok: false, error: "method not allowed" }, 405);
    }
    return env.ASSETS.fetch(request);
  },
};

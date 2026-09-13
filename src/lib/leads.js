import { EARLY_ACCESS_FORM_ENDPOINT } from "../config.js";

const LOCAL_STORAGE_KEY = "margiqo_local_leads";

// Only these fields can ever leave this module. Anything else on the
// payload passed in — a stray SKU, a revenue figure, the CSV itself — is
// silently dropped here, structurally, not just by convention.
export const ALLOWED_FIELDS = ["email", "source", "usedDemo", "leaksCount", "marginUnlocked", "willingnessToPay"];

export function sanitize(payload) {
  const clean = {};
  for (const key of ALLOWED_FIELDS) {
    if (payload[key] !== undefined) clean[key] = payload[key];
  }
  clean.timestamp = new Date().toISOString();
  return clean;
}

function saveLocally(payload) {
  try {
    const existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
    existing.push(payload);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // Best effort only (private browsing, storage disabled, ...) — never
    // block the user-facing success state on this.
  }
}

/**
 * Submits an early-access signup. Without EARLY_ACCESS_FORM_ENDPOINT
 * configured (see src/config.js), captures locally instead so the flow is
 * still fully usable and testable without any backend.
 */
export async function submitEarlyAccess(rawPayload) {
  const payload = sanitize(rawPayload);

  if (!EARLY_ACCESS_FORM_ENDPOINT) {
    console.info("[margiqo] early-access endpoint not configured — captured locally", payload);
    saveLocally(payload);
    return { ok: true, mode: "local" };
  }

  try {
    const res = await fetch(EARLY_ACCESS_FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return { ok: true, mode: "remote" };
  } catch (err) {
    console.warn("[margiqo] early-access submission failed, falling back to local capture", err);
    saveLocally(payload);
    return { ok: true, mode: "local-fallback" };
  }
}

export function getLocallyCapturedLeads() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

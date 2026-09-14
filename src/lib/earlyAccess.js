// Server-side mirror of public/src/lib/leads.js's ALLOWED_FIELDS. Kept as a
// separate constant (not imported from public/) because this file must never
// depend on anything under public/src/ that touches CSV/order data — the
// import boundary itself is part of the guarantee in docs/PRIVACY.md.
export const ALLOWED_FIELDS = ["email", "source", "usedDemo", "leaksCount", "marginUnlocked", "willingnessToPay"];

export const WILLINGNESS_VALUES = new Set(["none", "9", "19", "39", "79plus"]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SOURCE_LEN = 253; // max valid hostname length

export function sanitizeLead(raw) {
  if (!raw || typeof raw !== "object") return {};
  const clean = {};
  for (const key of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) clean[key] = raw[key];
  }
  return clean;
}

// Returns an error string, or null when the payload is fine to store.
export function validateLead(clean) {
  if (typeof clean.email !== "string" || clean.email.length > 254 || !EMAIL_RE.test(clean.email)) {
    return "invalid email";
  }
  if (clean.source !== undefined && (typeof clean.source !== "string" || clean.source.length > MAX_SOURCE_LEN)) {
    return "invalid source";
  }
  if (clean.usedDemo !== undefined && typeof clean.usedDemo !== "boolean") {
    return "invalid usedDemo";
  }
  if (clean.leaksCount !== undefined && (!Number.isInteger(clean.leaksCount) || clean.leaksCount < 0 || clean.leaksCount > 100000)) {
    return "invalid leaksCount";
  }
  if (clean.marginUnlocked !== undefined && typeof clean.marginUnlocked !== "boolean") {
    return "invalid marginUnlocked";
  }
  if (clean.willingnessToPay !== undefined && !WILLINGNESS_VALUES.has(clean.willingnessToPay)) {
    return "invalid willingnessToPay";
  }
  return null;
}

// One record per email, so the willingness-to-pay follow-up (sent as a
// second, separate submission) merges into the same KV entry instead of
// creating a duplicate — see the LIMITATIONS.md caveat this replaces.
export function leadKey(email) {
  return `lead:${email.trim().toLowerCase()}`;
}

export function rateLimitKey(ip, windowStartSeconds) {
  return `rl:${ip}:${windowStartSeconds}`;
}

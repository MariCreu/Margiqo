// Both endpoints below are optional — leave them blank and the app still
// works end to end (leads/events are captured locally in the browser and
// logged to the console instead of sent anywhere), which is also what makes
// the app deterministic to test.
//
// EARLY_ACCESS_FORM_ENDPOINT: same-origin path handled by src/worker.js
// (POST /api/early-access), backed by the EARLY_ACCESS_KV namespace — see
// docs/DEPLOYMENT.md. Only the allowlisted fields in docs/PRIVACY.md are
// ever accepted; the worker re-validates them server-side regardless of
// what this client sends.
export const EARLY_ACCESS_FORM_ENDPOINT = "/api/early-access";

// ANALYTICS_ENDPOINT: optional future sink for the funnel events in
// src/lib/analytics.js (e.g. a Supabase REST endpoint once one exists —
// see docs/DEPLOYMENT.md). Expects POST of {event, ts, ...safeProps}.
export const ANALYTICS_ENDPOINT = "";

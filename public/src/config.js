// Phase 1.5 has no backend of its own. Both endpoints below are optional —
// leave them blank and the app still works end to end (leads/events are
// captured locally in the browser and logged to the console instead of
// sent anywhere), which is also what makes the app deterministic to test.
//
// EARLY_ACCESS_FORM_ENDPOINT: a free form endpoint (e.g. https://formspree.io
// — create a form, paste its endpoint URL here) that receives the
// early-access email + the non-sensitive scan summary fields listed in
// docs/PRIVACY.md. Never wire this to something that stores raw store data.
export const EARLY_ACCESS_FORM_ENDPOINT = "";

// ANALYTICS_ENDPOINT: optional future sink for the funnel events in
// src/lib/analytics.js (e.g. a Supabase REST endpoint once one exists —
// see docs/DEPLOYMENT.md). Expects POST of {event, ts, ...safeProps}.
export const ANALYTICS_ENDPOINT = "";

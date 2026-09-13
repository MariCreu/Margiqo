import { ANALYTICS_ENDPOINT } from "../config.js";

// Minimal, privacy-friendly, first-party funnel tracking. No vendor, no
// cookies, no fingerprinting, no CSV/store content ever — only these
// scalar properties can ride along with an event, structurally.
const ALLOWED_PROPS = ["is_demo", "leaks_count", "margin_unlocked", "severity"];

const buffer = [];

function sanitizeProps(props) {
  const clean = {};
  for (const key of ALLOWED_PROPS) {
    if (props[key] !== undefined) clean[key] = props[key];
  }
  return clean;
}

export function track(eventName, props = {}) {
  const event = { event: eventName, ts: Date.now(), ...sanitizeProps(props) };
  buffer.push(event);
  if (typeof console !== "undefined" && console.debug) console.debug("[profitdoctor:event]", event);

  if (ANALYTICS_ENDPOINT) {
    fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {});
  }
  return event;
}

export function getEventBuffer() {
  return buffer.slice();
}

export function clearEventBuffer() {
  buffer.length = 0;
}

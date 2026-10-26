// The full log of the viewer (ui/event-log.js shows it): every notice it
// raised, including the ones kept quiet, and the console's errors and
// warnings. Without imports from the UI, so viewer-utils.js (showToast) can
// record into it.

const MAX_ENTRIES = 500;

// Notices recorded in the log but not shown as toasts.
export const QUIET_NOTICE_KEYS = new Set([
  "toasts.performanceModeSet",
  "toasts.settingsFound",
  "toasts.settingsNotFound",
  // The same moment as "Model has been loaded".
  "toasts.objLoaded",
  // Tool states the toolbar shows anyway.
  "toasts.facePickingEnabled",
  "toasts.facePickingDisabled",
  "toasts.distanceEnabled",
  "toasts.distanceModeEnabled",
  "toasts.distanceModeDisabled",
  "toasts.clippingHelperToggle",
  "toasts.clippingDisabled",
  "toasts.featureToggle",
  "toasts.shadingModeApplied",
  "device.motionOff",
]);

const entries = [];
export const eventLogListeners = new Set();
let installed = false;

export function isQuietNotice(i18nKey) {
  return QUIET_NOTICE_KEYS.has(String(i18nKey || ""));
}

export function recordEvent({ tone = "info", message = "", detail = "", source = "notice", quiet = false } = {}) {
  const text = String(message ?? "").trim();
  if (!text) return;
  entries.push({
    time: new Date(),
    tone: String(tone || "info"),
    message: text,
    // Notices may carry markup in their detail; the log shows it as text.
    detail: stripTags(detail),
    source,
    quiet: quiet === true,
  });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  eventLogListeners.forEach((listener) => listener());
}

export function getEventLog() {
  return entries.slice();
}

export function clearEventLog() {
  entries.length = 0;
  eventLogListeners.forEach((listener) => listener());
}

function stripTags(value) {
  const text = String(value ?? "");
  if (!text.includes("<")) return text.trim();
  const element = document.createElement("div");
  element.innerHTML = text;
  return (element.textContent || "").replace(/\s+/g, " ").trim();
}

const MAX_ARGUMENT_LENGTH = 500;

// Plain data as JSON (cut short); anything else by its class only - three.js
// objects have a toJSON() that would serialize the whole scene.
function formatArgument(value) {
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (value === null || typeof value !== "object") return String(value);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) {
    return `[${value.constructor?.name || "object"}]`;
  }
  try {
    const text = JSON.stringify(value, (key, item) => (
      item && typeof item === "object" && key && ![Object.prototype, Array.prototype, null].includes(Object.getPrototypeOf(item))
        ? `[${item.constructor?.name || "object"}]`
        : item
    ));
    return text.length > MAX_ARGUMENT_LENGTH ? `${text.slice(0, MAX_ARGUMENT_LENGTH)}…` : text;
  } catch {
    return "[object]";
  }
}

// The console's errors and warnings and uncaught errors go into the log too
// (once, whichever viewer starts first).
export function installEventLog() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  ["error", "warn"].forEach((level) => {
    const original = console[level];
    if (typeof original !== "function") return;
    console[level] = (...args) => {
      original.apply(console, args);
      try {
        recordEvent({ tone: level === "error" ? "error" : "warning", message: args.map(formatArgument).join(" "), source: "console" });
      } catch {
        // The log must never break the console.
      }
    };
  });
  window.addEventListener("error", (event) => {
    recordEvent({ tone: "error", message: event.error?.stack || event.message || "Error", source: "console" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    recordEvent({ tone: "error", message: formatArgument(event.reason ?? "Unhandled rejection"), source: "console" });
  });
}


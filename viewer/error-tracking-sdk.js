// Only what error-tracking.js uses, so the lazily loaded chunk leaves out
// the rest of the SDK (replay, feedback widget, tracing).
export { init, captureMessage, setTag, flush } from "@sentry/browser";

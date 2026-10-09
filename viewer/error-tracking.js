import { core } from "./core.js";
import { isAppBuild } from "./remote.js";

// Error tracking with GlitchTip (self-hosted, docker-compose.glitchtip.yml),
// through the Sentry browser SDK - GlitchTip speaks Sentry's protocol. Off
// until viewer-settings.json names a project DSN (docs/error-tracking.md):
//   "viewer": { "errorTracking": { "dsn": "https://<key>@glitchtip.example.org/<id>" } }
// The SDK is loaded only then, as its own chunk.

const BUILD_ID = (typeof __BUILD_ID__ !== "undefined") ? __BUILD_ID__ : "";
const BUILD = (typeof __BUILD__ !== "undefined") ? __BUILD__ : "dev";

let initPromise = null;

function getErrorTrackingConfig() {
  return core.CONFIG?.viewer?.errorTracking || {};
}

export function isErrorTrackingConfigured() {
  return Boolean(getErrorTrackingConfig().dsn);
}

// Resolves to the SDK once it is set up, or null when error tracking is off
// or the SDK failed to load.
export function initErrorTracking() {
  if (initPromise) return initPromise;
  const config = getErrorTrackingConfig();
  if (!config.dsn) return Promise.resolve(null);

  initPromise = import("./error-tracking-sdk.js")
    .then((Sentry) => {
      // autoCapture: false sends only what users report with the bug button,
      // not every uncaught error.
      const autoCapture = config.autoCapture !== false;
      Sentry.init({
        dsn: config.dsn,
        release: BUILD_ID || undefined,
        environment: config.environment || (isAppBuild() ? "app" : BUILD),
        sendDefaultPii: false,
        sampleRate: Number.isFinite(config.sampleRate) ? config.sampleRate : 1,
        ...(autoCapture ? {} : { defaultIntegrations: false }),
      });
      Sentry.setTag("platform", isAppBuild() ? "app" : "web");
      return Sentry;
    })
    .catch((error) => {
      console.warn("Error tracking unavailable:", error);
      return null;
    });
  return initPromise;
}

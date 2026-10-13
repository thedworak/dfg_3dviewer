// Which features are available, for builds that wrap the viewer in an app
// (see app-hooks.js; an app build swaps this module the same way). Kept apart
// from app-hooks.js and free of imports: remote.js reads it, and most of the
// viewer imports remote.js.

// Whether a feature is available; everything is on the web.
export function hasFeature() {
  return true;
}

// Whether some features can be locked at all (and the lock icons shown).
export function isFeatureGatingEnabled() {
  return false;
}

// Extra headers for requests to the repository (uploads, model list).
export function extraRequestHeaders() {
  return {};
}

// Toolbar tools only the app has (AR, video, motion look - see the app's
// version): { key, group, svg, label(), onClick(), pressed, isActive(),
// primary }. Added before the help group of the editor toolbar.
export function appToolbarTools() {
  return [];
}

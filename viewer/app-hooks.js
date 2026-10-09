// Extension points for builds that wrap the viewer in an app (isAppBuild()
// in remote.js). These are the defaults the web builds use: nothing to start
// and nothing gated. An app build swaps this module for its own when bundling
// (see VIEWER_BUILD_EXTENSION in rollup.config.js), so none of its code ends
// up in the web bundles. What features are available is app-features.js.

// Right at startup, before the settings are read.
export function initAppEarly() {}

// Once the settings are in, before remote.js reads them.
export function initAppSettings() {}

// Adds the app's own panels to the Viewer object (like the attach* modules);
// Viewer.initAppUi(), if it defines one, runs once the menu is built.
export function attachAppUi() {}

// The first model is shown, or could not be loaded.
export function hideAppSplash() {}

// A model finished loading.
export function onAppModelLoaded() {}

// The account signed in on the repository changed: its plan from GET
// /api/auth/me, null when signed out.
export function onAccountChange() {}

// Signed in from the app (a session token, not a cookie).
export async function onAppLogin() {}

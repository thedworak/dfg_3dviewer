// The app's launch splash (capacitor.config.json: SplashScreen.launchAutoHide
// false) stays until the first model is on screen or failed to load - then
// the viewer, not an empty page, is what the splash fades into. The plugin is
// reached through the native bridge, so the web builds bundle nothing of it,
// and it does not depend on the settings (a start that fails before they load
// must still hide it). A fallback timer, started as soon as the script runs,
// hides it anyway, so a stalled start never keeps the app behind the splash.
const FALLBACK_MS = 6000;
let hidden = false;

function isNativeApp() {
  return window.Capacitor?.isNativePlatform?.() === true;
}

export function hideAppSplash() {
  if (hidden || !isNativeApp()) return;
  hidden = true;
  window.Capacitor.Plugins?.SplashScreen?.hide?.()?.catch?.(() => {});
}

if (isNativeApp()) window.setTimeout(hideAppSplash, FALLBACK_MS);

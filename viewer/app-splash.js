// The app's launch splash. Android's own splash (androidx SplashScreen, used
// by @capacitor/splash-screen on every Android version) only shows the app
// icon on a plain background - never the full-screen artwork. So it hands
// over to this page-level splash: resources/splash(-dark).png, copied to
// assets/img/app-splash(-dark).webp by rollup.config.js. The native one is
// hidden as soon as the artwork is on screen, so the two meet without a gap.
//
// The artwork stays until the first model is on screen or failed to load
// (hideAppSplash from loaders.js / renderFatalError), at least MIN_VISIBLE_MS,
// and at most FALLBACK_MS - a stalled start never keeps the app behind it.
// Native app only: it does not depend on the settings (a start that fails
// before they load must still end it), and web builds never show it.
const MIN_VISIBLE_MS = 1800;
const FALLBACK_MS = 6000;
const FADE_MS = 400;

let overlay = null;
let shownAt = 0;
let hiding = false;
let resolveDone;

// Resolves once the splash is gone (ads wait for it: a native banner would
// be drawn over the artwork).
export const appSplashDone = new Promise((resolve) => {
  resolveDone = resolve;
});

function isNativeApp() {
  return window.Capacitor?.isNativePlatform?.() === true;
}

function hideNativeSplash() {
  window.Capacitor?.Plugins?.SplashScreen?.hide?.({ fadeOutDuration: 200 })?.catch?.(() => {});
}

function showWebSplash() {
  const dark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches === true;
  overlay = document.createElement("div");
  overlay.id = "appSplash";
  overlay.setAttribute("aria-hidden", "true");
  overlay.dataset.theme = dark ? "dark" : "light";
  const image = new Image();
  image.alt = "";
  image.decoding = "async";
  // Whatever happens to the image, the native splash must not stay.
  const handOver = () => hideNativeSplash();
  image.addEventListener("load", handOver, { once: true });
  image.addEventListener("error", handOver, { once: true });
  window.setTimeout(handOver, 1500);
  image.src = new URL(`assets/img/app-splash${dark ? "-dark" : ""}.webp`, document.baseURI).href;
  // The artwork is square and shown whole; a blurred copy fills the rest
  // of the screen around it, so no edge shows.
  const fill = new Image();
  fill.alt = "";
  fill.className = "app-splash-fill";
  fill.src = image.src;
  overlay.append(fill, image);
  document.body.appendChild(overlay);
  shownAt = Date.now();
}

export function hideAppSplash() {
  if (!isNativeApp() || hiding) return;
  hiding = true;
  hideNativeSplash();
  if (!overlay) {
    resolveDone();
    return;
  }
  const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
  window.setTimeout(() => {
    overlay.classList.add("app-splash--hiding");
    window.setTimeout(() => {
      overlay.remove();
      overlay = null;
      resolveDone();
    }, FADE_MS);
  }, wait);
}

if (isNativeApp()) {
  if (document.body) showWebSplash();
  else document.addEventListener("DOMContentLoaded", showWebSplash, { once: true });
  window.setTimeout(hideAppSplash, FALLBACK_MS);
} else {
  resolveDone();
}

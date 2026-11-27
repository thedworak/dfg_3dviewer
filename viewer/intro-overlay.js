// The intro (intro.html, viewer/intro/) in front of the viewer page, as an
// option in viewer-settings.json:
//
//   "viewer": {
//     "intro": {
//       "enabled": true,       // show it on the standalone page
//       "show": "once",        // "once": the first visit only (localStorage),
//                              // "session": once per browser session,
//                              // "always"
//       "sound": false,        // sound on by default (the visitor's own
//                              // choice in the intro wins)
//       "url": "intro.html"    // the intro page, relative to the viewer page
//     }
//   }
//
// ?intro=1 shows it whatever the settings say, ?intro=0 never; a shared
// session's link (?session=) does not show it either. The intro runs
// in a full-window iframe over the page while the viewer starts and loads its
// model underneath; "Enter the viewer" fades it away (it tells this page via
// postMessage, same origin only), "Skip intro" and Escape close it at once.
// Only on the standalone page (index.html) and in the app build - not
// embedded, not in Drupal, which does not ship the intro.
//
// Entering through the intro always opens its model (introModelUrl(): the
// synagogue, or the scene's own), whatever was opened last; without the
// intro the viewer opens what it would have.

import { getBrandName } from './branding.js';
import { DEFAULT_SCENE } from './intro/intro-scene.js';

const SEEN_KEY = 'explora4d-intro-seen';
// No word from the intro page this long after it was asked for (it did not
// load, its script failed): the viewer is shown.
const READY_TIMEOUT = 15000;

let shown = false;
// The overlay on screen now (while it is, no second one).
let open = false;
// What showIntroOverlay was given: the menu's Intro button (replayIntro)
// shows the intro again with it.
let context = null;
// Closes the overlay on screen now (null: none).
let closeOpen = null;

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return undefined;
}

function storage(kind) {
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function wanted(settings) {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = parseBoolean(params.get('intro'));
  if (fromUrl !== undefined) return fromUrl;
  // A shared session's link (?session=, editor/live-link.js) goes straight
  // to the scene the others show: no intro over it, and not its model.
  if (params.get('session')) return false;
  if (parseBoolean(settings?.enabled) === false) return false;
  const show = String(settings?.show || 'once');
  if (show === 'always') return true;
  try {
    return storage(show === 'once' ? 'local' : 'session')?.getItem(SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}

function remember(settings) {
  const show = String(settings?.show || 'once');
  if (show === 'always') return;
  try {
    storage(show === 'once' ? 'local' : 'session')?.setItem(SEEN_KEY, '1');
  } catch {
    // no storage: shown again next time
  }
}

/**
 * Shows the intro over the page when the settings (or ?intro=) ask for it.
 * @param {object} settings  viewer-settings.json's viewer.intro
 * @param {object} options   { standalone: boolean, lang?: string }
 * @returns {boolean} whether the intro is shown
 */
export function showIntroOverlay(settings, { standalone, lang } = {}) {
  if (standalone && !window.__E2E__) context = { settings, lang };
  if (shown || !standalone || window.__E2E__) return false;
  if (!wanted(settings)) return false;
  shown = true;
  remember(settings);
  return openOverlay(settings, lang);
}

/**
 * The model the intro shows and leads into, as the viewer's example list has
 * it ("./examples/..."): the scene's `next` page's ?model=, else its model;
 * null for a scene in a file of its own (not known before it is read).
 * @param {object} settings  viewer-settings.json's viewer.intro
 * @returns {string|null}
 */
export function introModelUrl(settings) {
  const scene = settings?.scene;
  if (typeof scene === 'string') return null;
  const own = scene && typeof scene === 'object' ? scene : DEFAULT_SCENE;
  try {
    if (typeof own.next === 'string' && own.next.trim()) {
      const model = new URL(own.next.trim(), window.location.href).searchParams.get('model');
      if (model) return model;
    }
  } catch {
    // an unusable `next`: the model then
  }
  if (typeof own.model !== 'string' || !own.model.trim()) return null;
  const model = own.model.trim();
  return /^(\.{0,2}\/|[a-z]+:)/i.test(model) ? model : `./${model}`;
}

/** Whether the intro is over the page now (until it has faded away). */
export function isIntroOverlayOpen() {
  return open;
}

/** Closes the intro over the page (the back gesture, Back). */
export function closeIntroOverlay() {
  closeOpen?.(0.4);
}

/** Whether the intro can be shown again from the menu (the standalone page). */
export function canReplayIntro() {
  return Boolean(context);
}

/**
 * Shows the intro again, whatever the settings say (the menu's Intro button).
 * @param {string} [lang]  the viewer's language now
 * @returns {boolean} whether the intro is shown
 */
export function replayIntro(lang) {
  if (!context || open) return false;
  return openOverlay(context.settings, lang || context.lang);
}

// The page's safe area (env(safe-area-inset-*): a phone's status bar and
// notch, the app's edge-to-edge window), in CSS pixels "top,right,bottom,left".
// An iframe gets none of its own, so the intro is told.
function safeAreaInsets() {
  const probe = document.createElement('div');
  Object.assign(probe.style, {
    position: 'fixed',
    inset: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    padding: 'env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
  });
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const sides = ['Top', 'Right', 'Bottom', 'Left'].map((side) => Math.round(Number.parseFloat(style[`padding${side}`]) || 0));
  probe.remove();
  return sides.join(',');
}

function openOverlay(settings, lang) {
  const url = new URL(String(settings?.url || 'intro.html'), window.location.href);
  if (url.origin !== window.location.origin) {
    console.warn('[intro] viewer.intro.url must be a page of this site:', url.href);
    return false;
  }
  open = true;
  // In the hash: kept through a server's redirect (some drop the query).
  const hash = new URLSearchParams({ embedded: '1' });
  if (lang) hash.set('lang', lang);
  if (parseBoolean(settings?.sound)) hash.set('sound', '1');
  hash.set('insets', safeAreaInsets());
  url.hash = hash.toString();

  const overlay = document.createElement('div');
  overlay.id = 'viewer-intro-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483000',
    background: '#05070d',
    opacity: '1',
    transition: 'opacity 0.6s ease',
  });
  const frame = document.createElement('iframe');
  frame.src = url.href;
  frame.title = getBrandName();
  frame.allow = 'autoplay; fullscreen';
  Object.assign(frame.style, { width: '100%', height: '100%', border: '0', display: 'block' });
  overlay.appendChild(frame);
  document.body.appendChild(overlay);
  const previousOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  window.dispatchEvent(new CustomEvent('explora4d-intro-opened'));

  let closed = false;
  function close(fade = 0.6, delay = 0) {
    if (closed) return;
    closed = true;
    window.removeEventListener('message', onMessage);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    clearTimeout(readyTimer);
    overlay.style.transition = `opacity ${fade}s ease ${delay}s`;
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    setTimeout(() => {
      overlay.remove();
      open = false;
      closeOpen = null;
      document.documentElement.style.overflow = previousOverflow;
      // The viewer measured itself under the overlay: once more, uncovered.
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new CustomEvent('explora4d-intro-closed'));
    }, (fade + delay) * 1000 + 50);
  }

  function onMessage(event) {
    if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || data.type !== 'explora4d-intro') return;
    if (data.action === 'ready') clearTimeout(readyTimer);
    // Its language switched (it reloads itself in it): the viewer's too.
    if (data.action === 'lang' && ['pl', 'en', 'de'].includes(data.lang)) {
      if (context) context.lang = data.lang;
      window.dispatchEvent(new CustomEvent('explora4d-intro-language', { detail: { lang: data.lang } }));
    }
    // The points fly apart and the picture darkens: the viewer shows through.
    if (data.action === 'leaving') close(1.0, 0.45);
    if (data.action === 'done') close(0.5);
  }

  function onKey(event) {
    if (event.key === 'Escape') close(0.4);
  }

  // Turned (portrait, landscape): the safe area moves.
  let lastInsets = '';
  function onResize() {
    const insets = safeAreaInsets();
    if (insets === lastInsets) return;
    lastInsets = insets;
    frame.contentWindow?.postMessage({ type: 'explora4d-intro-host', insets }, window.location.origin);
  }

  closeOpen = close;
  const readyTimer = setTimeout(() => close(0.4), READY_TIMEOUT);
  window.addEventListener('message', onMessage);
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  frame.addEventListener('load', () => {
    frame.contentWindow?.focus();
    // Again after a reload of the intro (its language changed).
    lastInsets = '';
    onResize();
  });
  return true;
}

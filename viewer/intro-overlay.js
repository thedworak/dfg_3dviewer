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
// ?intro=1 shows it whatever the settings say, ?intro=0 never. The intro runs
// in a full-window iframe over the page while the viewer starts and loads its
// model underneath; "Enter the viewer" fades it away (it tells this page via
// postMessage, same origin only), "Skip intro" and Escape close it at once.
// Only on the standalone page (index.html) - not embedded, not in Drupal or
// the app, which do not ship the intro.

const SEEN_KEY = 'explora4d-intro-seen';
// No word from the intro page this long after it was asked for (it did not
// load, its script failed): the viewer is shown.
const READY_TIMEOUT = 15000;

let shown = false;

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
  const fromUrl = parseBoolean(new URLSearchParams(window.location.search).get('intro'));
  if (fromUrl !== undefined) return fromUrl;
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
  if (shown || !standalone || window.__E2E__) return false;
  if (!wanted(settings)) return false;
  shown = true;
  remember(settings);

  const url = new URL(String(settings?.url || 'intro.html'), window.location.href);
  if (url.origin !== window.location.origin) {
    console.warn('[intro] viewer.intro.url must be a page of this site:', url.href);
    return false;
  }
  // In the hash: kept through a server's redirect (some drop the query).
  const hash = new URLSearchParams({ embedded: '1' });
  if (lang) hash.set('lang', lang);
  if (parseBoolean(settings?.sound)) hash.set('sound', '1');
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
  frame.title = 'ExPlora4D';
  frame.allow = 'autoplay; fullscreen';
  Object.assign(frame.style, { width: '100%', height: '100%', border: '0', display: 'block' });
  overlay.appendChild(frame);
  document.body.appendChild(overlay);
  const previousOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';

  let closed = false;
  function close(fade = 0.6, delay = 0) {
    if (closed) return;
    closed = true;
    window.removeEventListener('message', onMessage);
    window.removeEventListener('keydown', onKey);
    clearTimeout(readyTimer);
    overlay.style.transition = `opacity ${fade}s ease ${delay}s`;
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    setTimeout(() => {
      overlay.remove();
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
    // The points fly apart and the picture darkens: the viewer shows through.
    if (data.action === 'leaving') close(1.0, 0.45);
    if (data.action === 'done') close(0.5);
  }

  function onKey(event) {
    if (event.key === 'Escape') close(0.4);
  }

  const readyTimer = setTimeout(() => close(0.4), READY_TIMEOUT);
  window.addEventListener('message', onMessage);
  window.addEventListener('keydown', onKey);
  frame.addEventListener('load', () => frame.contentWindow?.focus());
  return true;
}

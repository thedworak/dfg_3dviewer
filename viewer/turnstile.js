import { t } from "./i18n-utils.js";

// Cloudflare Turnstile in front of a login, a registration, a password
// reset and an administrator's second step (worker/turnstile.py). The
// worker names its site key and the protected actions in GET
// /api/auth/config ("turnstile": {siteKey, actions}); without it nothing
// is shown. Cloudflare's script is loaded the first time a widget is
// needed, straight from Cloudflare (it must not be copied or cached
// elsewhere). The page sends the widget's token as "turnstileToken"; it
// is good once, so the widget starts again after every attempt.

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise = null;

function loadScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("no turnstile")));
      script.onerror = () => {
        scriptPromise = null;
        script.remove();
        reject(new Error("Turnstile could not be loaded"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

// Whether the worker asks for the check before this action.
export function turnstileProtects(config, action) {
  return Boolean(config?.siteKey && Array.isArray(config.actions) && config.actions.includes(action));
}

// A widget for a form: { element, token(), reset(), remove() }. token()
// gives the current token, or throws a message to show when the check is
// not done (yet). With the action unprotected: no element, an empty token.
// The page's own light or dark (the viewer's body, the admin pages' <html>),
// else the system's.
function pageTheme() {
  const theme = document.documentElement.dataset.viewerTheme || document.body?.dataset.viewerTheme;
  return theme === "dark" || theme === "light" ? theme : "auto";
}

export function createTurnstile(config, action, { theme = pageTheme() } = {}) {
  if (!turnstileProtects(config, action)) {
    return { element: null, token: async () => "", reset() {}, remove() {} };
  }
  const element = document.createElement("div");
  element.className = "viewer-turnstile";
  const note = document.createElement("p");
  note.className = "viewer-turnstile-note";
  note.hidden = true;
  const slot = document.createElement("div");
  element.append(slot, note);

  let widgetId = null;
  let current = "";
  let removed = false;
  const failed = (text) => {
    note.textContent = text;
    note.hidden = false;
  };

  loadScript().then((turnstile) => {
    if (removed) return;
    widgetId = turnstile.render(slot, {
      sitekey: config.siteKey,
      action,
      theme,
      language: document.documentElement.lang || "auto",
      callback: (value) => {
        current = value;
        note.hidden = true;
      },
      "expired-callback": () => {
        current = "";
      },
      "error-callback": () => {
        current = "";
        failed(t("loginPanel.turnstileError", "The check did not work. Reload the page or try again in a moment."));
        // Turnstile's own retry is left to it: returning nothing here.
      },
    });
  }).catch(() => failed(t("loginPanel.turnstileUnavailable", "The check could not be loaded. Check your connection and try again.")));

  return {
    element,
    async token() {
      if (!current) throw new Error(t("loginPanel.turnstilePending", "Confirm that you are not a robot first."));
      return current;
    },
    // A token is good once: after every request, a new one.
    reset() {
      current = "";
      if (widgetId !== null) window.turnstile?.reset(widgetId);
    },
    remove() {
      removed = true;
      if (widgetId !== null) window.turnstile?.remove(widgetId);
      element.remove();
    },
  };
}

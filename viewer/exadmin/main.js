import { t, setLanguageSource } from "../i18n-utils.js";
import { createPasswordField } from "../ui/password-field.js";
import { apiRequest, appMode, authRequest, storeDeviceToken } from "./api.js";
import { confirmDialog, toast } from "./dialogs.js";
import { closePanel } from "./app-bridge.js";
import { renderTwoFactorSetup, renderTwoFactorVerify } from "./two-factor.js";
import { createTurnstile } from "../turnstile.js";
import { SECTIONS } from "./sections/index.js";

// The admin pages (/exadmin/): the worker's administration, apart from the
// viewer. Same-origin with the worker, so the viewer's login (the worker's
// session cookie) is valid here as well. Language and theme follow what
// the viewer stored (viewer-defaults.js storage keys).

const LANGUAGE_STORAGE_KEY = "viewer-language";
const THEME_STORAGE_KEY = "manifesto-dark-mode";
const LANGUAGES = ["en", "pl", "de"];

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice lasts until the page is left.
  }
}

function storedLanguage() {
  const pick = (value) => LANGUAGES.find((lang) => String(value || "").toLowerCase().startsWith(lang));
  return pick(readStorage(LANGUAGE_STORAGE_KEY)) || pick(navigator.language) || "en";
}

let language = storedLanguage();
setLanguageSource(() => language);

// The viewer's default is dark; "0" stored = light.
function applyTheme() {
  const theme = readStorage(THEME_STORAGE_KEY) === "0" ? "light" : "dark";
  document.documentElement.dataset.viewerTheme = theme;
  return theme;
}

const page = {
  main: document.getElementById("exadminMain"),
  nav: document.getElementById("exadminNav"),
  account: document.getElementById("exadminAccount"),
  title: document.getElementById("exadminTitle"),
  viewerLink: document.getElementById("exadminViewerLink"),
};

let me = null;
// The signed-in admin's second step (GET /api/auth/me twoFactor).
let twoFactor = null;

function messageBlock(text, tone = "info") {
  const block = document.createElement("p");
  block.className = "exadmin-message";
  block.dataset.tone = tone;
  block.textContent = text;
  return block;
}

function renderChrome() {
  document.documentElement.lang = language;
  document.title = t("exadmin.title", "Administration");
  page.title.textContent = t("exadmin.title", "Administration");
  page.viewerLink.textContent = t("exadmin.backToViewer", "Back to the viewer");
  // In the app: back to its viewer (the panel lies over it, app-bridge.js).
  if (appMode && !page.viewerLink.dataset.bound) {
    page.viewerLink.dataset.bound = "true";
    page.viewerLink.addEventListener("click", (event) => {
      event.preventDefault();
      closePanel();
    });
  }

  page.account.textContent = "";
  const languageSelect = document.createElement("select");
  languageSelect.className = "exadmin-language";
  languageSelect.setAttribute("aria-label", t("exadmin.language", "Language"));
  LANGUAGES.forEach((lang) => languageSelect.appendChild(new Option(lang.toUpperCase(), lang)));
  languageSelect.value = language;
  languageSelect.addEventListener("change", () => {
    language = languageSelect.value;
    writeStorage(LANGUAGE_STORAGE_KEY, language);
    render();
  });

  const themeButton = document.createElement("button");
  themeButton.type = "button";
  themeButton.className = "exadmin-theme";
  const isDark = applyTheme() === "dark";
  themeButton.textContent = isDark ? "☀️" : "🌙";
  themeButton.title = isDark ? t("theme.lightMode", "Light mode") : t("theme.darkMode", "Dark mode");
  themeButton.setAttribute("aria-label", themeButton.title);
  themeButton.addEventListener("click", () => {
    writeStorage(THEME_STORAGE_KEY, isDark ? "0" : "1");
    renderChrome();
  });

  page.account.append(languageSelect, themeButton);
  if (me) {
    const user = document.createElement("span");
    user.className = "exadmin-user";
    user.textContent = t("loginPanel.openSignedIn", { user: me }, "Signed in as {user}");
    const logout = document.createElement("button");
    logout.type = "button";
    logout.textContent = t("uploadPanel.logout", "Log out");
    logout.addEventListener("click", async () => {
      try {
        await authRequest("logout", {});
      } catch (error) {
        console.error("[exadmin] Logout failed:", error);
      }
      start();
    });
    // The app has its own login: signing out stays there.
    // This device is remembered for the second step: a way to undo it
    // (every remembered device of the account asks for a code again).
    if (twoFactor?.remembered) page.account.append(forgetDevicesButton());
    if (appMode) page.account.append(user);
    else page.account.append(user, logout);
  }
}

function forgetDevicesButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = t("exadmin.twoFactorForget", "Forget remembered devices");
  button.title = t("exadmin.twoFactorForgetTitle", "This and your other remembered devices ask for a code again.");
  button.addEventListener("click", async () => {
    const confirmed = await confirmDialog({
      message: t("exadmin.twoFactorForgetConfirm",
        "Forget every device you chose to remember? Each of them asks for a code from your authenticator app again."),
      confirmLabel: t("exadmin.twoFactorForget", "Forget remembered devices"),
      cancelLabel: t("adminPanel.deleteCancel", "Cancel"),
    });
    if (!confirmed) return;
    try {
      await apiRequest("/api/auth/2fa/forget-devices", "POST", {});
      storeDeviceToken("");
      toast("userUpdated", "success");
      await start();
    } catch (error) {
      console.error("[exadmin] Could not forget the devices:", error);
    }
  });
  return button;
}

function renderLogin(message) {
  const form = document.createElement("form");
  form.className = "exadmin-login";
  const heading = document.createElement("h2");
  heading.textContent = t("exadmin.loginTitle", "Log in as an administrator");
  const username = document.createElement("input");
  username.type = "text";
  username.autocomplete = "username";
  username.autocapitalize = "off";
  username.required = true;
  username.placeholder = t("uploadPanel.username", "Username");
  username.setAttribute("aria-label", username.placeholder);
  const { field: passwordField, input: password } = createPasswordField();
  password.required = true;
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = t("uploadPanel.login", "Log in");
  const status = messageBlock(message || "", message ? "error" : "info");
  // Cloudflare Turnstile, when the worker asks for it (worker/turnstile.py).
  const check = createTurnstile(authConfig?.turnstile, "login");
  form.append(heading, username, passwordField, ...(check.element ? [check.element] : []), submit, status);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    try {
      await authRequest("login", { username: username.value.trim(), password: password.value, turnstileToken: await check.token() });
      await start();
    } catch (error) {
      status.dataset.tone = "error";
      status.textContent = error.message;
      submit.disabled = false;
      check.reset();
    }
  });
  page.main.appendChild(form);
  username.focus();
}

function currentSection() {
  const id = location.hash.replace(/^#/, "");
  return SECTIONS.find((section) => section.id === id) || SECTIONS[0];
}

// The navigation's counters (GET /api/admin/summary): a section with a
// badge(summary) shows what waits there - {text, alert, title} or null.
let summary = null;

function renderNavBadges() {
  page.nav.querySelectorAll("a[data-section]").forEach((link) => {
    const section = SECTIONS.find((item) => item.id === link.dataset.section);
    link.querySelector(".exadmin-nav-badge")?.remove();
    const badge = summary && section?.badge ? section.badge(summary) : null;
    if (!badge) return;
    const element = document.createElement("span");
    element.className = "exadmin-nav-badge";
    if (badge.alert) element.dataset.alert = "true";
    element.textContent = badge.text;
    element.title = badge.title || "";
    if (badge.title) element.setAttribute("aria-label", badge.title);
    link.appendChild(element);
  });
}

async function refreshSummary() {
  try {
    summary = await apiRequest("/api/admin/summary");
  } catch (error) {
    // An older worker, or a moment offline: the navigation stays plain.
    console.warn("[exadmin] No summary:", error.message);
    summary = null;
  }
  renderNavBadges();
}

// A section changed something the counters count (approved an account,
// resolved a report): exadmin:changed asks for them again.
window.addEventListener("exadmin:changed", () => {
  if (state.view === "sections") refreshSummary();
});

function renderSection() {
  const active = currentSection();
  page.nav.textContent = "";
  SECTIONS.forEach((section) => {
    const link = document.createElement("a");
    link.href = `#${section.id}`;
    link.dataset.section = section.id;
    link.textContent = section.label();
    if (section === active) link.setAttribute("aria-current", "page");
    page.nav.appendChild(link);
  });
  page.nav.appendChild(reloadButton());
  renderNavBadges();
  refreshSummary();
  page.main.textContent = "";
  active.mount(page.main, { me });
}

// Fetches the open section's values again (its mount() loads them), the
// page itself stays: no reload, no lost place in the navigation.
const RELOAD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function reloadButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "exadmin-reload";
  button.innerHTML = RELOAD_ICON;
  button.title = t("exadmin.reload", "Refresh");
  button.setAttribute("aria-label", button.title);
  button.addEventListener("click", () => {
    renderSection();
    // The new button turns once: the values are on their way.
    page.nav.querySelector(".exadmin-reload")?.classList.add("is-spinning");
  });
  return button;
}

// What the page shows: who is signed in decides between the sections, the
// login form and a notice (accounts off, signed in without admin rights).
let state = { view: "loading" };
// GET /api/auth/config: accounts, and Turnstile's site key (login, 2FA).
let authConfig = null;

function render() {
  renderChrome();
  page.nav.textContent = "";
  page.main.textContent = "";
  if (state.view === "sections") renderSection();
  else if (state.view === "twoFactorSetup") {
    renderTwoFactorSetup(page.main, { user: me, turnstile: authConfig?.turnstile, rememberDays: twoFactor?.rememberDays, onDone: start });
  } else if (state.view === "twoFactorVerify") {
    renderTwoFactorVerify(page.main, {
      recoveryLeft: state.recoveryLeft, turnstile: authConfig?.turnstile, rememberDays: twoFactor?.rememberDays, onDone: start,
    });
  }
  else if (state.view === "login") renderLogin(state.message);
  else if (state.view === "accountsOff") page.main.appendChild(messageBlock(t("exadmin.accountsOff", "Accounts are not enabled on this server, so there is nothing to administer here.")));
  else if (state.view === "error") page.main.appendChild(messageBlock(t("exadmin.unreachable", "The server is not responding."), "error"));
  else page.main.appendChild(messageBlock(t("exadmin.loading", "Loading...")));
}

async function start() {
  me = null;
  twoFactor = null;
  state = { view: "loading" };
  render();
  try {
    const config = await authRequest("config");
    authConfig = config;
    if (config.mode !== "required") {
      state = { view: "accountsOff" };
    } else {
      const session = await authRequest("me");
      if (session.user && session.role === "admin") {
        me = session.user;
        twoFactor = session.twoFactor || null;
        // The admin pages' second step (worker WORKER_ADMIN_2FA).
        const second = session.twoFactor?.state;
        if (second === "setup") state = { view: "twoFactorSetup" };
        else if (second === "verify") state = { view: "twoFactorVerify", recoveryLeft: session.twoFactor.recoveryLeft };
        else state = { view: "sections" };
      } else {
        state = {
          view: "login",
          message: session.user
            ? t("exadmin.notAdmin", { user: session.user }, "{user} is not an administrator.")
            : "",
        };
      }
    }
  } catch (error) {
    console.error("[exadmin] Could not read the session:", error);
    state = { view: "error" };
  }
  render();
}

// A section was refused for want of the second step (it lapsed while the
// page was open): asked for again.
window.addEventListener("exadmin:second-step", () => {
  if (state.view === "sections") start();
});

window.addEventListener("hashchange", () => {
  if (state.view === "sections") renderSection();
});
// The theme or language changed in the viewer in another tab.
window.addEventListener("storage", (event) => {
  if (event.key === LANGUAGE_STORAGE_KEY) language = storedLanguage();
  if (event.key === LANGUAGE_STORAGE_KEY || event.key === THEME_STORAGE_KEY) render();
});

applyTheme();
start();

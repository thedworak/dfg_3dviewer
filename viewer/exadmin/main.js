import { t, setLanguageSource } from "../i18n-utils.js";
import { createPasswordField } from "../ui/password-field.js";
import { authRequest } from "./api.js";
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
    page.account.append(user, logout);
  }
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
  form.append(heading, username, passwordField, submit, status);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    try {
      await authRequest("login", { username: username.value.trim(), password: password.value });
      await start();
    } catch (error) {
      status.dataset.tone = "error";
      status.textContent = error.message;
      submit.disabled = false;
    }
  });
  page.main.appendChild(form);
  username.focus();
}

function currentSection() {
  const id = location.hash.replace(/^#/, "");
  return SECTIONS.find((section) => section.id === id) || SECTIONS[0];
}

function renderSection() {
  const active = currentSection();
  page.nav.textContent = "";
  SECTIONS.forEach((section) => {
    const link = document.createElement("a");
    link.href = `#${section.id}`;
    link.textContent = section.label();
    if (section === active) link.setAttribute("aria-current", "page");
    page.nav.appendChild(link);
  });
  page.main.textContent = "";
  active.mount(page.main, { me });
}

// What the page shows: who is signed in decides between the sections, the
// login form and a notice (accounts off, signed in without admin rights).
let state = { view: "loading" };

function render() {
  renderChrome();
  page.nav.textContent = "";
  page.main.textContent = "";
  if (state.view === "sections") renderSection();
  else if (state.view === "login") renderLogin(state.message);
  else if (state.view === "accountsOff") page.main.appendChild(messageBlock(t("exadmin.accountsOff", "Accounts are not enabled on this server, so there is nothing to administer here.")));
  else if (state.view === "error") page.main.appendChild(messageBlock(t("exadmin.unreachable", "The server is not responding."), "error"));
  else page.main.appendChild(messageBlock(t("exadmin.loading", "Loading...")));
}

async function start() {
  me = null;
  state = { view: "loading" };
  render();
  try {
    const config = await authRequest("config");
    if (config.mode !== "required") {
      state = { view: "accountsOff" };
    } else {
      const session = await authRequest("me");
      if (session.user && session.role === "admin") {
        me = session.user;
        state = { view: "sections" };
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

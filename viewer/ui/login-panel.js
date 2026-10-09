import { core } from "../core.js";
import { apiUrl, appRequestHeaders, deleteAccountUrl, hasRemote, isAppBuild, setSessionToken } from "../remote.js";
import { t } from "../i18n-utils.js";
import { onAccountChange, onAppLogin } from "../app-hooks.js";
import { makePanelWindow } from "./panel-window.js";
import { createPasswordField } from "./password-field.js";

// Worker endpoints (see worker/auth.py). On a page the repository serves,
// the session is a same-origin cookie; the app (another origin) sends its
// session token instead (remote.js appRequestHeaders).
async function authRequest(path, body) {
  const headers = appRequestHeaders();
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(apiUrl(`/api/auth/${path}`), {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await response.json();
  } catch (_error) {
    // Non-JSON error page (e.g. from a proxy) - fall through with the status.
  }
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

// Opens outside the viewer (in the app: the system browser).
export function createDeleteAccountLink() {
  const link = document.createElement("a");
  link.className = "delete-account-link";
  link.href = deleteAccountUrl();
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = t("plans.accountDelete", "Delete account and data");
  return link;
}

// The plan of an account (worker/auth.py effective_app_plan), next to its name.
export function createPlanBadge(tier) {
  const badge = document.createElement("span");
  badge.className = "plan-badge";
  badge.dataset.tier = tier;
  badge.textContent = t(`plans.${tier}`, tier);
  badge.title = t("loginPanel.planTitle", "Plan bought in the app");
  return badge;
}

export function attachLoginPanel(Viewer) {
  Object.assign(Viewer, {
    // Accounts are enforced by the worker (WORKER_AUTH_MODE); the manifest's
    // AIM3DViewer.viewer.auth only tunes the UI: enabled:false hides it,
    // allowRegistration:false hides the register button.
    async refreshAuthState() {
      const uiConfig = core.CONFIG?.viewer?.auth || {};
      const state = { required: false, registration: false, user: null, role: null, plan: null, maxUploadBytes: 0 };
      // The upload limit is reported by the same endpoint, so query it even
      // when the manifest hides the login UI. The app build with no
      // repository configured has no worker to ask: accounts off.
      if (hasRemote()) {
        try {
          const serverConfig = await authRequest("config");
          state.maxUploadBytes = Number(serverConfig.maxUploadBytes) || 0;
          if (uiConfig.enabled !== false) {
            state.required = serverConfig.mode === "required";
            state.registration =
              serverConfig.registration !== "closed" && uiConfig.allowRegistration !== false;
            if (state.required) {
              const me = await authRequest("me");
              state.user = me.user || null;
              state.role = me.role || null;
              // The account's plan, if the worker has plans (app-hooks.js).
              state.plan = me.plan || null;
              onAccountChange(state.user ? state.plan : null);
              // An expired or revoked app session: start signed out.
              if (!state.user) setSessionToken("");
            }
          }
        } catch (_error) {
          // Older worker without /api/auth/*: behaves as accounts off.
        }
      }
      this.authState = state;
      this.renderUploadHint?.();
      this.renderUploadAuthNotice?.();
      // Limits and usage depend on who is logged in.
      if (this.isUploadPanelOpen?.()) this.refreshUploadLimits?.();
      this.renderLoginPanel();
      this.updateLoginMenuEntryState();
      this.updateAdminMenuEntryState?.();
      return state;
    },

    updateLoginMenuEntryState() {
      if (!this.loginButton) return;
      this.loginButton.hidden = !this.authState?.required;
      const signedIn = Boolean(this.authState?.user);
      this.loginButton.dataset.signedIn = signedIn ? "true" : "false";
      this.loginButton.innerHTML = `<span class="login-icon" aria-hidden="true"></span>`;
      const plan = this.authState?.plan?.tier;
      const user = plan ? `${this.authState.user} (${t(`plans.${plan}`, plan)})` : this.authState?.user;
      const a11yLabel = signedIn
        ? t("loginPanel.openSignedIn", { user }, "Signed in as {user}")
        : t("menu.openLoginPanel", "Log in or register");
      this.loginButton.setAttribute("aria-label", a11yLabel);
      this.loginButton.setAttribute("title", a11yLabel);
    },

    isLoginPanelOpen() {
      return this.loginPanel?.hidden === false;
    },

    openLoginPanel(event) {
      this.createLoginPanel();
      this.toggleLoginPanel(event);
    },

    toggleLoginPanel(event) {
      event?.preventDefault?.();
      this.closeActionMenu?.();
      if (!this.loginPanel) return;
      const willShow = this.loginPanel.hidden === true;
      this.loginPanel.hidden = !willShow;
      if (willShow) {
        this.setLoginStatusText("");
        this.refreshAuthState();
      }
    },

    closeLoginPanel() {
      if (this.loginPanel) this.loginPanel.hidden = true;
    },

    setLoginStatusText(message, tone = "info") {
      if (!this.loginInputs?.status) return;
      this.loginInputs.status.textContent = message;
      this.loginInputs.status.dataset.tone = tone;
    },

    createLoginPanel() {
      if (!core.container || this.loginPanel) return;

      const panel = document.createElement("div");
      panel.id = "loginPanel";
      panel.hidden = true;
      panel.innerHTML = `
        <div class="upload-panel-header">
          <span>${t("loginPanel.title", "Account")}</span>
          <button id="loginPanelClose" type="button" aria-label="${t("loginPanel.closeAria", "Close account panel")}">X</button>
        </div>
        <div id="loginPanelAuth" class="upload-panel-auth"></div>
        <p id="loginPanelStatus" class="upload-panel-status" role="status" aria-live="polite"></p>
      `;

      core.container.appendChild(panel);
      this.loginPanel = panel;
      this.loginInputs = {
        auth: panel.querySelector("#loginPanelAuth"),
        status: panel.querySelector("#loginPanelStatus"),
      };
      this.bindEventListener(panel.querySelector("#loginPanelClose"), "click", () => this.closeLoginPanel());
      makePanelWindow(this, panel, panel.querySelector(".upload-panel-header"));
      this.renderLoginPanel();
    },

    renderLoginPanel() {
      const section = this.loginInputs?.auth;
      if (!section) return;
      const state = this.authState || { required: false };
      section.textContent = "";

      if (!state.required) {
        const note = document.createElement("p");
        note.className = "upload-panel-hint";
        note.textContent = t("loginPanel.notRequired", "Accounts are not enabled on this server.");
        section.appendChild(note);
        return;
      }

      if (state.user) {
        const label = document.createElement("span");
        label.textContent = t("uploadPanel.signedInAs", { user: state.user }, "Signed in as {user}");
        if (state.plan) label.appendChild(createPlanBadge(state.plan.tier));
        const logout = document.createElement("button");
        logout.type = "button";
        logout.textContent = t("uploadPanel.logout", "Log out");
        this.bindEventListener(logout, "click", () => this.handleAuthAction("logout"));
        section.append(label, logout, createDeleteAccountLink());
        return;
      }

      const username = document.createElement("input");
      username.type = "text";
      username.autocomplete = "username";
      username.autocapitalize = "off";
      username.placeholder = t("uploadPanel.username", "Username");
      username.setAttribute("aria-label", username.placeholder);
      const { field: passwordField, input: password } = createPasswordField();
      const login = document.createElement("button");
      login.type = "button";
      login.textContent = t("uploadPanel.login", "Log in");
      this.bindEventListener(login, "click", () =>
        this.handleAuthAction("login", { username: username.value.trim(), password: password.value })
      );
      this.bindEventListener(password, "keydown", (event) => {
        if (event.key === "Enter") login.click();
      });
      section.append(username, passwordField, login);
      if (state.registration) {
        // Only needed to register (AUTH.register() rejects a missing/invalid
        // address server-side); login doesn't use it, so it stays out of the
        // shared username/password row above.
        const email = document.createElement("input");
        email.type = "email";
        email.autocomplete = "email";
        email.placeholder = t("uploadPanel.email", "Email");
        email.setAttribute("aria-label", email.placeholder);
        const register = document.createElement("button");
        register.type = "button";
        register.textContent = t("uploadPanel.register", "Register");
        this.bindEventListener(register, "click", () =>
          this.handleAuthAction("register", {
            username: username.value.trim(),
            password: password.value,
            email: email.value.trim(),
          })
        );
        section.append(email, register);
      }
    },

    async handleAuthAction(action, credentials) {
      try {
        if (action === "register") {
          const result = await authRequest("register", credentials);
          this.setLoginStatusText(
            result.status === "pending"
              ? t("uploadPanel.registeredPending", "Account created. It must be approved before you can upload.")
              : t("uploadPanel.registeredActive", "Account created. You can log in now."),
            "success"
          );
          return;
        }
        await this.runAuthAction(action, credentials);
        this.setLoginStatusText("");
      } catch (error) {
        this.setLoginStatusText(error.message, "error");
      }
    },

    // Logs in or out and updates everything that depends on the account.
    // Throws the worker's message (e.g. "Unknown username.") - other panels
    // sign in through this too and show it there.
    async runAuthAction(action, credentials) {
      if (action === "login" && isAppBuild()) {
        const result = await authRequest("login", { ...credentials, session: "token" });
        setSessionToken(result.token);
        await onAppLogin();
      } else {
        await authRequest(action, credentials || {});
        if (action === "logout") setSessionToken("");
      }
      await this.refreshAuthState();
      if (this.plansPanel?.hidden === false) this.renderPlansPanel?.();
      // Delete permissions in the models panel depend on who's logged in;
      // refresh it too if it's already open.
      this.loadModelsList?.();
    },
  });
}

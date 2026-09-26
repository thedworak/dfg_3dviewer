import { core } from "../core.js";
import { apiUrl, hasRemote } from "../remote.js";
import { t } from "../i18n-utils.js";
import { makePanelWindow } from "./panel-window.js";

// Same-origin worker endpoints (see worker/auth.py). Cookies travel by default
// for same-origin requests, so no credentials option is needed.
async function authRequest(path, body) {
  const response = await fetch(apiUrl(`/api/auth/${path}`), {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
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

export function attachLoginPanel(Viewer) {
  Object.assign(Viewer, {
    // Accounts are enforced by the worker (WORKER_AUTH_MODE); the manifest's
    // AIM3DViewer.viewer.auth only tunes the UI: enabled:false hides it,
    // allowRegistration:false hides the register button.
    async refreshAuthState() {
      const uiConfig = core.CONFIG?.viewer?.auth || {};
      const state = { required: false, registration: false, user: null, role: null, maxUploadBytes: 0 };
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
      const a11yLabel = signedIn
        ? t("loginPanel.openSignedIn", { user: this.authState.user }, "Signed in as {user}")
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
        const logout = document.createElement("button");
        logout.type = "button";
        logout.textContent = t("uploadPanel.logout", "Log out");
        this.bindEventListener(logout, "click", () => this.handleAuthAction("logout"));
        section.append(label, logout);
        return;
      }

      const username = document.createElement("input");
      username.type = "text";
      username.autocomplete = "username";
      username.placeholder = t("uploadPanel.username", "Username");
      username.setAttribute("aria-label", username.placeholder);
      const password = document.createElement("input");
      password.type = "password";
      password.autocomplete = "current-password";
      password.placeholder = t("uploadPanel.password", "Password");
      password.setAttribute("aria-label", password.placeholder);
      const login = document.createElement("button");
      login.type = "button";
      login.textContent = t("uploadPanel.login", "Log in");
      this.bindEventListener(login, "click", () =>
        this.handleAuthAction("login", { username: username.value.trim(), password: password.value })
      );
      this.bindEventListener(password, "keydown", (event) => {
        if (event.key === "Enter") login.click();
      });
      section.append(username, password, login);
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
        await authRequest(action, credentials || {});
        this.setLoginStatusText("");
        await this.refreshAuthState();
        // Delete permissions in the models panel depend on who's logged in;
        // refresh it too if it's already open.
        this.loadModelsList?.();
      } catch (error) {
        this.setLoginStatusText(error.message, "error");
      }
    },
  });
}

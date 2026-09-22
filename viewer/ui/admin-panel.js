import { core } from "../core.js";
import { toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";

// Same-origin worker endpoints (see worker/auth.py's "administration" methods
// and server.py's _require_admin/_handle_admin_*). Deliberately separate from
// authRequest() in upload-panel.js: every call here needs an admin session,
// while /api/auth/* is reachable by anyone.
async function adminRequest(path, method = "GET") {
  const response = await fetch(`/api/admin/users${path}`, { method });
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

export function attachAdminPanel(Viewer) {
  Object.assign(Viewer, {
    isAdminUser() {
      return Boolean(this.authState?.required && this.authState?.user && this.authState?.role === "admin");
    },

    updateAdminMenuEntryState() {
      if (!this.manageUsersButton) return;
      const show = this.isAdminUser();
      this.manageUsersButton.hidden = !show;
      if (!show) return;
      this.manageUsersButton.innerHTML = `<span class="admin-users-icon" aria-hidden="true"></span>`;
      const a11yLabel = t("menu.openAdminPanel", "Manage registered users");
      this.manageUsersButton.setAttribute("aria-label", a11yLabel);
      this.manageUsersButton.setAttribute("title", a11yLabel);
    },

    isAdminPanelOpen() {
      return this.adminPanel?.hidden === false;
    },

    openAdminPanel(event) {
      if (!this.isAdminUser()) return;
      this.createAdminPanel();
      this.toggleAdminPanel(event);
    },

    toggleAdminPanel(event) {
      event?.preventDefault?.();
      this.closeActionMenu?.();
      if (!this.adminPanel) return;
      const willShow = this.adminPanel.hidden === true;
      this.adminPanel.hidden = !willShow;
      if (willShow) this.loadUsersList();
    },

    closeAdminPanel() {
      if (this.adminPanel) this.adminPanel.hidden = true;
    },

    setAdminStatusText(message, tone = "info") {
      if (!this.adminInputs?.status) return;
      this.adminInputs.status.textContent = message;
      this.adminInputs.status.dataset.tone = tone;
    },

    createAdminPanel() {
      if (!core.container || this.adminPanel) return;

      const panelText = {
        title: t("adminPanel.title", "Manage users"),
        closeAria: t("adminPanel.closeAria", "Close user management panel"),
      };

      const panel = document.createElement("div");
      panel.id = "adminUsersPanel";
      panel.hidden = true;
      panel.innerHTML = `
        <div class="upload-panel-header">
          <span>${panelText.title}</span>
          <button id="adminPanelClose" type="button" aria-label="${panelText.closeAria}">X</button>
        </div>
        <p id="adminPanelStatus" class="upload-panel-status" role="status" aria-live="polite"></p>
        <ul id="adminUsersList" class="admin-users-list"></ul>
      `;

      core.container.appendChild(panel);
      this.adminPanel = panel;
      this.adminInputs = {
        status: panel.querySelector("#adminPanelStatus"),
        list: panel.querySelector("#adminUsersList"),
      };

      const closeButton = panel.querySelector("#adminPanelClose");
      this.bindEventListener(closeButton, "click", () => this.closeAdminPanel());
    },

    async loadUsersList() {
      if (!this.adminInputs?.list) return;
      const list = this.adminInputs.list;
      list.textContent = "";
      this.setAdminStatusText("");

      let users = [];
      try {
        users = (await adminRequest("")).users || [];
      } catch (error) {
        this.reportError(error, { context: "Failed to load users list" });
        this.setAdminStatusText(t("adminPanel.loadError", "Could not load the user list."), "error");
        return;
      }

      if (users.length === 0) {
        const empty = document.createElement("li");
        empty.className = "admin-users-empty";
        empty.textContent = t("adminPanel.empty", "No registered users yet.");
        list.appendChild(empty);
        return;
      }

      users.forEach((user) => list.appendChild(this.renderUserRow(user)));
    },

    renderUserRow(user) {
      const item = document.createElement("li");
      item.className = "admin-users-row";

      const info = document.createElement("div");
      info.className = "admin-users-info";
      const name = document.createElement("span");
      name.className = "admin-users-name";
      name.textContent = user.username;
      const meta = document.createElement("span");
      meta.className = "admin-users-meta";
      const created = user.createdAt ? new Date(user.createdAt * 1000).toLocaleDateString() : "";
      meta.textContent = [user.email, `${user.role} · ${user.status}`, created].filter(Boolean).join(" · ");
      info.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "admin-users-actions";
      const isSelf = user.username === this.authState?.user;

      if (user.status === "pending" || user.status === "disabled") {
        actions.appendChild(
          this.createUserActionButton(user.username, "approve", t("adminPanel.approve", "Approve"))
        );
      } else if (!isSelf) {
        actions.appendChild(
          this.createUserActionButton(user.username, "disable", t("adminPanel.disable", "Disable"))
        );
      }

      if (!isSelf) {
        if (user.role === "admin") {
          actions.appendChild(
            this.createUserActionButton(user.username, "demote", t("adminPanel.demote", "Demote"))
          );
        } else {
          actions.appendChild(
            this.createUserActionButton(user.username, "promote", t("adminPanel.promote", "Promote"))
          );
        }
      }

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "admin-users-delete";
      deleteButton.textContent = t("adminPanel.delete", "Delete");
      deleteButton.disabled = isSelf;
      deleteButton.title = isSelf ? t("adminPanel.cannotDeleteSelf", "You cannot delete your own account.") : "";
      this.bindEventListener(deleteButton, "click", () => this.deleteUserWithConfirm(user.username));
      actions.appendChild(deleteButton);

      item.append(info, actions);
      return item;
    },

    createUserActionButton(username, action, label) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      this.bindEventListener(button, "click", () => this.performUserAction(username, action));
      return button;
    },

    async performUserAction(username, action) {
      try {
        await adminRequest(`/${encodeURIComponent(username)}/${action}`, "POST");
        toastHelper("userUpdated", "success");
        await this.loadUsersList();
      } catch (error) {
        this.reportError(error, { context: `Failed to ${action} user` });
        this.setAdminStatusText(error.message, "error");
      }
    },

    async deleteUserWithConfirm(username) {
      const confirmed = await this.confirmDialog({
        message: t(
          "adminPanel.deleteConfirm",
          { user: username },
          'Delete user "{user}"? This permanently removes their account.'
        ),
        confirmLabel: t("adminPanel.deleteAction", "Delete"),
        cancelLabel: t("adminPanel.deleteCancel", "Cancel"),
        danger: true,
      });
      if (!confirmed) return;

      try {
        await adminRequest(`/${encodeURIComponent(username)}`, "DELETE");
        toastHelper("userDeleted", "info");
        await this.loadUsersList();
      } catch (error) {
        this.reportError(error, { context: "Failed to delete user" });
        this.setAdminStatusText(error.message, "error");
      }
    },
  });
}

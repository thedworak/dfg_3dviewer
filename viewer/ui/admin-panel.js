import { core } from "../core.js";
import { apiUrl, remoteAssetUrl } from "../remote.js";
import { toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import { makePanelWindow } from "./panel-window.js";

// Same-origin worker endpoints (see worker/auth.py's "administration" methods
// and server.py's _require_admin/_handle_admin_*). Deliberately separate from
// authRequest() in upload-panel.js: every call here needs an admin session,
// while /api/auth/* is reachable by anyone.
async function adminRequest(path, method = "GET", body = undefined) {
  const options = { method };
  if (body !== undefined) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(apiUrl(`/api/admin/users${path}`), options);
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

// GET /api/jobs includes each job's `owner` username (see worker/server.py's
// list_jobs) - reused here to compute each user's upload count/listing
// without a dedicated endpoint.
async function fetchJobsByOwner() {
  const response = await fetch(apiUrl("/api/jobs"));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  const byOwner = new Map();
  for (const job of jobs) {
    if (!job.owner) continue;
    if (!byOwner.has(job.owner)) byOwner.set(job.owner, []);
    byOwner.get(job.owner).push(job);
  }
  return byOwner;
}

// Per-account upload limits (worker/limits.py). 0 means unlimited; an empty
// field falls back to the worker's WORKER_LIMIT_* default.
const LIMIT_FIELDS = [
  { key: "uploadsPerHour", label: ["adminPanel.limitUploadsPerHour", "Uploads per hour"] },
  { key: "uploadsPerDay", label: ["adminPanel.limitUploadsPerDay", "Uploads per day"] },
  { key: "storageMb", label: ["adminPanel.limitStorageMb", "Storage (MB)"] },
  { key: "maxModels", label: ["adminPanel.limitMaxModels", "Max models"] },
  { key: "concurrentJobs", label: ["adminPanel.limitConcurrentJobs", "Concurrent conversions"] },
];

function formatLimit(value) {
  return value ? String(value) : "∞";
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
      makePanelWindow(this, panel, panel.querySelector(".upload-panel-header"));
    },

    async loadUsersList() {
      if (!this.adminInputs?.list) return;
      const list = this.adminInputs.list;
      list.textContent = "";
      this.setAdminStatusText("");

      let users = [];
      try {
        const data = await adminRequest("");
        users = data.users || [];
        this.adminDefaultLimits = data.defaultLimits || null;
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

      // Upload stats/listing are best-effort - a failure here shouldn't
      // block the user list itself, just leave counts at 0/empty.
      let jobsByOwner = new Map();
      try {
        jobsByOwner = await fetchJobsByOwner();
      } catch (error) {
        this.reportError(error, { context: "Failed to load user upload stats" });
      }

      users.forEach((user) =>
        list.appendChild(this.renderUserRow(user, jobsByOwner.get(user.username) || []))
      );
    },

    renderUserRow(user, models = []) {
      const item = document.createElement("li");
      item.className = "admin-users-row";

      const top = document.createElement("div");
      top.className = "admin-users-row-top";

      const info = document.createElement("div");
      info.className = "admin-users-info";
      const name = document.createElement("span");
      name.className = "admin-users-name";
      name.textContent = user.username;
      const meta = document.createElement("span");
      meta.className = "admin-users-meta";
      const created = user.createdAt ? new Date(user.createdAt * 1000).toLocaleDateString() : "";
      const modelsCount = t("adminPanel.modelsCount", { count: models.length }, "{count} models");
      meta.textContent = [user.email, `${user.role} · ${user.status}`, modelsCount, created]
        .filter(Boolean)
        .join(" · ");
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

      top.append(info, actions);
      item.append(top, this.renderUserModelsTab(user.username, models));
      // Older workers do not report limits - leave the section out.
      if (user.effectiveLimits) item.appendChild(this.renderUserLimitsTab(user));
      return item;
    },

    renderUserLimitsTab(user) {
      const section = document.createElement("div");
      section.className = "admin-users-limits";

      const usage = user.usage || {};
      const limits = user.effectiveLimits || {};
      const summary = document.createElement("p");
      summary.className = "admin-users-limits-summary";
      summary.textContent = t(
        "adminPanel.limitsUsage",
        {
          hour: `${usage.uploadsLastHour ?? 0}/${formatLimit(limits.uploadsPerHour)}`,
          day: `${usage.uploadsLastDay ?? 0}/${formatLimit(limits.uploadsPerDay)}`,
          storage: `${((usage.storageBytes || 0) / 1048576).toFixed(1)}/${formatLimit(limits.storageMb)}`,
          models: `${usage.models ?? 0}/${formatLimit(limits.maxModels)}`,
        },
        "Uploads {hour} this hour, {day} today · Storage {storage} MB · Models {models}"
      );

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "admin-users-models-toggle";
      toggle.textContent = t("adminPanel.limitsShow", "Edit limits");

      const form = document.createElement("form");
      form.className = "admin-users-limits-form";
      form.hidden = true;

      if (user.role === "admin") {
        const note = document.createElement("p");
        note.className = "admin-users-limits-note";
        note.textContent = t("adminPanel.limitsAdmin", "Admins are not limited.");
        form.appendChild(note);
      }

      const overrides = user.limits || {};
      const defaults = this.adminDefaultLimits || {};
      const inputs = {};
      LIMIT_FIELDS.forEach(({ key, label }) => {
        const field = document.createElement("label");
        field.className = "admin-users-limits-field";
        const text = document.createElement("span");
        text.textContent = t(label[0], label[1]);
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.step = "1";
        input.inputMode = "numeric";
        input.value = overrides[key] ?? "";
        input.placeholder = t("adminPanel.limitsDefault", { value: formatLimit(defaults[key]) }, "default: {value}");
        field.append(text, input);
        form.appendChild(field);
        inputs[key] = input;
      });

      const hint = document.createElement("p");
      hint.className = "admin-users-limits-note";
      hint.textContent = t("adminPanel.limitsHint", "Empty = default, 0 = unlimited.");

      const buttons = document.createElement("div");
      buttons.className = "admin-users-actions";
      const save = document.createElement("button");
      save.type = "submit";
      save.textContent = t("adminPanel.limitsSave", "Save limits");
      const reset = document.createElement("button");
      reset.type = "button";
      reset.textContent = t("adminPanel.limitsReset", "Use defaults");
      buttons.append(save, reset);
      form.append(hint, buttons);

      this.bindEventListener(toggle, "click", () => {
        form.hidden = !form.hidden;
        toggle.textContent = form.hidden
          ? t("adminPanel.limitsShow", "Edit limits")
          : t("adminPanel.limitsHide", "Hide limits");
      });
      this.bindEventListener(form, "submit", (event) => {
        event.preventDefault();
        const payload = {};
        LIMIT_FIELDS.forEach(({ key }) => {
          const raw = inputs[key].value.trim();
          payload[key] = raw === "" ? null : Number(raw);
        });
        this.saveUserLimits(user.username, payload);
      });
      this.bindEventListener(reset, "click", () => {
        const payload = {};
        LIMIT_FIELDS.forEach(({ key }) => { payload[key] = null; });
        this.saveUserLimits(user.username, payload);
      });

      section.append(summary, toggle, form);
      return section;
    },

    async saveUserLimits(username, payload) {
      try {
        await adminRequest(`/${encodeURIComponent(username)}/limits`, "POST", payload);
        toastHelper("userUpdated", "success");
        await this.loadUsersList();
      } catch (error) {
        this.reportError(error, { context: "Failed to save user limits" });
        this.setAdminStatusText(error.message, "error");
      }
    },

    // A per-user "tab": a toggle that reveals that user's own uploaded
    // models, each deletable from here. Since it only ever lists jobs whose
    // owner is this username, deleting from it can only ever remove that
    // user's own uploads - never another user's.
    renderUserModelsTab(username, models) {
      const section = document.createElement("div");
      section.className = "admin-users-models";

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "admin-users-models-toggle";
      toggle.textContent = t("adminPanel.modelsShow", "Show models");
      toggle.disabled = models.length === 0;

      const modelsList = document.createElement("ul");
      modelsList.className = "admin-users-models-list";
      modelsList.hidden = true;
      this.renderUserModelsList(modelsList, username, models);

      this.bindEventListener(toggle, "click", () => {
        const willShow = modelsList.hidden;
        modelsList.hidden = !willShow;
        toggle.textContent = willShow
          ? t("adminPanel.modelsHide", "Hide models")
          : t("adminPanel.modelsShow", "Show models");
      });

      section.append(toggle, modelsList);
      return section;
    },

    renderUserModelsList(modelsList, username, models) {
      modelsList.textContent = "";
      if (models.length === 0) {
        const empty = document.createElement("li");
        empty.className = "models-panel-empty";
        empty.textContent = t("adminPanel.modelsEmpty", "No models uploaded yet.");
        modelsList.appendChild(empty);
        return;
      }
      models.forEach((job) => modelsList.appendChild(this.renderUserModelRow(username, job, modelsList)));
    },

    renderUserModelRow(username, job, modelsList) {
      const name = job.name || job.id;
      const item = document.createElement("li");
      item.className = "models-panel-row";

      const entry = document.createElement("span");
      entry.className = "models-panel-item";
      entry.title = name;
      if (job.imageUrls?.[0]) {
        const thumb = document.createElement("img");
        thumb.src = remoteAssetUrl(job.imageUrls[0]);
        thumb.alt = "";
        thumb.loading = "lazy";
        entry.appendChild(thumb);
      }
      const label = document.createElement("span");
      label.textContent = name;
      entry.appendChild(label);
      item.appendChild(entry);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "models-panel-delete";
      deleteButton.textContent = "✕";
      const deleteAria = t("adminPanel.modelDeleteAria", { name }, "Delete {name}");
      deleteButton.setAttribute("aria-label", deleteAria);
      deleteButton.title = deleteAria;
      this.bindEventListener(deleteButton, "click", () =>
        this.deleteUserModelWithConfirm(username, job, item, modelsList)
      );
      item.appendChild(deleteButton);

      return item;
    },

    async deleteUserModelWithConfirm(username, job, item, modelsList) {
      const name = job.name || job.id;
      const confirmed = await this.confirmDialog({
        message: t(
          "adminPanel.modelDeleteConfirm",
          { name },
          'Delete "{name}"? This permanently removes the converted model and its renders.'
        ),
        confirmLabel: t("modelsPanel.deleteAction", "Delete"),
        cancelLabel: t("modelsPanel.deleteCancel", "Cancel"),
        danger: true,
      });
      if (!confirmed) return;

      try {
        const response = await fetch(apiUrl(`/api/jobs/${encodeURIComponent(job.id)}`), { method: "DELETE" });
        if (!response.ok && response.status !== 404) {
          throw new Error(`Delete failed (HTTP ${response.status})`);
        }
        item.remove();
        if (modelsList.children.length === 0) {
          this.renderUserModelsList(modelsList, username, []);
        }
        toastHelper("modelDeleted", "info");
        this.loadModelsList?.();
      } catch (error) {
        this.reportError(error, { context: "Failed to delete user's model" });
        toastHelper("modelDeleteError", "error");
      }
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

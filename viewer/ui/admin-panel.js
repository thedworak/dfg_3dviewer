import { core } from "../core.js";
import { apiUrl, appRequestHeaders, remoteAssetUrl } from "../remote.js";
import { toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import { makePanelWindow } from "./panel-window.js";
import { fillModelThumbnail } from "./thumbnail-gallery.js";

// Same-origin worker endpoints (see worker/auth.py's "administration" methods
// and server.py's _require_admin/_handle_admin_*). Deliberately separate from
// authRequest() in upload-panel.js: every call here needs an admin session,
// while /api/auth/* is reachable by anyone.
async function adminRequest(path, method = "GET", body = undefined) {
  return adminFetch(`/api/admin/users${path}`, method, body);
}

async function adminFetch(endpoint, method = "GET", body = undefined) {
  const options = { method, headers: appRequestHeaders() };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(apiUrl(endpoint), options);
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
// without a dedicated endpoint. Jobs without an owner are keyed "".
async function fetchJobsByOwner() {
  const response = await fetch(apiUrl("/api/jobs"), { headers: appRequestHeaders() });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  const byOwner = new Map();
  for (const job of jobs) {
    const owner = job.owner || "";
    if (!byOwner.has(owner)) byOwner.set(owner, []);
    byOwner.get(owner).push(job);
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

// The app plan (worker/entitlements.py) as a small icon, coloured like the
// .plan-badge elsewhere: an outlined star (Free), a star (Pro), a gem
// (Business). The name stays in its tooltip and accessible label.
const PLAN_ICONS = {
  free: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  pro: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="currentColor"/>',
  business:
    '<defs><linearGradient id="adminPlanBusiness" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#db2777"/></linearGradient></defs>' +
    '<path d="M7 4h10l4 5-9 11L3 9z" fill="url(#adminPlanBusiness)"/>' +
    '<path d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1" stroke-linejoin="round"/>',
};

function createPlanIcon(tier) {
  const icon = document.createElement("span");
  icon.className = "admin-plan-icon";
  icon.dataset.tier = tier;
  icon.setAttribute("role", "img");
  icon.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">${PLAN_ICONS[tier] || PLAN_ICONS.free}</svg>`;
  return icon;
}

const PLAN_RANK = { business: 3, pro: 2, free: 1 };

const lastUploadOf = (models) => models.reduce((latest, job) => Math.max(latest, job.createdAt || 0), 0);

// Sort keys for the user list. `desc`: the first click sorts high to low
// (biggest, newest, best plan first); names go A-Z.
const USER_SORTS = {
  plan: { label: ["adminPanel.sortPlan", "Plan"], desc: true, value: (u) => PLAN_RANK[u.user.plan?.tier] || 0 },
  name: { label: ["adminPanel.sortName", "Name"], desc: false, value: (u) => u.user.username.toLocaleLowerCase() },
  models: { label: ["adminPanel.sortModels", "Uploaded models"], desc: true, value: (u) => u.models.length },
  storage: { label: ["adminPanel.sortStorage", "Storage used"], desc: true, value: (u) => u.user.usage?.storageBytes || 0 },
  lastUpload: { label: ["adminPanel.sortLastUpload", "Last upload"], desc: true, value: (u) => lastUploadOf(u.models) },
};

function compareUsers(a, b, key, desc) {
  const va = USER_SORTS[key].value(a);
  const vb = USER_SORTS[key].value(b);
  const order = typeof va === "string" ? va.localeCompare(vb) : va - vb;
  // Ties (e.g. everyone on Free) fall back to the name, always A-Z.
  if (order === 0) return a.user.username.localeCompare(b.user.username);
  return desc ? -order : order;
}

// Unix seconds <-> the local "YYYY-MM-DDTHH:MM" of <input type="datetime-local">.
function toDateTimeInputValue(seconds) {
  if (!seconds) return "";
  const date = new Date(seconds * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDateTimeInputValue(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.floor(time / 1000) : null;
}

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
        <div class="admin-users-sort" hidden>
          <label for="adminUsersSort">${t("adminPanel.sortBy", "Sort by")}</label>
          <select id="adminUsersSort"></select>
          <button type="button" class="admin-users-sort-direction"></button>
        </div>
        <ul id="adminUsersList" class="admin-users-list"></ul>
      `;

      core.container.appendChild(panel);
      this.adminPanel = panel;
      this.adminInputs = {
        status: panel.querySelector("#adminPanelStatus"),
        list: panel.querySelector("#adminUsersList"),
        sortBar: panel.querySelector(".admin-users-sort"),
        sort: panel.querySelector("#adminUsersSort"),
        sortDirection: panel.querySelector(".admin-users-sort-direction"),
      };

      this.adminSort = { key: "plan", desc: USER_SORTS.plan.desc };
      Object.entries(USER_SORTS).forEach(([key, sort]) => {
        this.adminInputs.sort.appendChild(new Option(t(...sort.label), key));
      });
      this.adminInputs.sort.value = this.adminSort.key;
      this.bindEventListener(this.adminInputs.sort, "change", () => {
        const key = this.adminInputs.sort.value;
        this.adminSort = { key, desc: USER_SORTS[key].desc };
        this.renderAdminUsers();
      });
      this.bindEventListener(this.adminInputs.sortDirection, "click", () => {
        this.adminSort.desc = !this.adminSort.desc;
        this.renderAdminUsers();
      });

      const closeButton = panel.querySelector("#adminPanelClose");
      this.bindEventListener(closeButton, "click", () => this.closeAdminPanel());
      makePanelWindow(this, panel, panel.querySelector(".upload-panel-header"));
    },

    async loadUsersList() {
      if (!this.adminInputs?.list) return;
      const list = this.adminInputs.list;
      list.textContent = "";
      this.adminInputs.sortBar.hidden = true;
      this.setAdminStatusText("");

      let users = [];
      try {
        const data = await adminRequest("");
        users = data.users || [];
        this.adminDefaultLimits = data.defaultLimits || null;
        this.adminBusinessLimits = data.businessLimits || null;
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

      this.adminUsers = users.map((user) => ({ user, models: jobsByOwner.get(user.username) || [] }));
      // Uploads from before accounts (or anonymous ones): listed separately
      // so an admin can assign them to someone.
      const known = new Set(users.map((user) => user.username));
      this.adminUnownedModels = [...jobsByOwner.entries()]
        .filter(([owner]) => !known.has(owner))
        .flatMap(([, models]) => models);
      this.adminInputs.sortBar.hidden = false;
      this.renderAdminUsers();
    },

    renderAdminUsers() {
      const { list, sortDirection } = this.adminInputs;
      const { key, desc } = this.adminSort;
      const label = desc
        ? t("adminPanel.sortDescending", "Descending")
        : t("adminPanel.sortAscending", "Ascending");
      sortDirection.textContent = desc ? "↓" : "↑";
      sortDirection.title = label;
      sortDirection.setAttribute("aria-label", label);
      list.textContent = "";
      [...(this.adminUsers || [])]
        .sort((a, b) => compareUsers(a, b, key, desc))
        .forEach(({ user, models }) => list.appendChild(this.renderUserRow(user, models)));
      if (this.adminUnownedModels?.length) list.appendChild(this.renderUnownedModelsRow(this.adminUnownedModels));
    },

    renderUnownedModelsRow(models) {
      const item = document.createElement("li");
      item.className = "admin-users-row";
      const info = document.createElement("div");
      info.className = "admin-users-info";
      const name = document.createElement("span");
      name.className = "admin-users-name";
      name.textContent = t("adminPanel.unownedTitle", "Uploads without an owner");
      const meta = document.createElement("span");
      meta.className = "admin-users-meta";
      meta.textContent = t("adminPanel.modelsCount", { count: models.length }, "{count} models");
      info.append(name, meta);
      item.append(info, this.renderUserModelsTab("", models));
      return item;
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
      // The mobile app plan linked to the account (worker/entitlements.py).
      if (user.plan) {
        const badge = createPlanIcon(user.plan.tier);
        const details = [
          t(`plans.${user.plan.tier}`, user.plan.tier),
          user.plan.source === "admin"
            ? t("adminPanel.planSourceAdmin", "granted by an admin")
            : t("loginPanel.planTitle", "Plan in the mobile app"),
        ];
        if (user.plan.expiresAt) {
          details.push(t("adminPanel.planRenews", { date: new Date(user.plan.expiresAt * 1000).toLocaleDateString() }, "renews/ends {date}"));
        }
        if (user.plan.updatedAt) {
          details.push(t("adminPanel.planChecked", { date: new Date(user.plan.updatedAt * 1000).toLocaleString() }, "checked {date}"));
        }
        badge.title = details.join(" · ");
        badge.setAttribute("aria-label", badge.title);
        name.appendChild(badge);
      }
      const meta = document.createElement("span");
      meta.className = "admin-users-meta";
      const created = user.createdAt ? new Date(user.createdAt * 1000).toLocaleDateString() : "";
      const modelsCount = t("adminPanel.modelsCount", { count: models.length }, "{count} models");
      const lastUpload = lastUploadOf(models);
      const lastUploadText = lastUpload
        ? t("adminPanel.lastUpload", { date: new Date(lastUpload * 1000).toLocaleDateString() }, "last upload {date}")
        : "";
      meta.textContent = [user.email, `${user.role} · ${user.status}`, modelsCount, lastUploadText, created]
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
      item.appendChild(this.renderUserPlanTab(user));
      // Older workers do not report limits - leave the section out.
      if (user.effectiveLimits) item.appendChild(this.renderUserLimitsTab(user));
      return item;
    },

    // The account's plan (worker/auth.py effective_app_plan): what it bought
    // in the app, raised by a plan an admin grants here (optionally until a
    // date). A grant cannot take away a purchase - the higher one applies.
    renderUserPlanTab(user) {
      const section = document.createElement("div");
      section.className = "admin-users-limits admin-users-plan";
      const plan = user.plan;
      const purchase = plan?.purchase?.tier || (plan?.source === "store" ? plan.tier : null);
      const grant = plan?.grant || null;

      const summary = document.createElement("p");
      summary.className = "admin-users-limits-summary";
      const parts = [
        t("adminPanel.planCurrent", { plan: t(`plans.${plan?.tier || "free"}`, plan?.tier || "free") }, "Plan: {plan}"),
        t("adminPanel.planPurchase", { plan: t(`plans.${purchase || "free"}`, purchase || "free") }, "bought in the app: {plan}"),
      ];
      if (grant) {
        parts.push(grant.expiresAt
          ? t("adminPanel.planGrantUntil", { plan: t(`plans.${grant.tier}`, grant.tier), date: new Date(grant.expiresAt * 1000).toLocaleDateString() }, "granted: {plan} until {date}")
          : t("adminPanel.planGrant", { plan: t(`plans.${grant.tier}`, grant.tier) }, "granted: {plan}"));
      }
      summary.textContent = parts.join(" · ");

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "admin-users-models-toggle";
      toggle.textContent = t("adminPanel.planShow", "Change plan");

      const form = document.createElement("form");
      form.className = "admin-users-limits-form";
      form.hidden = true;

      const tierField = document.createElement("label");
      tierField.className = "admin-users-limits-field";
      const tierText = document.createElement("span");
      tierText.textContent = t("adminPanel.planGrantLabel", "Granted plan");
      const tierSelect = document.createElement("select");
      tierSelect.appendChild(new Option(t("adminPanel.planNone", "None (only what was bought)"), ""));
      ["pro", "business"].forEach((tier) => tierSelect.appendChild(new Option(t(`plans.${tier}`, tier), tier)));
      tierSelect.value = grant?.tier && grant.tier !== "free" ? grant.tier : "";
      tierField.append(tierText, tierSelect);

      const untilField = document.createElement("label");
      untilField.className = "admin-users-limits-field";
      const untilText = document.createElement("span");
      untilText.textContent = t("adminPanel.planUntil", "Until (empty = no end)");
      const until = document.createElement("input");
      until.type = "datetime-local";
      until.value = toDateTimeInputValue(grant?.expiresAt);
      untilField.append(untilText, until);

      const hint = document.createElement("p");
      hint.className = "admin-users-limits-note";
      hint.textContent = t("adminPanel.planHint", "The higher of the granted and the bought plan applies, in the app and for the upload limits.");

      const buttons = document.createElement("div");
      buttons.className = "admin-users-actions";
      const save = document.createElement("button");
      save.type = "submit";
      save.textContent = t("adminPanel.planSave", "Save plan");
      buttons.appendChild(save);
      form.append(tierField, untilField, hint, buttons);

      const syncUntil = () => { until.disabled = !tierSelect.value; };
      syncUntil();
      this.bindEventListener(tierSelect, "change", syncUntil);
      this.bindEventListener(toggle, "click", () => {
        form.hidden = !form.hidden;
        toggle.textContent = form.hidden
          ? t("adminPanel.planShow", "Change plan")
          : t("adminPanel.planHide", "Hide plan");
      });
      this.bindEventListener(form, "submit", async (event) => {
        event.preventDefault();
        const tier = tierSelect.value || null;
        const expiresAt = tier && until.value ? fromDateTimeInputValue(until.value) : null;
        try {
          await adminRequest(`/${encodeURIComponent(user.username)}/plan`, "POST", { tier, expiresAt });
          toastHelper("userUpdated", "success");
          await this.loadUsersList();
          // An admin changing their own plan: the app applies it right away.
          if (user.username === this.authState?.user) this.refreshAuthState?.();
        } catch (error) {
          this.reportError(error, { context: "Failed to save user plan" });
          this.setAdminStatusText(error.message, "error");
        }
      });

      section.append(summary, toggle, form);
      return section;
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
      // Accounts with the app's Business plan start from its limits.
      const isBusiness = user.plan?.tier === "business" && this.adminBusinessLimits;
      const defaults = (isBusiness ? this.adminBusinessLimits : this.adminDefaultLimits) || {};
      if (isBusiness && user.role !== "admin") {
        const note = document.createElement("p");
        note.className = "admin-users-limits-note";
        note.textContent = t("adminPanel.limitsBusiness", "Business plan: its limits are the defaults here.");
        form.appendChild(note);
      }
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
      // Stays open across re-renders (sorting, editing a model).
      this.adminExpandedModels ??= new Set();
      modelsList.hidden = !(models.length > 0 && this.adminExpandedModels.has(username));
      if (!modelsList.hidden) toggle.textContent = t("adminPanel.modelsHide", "Hide models");
      this.renderUserModelsList(modelsList, username, models);

      this.bindEventListener(toggle, "click", () => {
        const willShow = modelsList.hidden;
        modelsList.hidden = !willShow;
        if (willShow) this.adminExpandedModels.add(username);
        else this.adminExpandedModels.delete(username);
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
      item.className = "models-panel-row admin-model-row";

      const entry = document.createElement("span");
      entry.className = "models-panel-item";
      entry.title = name;
      // Same thumbnail slot (and placeholder) as the browse-models panel.
      const thumbSlot = document.createElement("span");
      thumbSlot.className = "models-panel-item-thumb";
      thumbSlot.setAttribute("aria-hidden", "true");
      fillModelThumbnail(thumbSlot, job.imageUrls?.[0] ? remoteAssetUrl(job.imageUrls[0]) : "", job.id);
      entry.appendChild(thumbSlot);
      const text = document.createElement("span");
      text.className = "models-panel-item-text";
      const label = document.createElement("span");
      label.className = "models-panel-item-name";
      label.textContent = name;
      const caption = document.createElement("span");
      caption.className = "models-panel-item-meta";
      caption.textContent = [
        job.owner
          ? t("modelsPanel.uploadedBy", { user: job.owner }, "Uploaded by {user}")
          : t("adminPanel.modelNoOwner", "No owner"),
        job.createdAt ? new Date(job.createdAt * 1000).toLocaleString() : "",
      ].filter(Boolean).join(" · ");
      text.append(label, caption);
      entry.appendChild(text);
      item.appendChild(entry);

      const editForm = this.renderModelEditForm(job);
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "models-panel-edit";
      editButton.textContent = "✎";
      const editAria = t("adminPanel.modelEditAria", { name }, "Edit upload details of {name}");
      editButton.setAttribute("aria-label", editAria);
      editButton.title = editAria;
      editButton.setAttribute("aria-expanded", "false");
      this.bindEventListener(editButton, "click", () => {
        editForm.hidden = !editForm.hidden;
        editButton.setAttribute("aria-expanded", String(!editForm.hidden));
        if (!editForm.hidden) editForm.querySelector("select")?.focus();
      });
      item.appendChild(editButton);

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
      item.appendChild(editForm);

      return item;
    },

    // Who uploaded the model and when (POST /api/admin/jobs/<id>).
    renderModelEditForm(job) {
      const form = document.createElement("form");
      form.className = "admin-model-edit";
      form.hidden = true;

      const ownerField = document.createElement("label");
      ownerField.className = "admin-users-limits-field";
      const ownerText = document.createElement("span");
      ownerText.textContent = t("adminPanel.modelOwner", "Uploaded by");
      const ownerSelect = document.createElement("select");
      ownerSelect.appendChild(new Option(t("adminPanel.modelNoOwner", "No owner"), ""));
      (this.adminUsers || [])
        .map(({ user }) => user.username)
        .sort((a, b) => a.localeCompare(b))
        .forEach((username) => ownerSelect.appendChild(new Option(username, username)));
      ownerSelect.value = job.owner || "";
      ownerField.append(ownerText, ownerSelect);

      const dateField = document.createElement("label");
      dateField.className = "admin-users-limits-field";
      const dateText = document.createElement("span");
      dateText.textContent = t("adminPanel.modelUploadedAt", "Uploaded on");
      const dateInput = document.createElement("input");
      dateInput.type = "datetime-local";
      dateInput.required = true;
      dateInput.value = toDateTimeInputValue(job.createdAt);
      dateField.append(dateText, dateInput);

      const buttons = document.createElement("div");
      buttons.className = "admin-users-actions";
      const save = document.createElement("button");
      save.type = "submit";
      save.textContent = t("adminPanel.modelSave", "Save");
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = t("modelsPanel.deleteCancel", "Cancel");
      buttons.append(save, cancel);

      form.append(ownerField, dateField, buttons);

      this.bindEventListener(cancel, "click", () => {
        ownerSelect.value = job.owner || "";
        dateInput.value = toDateTimeInputValue(job.createdAt);
        form.hidden = true;
      });
      this.bindEventListener(form, "submit", async (event) => {
        event.preventDefault();
        const createdAt = fromDateTimeInputValue(dateInput.value);
        if (!createdAt) return;
        save.disabled = true;
        await this.saveModelDetails(job, { owner: ownerSelect.value || null, createdAt });
        save.disabled = false;
      });
      return form;
    },

    async saveModelDetails(job, payload) {
      try {
        const result = await adminFetch(`/api/admin/jobs/${encodeURIComponent(job.id)}`, "POST", payload);
        const owner = result.owner || "";
        const updated = { ...job, owner: result.owner || null, createdAt: result.createdAt || payload.createdAt };
        // Move the model to its (new) owner's list in the panel's data.
        const remove = (models) => models.filter((m) => m.id !== job.id);
        (this.adminUsers || []).forEach((entry) => { entry.models = remove(entry.models); });
        this.adminUnownedModels = remove(this.adminUnownedModels || []);
        const target = (this.adminUsers || []).find((entry) => entry.user.username === owner);
        const models = target ? target.models : this.adminUnownedModels;
        models.push(updated);
        models.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        this.adminExpandedModels?.add(target ? owner : "");
        this.renderAdminUsers();
        toastHelper("modelUpdated", "success");
        this.loadModelsList?.();
      } catch (error) {
        this.reportError(error, { context: "Failed to update model details" });
        this.setAdminStatusText(error.message, "error");
      }
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
        const response = await fetch(apiUrl(`/api/jobs/${encodeURIComponent(job.id)}`), { method: "DELETE", headers: appRequestHeaders() });
        if (!response.ok && response.status !== 404) {
          throw new Error(`Delete failed (HTTP ${response.status})`);
        }
        item.remove();
        // Keep the sorted list's data in step (a re-sort re-renders from it).
        const entry = this.adminUsers?.find((u) => u.user.username === username);
        if (entry) entry.models = entry.models.filter((m) => m.id !== job.id);
        else this.adminUnownedModels = (this.adminUnownedModels || []).filter((m) => m.id !== job.id);
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

import { t, f as fillModelThumbnail, m as metaCaption, a as metaPart, b as modelCheckPart, s as setLanguageSource, c as createPasswordField } from './model-thumbnail-xwUYwoPz.js';

// Worker endpoints for the admin pages, same-origin like the viewer's: the
// session is the worker's cookie (worker/auth.py). /api/auth/* answers
// anyone, /api/admin/* only an admin session (server.py _require_admin).
async function apiRequest(endpoint, method = "GET", body = undefined) {
  const options = { method, credentials: "same-origin", headers: {} };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(endpoint, options);
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

const authRequest = (path, body) => apiRequest(`/api/auth/${path}`, body ? "POST" : "GET", body);

// GET /api/jobs includes each job's `owner` username (worker/server.py
// list_jobs): each user's models without an endpoint of their own. Jobs
// without an owner are keyed "".
async function fetchJobsByOwner() {
  const data = await apiRequest("/api/jobs");
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  const byOwner = new Map();
  for (const job of jobs) {
    const owner = job.owner || "";
    if (!byOwner.has(owner)) byOwner.set(owner, []);
    byOwner.get(owner).push(job);
  }
  return byOwner;
}

// Replaces window.confirm(), styled like the viewer's (upload-panel.css
// .viewer-confirm). Resolves true on confirm, false on cancel, Escape or a
// click beside it.
function confirmDialog({ message, confirmLabel, cancelLabel, danger = false }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "viewer-confirm-backdrop exadmin-confirm-backdrop";
    backdrop.innerHTML = `
      <div class="viewer-confirm" role="alertdialog" aria-modal="true" aria-describedby="exadminConfirmMessage">
        <p id="exadminConfirmMessage" class="viewer-confirm-message"></p>
        <div class="viewer-confirm-actions">
          <button type="button" class="viewer-confirm-cancel"></button>
          <button type="button" class="viewer-confirm-ok${danger ? " viewer-confirm-ok--danger" : ""}"></button>
        </div>
      </div>`;
    backdrop.querySelector(".viewer-confirm-message").textContent = message;
    const cancel = backdrop.querySelector(".viewer-confirm-cancel");
    const ok = backdrop.querySelector(".viewer-confirm-ok");
    cancel.textContent = cancelLabel;
    ok.textContent = confirmLabel;

    const finish = (value) => {
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
      resolve(value);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    cancel.addEventListener("click", () => finish(false));
    ok.addEventListener("click", () => finish(true));
    backdrop.addEventListener("pointerdown", (event) => {
      if (event.target === backdrop) finish(false);
    });

    document.body.appendChild(backdrop);
    cancel.focus();
  });
}

const TOAST_MS = 3500;

// A short message in the corner: `key` from the viewer's toasts.* texts.
function toast(key, tone = "info") {
  let host = document.getElementById("exadminToasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "exadminToasts";
    host.className = "exadmin-toasts";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }
  const item = document.createElement("div");
  item.className = "exadmin-toast";
  item.dataset.tone = tone;
  item.textContent = t(`toasts.${key}`, key);
  host.appendChild(item);
  setTimeout(() => item.remove(), TOAST_MS);
}

// Registered accounts (worker/auth.py "administration" methods, server.py
// _handle_admin_*): approve, disable, promote, delete; each account's plan,
// upload limits and uploaded models.

const adminRequest = (path, method = "GET", body = undefined) =>
  apiRequest(`/api/admin/users${path}`, method, body);

// Per-account upload limits (worker/limits.py). 0 means unlimited; an empty
// field falls back to the worker's WORKER_LIMIT_* default.
const LIMIT_FIELDS = [
  { key: "uploadsPerHour", label: ["adminPanel.limitUploadsPerHour", "Uploads per hour"] },
  { key: "uploadsPerDay", label: ["adminPanel.limitUploadsPerDay", "Uploads per day"] },
  { key: "storageMb", label: ["adminPanel.limitStorageMb", "Storage (MB)"] },
  { key: "maxModels", label: ["adminPanel.limitMaxModels", "Max models"] },
  { key: "concurrentJobs", label: ["adminPanel.limitConcurrentJobs", "Concurrent conversions"] },
];

// The account's plan (worker/auth.py effective_app_plan) as a small icon, coloured like the
// .plan-badge elsewhere: an outlined star (Free), a star (Pro), a gem
// (Business), a crown (Enterprise). The name stays in its tooltip and
// accessible label.
const PLAN_ICONS = {
  free: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  pro: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="currentColor"/>',
  business:
    '<defs><linearGradient id="adminPlanBusiness" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#db2777"/></linearGradient></defs>' +
    '<path d="M7 4h10l4 5-9 11L3 9z" fill="url(#adminPlanBusiness)"/>' +
    '<path d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1" stroke-linejoin="round"/>',
  enterprise:
    '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="#b8860b"/>' +
    '<path d="M5 19h14" stroke="#7a5a00" stroke-width="1.6" stroke-linecap="round"/>',
};

function createPlanIcon(tier) {
  const icon = document.createElement("span");
  icon.className = "admin-plan-icon";
  icon.dataset.tier = tier;
  icon.setAttribute("role", "img");
  icon.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">${PLAN_ICONS[tier] || PLAN_ICONS.free}</svg>`;
  return icon;
}

const PLAN_RANK = { enterprise: 4, business: 3, pro: 2, free: 1 };

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

class UsersSection {
  // `me`: the signed-in admin's username (they cannot disable, demote or
  // delete themselves).
  constructor({ me }) {
    this.me = me;
    this.users = [];
    this.unownedModels = [];
    this.expandedModels = new Set();
    this.defaultLimits = null;
    this.businessLimits = null;
    this.sort = { key: "plan", desc: USER_SORTS.plan.desc };

    const element = document.createElement("section");
    element.className = "exadmin-section exadmin-users";
    element.innerHTML = `
      <div class="exadmin-section-header">
        <h2>${t("adminPanel.title", "Manage users")}</h2>
        <div class="admin-users-sort" hidden>
          <label for="adminUsersSort">${t("adminPanel.sortBy", "Sort by")}</label>
          <select id="adminUsersSort"></select>
          <button type="button" class="admin-users-sort-direction"></button>
        </div>
      </div>
      <p class="upload-panel-status" role="status" aria-live="polite"></p>
      <ul class="admin-users-list"></ul>
    `;
    this.element = element;
    this.status = element.querySelector(".upload-panel-status");
    this.list = element.querySelector(".admin-users-list");
    this.sortBar = element.querySelector(".admin-users-sort");
    this.sortSelect = element.querySelector("#adminUsersSort");
    this.sortDirection = element.querySelector(".admin-users-sort-direction");

    Object.entries(USER_SORTS).forEach(([key, sort]) => {
      this.sortSelect.appendChild(new Option(t(...sort.label), key));
    });
    this.sortSelect.value = this.sort.key;
    this.sortSelect.addEventListener("change", () => {
      const key = this.sortSelect.value;
      this.sort = { key, desc: USER_SORTS[key].desc };
      this.render();
    });
    this.sortDirection.addEventListener("click", () => {
      this.sort.desc = !this.sort.desc;
      this.render();
    });
  }

  setStatus(message, tone = "info") {
    this.status.textContent = message;
    this.status.dataset.tone = tone;
  }

  reportError(error, context) {
    console.error(`[exadmin] ${context}:`, error);
  }

  async load() {
    this.list.textContent = "";
    this.sortBar.hidden = true;
    this.setStatus(t("exadmin.loading", "Loading..."));

    let users = [];
    try {
      const data = await adminRequest("");
      users = data.users || [];
      this.defaultLimits = data.defaultLimits || null;
      this.businessLimits = data.businessLimits || null;
    } catch (error) {
      this.reportError(error, "Failed to load users list");
      this.setStatus(t("adminPanel.loadError", "Could not load the user list."), "error");
      return;
    }
    this.setStatus("");

    if (users.length === 0) {
      const empty = document.createElement("li");
      empty.className = "admin-users-empty";
      empty.textContent = t("adminPanel.empty", "No registered users yet.");
      this.list.appendChild(empty);
      return;
    }

    // Upload stats/listing are best-effort - a failure here shouldn't
    // block the user list itself, just leave counts at 0/empty.
    let jobsByOwner = new Map();
    try {
      jobsByOwner = await fetchJobsByOwner();
    } catch (error) {
      this.reportError(error, "Failed to load user upload stats");
    }

    this.users = users.map((user) => ({ user, models: jobsByOwner.get(user.username) || [] }));
    // Uploads from before accounts (or anonymous ones): listed separately
    // so an admin can assign them to someone.
    const known = new Set(users.map((user) => user.username));
    this.unownedModels = [...jobsByOwner.entries()]
      .filter(([owner]) => !known.has(owner))
      .flatMap(([, models]) => models);
    this.sortBar.hidden = false;
    this.render();
  }

  render() {
    const { key, desc } = this.sort;
    const label = desc
      ? t("adminPanel.sortDescending", "Descending")
      : t("adminPanel.sortAscending", "Ascending");
    this.sortDirection.textContent = desc ? "↓" : "↑";
    this.sortDirection.title = label;
    this.sortDirection.setAttribute("aria-label", label);
    this.list.textContent = "";
    [...this.users]
      .sort((a, b) => compareUsers(a, b, key, desc))
      .forEach(({ user, models }) => this.list.appendChild(this.renderUserRow(user, models)));
    if (this.unownedModels.length) this.list.appendChild(this.renderUnownedModelsRow(this.unownedModels));
  }

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
  }

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
    // The account's plan: granted by an admin or bought in an app.
    if (user.plan) {
      const badge = createPlanIcon(user.plan.tier);
      const details = [
        t(`plans.${user.plan.tier}`, user.plan.tier),
        user.plan.source === "admin"
          ? t("adminPanel.planSourceAdmin", "granted by an admin")
          : t("loginPanel.planTitle", "Plan bought in the app"),
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
    const isSelf = user.username === this.me;

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
    deleteButton.addEventListener("click", () => this.deleteUserWithConfirm(user.username));
    actions.appendChild(deleteButton);

    top.append(info, actions);
    item.append(top, this.renderUserModelsTab(user.username, models));
    item.appendChild(this.renderUserPlanTab(user));
    // Older workers do not report limits - leave the section out.
    if (user.effectiveLimits) item.appendChild(this.renderUserLimitsTab(user));
    return item;
  }

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
    // Enterprise is only granted here (price agreed individually).
    ["pro", "business", "enterprise"].forEach((tier) => tierSelect.appendChild(new Option(t(`plans.${tier}`, tier), tier)));
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
    tierSelect.addEventListener("change", syncUntil);
    toggle.addEventListener("click", () => {
      form.hidden = !form.hidden;
      toggle.textContent = form.hidden
        ? t("adminPanel.planShow", "Change plan")
        : t("adminPanel.planHide", "Hide plan");
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const tier = tierSelect.value || null;
      const expiresAt = tier && until.value ? fromDateTimeInputValue(until.value) : null;
      try {
        await adminRequest(`/${encodeURIComponent(user.username)}/plan`, "POST", { tier, expiresAt });
        toast("userUpdated", "success");
        await this.load();
      } catch (error) {
        this.reportError(error, "Failed to save user plan");
        this.setStatus(error.message, "error");
      }
    });

    section.append(summary, toggle, form);
    return section;
  }

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
    const isBusiness = ["business", "enterprise"].includes(user.plan?.tier) && this.businessLimits;
    const defaults = (isBusiness ? this.businessLimits : this.defaultLimits) || {};
    if (isBusiness && user.role !== "admin") {
      const note = document.createElement("p");
      note.className = "admin-users-limits-note";
      note.textContent = t("adminPanel.limitsBusiness", "Business or Enterprise plan: the Business limits are the defaults here.");
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

    toggle.addEventListener("click", () => {
      form.hidden = !form.hidden;
      toggle.textContent = form.hidden
        ? t("adminPanel.limitsShow", "Edit limits")
        : t("adminPanel.limitsHide", "Hide limits");
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const payload = {};
      LIMIT_FIELDS.forEach(({ key }) => {
        const raw = inputs[key].value.trim();
        payload[key] = raw === "" ? null : Number(raw);
      });
      this.saveUserLimits(user.username, payload);
    });
    reset.addEventListener("click", () => {
      const payload = {};
      LIMIT_FIELDS.forEach(({ key }) => { payload[key] = null; });
      this.saveUserLimits(user.username, payload);
    });

    section.append(summary, toggle, form);
    return section;
  }

  async saveUserLimits(username, payload) {
    try {
      await adminRequest(`/${encodeURIComponent(username)}/limits`, "POST", payload);
      toast("userUpdated", "success");
      await this.load();
    } catch (error) {
      this.reportError(error, "Failed to save user limits");
      this.setStatus(error.message, "error");
    }
  }

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
    modelsList.hidden = !(models.length > 0 && this.expandedModels.has(username));
    if (!modelsList.hidden) toggle.textContent = t("adminPanel.modelsHide", "Hide models");
    this.renderUserModelsList(modelsList, username, models);

    toggle.addEventListener("click", () => {
      const willShow = modelsList.hidden;
      modelsList.hidden = !willShow;
      if (willShow) this.expandedModels.add(username);
      else this.expandedModels.delete(username);
      toggle.textContent = willShow
        ? t("adminPanel.modelsHide", "Hide models")
        : t("adminPanel.modelsShow", "Show models");
    });

    section.append(toggle, modelsList);
    return section;
  }

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
  }

  renderUserModelRow(username, job, modelsList) {
    const name = job.name || job.id;
    const item = document.createElement("li");
    item.className = "models-panel-row admin-model-row";

    const entry = document.createElement("span");
    entry.className = "models-panel-item";
    entry.title = name;
    // Same thumbnail slot (and placeholder) as the viewer's browse-models panel.
    const thumbSlot = document.createElement("span");
    thumbSlot.className = "models-panel-item-thumb";
    thumbSlot.setAttribute("aria-hidden", "true");
    fillModelThumbnail(thumbSlot, job.imageUrls?.[0] || "", job.id);
    entry.appendChild(thumbSlot);
    const text = document.createElement("span");
    text.className = "models-panel-item-text";
    const label = document.createElement("span");
    label.className = "models-panel-item-name";
    label.textContent = name;
    const caption = metaCaption([
      job.owner
        ? metaPart("user", t("modelsMeta.uploadedBy", "Uploaded by"), job.owner)
        : metaPart("no-user", t("adminPanel.modelNoOwner", "No owner")),
      job.createdAt
        ? metaPart("date", t("modelsMeta.uploaded", "Uploaded"), new Date(job.createdAt * 1000).toLocaleString())
        : null,
      // The worker's check of the model file (validation.json), as in the
      // browse-models panel.
      modelCheckPart(job.validation),
    ]);
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
    editButton.addEventListener("click", () => {
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
    deleteButton.addEventListener("click", () =>
      this.deleteUserModelWithConfirm(username, job, item, modelsList)
    );
    item.appendChild(deleteButton);
    item.appendChild(editForm);

    return item;
  }

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
    this.users
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

    cancel.addEventListener("click", () => {
      ownerSelect.value = job.owner || "";
      dateInput.value = toDateTimeInputValue(job.createdAt);
      form.hidden = true;
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const createdAt = fromDateTimeInputValue(dateInput.value);
      if (!createdAt) return;
      save.disabled = true;
      await this.saveModelDetails(job, { owner: ownerSelect.value || null, createdAt });
      save.disabled = false;
    });
    return form;
  }

  async saveModelDetails(job, payload) {
    try {
      const result = await apiRequest(`/api/admin/jobs/${encodeURIComponent(job.id)}`, "POST", payload);
      const owner = result.owner || "";
      const updated = { ...job, owner: result.owner || null, createdAt: result.createdAt || payload.createdAt };
      // Move the model to its (new) owner's list.
      const remove = (models) => models.filter((m) => m.id !== job.id);
      this.users.forEach((entry) => { entry.models = remove(entry.models); });
      this.unownedModels = remove(this.unownedModels);
      const target = this.users.find((entry) => entry.user.username === owner);
      const models = target ? target.models : this.unownedModels;
      models.push(updated);
      models.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      this.expandedModels.add(target ? owner : "");
      this.render();
      toast("modelUpdated", "success");
    } catch (error) {
      this.reportError(error, "Failed to update model details");
      this.setStatus(error.message, "error");
    }
  }

  async deleteUserModelWithConfirm(username, job, item, modelsList) {
    const name = job.name || job.id;
    const confirmed = await confirmDialog({
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
      try {
        await apiRequest(`/api/jobs/${encodeURIComponent(job.id)}`, "DELETE");
      } catch (error) {
        if (error.status !== 404) throw error;
      }
      item.remove();
      // Keep the sorted list's data in step (a re-sort re-renders from it).
      const entry = this.users.find((u) => u.user.username === username);
      if (entry) entry.models = entry.models.filter((m) => m.id !== job.id);
      else this.unownedModels = this.unownedModels.filter((m) => m.id !== job.id);
      if (modelsList.children.length === 0) {
        this.renderUserModelsList(modelsList, username, []);
      }
      toast("modelDeleted", "info");
    } catch (error) {
      this.reportError(error, "Failed to delete user's model");
      toast("modelDeleteError", "error");
    }
  }

  createUserActionButton(username, action, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => this.performUserAction(username, action));
    return button;
  }

  async performUserAction(username, action) {
    try {
      await adminRequest(`/${encodeURIComponent(username)}/${action}`, "POST");
      toast("userUpdated", "success");
      await this.load();
    } catch (error) {
      this.reportError(error, `Failed to ${action} user`);
      this.setStatus(error.message, "error");
    }
  }

  async deleteUserWithConfirm(username) {
    const confirmed = await confirmDialog({
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
      toast("userDeleted", "info");
      await this.load();
    } catch (error) {
      this.reportError(error, "Failed to delete user");
      this.setStatus(error.message, "error");
    }
  }
}

const usersSection = {
  id: "users",
  label: () => t("exadmin.navUsers", "Users"),
  // Builds the section into `container` and loads its data.
  mount(container, context) {
    const section = new UsersSection(context);
    container.appendChild(section.element);
    section.load();
  },
};

// The admin pages' sections, in navigation order. A section is
// { id, label(), mount(container, { me }) }: `id` is its address
// (/exadmin/#<id>), mount() builds it into the emptied main area each time
// it is opened. A new one is added here and nowhere else.
const SECTIONS = [usersSection];

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
//# sourceMappingURL=exadmin-DbguaN3b.js.map

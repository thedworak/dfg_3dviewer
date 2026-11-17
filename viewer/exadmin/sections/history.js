import { t } from "../../i18n-utils.js";
import { apiRequest } from "../api.js";
import { formatDateTime } from "../format.js";

// What the administrators did and when (GET /api/admin/audit,
// worker/audit.py): approvals, rejections, roles, plans, limits, models
// edited or deleted, reports decided. Newest first, filtered by admin or
// action, older entries a click away.

const PAGE = 100;

const ACTIONS = {
  approve: ["exadmin.auditApprove", "Account approved"],
  reject: ["exadmin.auditReject", "Account rejected"],
  disable: ["exadmin.auditDisable", "Account disabled"],
  promote: ["exadmin.auditPromote", "Made an administrator"],
  demote: ["exadmin.auditDemote", "Administrator rights taken away"],
  "delete-user": ["exadmin.auditDeleteUser", "Account deleted"],
  plan: ["exadmin.auditPlan", "Plan changed"],
  limits: ["exadmin.auditLimits", "Limits changed"],
  "edit-model": ["exadmin.auditEditModel", "Uploader or upload date changed"],
  "delete-model": ["exadmin.auditDeleteModel", "Model deleted"],
  visibility: ["exadmin.auditVisibility", "Model visibility changed"],
  report: ["exadmin.auditReport", "Report decided"],
  "2fa-enable": ["exadmin.audit2faEnable", "Two-step verification turned on"],
  "2fa-reset": ["exadmin.audit2faReset", "Two-step verification reset"],
  "2fa-forget-devices": ["exadmin.audit2faForgetDevices", "Remembered devices forgotten"],
};

const label = ([key, fallback]) => t(key, fallback);

// The entry's details as a short line.
function describe(entry) {
  const d = entry.details || {};
  const parts = [];
  if (d.name) parts.push(d.name);
  if (entry.action === "reject" && d.reason) parts.push(t("exadmin.auditReason", { reason: d.reason }, "reason: {reason}"));
  if (entry.action === "plan") {
    parts.push(d.tier ? t(`plans.${d.tier}`, d.tier) : t("adminPanel.planNone", "None (only what was bought)"));
    if (d.expiresAt) parts.push(t("exadmin.auditUntil", { date: formatDateTime(d.expiresAt) }, "until {date}"));
  }
  if (entry.action === "limits") {
    const limits = Object.entries(d.limits || {});
    parts.push(limits.length ? limits.map(([key, value]) => `${key}=${value}`).join(", ") : t("adminPanel.limitsReset", "Use defaults"));
  }
  if (entry.action === "edit-model") {
    if (d.owner) parts.push(`${d.owner[0] || "-"} → ${d.owner[1] || "-"}`);
    if (d.createdAt) parts.push(`${formatDateTime(d.createdAt[0])} → ${formatDateTime(d.createdAt[1])}`);
  }
  if (entry.action === "visibility") {
    parts.push(d.private ? t("exadmin.modelsPrivate", "Private") : t("exadmin.modelsPublic", "Public"));
  }
  if (entry.action === "report") {
    const decision = { dismiss: ["adminPanel.reportDismiss", "Dismiss"], "remove-model": ["adminPanel.reportRemoveModel", "Remove model"],
      "disable-user": ["adminPanel.reportDisableUser", "Disable uploader"] }[d.decision];
    if (decision) parts.push(label(decision));
    if (d.reason) parts.push(t(`modelsPanel.reportReason_${d.reason}`, d.reason));
  }
  if (["delete-model", "visibility", "report"].includes(entry.action) && d.owner) {
    parts.push(t("adminPanel.reportOwner", { user: d.owner }, "Uploaded by {user}"));
  }
  return parts.join(" · ");
}

class HistorySection {
  constructor() {
    this.entries = [];
    this.filters = { admin: "", action: "" };
    const element = document.createElement("section");
    element.className = "exadmin-section exadmin-history";
    element.innerHTML = `
      <div class="exadmin-section-header"><h2></h2></div>
      <div class="exadmin-models-filters"></div>
      <p class="upload-panel-status" role="status" aria-live="polite"></p>
      <ol class="exadmin-history-list"></ol>
      <button type="button" class="exadmin-models-more" hidden></button>
    `;
    element.querySelector("h2").textContent = t("exadmin.historyTitle", "What the administrators did");
    this.element = element;
    this.filtersBox = element.querySelector(".exadmin-models-filters");
    this.status = element.querySelector(".upload-panel-status");
    this.list = element.querySelector(".exadmin-history-list");
    this.more = element.querySelector(".exadmin-models-more");
    this.more.textContent = t("exadmin.historyMore", "Show older");
    this.more.addEventListener("click", () => this.load(true));
    this.renderFilters();
  }

  renderFilters() {
    const all = t("exadmin.modelsAll", "All");
    const actionField = document.createElement("label");
    const actionCaption = document.createElement("span");
    actionCaption.textContent = t("exadmin.historyAction", "Action");
    const action = document.createElement("select");
    action.setAttribute("aria-label", actionCaption.textContent);
    action.appendChild(new Option(all, ""));
    Object.entries(ACTIONS).forEach(([id, text]) => action.appendChild(new Option(label(text), id)));
    action.addEventListener("change", () => {
      this.filters.action = action.value;
      this.load();
    });
    actionField.append(actionCaption, action);

    const adminField = document.createElement("label");
    const adminCaption = document.createElement("span");
    adminCaption.textContent = t("exadmin.historyAdmin", "Administrator");
    this.adminSelect = document.createElement("select");
    this.adminSelect.setAttribute("aria-label", adminCaption.textContent);
    this.adminSelect.appendChild(new Option(all, ""));
    this.adminSelect.addEventListener("change", () => {
      this.filters.admin = this.adminSelect.value;
      this.load();
    });
    adminField.append(adminCaption, this.adminSelect);
    this.filtersBox.append(actionField, adminField);
  }

  // Administrators seen so far are offered in the filter.
  updateAdminOptions() {
    const known = new Set([...this.adminSelect.options].map((option) => option.value));
    this.entries.forEach((entry) => {
      if (!known.has(entry.admin)) {
        known.add(entry.admin);
        this.adminSelect.appendChild(new Option(entry.admin, entry.admin));
      }
    });
  }

  async load(older = false) {
    const params = new URLSearchParams({ limit: String(PAGE) });
    if (older && this.entries.length) params.set("before", String(this.entries[this.entries.length - 1].at));
    if (this.filters.admin) params.set("admin", this.filters.admin);
    if (this.filters.action) params.set("action", this.filters.action);
    this.status.textContent = t("exadmin.loading", "Loading...");
    try {
      const data = await apiRequest(`/api/admin/audit?${params}`);
      const entries = Array.isArray(data.entries) ? data.entries : [];
      this.entries = older ? [...this.entries, ...entries] : entries;
      this.more.hidden = !data.more;
      this.status.textContent = "";
    } catch (error) {
      console.error("[exadmin] Failed to load the history:", error);
      this.status.textContent = error.message;
      this.status.dataset.tone = "error";
      return;
    }
    this.updateAdminOptions();
    this.render();
  }

  render() {
    this.list.textContent = "";
    if (!this.entries.length) {
      const empty = document.createElement("li");
      empty.className = "admin-users-empty";
      empty.textContent = t("exadmin.historyEmpty", "Nothing recorded yet.");
      this.list.appendChild(empty);
      return;
    }
    this.entries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "exadmin-history-entry";
      const when = document.createElement("time");
      when.dateTime = new Date(entry.at * 1000).toISOString();
      when.textContent = formatDateTime(entry.at);
      const what = document.createElement("div");
      what.className = "exadmin-history-what";
      // "Action: target", then who did it and the details (no sentence
      // to inflect for the admin in every language).
      const head = document.createElement("span");
      const action = document.createTextNode(`${ACTIONS[entry.action] ? label(ACTIONS[entry.action]) : entry.action}: `);
      const target = document.createElement("strong");
      target.textContent = entry.target;
      head.append(action, target);
      what.appendChild(head);
      const line = document.createElement("span");
      line.className = "exadmin-history-details";
      const admin = entry.admin === "(command line)" ? t("exadmin.historyCli", "the command line") : entry.admin;
      line.textContent = [t("exadmin.historyBy", { admin }, "by {admin}"), describe(entry)].filter(Boolean).join(" · ");
      what.appendChild(line);
      item.append(when, what);
      this.list.appendChild(item);
    });
  }
}

export const historySection = {
  id: "history",
  label: () => t("exadmin.navHistory", "History"),
  mount(container) {
    const section = new HistorySection();
    container.appendChild(section.element);
    section.load();
  },
};

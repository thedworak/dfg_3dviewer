import { t } from "../../i18n-utils.js";
import { apiRequest } from "../api.js";
import { confirmDialog, toast } from "../dialogs.js";

// Reported models (worker/reports.py, server.py _handle_admin_resolve_report):
// what was reported, why and by whom, and the admin's decision - dismiss,
// remove the model or disable its uploader. The App Store expects reports
// on user-generated content to be acted on within 24 hours (guideline 1.2).

const ACTION_LABELS = {
  dismiss: ["adminPanel.reportDismiss", "Dismiss"],
  "remove-model": ["adminPanel.reportRemoveModel", "Remove model"],
  "disable-user": ["adminPanel.reportDisableUser", "Disable uploader"],
};

const reasonLabel = (reason) => t(`modelsPanel.reportReason_${reason}`, reason);

class ReportsSection {
  constructor({ me }) {
    this.me = me;
    this.showResolved = false;
    const element = document.createElement("section");
    element.className = "exadmin-section exadmin-reports";
    element.innerHTML = `
      <div class="exadmin-section-header">
        <h2>${t("adminPanel.reportsTitle", "Reported models")}</h2>
        <label class="exadmin-reports-toggle"><input type="checkbox" /> <span></span></label>
      </div>
      <p class="exadmin-reports-hint"></p>
      <p class="upload-panel-status" role="status" aria-live="polite"></p>
      <ul class="exadmin-reports-list"></ul>
    `;
    this.element = element;
    this.hint = element.querySelector(".exadmin-reports-hint");
    this.status = element.querySelector(".upload-panel-status");
    this.list = element.querySelector(".exadmin-reports-list");
    const toggle = element.querySelector(".exadmin-reports-toggle input");
    element.querySelector(".exadmin-reports-toggle span").textContent =
      t("adminPanel.reportsShowResolved", "Show resolved reports");
    toggle.addEventListener("change", () => {
      this.showResolved = toggle.checked;
      this.render();
    });
  }

  setStatus(message, tone = "info") {
    this.status.textContent = message;
    this.status.dataset.tone = tone;
  }

  async load() {
    this.setStatus(t("exadmin.loading", "Loading..."));
    try {
      const data = await apiRequest("/api/admin/reports");
      this.reports = Array.isArray(data.reports) ? data.reports : [];
      this.hint.textContent = data.hideThreshold
        ? t("adminPanel.reportsHint", { count: data.hideThreshold },
          "Act on reports within 24 hours. A model reported by {count} people is hidden from others until you decide.")
        : t("adminPanel.reportsHintNoHide", "Act on reports within 24 hours.");
      this.setStatus("");
    } catch (error) {
      console.error("[exadmin] Failed to load reports:", error);
      this.setStatus(error.message, "error");
      this.reports = [];
    }
    this.render();
  }

  render() {
    this.list.textContent = "";
    const reports = (this.reports || []).filter((report) => this.showResolved || report.status === "open");
    if (!reports.length) {
      const empty = document.createElement("li");
      empty.className = "exadmin-reports-empty";
      empty.textContent = t("adminPanel.reportsEmpty", "No reports.");
      this.list.appendChild(empty);
      return;
    }
    reports.forEach((report) => this.list.appendChild(this.renderReport(report)));
  }

  renderReport(report) {
    const item = document.createElement("li");
    item.className = "exadmin-report";
    item.dataset.status = report.status;

    const head = document.createElement("div");
    head.className = "exadmin-report-head";
    const name = document.createElement("strong");
    name.textContent = report.modelName || report.jobId;
    const when = document.createElement("span");
    when.className = "exadmin-report-date";
    when.textContent = new Date(report.createdAt * 1000).toLocaleString();
    head.append(name, when);
    item.appendChild(head);

    const lines = [
      t("adminPanel.reportReason", { reason: reasonLabel(report.reason) }, "Reason: {reason}"),
      report.owner ? t("adminPanel.reportOwner", { user: report.owner }, "Uploaded by {user}") : null,
      report.reporterUser
        ? t("adminPanel.reportBy", { user: report.reporterUser }, "Reported by {user}")
        : t("adminPanel.reportAnonymous", "Reported without an account"),
    ].filter(Boolean);
    const meta = document.createElement("p");
    meta.className = "exadmin-report-meta";
    meta.textContent = lines.join(" · ");
    item.appendChild(meta);

    if (report.details) {
      const details = document.createElement("blockquote");
      details.textContent = report.details;
      item.appendChild(details);
    }

    if (report.modelExists && report.modelUrl) {
      const open = document.createElement("a");
      open.href = `/?model=${encodeURIComponent(report.modelUrl)}`;
      open.target = "_blank";
      open.rel = "noopener";
      open.textContent = t("adminPanel.reportOpenModel", "Open the model");
      item.appendChild(open);
    } else if (!report.modelExists) {
      const gone = document.createElement("p");
      gone.className = "exadmin-report-meta";
      gone.textContent = t("adminPanel.reportModelGone", "The model no longer exists.");
      item.appendChild(gone);
    }

    if (report.status !== "open") {
      const resolved = document.createElement("p");
      resolved.className = "exadmin-report-meta";
      resolved.textContent = t(
        "adminPanel.reportResolved",
        { action: t(...(ACTION_LABELS[report.action] || [report.action, report.action])), admin: report.resolvedBy || "" },
        "Resolved ({action}) by {admin}"
      );
      item.appendChild(resolved);
      return item;
    }

    const actions = document.createElement("div");
    actions.className = "exadmin-report-actions";
    Object.entries(ACTION_LABELS).forEach(([action, label]) => {
      if (action === "remove-model" && !report.modelExists) return;
      if (action === "disable-user" && (!report.owner || report.owner === this.me)) return;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = t(...label);
      if (action !== "dismiss") button.classList.add("exadmin-report-danger");
      button.addEventListener("click", () => this.resolve(report, action));
      actions.appendChild(button);
    });
    item.appendChild(actions);
    return item;
  }

  async resolve(report, action) {
    if (action !== "dismiss") {
      const confirmed = await confirmDialog({
        message: action === "remove-model"
          ? t("adminPanel.reportRemoveConfirm",
            "Remove this model for good? Its files, converted model and renders are deleted.")
          : t("adminPanel.reportDisableConfirm", { user: report.owner },
            "Disable the account {user}? They can no longer log in or upload."),
        confirmLabel: t(...ACTION_LABELS[action]),
        cancelLabel: t("adminPanel.deleteCancel", "Cancel"),
        danger: true,
      });
      if (!confirmed) return;
    }
    try {
      await apiRequest(`/api/admin/reports/${encodeURIComponent(report.id)}`, "POST", { action });
      toast("reportResolved", "info");
      await this.load();
    } catch (error) {
      console.error("[exadmin] Failed to resolve report:", error);
      this.setStatus(error.message, "error");
    }
  }
}

export const reportsSection = {
  id: "reports",
  label: () => t("exadmin.navReports", "Reports"),
  mount(container, context) {
    const section = new ReportsSection(context);
    container.appendChild(section.element);
    section.load();
  },
};

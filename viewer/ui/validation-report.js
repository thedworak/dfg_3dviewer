import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { appRequestHeaders, remoteAssetUrl } from "../remote.js";
import { makePanelWindow } from "./panel-window.js";
import { featureIconSvg, featureLabel, statusLabel } from "./feature-icons.js";
import { inspectAIM3DManifest } from "../manifesto/manifest-inspection.js";
import { aiAvailability, aiDisclaimer, aiRequest, showAILocked } from "../ai/ai-client.js";
import { createLockIcon } from "./lock-icon.js";

// The validation report (toolbar: File > Validation report): is the open
// model ready to be published? One row per check, like a checklist:
//
//   - the model file: the worker's glTF-Validator report (validation.json,
//     GET /api/model/validation/<id>) for models served from a worker job
//     (/files/<id>/...); "not checked" elsewhere
//   - the IIIF structure, the descriptive metadata and the rights - always
//   - every other feature the manifest sets (annotations, timeline, ...)
//
// of the manifest the viewer would export now (build3IFManifest), checked
// attribute by attribute (manifest-inspection.js). Each row opens to its
// issues. Overall: "X/Y passed" - rows that pass over rows checked.
//
// When the worker offers AI assistance (worker/ai.py, "validation"), the
// model check can be explained in plain language: what matters, what to fix
// first (POST /api/ai/validation/<id>). Asked for by a button, never on its
// own, since every answer costs a request.

const MAX_ISSUES_SHOWN = 50;
const ALWAYS = ["manifest", "metadata", "rights"];
// Rows with a line saying what they check (validationReport.hints).
const HINTED = ["model", "metadata", "rights", "annotations", "manifest"];

const validationRequests = new Map();

// The worker job serving a model (/files/<id>/...): {id, origin}, or null.
export function modelJob(modelUrl) {
  if (typeof modelUrl !== "string" || !modelUrl) return null;
  let parsed;
  try {
    parsed = new URL(remoteAssetUrl(modelUrl), window.location.href);
  } catch {
    return null;
  }
  const match = parsed.pathname.match(/\/files\/([A-Za-z0-9_-]+)\//);
  return match ? { id: match[1], origin: parsed.origin } : null;
}

// The worker's validation endpoint for a model it serves, or null.
export function modelValidationUrl(modelUrl) {
  const job = modelJob(modelUrl);
  return job ? new URL(`/api/model/validation/${job.id}`, job.origin).href : null;
}

// validation.json of a worker model; null when there is none (other hosts,
// Drupal, models from before validation). Cached per URL for the session.
export function fetchModelValidation(modelUrl, { refresh = false } = {}) {
  const url = modelValidationUrl(modelUrl);
  if (!url) return Promise.resolve(null);
  if (refresh) validationRequests.delete(url);
  if (!validationRequests.has(url)) {
    validationRequests.set(url, fetch(url, { cache: "no-store", headers: appRequestHeaders() })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null));
  }
  return validationRequests.get(url);
}

const issueLevelOrder = { error: 0, warning: 1, info: 2, hint: 3 };

function modelRow(report) {
  const base = {
    id: "model-check",
    icon: "model-check",
    label: t("validationReport.modelCheck", "Model file check (glTF-Validator)"),
    description: t("validationReport.modelCheckHint", "Is the model file valid glTF that works in all browsers?"),
  };
  if (!report) {
    return {
      ...base,
      status: "unchecked",
      note: t("validationReport.modelNotChecked", "Only models converted by the upload worker are checked."),
      issues: [],
    };
  }
  const groups = (report.validator?.issues || []).map((group) => ({
    level: group.level,
    path: group.code + (group.count > 1 ? ` ×${group.count}` : ""),
    message: [group.message, group.pointers?.length ? `(${group.pointers.join(", ")})` : ""].filter(Boolean).join(" "),
  }));
  const checks = (report.checks || []).map((check) => ({ level: check.level, path: check.id, message: check.message }));
  const note = report.validator?.version
    ? `glTF-Validator ${report.validator.version}`
    : report.validator?.failed || t("validationReport.validatorMissing", "glTF-Validator is not installed on the worker.");
  return {
    ...base,
    status: report.status,
    note,
    issues: [...checks, ...groups].sort((a, b) => (issueLevelOrder[a.level] ?? 9) - (issueLevelOrder[b.level] ?? 9)),
  };
}

function featureRows(inspection) {
  return inspection.features
    .filter((feature) => feature.present || ALWAYS.includes(feature.id))
    .map((feature) => {
      const issues = inspection.attributes
        .filter((entry) => entry.feature === feature.id)
        .flatMap((entry) => entry.issues.map((issue) => ({ level: issue.level, path: entry.path, message: issue.message })))
        .sort((a, b) => (issueLevelOrder[a.level] ?? 9) - (issueLevelOrder[b.level] ?? 9));
      return {
        id: feature.id,
        icon: feature.icon,
        label: featureLabel(feature),
        description: HINTED.includes(feature.id) ? t(`validationReport.hints.${feature.id}`, "") : "",
        status: feature.present ? feature.status : "missing",
        count: feature.count,
        issues,
      };
    });
}

// The rows, the overall count and the details, from the manifest and the
// model's report. Also usable without the panel (tests, other UIs).
export function buildValidationReport(manifest, modelReport) {
  const inspection = inspectAIM3DManifest(manifest);
  const rows = [modelRow(modelReport), ...featureRows(inspection)];
  const checked = rows.filter((row) => row.status !== "unchecked");
  const passed = checked.filter((row) => row.status === "ok").length;
  const failed = checked.some((row) => row.status === "error");
  return {
    rows,
    passed,
    total: checked.length,
    status: failed ? "error" : passed === checked.length ? "ok" : "warning",
    inspection,
    modelReport,
  };
}

function formatNumber(value) {
  return typeof value === "number" ? value.toLocaleString() : "–";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "–";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function attachValidationReport(Viewer) {
  Object.assign(Viewer, {
    validationReport: null,
    // The AI explanation of the model check: {model, state, answer, error}.
    validationAIExplanation: null,

    isValidationReportOpen() {
      return Boolean(this.validationReportPanel && !this.validationReportPanel.hidden);
    },

    closeValidationReport() {
      if (this.validationReportPanel) this.validationReportPanel.hidden = true;
      this.updateEditorToolbarState?.();
    },

    toggleValidationReport() {
      if (this.isValidationReportOpen()) {
        this.closeValidationReport();
        return;
      }
      this.createValidationReportPanel();
      if (!this.validationReportPanel) return;
      this.validationReportPanel.hidden = false;
      this.openToolbarMenu?.(null);
      this.refreshValidationReport();
      this.updateEditorToolbarState?.();
    },

    createValidationReportPanel() {
      if (!core.container || this.validationReportPanel) return;
      const panel = document.createElement("div");
      panel.id = "validationReportPanel";
      panel.hidden = true;
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-labelledby", "validationReportTitle");
      panel.innerHTML = `
        <div class="upload-panel-header">
          <span id="validationReportTitle"></span>
          <span class="validation-report-actions">
            <button type="button" data-action="download"></button>
            <button type="button" data-action="refresh">↻</button>
            <button type="button" data-action="close">X</button>
          </span>
        </div>
        <div class="validation-report-body"></div>
      `;
      core.container.appendChild(panel);
      this.validationReportPanel = panel;
      this.validationReportBody = panel.querySelector(".validation-report-body");
      this.bindEventListener(panel.querySelector('[data-action="close"]'), "click", () => this.closeValidationReport());
      this.bindEventListener(panel.querySelector('[data-action="refresh"]'), "click", () => this.refreshValidationReport({ refresh: true }));
      this.bindEventListener(panel.querySelector('[data-action="download"]'), "click", () => this.downloadValidationReport());
      makePanelWindow(this, panel, panel.querySelector(".upload-panel-header"), () => this.closeValidationReport());
      this.localizeValidationReport();
    },

    localizeValidationReport() {
      const panel = this.validationReportPanel;
      if (!panel) return;
      panel.querySelector("#validationReportTitle").textContent = t("validationReport.title", "Validation report");
      [
        ["download", t("validationReport.download", "Download the report (JSON)"), "⤓"],
        ["refresh", t("validationReport.refresh", "Check again"), "↻"],
        ["close", t("validationReport.close", "Close"), "X"],
      ].forEach(([action, label, glyph]) => {
        const button = panel.querySelector(`[data-action="${action}"]`);
        button.title = label;
        button.setAttribute("aria-label", label);
        button.textContent = glyph;
      });
      if (this.validationReport) this.renderValidationReport();
    },

    // The manifest as it would be exported now; null without a model.
    currentManifestForReport() {
      if (!core.fileObject?.originalPath) return null;
      try {
        return this.build3IFManifest();
      } catch (error) {
        this.reportError?.(error, { context: "Failed to build the manifest for the validation report", toast: false });
        return null;
      }
    },

    async refreshValidationReport({ refresh = false } = {}) {
      const body = this.validationReportBody;
      if (!body) return;
      body.textContent = "";
      body.appendChild(el("p", "models-panel-empty", t("validationReport.checking", "Checking...")));
      const manifest = this.currentManifestForReport();
      if (!manifest) {
        this.validationReport = null;
        body.textContent = "";
        body.appendChild(el("p", "models-panel-empty", t("validationReport.noModel", "Open a model to check it.")));
        return;
      }
      const modelReport = await fetchModelValidation(core.fileObject.originalPath, { refresh });
      this.validationReport = buildValidationReport(manifest, modelReport);
      if (refresh || this.validationAIExplanation?.model !== core.fileObject.originalPath) this.validationAIExplanation = null;
      // "on" | "locked" (the app, a plan without it) | "off".
      this.validationAIState = modelReport ? await aiAvailability("validation") : "off";
      this.renderValidationReport();
    },

    renderValidationReport() {
      const body = this.validationReportBody;
      const report = this.validationReport;
      if (!body || !report) return;
      body.textContent = "";

      // Overall: the ring with X/Y passed and what that means.
      const summary = el("div", "validation-report-summary");
      summary.dataset.status = report.status;
      const ratio = report.total ? report.passed / report.total : 0;
      const ring = el("div", "validation-report-ring");
      ring.style.setProperty("--ratio", String(ratio));
      ring.append(
        el("strong", "", t("validationReport.passed", { passed: report.passed, total: report.total }, "{passed}/{total}")),
        el("span", "", t("validationReport.passedLabel", "passed")),
      );
      const verdict = el("div", "validation-report-verdict");
      const headline = {
        ok: t("validationReport.ready", "Ready"),
        warning: t("validationReport.mostlyReady", "Mostly ready"),
        error: t("validationReport.notReady", "Not ready"),
      }[report.status];
      const explanation = {
        ok: t("validationReport.readyHint", "Every check passed: the model and its manifest are ready for public reuse."),
        warning: t("validationReport.mostlyReadyHint", "The model can be published. Review the remaining items first."),
        error: t("validationReport.notReadyHint", "Some values cannot be used. Fix the failed items before publishing."),
      }[report.status];
      verdict.append(el("strong", "", headline), el("p", "", explanation));
      summary.append(ring, verdict);
      body.appendChild(summary);

      if (this.validationAIState && this.validationAIState !== "off") body.appendChild(this.renderValidationAISection());

      // The checklist.
      const list = el("ul", "validation-report-list");
      report.rows.forEach((row) => list.appendChild(this.renderValidationReportRow(row)));
      body.appendChild(list);

      body.appendChild(this.renderValidationReportDetails(report));
    },

    renderValidationReportRow(row) {
      const item = el("li", "validation-report-row");
      item.dataset.status = row.status;
      item.dataset.check = row.id;
      const details = el("details");
      const head = el("summary");
      const icon = el("span", "validation-report-icon");
      icon.innerHTML = featureIconSvg(row.icon);
      const text = el("span", "validation-report-text");
      text.append(el("strong", "", row.label + (row.count > 1 ? ` (${row.count})` : "")));
      if (row.description) text.appendChild(el("span", "", row.description));
      const pill = el("span", "validation-report-pill", statusLabel(row.status));
      head.append(icon, text, pill);
      details.appendChild(head);

      const issues = el("ul", "validation-report-issues");
      if (row.note) issues.appendChild(el("li", "validation-report-note", row.note));
      if (!row.issues.length && !row.note) {
        issues.appendChild(el("li", "validation-report-note", row.status === "missing"
          ? t("validationReport.notSetHint", "The manifest does not set this yet.")
          : t("validationReport.noIssues", "No issues.")));
      }
      row.issues.slice(0, MAX_ISSUES_SHOWN).forEach((issue) => {
        const line = el("li");
        line.dataset.level = issue.level;
        line.append(el("code", "", issue.path), el("span", "", issue.message));
        issues.appendChild(line);
      });
      if (row.issues.length > MAX_ISSUES_SHOWN) {
        issues.appendChild(el("li", "validation-report-note",
          t("validationReport.moreIssues", { count: row.issues.length - MAX_ISSUES_SHOWN }, "...and {count} more (download the report)")));
      }
      details.appendChild(issues);
      item.appendChild(details);
      return item;
    },

    // What the checks looked at: the model's numbers and the manifest's.
    renderValidationReportDetails(report) {
      const section = el("section", "validation-report-details");
      section.appendChild(el("h3", "", t("validationReport.details", "Details")));
      const table = el("dl");
      const add = (label, value) => {
        if (value === undefined || value === null || value === "") return;
        table.append(el("dt", "", label), el("dd", "", String(value)));
      };
      const model = report.modelReport;
      add(t("validationReport.file", "File"), model?.file?.name || core.fileObject?.filename);
      if (model) {
        const stats = model.stats || {};
        add(t("validationReport.fileSize", "File size"), formatBytes(model.file?.bytes));
        add(t("validationReport.triangles", "Triangles"), formatNumber(stats.totalTriangleCount));
        add(t("validationReport.vertices", "Vertices"), formatNumber(stats.totalVertexCount));
        add(t("validationReport.materials", "Materials"), formatNumber(stats.materialCount));
        add(t("validationReport.textures", "Largest texture"), stats.maxTextureSize ? `${stats.maxTextureSize[0]} × ${stats.maxTextureSize[1]} px` : null);
        add(t("validationReport.size", "Size"), model.bounds?.size ? `${model.bounds.size.map((v) => v.toLocaleString(undefined, { maximumFractionDigits: 2 })).join(" × ")} m` : null);
        add(t("validationReport.generator", "Made with"), stats.generator);
      }
      const { summary } = report.inspection;
      add(t("validationReport.attributes", "Manifest attributes"), t(
        "validationReport.attributesValue",
        { count: summary.attributes, errors: summary.errors, warnings: summary.warnings, unknown: summary.unknown },
        "{count} checked: {errors} error(s), {warnings} warning(s), {unknown} unknown",
      ));
      section.appendChild(table);
      return section;
    },

    // The AI explanation: a button, then the answer (or why there is none).
    renderValidationAISection() {
      const section = el("section", "validation-report-ai ai-answer");
      if (this.validationAIState === "locked") {
        const button = el("button", "ai-button ai-button-locked", t("ai.validation.explain", "Explain in plain language (AI)"));
        button.type = "button";
        button.prepend(createLockIcon());
        button.title = t("ai.locked", "Available with the Business plan");
        this.bindEventListener(button, "click", () => showAILocked(this));
        section.append(button, el("p", "ai-disclaimer", t("ai.locked", "Available with the Business plan")));
        return section;
      }
      const state = this.validationAIExplanation;
      if (!state || state.state === "error") {
        const button = el("button", "ai-button", t("ai.validation.explain", "Explain in plain language (AI)"));
        button.type = "button";
        button.title = t("ai.validation.explainHint", "Sends the model check report (not the model) to the AI assistant.");
        this.bindEventListener(button, "click", () => this.explainValidationWithAI());
        section.appendChild(button);
        if (state?.error) section.appendChild(el("p", "ai-error", state.error));
        return section;
      }
      if (state.state === "loading") {
        section.appendChild(el("p", "ai-loading", t("ai.thinking", "The AI assistant is looking at it...")));
        return section;
      }
      const answer = state.answer || {};
      section.appendChild(el("h3", "", t("ai.validation.title", "Explained by AI")));
      if (answer.headline) section.appendChild(el("p", "ai-headline", answer.headline));
      if (answer.summary) section.appendChild(el("p", "", answer.summary));
      const findings = Array.isArray(answer.findings) ? answer.findings : [];
      if (findings.length) {
        const list = el("ul", "ai-findings");
        findings.forEach((finding) => {
          const item = el("li");
          item.dataset.level = finding.level || "info";
          item.appendChild(el("strong", "", finding.title || ""));
          if (finding.explanation) item.appendChild(el("p", "", finding.explanation));
          if (finding.fix) {
            const fix = el("p", "ai-fix");
            fix.append(el("span", "", t("ai.validation.fix", "What to do: ")), document.createTextNode(finding.fix));
            item.appendChild(fix);
          }
          list.appendChild(item);
        });
        section.appendChild(list);
      }
      section.appendChild(el("p", "ai-disclaimer", aiDisclaimer(answer.model)));
      return section;
    },

    async explainValidationWithAI() {
      const modelUrl = core.fileObject?.originalPath;
      const job = modelJob(modelUrl);
      if (!job) return;
      this.validationAIExplanation = { model: modelUrl, state: "loading" };
      this.renderValidationReport();
      try {
        const answer = await aiRequest(`/api/ai/validation/${encodeURIComponent(job.id)}`);
        if (this.validationAIExplanation?.model !== modelUrl) return;
        this.validationAIExplanation = { model: modelUrl, state: "done", answer };
      } catch (error) {
        if (this.validationAIExplanation?.model !== modelUrl) return;
        this.validationAIExplanation = { model: modelUrl, state: "error", error: error.message };
      }
      this.renderValidationReport();
    },

    downloadValidationReport() {
      const report = this.validationReport;
      if (!report) return;
      const data = {
        createdAt: new Date().toISOString(),
        model: core.fileObject?.originalPath || null,
        passed: report.passed,
        total: report.total,
        status: report.status,
        checks: report.rows.map(({ id, status, count, issues }) => ({ id, status, count, issues })),
        modelValidation: report.modelReport,
        manifestInspection: report.inspection,
        ...(this.validationAIExplanation?.state === "done" ? { aiExplanation: this.validationAIExplanation.answer } : {}),
      };
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
      link.download = `${(core.fileObject?.basename || core.fileObject?.filename || "model").replace(/\.[^.]+$/, "")}-validation.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    },
  });
}

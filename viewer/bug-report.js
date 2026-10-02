import { core } from "./core.js";
import { isAppBuild } from "./remote.js";
import { t } from "./i18n-utils.js";
import { showToast } from "./viewer-utils.js";
import { initErrorTracking, isErrorTrackingConfigured } from "./error-tracking.js";

// "Report a bug" in the editor toolbar. With error tracking set up
// (error-tracking.js) it opens a short form and sends the report to
// GlitchTip, with the diagnostics below. Without it, it opens a new issue on
// the repository's tracker instead, pre-filled with the same. Settings:
//   "viewer": { "bugReport": { "enabled": true, "url": "https://..." } }
// url (issue tracker fallback) gets ?title=...&body=... appended.

const DEFAULT_REPORT_URL = "https://github.com/thedworak/dfg_3dviewer/issues/new";
const BUILD_ID = (typeof __BUILD_ID__ !== "undefined") ? __BUILD_ID__ : "";
const BUILD_TIME = (typeof __BUILD_TIME__ !== "undefined") ? __BUILD_TIME__ : "";
const MAX_RECENT_ERRORS = 5;
// Issue trackers reject very long URLs.
const MAX_BODY_LENGTH = 6000;

const recentErrors = [];

function rememberError(message) {
  if (!message) return;
  recentErrors.push(`${new Date().toISOString()} ${String(message).slice(0, 300)}`);
  if (recentErrors.length > MAX_RECENT_ERRORS) recentErrors.shift();
}

window.addEventListener("error", (event) => {
  rememberError(event.error?.stack?.split("\n").slice(0, 3).join(" | ") || event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  rememberError(reason?.stack?.split("\n").slice(0, 3).join(" | ") || reason?.message || reason);
});

function getBugReportConfig() {
  return core.CONFIG?.viewer?.bugReport || {};
}

export function isBugReportEnabled() {
  return getBugReportConfig().enabled !== false;
}

function getGpuRenderer() {
  try {
    const gl = core.renderer?.getContext?.();
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "";
  } catch {
    return "";
  }
}

function getModelName() {
  const file = core.fileObject;
  if (!file?.basename) return "";
  return file.extension ? `${file.basename}.${file.extension}` : file.basename;
}

export function collectBugReportDiagnostics() {
  return {
    build: BUILD_ID || "unknown",
    buildTime: BUILD_TIME || "unknown",
    platform: isAppBuild() ? "app" : "web",
    // The app page is served from inside the package; its URL says nothing.
    page: isAppBuild() ? "" : window.location.href,
    model: getModelName(),
    language: core.currentLanguage || navigator.language,
    userAgent: navigator.userAgent,
    screen: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}x`,
    gpu: getGpuRenderer(),
    recentErrors: [...recentErrors],
  };
}

function formatBody(diagnostics) {
  const lines = [
    "### What happened?",
    "",
    "",
    "### Steps to reproduce",
    "1. ",
    "",
    "### Environment",
    ...Object.entries(diagnostics)
      .filter(([key, value]) => key !== "recentErrors" && value)
      .map(([key, value]) => `- **${key}:** ${value}`),
  ];
  if (diagnostics.recentErrors.length) {
    lines.push("", "### Recent errors", "```", ...diagnostics.recentErrors, "```");
  }
  return lines.join("\n").slice(0, MAX_BODY_LENGTH);
}

function openIssueTracker(diagnostics) {
  const url = new URL(getBugReportConfig().url || DEFAULT_REPORT_URL);
  const model = diagnostics.model ? ` (${diagnostics.model})` : "";
  url.searchParams.set("title", `[Bug] ${diagnostics.platform}${model}: `);
  url.searchParams.set("body", formatBody(diagnostics));
  window.open(url.toString(), "_blank", "noopener");
}

async function sendReport({ description, email, includeDiagnostics }) {
  const Sentry = await initErrorTracking();
  if (!Sentry) return false;
  const summary = description.split("\n")[0].slice(0, 100);
  const diagnostics = collectBugReportDiagnostics();
  Sentry.captureMessage(`User report: ${summary}`, {
    level: "info",
    tags: { user_report: "true" },
    user: email ? { email } : undefined,
    extra: { description },
    contexts: includeDiagnostics ? { diagnostics } : undefined,
  });
  return Sentry.flush(8000);
}

let dialog = null;

function buildDialog() {
  const root = document.createElement("div");
  root.id = "bugReportDialog";
  root.hidden = true;
  root.innerHTML = `
    <div class="annotation-dialog__backdrop" data-bug-report-dismiss="true"></div>
    <div class="annotation-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="bugReportDialogTitle">
      <div class="annotation-dialog__header">
        <h3 id="bugReportDialogTitle"></h3>
        <button type="button" class="annotation-dialog__close" data-bug-report-dismiss="true">&times;</button>
      </div>
      <form class="annotation-dialog__form">
        <label>
          <span data-bug-report-label="description"></span>
          <textarea name="description" rows="6" maxlength="4000" required></textarea>
        </label>
        <label>
          <span data-bug-report-label="email"></span>
          <input name="email" type="email" maxlength="200" autocomplete="email" />
        </label>
        <label class="annotation-dialog__checkbox">
          <input name="includeDiagnostics" type="checkbox" checked />
          <span data-bug-report-label="diagnostics"></span>
        </label>
        <p class="bug-report-dialog__privacy" data-bug-report-label="privacy"></p>
        <div class="annotation-dialog__actions">
          <button type="submit" data-bug-report-label="send"></button>
          <button type="button" data-bug-report-dismiss="true" data-bug-report-label="cancel"></button>
        </div>
      </form>
    </div>
  `;
  ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
    root.addEventListener(type, (event) => event.stopPropagation());
  });
  const form = root.querySelector("form");
  const close = () => { root.hidden = true; };
  root.addEventListener("click", (event) => {
    if (event.target.closest("[data-bug-report-dismiss='true']")) close();
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("button[type='submit']");
    const description = form.elements.description.value.trim();
    if (!description) return;
    submit.disabled = true;
    const sent = await sendReport({
      description,
      email: form.elements.email.value.trim(),
      includeDiagnostics: form.elements.includeDiagnostics.checked,
    });
    submit.disabled = false;
    if (sent) {
      form.reset();
      close();
      showToast(t("bugReport.sent", "Thank you - the report was sent."), "success");
    } else {
      showToast(t("bugReport.failed", "The report could not be sent. Please try again later."), "error");
    }
  });
  document.body.appendChild(root);
  return root;
}

function syncDialogLabels(root) {
  root.querySelector("#bugReportDialogTitle").textContent = t("bugReport.title", "Report a bug");
  const closeButton = root.querySelector(".annotation-dialog__close");
  closeButton.setAttribute("aria-label", t("bugReport.cancel", "Cancel"));
  const labels = {
    description: t("bugReport.description", "What went wrong? What did you do just before?"),
    email: t("bugReport.email", "E-mail (optional, if we may ask you about it)"),
    diagnostics: t("bugReport.includeDiagnostics", "Attach technical details (device, browser, model, recent errors)"),
    privacy: t("bugReport.privacy", "The report goes to the viewer's developers only."),
    send: t("bugReport.send", "Send report"),
    cancel: t("bugReport.cancel", "Cancel"),
  };
  root.querySelectorAll("[data-bug-report-label]").forEach((element) => {
    element.textContent = labels[element.dataset.bugReportLabel] || "";
  });
}

export function reportBug() {
  if (!isErrorTrackingConfigured()) {
    openIssueTracker(collectBugReportDiagnostics());
    return;
  }
  dialog = dialog?.isConnected ? dialog : buildDialog();
  syncDialogLabels(dialog);
  dialog.hidden = false;
  dialog.querySelector("textarea").focus();
}

import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { makePanelWindow } from "./panel-window.js";
import { attachToolPanelChrome, refreshToolPanelChrome } from "./tool-panel-chrome.js";
import { clearEventLog, eventLogListeners, getEventLog, recordEvent } from "./event-log-store.js";

// The full log (Settings -> Event log, ui/event-log-store.js): every notice
// the viewer raised, including the ones it keeps quiet (QUIET_NOTICE_KEYS -
// states the toolbar already shows), the steps of each model load
// (createLoadingLog(), ui/loading-status.js), and the errors and warnings
// of the console. The toasts are only for what matters: the
// model loaded, something missing or failed, a hint for the tool just picked.

function formatTime(date) {
  return date.toTimeString().slice(0, 8);
}

function entryText(entry) {
  const tone = entry.tone.toUpperCase();
  const source = entry.source === "console" || entry.source === "loading" ? ` [${entry.source}]` : entry.quiet ? " [quiet]" : "";
  return `${formatTime(entry.time)} ${tone}${source} ${entry.message}${entry.detail ? ` - ${entry.detail}` : ""}`;
}

// The minimized window's icon, as the toolbar's (editor-toolbar.js).
const EVENT_LOG_PIP_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M6 3h12v18H6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 8h6M9 12h6M9 16h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

export function attachEventLogPanel(Viewer) {
  Object.assign(Viewer, {
    isEventLogOpen() {
      return Boolean(this.eventLogPanel && !this.eventLogPanel.hidden);
    },

    closeEventLog() {
      if (this.eventLogPanel) this.eventLogPanel.hidden = true;
      this.updateEditorToolbarState?.();
    },

    toggleEventLog() {
      if (this.isEventLogOpen()) {
        this.closeEventLog();
        return;
      }
      this.createEventLogPanel();
      if (!this.eventLogPanel) return;
      this.renderEventLog();
      this.eventLogPanel.hidden = false;
      this.openToolbarMenu?.(null);
      this.updateEditorToolbarState?.();
      const list = this.eventLogPanel.querySelector(".event-log-list");
      list.scrollTop = list.scrollHeight;
    },

    createEventLogPanel() {
      if (!core.container || this.eventLogPanel) return;
      const panel = document.createElement("div");
      panel.id = "eventLogPanel";
      panel.hidden = true;
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-labelledby", "eventLogPanelTitle");
      panel.innerHTML = `
        <div class="upload-panel-header">
          <span id="eventLogPanelTitle"></span>
          <button type="button" data-action="copy"></button>
          <button type="button" data-action="clear"></button>
          <button type="button" data-action="close">X</button>
        </div>
        <ol class="event-log-list" aria-live="polite"></ol>
      `;
      core.container.appendChild(panel);
      this.eventLogPanel = panel;
      this.bindEventListener(panel.querySelector('[data-action="close"]'), "click", () => this.closeEventLog());
      this.bindEventListener(panel.querySelector('[data-action="clear"]'), "click", () => clearEventLog());
      this.bindEventListener(panel.querySelector('[data-action="copy"]'), "click", () => this.copyEventLog());
      const header = panel.querySelector(".upload-panel-header");
      makePanelWindow(this, panel, header, () => this.closeEventLog());
      attachToolPanelChrome(panel, header, {
        before: header.querySelector('[data-action="copy"]'),
        movable: false,
        icon: EVENT_LOG_PIP_ICON,
        label: () => t("eventLog.title", "Event log"),
      });
      // Kept up to date while open.
      eventLogListeners.add(() => {
        if (this.isEventLogOpen()) this.renderEventLog();
      });
      this.localizeEventLog();
    },

    localizeEventLog() {
      const panel = this.eventLogPanel;
      if (!panel) return;
      panel.querySelector("#eventLogPanelTitle").textContent = t("eventLog.title", "Event log");
      [
        ["copy", t("eventLog.copy", "Copy")],
        ["clear", t("eventLog.clear", "Clear")],
        ["close", t("validationReport.close", "Close")],
      ].forEach(([action, label]) => {
        const button = panel.querySelector(`[data-action="${action}"]`);
        if (action !== "close") button.textContent = label;
        button.title = label;
        button.setAttribute("aria-label", label);
      });
      this.renderEventLog();
      refreshToolPanelChrome(panel);
    },

    renderEventLog() {
      const list = this.eventLogPanel?.querySelector(".event-log-list");
      if (!list) return;
      const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
      list.replaceChildren();
      const log = getEventLog();
      if (!log.length) {
        const empty = document.createElement("li");
        empty.className = "event-log-empty";
        empty.textContent = t("eventLog.empty", "Nothing logged yet.");
        list.appendChild(empty);
        return;
      }
      log.forEach((entry) => {
        const item = document.createElement("li");
        item.className = "event-log-entry";
        item.dataset.tone = entry.tone;
        item.dataset.source = entry.source;
        if (entry.quiet) item.dataset.quiet = "true";
        const time = document.createElement("time");
        time.textContent = formatTime(entry.time);
        time.dateTime = entry.time.toISOString();
        const message = document.createElement("span");
        message.className = "event-log-message";
        message.textContent = entry.message;
        item.append(time, message);
        if (entry.detail) {
          const detail = document.createElement("span");
          detail.className = "event-log-detail";
          detail.textContent = entry.detail;
          item.appendChild(detail);
        }
        list.appendChild(item);
      });
      if (nearBottom) list.scrollTop = list.scrollHeight;
    },

    async copyEventLog() {
      const text = getEventLog().map(entryText).join("\n");
      try {
        await navigator.clipboard.writeText(text);
        recordEvent({ tone: "success", message: t("eventLog.copied", "Log copied."), quiet: true });
        const button = this.eventLogPanel?.querySelector('[data-action="copy"]');
        if (button) {
          button.textContent = t("eventLog.copied", "Log copied.");
          setTimeout(() => this.localizeEventLog(), 1600);
        }
      } catch (error) {
        console.warn("Event log: could not copy", error);
      }
    },
  });
}

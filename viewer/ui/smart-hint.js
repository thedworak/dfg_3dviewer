import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { recordEvent } from "./event-log-store.js";

// A hint the viewer offers by itself, with the buttons that act on it: the
// view stuttering (editor/performance.js), something to fix before the
// renders (editor/publish-check.js), a model lying on its side. One at a
// time, among the notices (above the toolbar); a new one replaces the one
// shown. Closed with its ×, a hint of that key is not offered again in this
// session (`once: false` lets it come back).
//
// showSmartHint({ key, message, detail, tone, actions: [{ key, label,
// primary, run }], duration (ms, 0: until closed), once, onClose })

let current = null;
const closedKeys = new Set();

function render(hint) {
  const element = document.createElement("div");
  element.id = "viewerSmartHint";
  element.className = "viewer-hint";
  element.dataset.hint = hint.key;
  element.dataset.tone = hint.tone || "info";
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  const text = document.createElement("div");
  text.className = "viewer-hint_text";
  const message = document.createElement("span");
  message.className = "viewer-hint_message";
  message.textContent = hint.message;
  text.append(message);
  if (hint.detail) {
    const detail = document.createElement("span");
    detail.className = "viewer-hint_detail";
    detail.textContent = hint.detail;
    text.append(detail);
  }
  const actions = document.createElement("div");
  actions.className = "viewer-hint_actions";
  (hint.actions || []).forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "viewer-hint_action";
    button.classList.toggle("is-primary", action.primary === true);
    button.dataset.action = action.key || "";
    button.textContent = action.label;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      // The action may show the next hint: this one goes first.
      if (action.keepOpen !== true) hideSmartHint(hint.key);
      action.run?.();
    });
    actions.append(button);
  });
  const close = document.createElement("button");
  close.type = "button";
  close.className = "viewer-hint_close";
  close.textContent = "×";
  const closeLabel = t("hints.close", "Not now");
  close.title = closeLabel;
  close.setAttribute("aria-label", closeLabel);
  close.addEventListener("click", (event) => {
    event.stopPropagation();
    if (hint.once !== false) closedKeys.add(hint.key);
    hideSmartHint(hint.key);
    hint.onClose?.();
  });
  element.append(text, actions, close);
  ["pointerdown", "pointerup", "wheel"].forEach((type) => {
    element.addEventListener(type, (event) => event.stopPropagation());
  });
  return element;
}

export function isSmartHintClosed(key) {
  return closedKeys.has(key);
}

export function getSmartHint() {
  return current ? { key: current.hint.key, message: current.hint.message } : null;
}

// Shows the hint; false when one of its key was closed before, or there is
// nowhere to show it.
export function showSmartHint(hint) {
  if (!hint?.key || !hint.message || closedKeys.has(hint.key)) return false;
  const container = core.noticeContainer || document.getElementById("viewerNoticeContainer");
  if (!container) return false;
  hideSmartHint();
  const element = render(hint);
  container.prepend(element);
  requestAnimationFrame(() => element.classList.add("is-visible"));
  const timer = hint.duration > 0 ? setTimeout(() => hideSmartHint(hint.key), hint.duration) : null;
  current = { hint, element, timer };
  recordEvent({ tone: hint.tone || "info", message: hint.message, detail: hint.detail || "", quiet: true });
  return true;
}

// The hint shown (of `key`, if given) goes.
export function hideSmartHint(key = null) {
  if (!current || (key && current.hint.key !== key)) return false;
  clearTimeout(current.timer);
  current.element.remove();
  current = null;
  return true;
}

// For a new session in tests.
export function resetSmartHints() {
  hideSmartHint();
  closedKeys.clear();
}

import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { getViewerSideStack } from "./side-stack.js";
import { isPhoneLayout, setToolPanelMinimized } from "./tool-panel-chrome.js";

// The viewer's tool panels (attachToolPanelChrome) as one dock instead of
// windows that pile up over each other. On a desktop: a rail of icons down
// the viewer's right edge, one per open panel, and a drawer beside it with
// one panel at a time - a tap on another icon switches, a tap on the shown
// panel's icon (or Escape) folds the drawer away. On a phone: the panels'
// own sheet, the other open panels as tabs on top of it.
//
// A panel out of sight is not closed: it keeps running (a live link
// session, sounds playing, a tour) and keeps its icon - with a dot while
// something of it goes on (setToolPanelBusy) - until its own close button
// closes it. A click on the scene closes none of them (ui/panel-window.js
// leaves docked panels be).
//
// Panels made with `modal: false` (a player bar, a legend) or `dockable:
// false` (the tour's player) stay over the scene, outside the dock.
//
// Off: ?dock=0, localStorage viewerPanelDock = "0", or viewer.panelDock:
// false in viewer-settings.json.

const NARROW_WIDTH = 640;

export function isPanelDockEnabled(Viewer) {
  if (core.PRESENTATION_MODE === true || Viewer?.urlOptions?.hideUi === true) return false;
  const param = new URLSearchParams(window.location.search).get("dock");
  if (param === "1" || param === "0") return param === "1";
  try {
    const stored = window.localStorage.getItem("viewerPanelDock");
    if (stored === "1" || stored === "0") return stored === "1";
  } catch (_err) {
    // No storage: the settings decide.
  }
  return core.CONFIG?.viewer?.panelDock !== false;
}

function panelLabel(panel) {
  const label = panel.toolPanelChrome?.options?.label;
  const text = typeof label === "function" ? label() : label;
  if (text) return text;
  if (panel.getAttribute("aria-label")) return panel.getAttribute("aria-label");
  const header = panel.toolPanelChrome?.header;
  const title = header?.querySelector("h2, h3, strong, [class*='title']") || header;
  return (title?.textContent || "").trim().slice(0, 40);
}

function isOpen(panel) {
  const root = panel.toolPanelChrome?.visibilityRoot || panel;
  return panel.isConnected && !panel.hidden && !root.hidden;
}

function isDockable(panel) {
  const options = panel.toolPanelChrome?.options;
  return Boolean(options) && options.modal !== false && options.dockable !== false;
}

// The dock is in charge of the panels (no window of their own over the
// scene: editor/live-data.js).
export function isPanelDockActive() {
  return Boolean(core.container?.panelDock);
}

export function installPanelDock() {
  const container = core.container;
  const stack = getViewerSideStack();
  if (!container || !stack || container.panelDock) return;

  const rail = document.createElement("div");
  rail.className = "viewer-panel-dock-rail";
  rail.setAttribute("role", "tablist");
  rail.setAttribute("aria-orientation", "vertical");
  container.append(rail);

  const tabs = document.createElement("div");
  tabs.className = "viewer-panel-dock-tabs";
  tabs.setAttribute("role", "tablist");

  const buttons = new Map();
  // Most recently shown last: closing the shown panel shows the one before.
  let order = [];
  let active = null;
  let collapsed = false;
  let previous = new Set();

  const isNarrow = () => isPhoneLayout() || container.clientWidth < NARROW_WIDTH;

  const bringForward = (panel) => {
    active = panel;
    collapsed = false;
    order = [...order.filter((item) => item !== panel), panel];
    if (panel.classList.contains("is-minimized")) setToolPanelMinimized(panel, false, { focus: false });
  };

  const show = (panel) => {
    if (active === panel && !collapsed && !isNarrow()) collapsed = true;
    else bringForward(panel);
    sync();
  };

  const makeButton = (panel) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "viewer-panel-dock-button";
    button.setAttribute("role", "tab");
    button.addEventListener("click", () => show(panel));
    // Not a click on the scene behind (ui/panel-window.js).
    button.addEventListener("pointerup", (event) => event.stopPropagation());
    return button;
  };

  const renderButton = (button, panel, { withText }) => {
    const icon = panel.toolPanelChrome?.options?.icon || "";
    const label = panelLabel(panel);
    const key = `${withText}|${label}|${icon.length}`;
    if (button.dockKey !== key) {
      button.innerHTML = `<span class="viewer-panel-dock-icon">${icon}</span>${withText ? `<span class="viewer-panel-dock-label"></span>` : ""}<span class="viewer-panel-dock-dot" aria-hidden="true"></span>`;
      if (withText) button.querySelector(".viewer-panel-dock-label").textContent = label;
      button.dockKey = key;
    }
    const shown = panel === active && !collapsed;
    const busy = panel.dataset.panelBusy === "1";
    button.classList.toggle("is-active", shown);
    button.classList.toggle("is-busy", busy && !shown);
    button.setAttribute("aria-selected", String(shown));
    const parts = [label];
    if (busy) parts.push(t("panelDock.busy", "running"));
    if (shown && !withText) parts.push(t("panelDock.fold", "tap to fold away"));
    const title = parts.join(" - ");
    if (button.title !== title) {
      button.title = title;
      button.setAttribute("aria-label", title);
    }
  };

  // The panels themselves: minimized by their own code, busy or not.
  const panelObserver = new MutationObserver(() => schedule());
  const watched = new WeakSet();

  let frame = 0;
  function sync() {
    cancelAnimationFrame(frame);
    const narrow = isNarrow();
    // In the side stack, or in the viewer itself: a phone's sheet, or a
    // window placed over the scene (the ground panel, the event log).
    const panels = [...new Set([...stack.children, ...container.children])]
      .filter((panel) => isDockable(panel) && isOpen(panel));
    const open = new Set(panels);

    panels.forEach((panel) => {
      if (!watched.has(panel)) {
        watched.add(panel);
        panelObserver.observe(panel, { attributes: true, attributeFilter: ["class", "data-panel-busy"] });
      }
      panel.classList.add("is-docked");
      // A window over the scene joins the drawer.
      if (!narrow && panel.parentElement === container && !panel.classList.contains("is-modal-open")) {
        stack.append(panel);
      }
      // Just opened (its toolbar button): it comes forward.
      if (!previous.has(panel)) bringForward(panel);
    });
    previous = open;
    order = order.filter((panel) => open.has(panel));
    if (!open.has(active)) active = order[order.length - 1] || null;
    // Minimized by its own code (a phone's sheet pulled down, a tool that
    // needs the scene): on a desktop, the drawer folds.
    if (!narrow && active?.classList.contains("is-minimized")) collapsed = true;
    if (narrow && active) collapsed = false;

    [...buttons.keys()].forEach((panel) => {
      if (open.has(panel)) return;
      buttons.get(panel).rail.remove();
      buttons.get(panel).tab.remove();
      buttons.delete(panel);
      panel.classList.remove("is-docked", "is-dock-hidden");
    });
    panels.forEach((panel) => {
      if (!buttons.has(panel)) buttons.set(panel, { rail: makeButton(panel), tab: makeButton(panel) });
      const { rail: railButton, tab } = buttons.get(panel);
      renderButton(railButton, panel, { withText: false });
      renderButton(tab, panel, { withText: true });
      if (railButton.parentNode !== rail) rail.append(railButton);
      if (tab.parentNode !== tabs) tabs.append(tab);
      panel.classList.toggle("is-dock-hidden", panel !== active || collapsed);
    });

    container.classList.toggle("has-panel-dock", panels.length > 0);
    container.classList.toggle("is-panel-dock-narrow", narrow);
    container.classList.toggle("is-panel-dock-collapsed", collapsed || !active);
    // The tabs ride on top of the shown sheet; one panel alone needs none.
    const tabsHome = narrow && active && panels.length > 1 ? active : null;
    if (tabsHome && tabs.parentNode !== tabsHome) tabsHome.prepend(tabs);
    else if (!tabsHome && tabs.isConnected) tabs.remove();
  }

  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sync);
  }
  // A panel added, removed, shown or hidden.
  new MutationObserver(schedule).observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden"],
  });
  window.addEventListener("resize", schedule);
  container.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || isNarrow() || !active || collapsed) return;
    collapsed = true;
    sync();
  });

  const refreshTexts = () => {
    rail.setAttribute("aria-label", t("panelDock.title", "Open panels"));
    tabs.setAttribute("aria-label", t("panelDock.title", "Open panels"));
    buttons.forEach(({ rail: railButton, tab }) => {
      railButton.dockKey = null;
      tab.dockKey = null;
    });
    schedule();
  };
  refreshTexts();

  container.panelDock = { sync, show, refreshTexts };
  container.classList.add("viewer-panel-dock");
  sync();
}

// The dock's texts again, in the current language (ui/localization-theme.js).
export function refreshPanelDock() {
  core.container?.panelDock?.refreshTexts();
}

import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { TOOL_PANEL_OPEN_EVENT } from "./tool-panel-chrome.js";
// Called at run time only, so the import cycle is harmless.
import { setStoredToolbarPosition, syncNoticeAboveToolbar } from "../editor-toolbar.js";

// The toolbar as menus (a test of the layout proposed for the toolbar): the
// tools of editor-toolbar.js - the same buttons, with their submenus and
// state - sorted into a few menus with names, instead of one row of icons.
// `?ui=classic` (or viewer.ui: "classic") keeps the toolbar as it was.
//
// Three layouts, from the size of the viewer (not the window: the viewer
// can sit in a page), set as data-mode on the toolbar:
// - "desktop": a bar in the bottom left corner - the navigation tools, then
//   the menus by name; a menu opens as a panel above it.
// - "bar" (phone, upright): a tab bar along the bottom with five tabs, the
//   rest under "More"; a menu opens as a sheet above the bar.
// - "rail" (phone on its side): the same tabs down the left edge; a menu
//   opens as a panel beside them, the model staying in view.
// Submenus open in place (an accordion) instead of flying out. Between the
// layouts (turning the phone) the tabs move to their new places, turning
// as they go.

const CATEGORIES = [
  {
    id: "look",
    label: () => t("menus.look", "Look"),
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    tools: ["projection", "lights", "environmentMap", "shading", "wireframe", "materials", "background", "rendering", "resetSettings"],
  },
  {
    id: "analysis",
    label: () => t("menus.analysis", "Analysis"),
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19h18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M6 19c1-3 2-3 3 0s2 3 3 0 2-3 3 0 2 3 3 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 5l7 6M5 9l4 3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    tools: ["rakingLight", "sunStudy", "clippingPlanes", "certainty", "compare"],
  },
  {
    id: "measure",
    label: () => t("menus.measure", "Measure"),
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15 15 3l6 6L9 21z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M7 11l2 2M10 8l2 2M13 5l2 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    tools: ["ruler"],
  },
  {
    id: "story",
    label: () => t("menus.story", "Story"),
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v12H10l-5 4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 9h6M9 12h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    tools: ["annotate", "annotateTour", "annotatePhotos"],
  },
  {
    id: "model",
    more: true,
    label: () => t("menus.model", "Model"),
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 12 20 7.5M12 12 4 7.5M12 12v9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    tools: ["hierarchy", "picking", "pointCloud"],
  },
  {
    id: "file",
    more: true,
    label: () => t("menus.file", "File"),
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 3v4h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    tools: ["preview", "download", "save", "generateThumbnails", "annotateImport", "annotateExport", "IIIFimport", "IIIFexport"],
  },
  {
    id: "device",
    more: true,
    label: () => t("menus.device", "Device"),
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M11 18.5h2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    tools: ["deviceVideo", "deviceMotion"],
  },
  // With what the classic toolbar's main menu (the cog) held: language
  // and theme, first.
  {
    id: "settings",
    more: true,
    label: () => t("menus.settings", "Settings"),
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2 2.2 3-.2.8 2.9 2.6 1.4-1 2.8 1 2.8-2.6 1.4-.8 2.9-3-.2L12 21l-2-2.2-3 .2-.8-2.9-2.6-1.4 1-2.8-1-2.8 2.6-1.4.8-2.9 3 .2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    tools: ["help", "reportBug", "statistics", "loadingLogs"],
  },
];

const MORE = {
  id: "more",
  label: () => t("menus.more", "More"),
  icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/></svg>',
};

// Always at hand, outside the menus: the model's transform modes, then the
// view.
const NAV_TRANSFORM = ["orbit", "move", "rotate", "scale"];
const NAV_VIEW = ["resetCamera", "fullScreen", "immersive", "deviceAr"];
const NAV_TOOLS = [...NAV_TRANSFORM, ...NAV_VIEW];
// Not in the menus layout (none at the moment).
export const MENU_SKIPPED_TOOLS = [];

const PHONE_SHORT_SIDE = 520;
const PHONE_WIDTH = 700;
const TURN_MS = 560;

export function isMenuToolbarEnabled(viewer) {
  const param = new URLSearchParams(window.location.search).get("ui");
  const value = String(param || core.CONFIG?.viewer?.ui || viewer?.CONFIG?.viewer?.ui || "menus").toLowerCase();
  return value !== "classic";
}

export function isMenuToolbar(toolbar = core.editorToolbar) {
  return toolbar?.classList.contains("viewer-menus") === true;
}

// The layout for a viewer of this size.
function layoutFor(width, height) {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (coarse && width > height && height <= PHONE_SHORT_SIDE) return "rail";
  if (width < PHONE_WIDTH) return "bar";
  return "desktop";
}

function categoryOf(key) {
  return CATEGORIES.find((category) => category.tools.includes(key)) || null;
}

function el(tag, className, attrs = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
  return node;
}

// Builds the menus into `toolbar` from the tool buttons by key (in the
// toolbar's order). Unknown tools go to Help, so none is lost.
export function buildMenuToolbar(viewer, toolbar, host, buttons) {
  toolbar.classList.add("viewer-menus");
  toolbar.classList.remove("collapsed");

  const nav = el("div", "viewer-menus_nav");
  // The grip that moves the bar (desktop only).
  const grip = buttons.moveToolbar || null;
  if (grip) grip.classList.add("viewer-menus_grip");
  const tabs = el("div", "viewer-menus_tabs", { role: "group" });
  const dock = el("div", "viewer-menus_dock");
  const panel = el("div", "viewer-menus_panel", { role: "dialog" });
  panel.hidden = true;
  const header = el("div", "viewer-menus_panel-header");
  const title = el("div", "viewer-menus_panel-title");
  const close = el("button", "viewer-menus_close", { type: "button" });
  close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  header.append(title, close);
  const body = el("div", "viewer-menus_panel-body");
  panel.append(header, body);

  const groups = {};
  CATEGORIES.forEach((category) => {
    const group = el("div", "viewer-menus_group");
    group.dataset.category = category.id;
    const heading = el("div", "viewer-menus_group-title");
    group.appendChild(heading);
    groups[category.id] = { group, heading, count: 0 };
    body.appendChild(group);
  });

  if (grip) nav.appendChild(grip);
  NAV_TRANSFORM.forEach((key) => {
    if (buttons[key]) nav.appendChild(buttons[key]);
  });
  nav.appendChild(el("span", "viewer-menus_nav-divider", { "aria-hidden": "true" }));
  NAV_VIEW.forEach((key) => {
    if (buttons[key]) nav.appendChild(buttons[key]);
  });
  // In each menu in the order it lists them, the unknown ones last.
  const rank = (key) => {
    const category = categoryOf(key);
    return category ? category.tools.indexOf(key) : Number.MAX_SAFE_INTEGER;
  };
  Object.entries(buttons)
    .filter(([key]) => !NAV_TOOLS.includes(key) && key !== "moveToolbar")
    .sort(([a], [b]) => rank(a) - rank(b))
    .forEach(([key, button]) => {
      const category = categoryOf(key) || CATEGORIES.find((entry) => entry.id === "settings");
      button.classList.add("viewer-menus_item");
      groups[category.id].group.appendChild(button);
      groups[category.id].count += 1;
    });
  // The main menu's contents (language, theme - kept by main.js and
  // ui/localization-theme.js) open in Settings; its cog is not shown.
  if (viewer.actionMenuPanel) {
    const settings = groups.settings;
    settings.group.insertBefore(viewer.actionMenuPanel, settings.heading.nextSibling);
    settings.count += 1;
  }
  if (viewer.actionMenu) {
    viewer.actionMenu.classList.add("viewer-action-menu_in-toolbar", "viewer-menus_cog");
    toolbar.appendChild(viewer.actionMenu);
  }

  const tabButtons = {};
  const addTab = (category) => {
    const tab = el("button", "viewer-menus_tab", { type: "button", "aria-expanded": "false" });
    tab.dataset.menu = category.id;
    if (category.more) tab.dataset.more = "true";
    tab.innerHTML = `<span class="viewer-menus_tab-icon" aria-hidden="true">${category.icon}</span><span class="viewer-menus_tab-label"></span><span class="viewer-menus_tab-chevron" aria-hidden="true"></span>`;
    viewer.bindEventListener(tab, "click", (event) => {
      event.stopPropagation();
      openMenu(state.open === category.id ? null : category.id);
    });
    tabs.appendChild(tab);
    tabButtons[category.id] = tab;
  };
  CATEGORIES.filter((category) => groups[category.id].count > 0).forEach(addTab);
  addTab(MORE);
  Object.values(groups).forEach(({ group, count }) => { group.hidden = count === 0; });

  dock.append(nav, tabs);
  toolbar.append(dock, panel);

  const state = { open: null, mode: null };
  viewer.menuToolbar = { toolbar, dock, nav, tabs, panel, title, close, groups, tabButtons, state, categories: CATEGORIES, more: MORE };

  // The menus a tab shows: one, or everything marked `more` under "More".
  const menusFor = (id) => (id === "more"
    ? CATEGORIES.filter((category) => category.more && groups[category.id].count > 0)
    : CATEGORIES.filter((category) => category.id === id));

  function openMenu(id) {
    state.open = id;
    const shown = id ? menusFor(id).map((category) => category.id) : [];
    Object.entries(groups).forEach(([key, { group }]) => {
      group.classList.toggle("is-shown", shown.includes(key));
    });
    panel.classList.toggle("viewer-menus_panel--many", shown.length > 1);
    Object.entries(tabButtons).forEach(([key, tab]) => {
      const active = key === id || (id === "more" && tab.dataset.more === "true" && state.mode === "desktop");
      tab.classList.toggle("is-open", key === id);
      tab.setAttribute("aria-expanded", key === id ? "true" : "false");
      tab.classList.toggle("is-current", active && key === id);
    });
    panel.hidden = !id;
    toolbar.classList.toggle("viewer-menus--open", Boolean(id));
    if (id) {
      const category = id === "more" ? MORE : CATEGORIES.find((entry) => entry.id === id);
      title.textContent = category?.label() || "";
      panel.setAttribute("aria-label", title.textContent);
      placePanel();
      body.scrollTop = 0;
    }
    syncNoticeAboveToolbar();
    // Again once the panel has slid in.
    setTimeout(syncNoticeAboveToolbar, 320);
  }
  viewer.openToolbarMenu = openMenu;

  // On the desktop the panel stands over its tab - or under it, where the
  // bar was moved up and there is more room below.
  function placePanel() {
    if (state.mode !== "desktop" || !state.open) {
      panel.style.removeProperty("--viewer-menus-panel-left");
      toolbar.classList.remove("viewer-menus--below");
      return;
    }
    const tab = tabButtons[state.open];
    if (!tab) return;
    const left = tab.getBoundingClientRect().left - toolbar.getBoundingClientRect().left;
    panel.style.setProperty("--viewer-menus-panel-left", `${Math.round(left)}px`);
    const hostRect = host.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();
    const above = dockRect.top - hostRect.top;
    const below = hostRect.bottom - dockRect.bottom;
    toolbar.classList.toggle("viewer-menus--below", above < 360 && below > above);
  }

  // Submenus open in place: a tap on a tool with a submenu (not in it).
  viewer.bindEventListener(panel, "click", (event) => {
    const row = event.target.closest(".has-submenu");
    if (!row || !panel.contains(row)) return;
    const submenu = row.querySelector(":scope > .viewer-editor-tool_submenu");
    if (submenu?.contains(event.target)) return;
    const open = !row.classList.contains("is-open");
    row.classList.toggle("is-open", open);
    row.setAttribute("aria-expanded", open ? "true" : "false");
  });
  panel.querySelectorAll(".has-submenu").forEach((row) => row.setAttribute("aria-expanded", "false"));

  viewer.bindEventListener(close, "click", (event) => {
    event.stopPropagation();
    openMenu(null);
  });
  viewer.bindEventListener(document, "click", (event) => {
    if (!state.open || toolbar.contains(event.target)) return;
    openMenu(null);
  });
  viewer.bindEventListener(document, "keydown", (event) => {
    if (event.key === "Escape" && state.open) openMenu(null);
  });
  // A tool panel opening (sun, section planes, VR and AR...) gets the room
  // on a phone.
  viewer.bindEventListener(document, TOOL_PANEL_OPEN_EVENT, () => {
    if (state.mode !== "desktop") setTimeout(() => openMenu(null), 0);
  });

  // The layout, from the viewer's size.
  const applyLayout = () => {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    toolbar.style.setProperty("--viewer-menus-host-w", `${Math.round(rect.width)}px`);
    toolbar.style.setProperty("--viewer-menus-host-h", `${Math.round(rect.height)}px`);
    const mode = layoutFor(rect.width, rect.height);
    if (mode === state.mode) {
      placePanel();
      return;
    }
    const previous = state.mode;
    const before = previous ? measureTabs() : null;
    state.mode = mode;
    toolbar.dataset.mode = mode;
    if (state.open === "more" && mode === "desktop") openMenu(null);
    placePanel();
    if (before) turnTabs(before, previous, mode);
    if (mode === "desktop") requestAnimationFrame(() => keepInside());
    syncNoticeAboveToolbar();
  };
  const measureTabs = () => {
    const rects = new Map();
    [...tabs.children, ...nav.children].forEach((node) => {
      if (node.offsetParent) rects.set(node, node.getBoundingClientRect());
    });
    return rects;
  };
  viewer.syncMenuToolbarLayout = applyLayout;

  // Moving the bar by its grip (desktop): an offset from its corner, kept
  // inside the viewer. It is the toolbar position of the viewer settings
  // and manifests (viewer.editorToolbar.position: stored by
  // setStoredToolbarPosition, exported by getCurrentEditorToolbarState,
  // applied by applyEditorToolbarConfig), as for the classic toolbar.
  const configured = core.CONFIG?.viewer?.editorToolbar?.position || {};
  const drag = {
    x: Number.parseFloat(configured.x) || 0,
    y: Number.parseFloat(configured.y) || 0,
    start: null,
  };
  const showOffset = () => {
    toolbar.style.setProperty("--viewer-menus-drag-x", `${Math.round(drag.x)}px`);
    toolbar.style.setProperty("--viewer-menus-drag-y", `${Math.round(drag.y)}px`);
  };
  // Inside the viewer - measured, so on the desktop only (elsewhere the
  // offset waits, unused, for the desktop layout).
  const clampOffset = () => {
    if (state.mode !== "desktop") return;
    const hostRect = host.getBoundingClientRect();
    const rect = dock.getBoundingClientRect();
    if (!hostRect.width || !rect.width) return;
    // Where the dock would be without the current offset.
    const shown = {
      x: Number.parseFloat(toolbar.style.getPropertyValue("--viewer-menus-drag-x")) || 0,
      y: Number.parseFloat(toolbar.style.getPropertyValue("--viewer-menus-drag-y")) || 0,
    };
    const baseLeft = rect.left - shown.x;
    const baseTop = rect.top - shown.y;
    const margin = 4;
    drag.x = Math.min(Math.max(drag.x, hostRect.left + margin - baseLeft), hostRect.right - margin - rect.width - baseLeft);
    drag.y = Math.min(Math.max(drag.y, hostRect.top + margin - baseTop), hostRect.bottom - margin - rect.height - baseTop);
  };
  const setOffset = (x, y, { store = false } = {}) => {
    if (Number.isFinite(x)) drag.x = x;
    if (Number.isFinite(y)) drag.y = y;
    clampOffset();
    showOffset();
    if (store) setStoredToolbarPosition(viewer, Math.round(drag.x), Math.round(drag.y), { explicit: true });
  };
  viewer.menuToolbar.setOffset = (x, y) => {
    setOffset(x, y);
    placePanel();
    syncNoticeAboveToolbar();
  };
  showOffset();
  if (grip) {
    viewer.bindEventListener(grip, "pointerdown", (event) => {
      if (event.button !== 0 || state.mode !== "desktop") return;
      event.preventDefault();
      event.stopPropagation();
      drag.start = { pointerX: event.clientX, pointerY: event.clientY, x: drag.x, y: drag.y };
      toolbar.classList.add("viewer-menus--dragging");
      grip.setPointerCapture?.(event.pointerId);
    });
    viewer.bindEventListener(grip, "pointermove", (event) => {
      if (!drag.start) return;
      setOffset(drag.start.x + event.clientX - drag.start.pointerX, drag.start.y + event.clientY - drag.start.pointerY);
      placePanel();
    });
    const stop = () => {
      if (!drag.start) return;
      drag.start = null;
      // Kept with the settings and manifests.
      setOffset(drag.x, drag.y, { store: true });
      toolbar.classList.remove("viewer-menus--dragging");
      placePanel();
      syncNoticeAboveToolbar();
    };
    viewer.bindEventListener(grip, "pointerup", stop);
    viewer.bindEventListener(grip, "pointercancel", stop);
    viewer.bindEventListener(grip, "click", (event) => event.stopPropagation());
  }
  // Still inside after the viewer changed size, or the desktop layout
  // came back.
  const keepInside = () => {
    if (state.mode === "desktop" && (drag.x || drag.y)) setOffset(drag.x, drag.y);
  };
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => {
      applyLayout();
      keepInside();
    });
    observer.observe(host);
  }
  viewer.bindEventListener(window, "resize", applyLayout);
  applyLayout();

  updateMenuToolbarLabels(viewer);
}

// The tabs fly from where they stood to their new places, turning a quarter
// the way the phone turned (screen.orientation), so they come out upright.
function turnTabs(before, previous, mode) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const angle = Number(window.screen?.orientation?.angle ?? window.orientation ?? 0);
  const toSide = mode === "rail";
  const fromSide = previous === "rail";
  let turn = 0;
  if (toSide) turn = angle === 270 || angle === -90 ? -90 : 90;
  else if (fromSide) turn = angle === 270 || angle === -90 ? 90 : -90;
  before.forEach((rect, node) => {
    if (!node.isConnected || !node.offsetParent) return;
    const now = node.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - (now.left + now.width / 2);
    const dy = rect.top + rect.height / 2 - (now.top + now.height / 2);
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && !turn) return;
    const icon = node.querySelector(":scope > .viewer-menus_tab-icon, :scope > .viewer-editor-tool_icon, :scope .viewer-action-menu_settings-icon");
    node.animate(
      [{ transform: `translate(${dx}px, ${dy}px)`, opacity: 0.4 }, { transform: "none", opacity: 1 }],
      { duration: TURN_MS, easing: "cubic-bezier(0.2, 0.85, 0.25, 1)" }
    );
    icon?.animate(
      [{ transform: `rotate(${turn}deg) scale(0.8)` }, { transform: "rotate(0deg) scale(1)" }],
      { duration: TURN_MS + 120, easing: "cubic-bezier(0.3, 1.4, 0.4, 1)" }
    );
  });
}

// Names of the menus and of the tools added for them; with the toolbar's
// other labels (updateEditorToolbarLabels), also on a language change.
export function updateMenuToolbarLabels(viewer) {
  const menus = viewer.menuToolbar;
  if (!menus) return;
  [...CATEGORIES, MORE].forEach((category) => {
    const tab = menus.tabButtons[category.id];
    const label = category.label();
    // The name in the tab is its accessible name too; no tooltip, as the
    // desktop bar shows it on hover.
    if (tab) tab.querySelector(".viewer-menus_tab-label").textContent = label;
    const group = menus.groups[category.id];
    if (group) group.heading.textContent = label;
  });
  menus.close.setAttribute("aria-label", t("menus.close", "Close"));
  menus.close.setAttribute("title", t("menus.close", "Close"));
  if (menus.state.open) {
    const category = menus.state.open === "more" ? MORE : CATEGORIES.find((entry) => entry.id === menus.state.open);
    menus.title.textContent = category?.label() || "";
  }
  const buttons = viewer.editorToolbarButtons || {};
  const labels = {
    sunStudy: t("sun.title", "Sun and shadows"),
    rakingLight: t("gui.rakingLight", "Raking light"),
    compare: viewer.isComparing?.() ? t("compare.close", "Close the comparison") : t("compare.open", "Compare two variants side by side"),
    annotatePhotos: t("gui.annotatePhotos", "Historical photos"),
    annotateImport: t("gui.annotateImport", "Import Annotations"),
    annotateExport: t("gui.annotateExport", "Export Annotations"),
    IIIFimport: t("gui.IIIFimport", "Import 3IF"),
    IIIFexport: t("gui.IIIFexport", "Export to IIIF"),
  };
  Object.entries(labels).forEach(([key, label]) => {
    const button = buttons[key];
    if (!button) return;
    button.setAttribute("title", label);
    button.setAttribute("aria-label", label);
  });
}

// What only the menus need of the toolbar's state: the comparison (shown
// where the model has variants or a timeline to compare).
export function updateMenuToolbarState(viewer) {
  const menus = viewer.menuToolbar;
  if (!menus) return;
  viewer.editorToolbarButtons?.moveToolbar?.classList.remove("is-active");
  const compare = viewer.editorToolbarButtons?.compare;
  if (compare) {
    compare.hidden = viewer.canCompare?.() !== true;
    const active = viewer.isComparing?.() === true;
    compare.classList.toggle("is-active", active);
    compare.setAttribute("aria-pressed", active ? "true" : "false");
  }
  ["sunStudy", "rakingLight"].forEach((key) => {
    const button = viewer.editorToolbarButtons?.[key];
    if (!button) return;
    const active = key === "sunStudy" ? viewer.sunStudy?.enabled === true : viewer.rakingLight?.enabled === true;
    button.classList.toggle("is-active", active);
  });
}

// The part of the viewer's bottom the toolbar covers, for the notices
// (syncNoticeAboveToolbar): the bar itself - an open menu stays out of it -
// and nothing for the rail or a bar moved up.
export function menuToolbarBottomEdge(toolbar) {
  const mode = toolbar.dataset.mode;
  if (mode === "rail") return null;
  const dock = toolbar.querySelector(":scope > .viewer-menus_dock");
  if (!dock) return null;
  const rect = dock.getBoundingClientRect();
  let top = rect.top;
  // On a phone the navigation stands in a row above the tabs.
  const nav = dock.querySelector(":scope > .viewer-menus_nav");
  if (mode === "bar" && nav) top = Math.min(top, nav.getBoundingClientRect().top);
  // A desktop bar moved away from the bottom leaves the notices where they are.
  const host = toolbar.parentElement?.getBoundingClientRect();
  if (mode === "desktop" && host && host.bottom - rect.bottom > 80) return null;
  return top;
}

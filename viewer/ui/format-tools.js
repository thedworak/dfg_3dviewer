import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { getModelKind, MODEL_KINDS } from "../model-kind.js";
// Called at run time only, so the import cycle is harmless.
import { syncEditorToolbarSecondaryTrayWidth, updateToolbarGroups, PHONE_TOOLBAR_QUERY } from "../editor-toolbar.js";

// The tools for the kind of model shown (model-kind.js): the ones this kind
// of model is mostly looked at with come to the top - out of the folded
// tray onto the bar of the classic toolbar, or as shortcuts into the
// navigation of the menus (ui/menu-toolbar.js) - faintly marked as the
// model's own (.is-format-tool, editor-toolbar.css and menu-toolbar.css).
// Those that do nothing for it are left out.
//
// `promote` is in order of importance: where the bar has room for fewer
// (FORMAT_TOOL_LIMITS), the first ones come. A tool not there for the model
// (hidden, e.g. the IFC questions without the worker's AI) is skipped, the
// next one taking its place.
export const FORMAT_TOOL_PROFILES = {
  bim: {
    promote: ["ifcQuery", "hierarchy", "picking", "clippingPlanes", "ruler"],
    hide: [],
  },
  pointcloud: {
    promote: ["pointCloud", "clippingPlanes", "ruler"],
    hide: ["shading", "wireframe"],
  },
  splats: {
    promote: ["clippingPlanes", "ruler"],
    hide: ["shading", "wireframe"],
  },
  volume: {
    promote: ["volume", "clippingPlanes", "ruler"],
    hide: ["shading", "wireframe", "weather", "ground", "sceneSuggest"],
  },
  mesh: {
    promote: ["materials", "shading", "lights", "ruler"],
    hide: [],
  },
};

// How many come to the top: phones have room for few.
export const FORMAT_TOOL_LIMITS = {
  classic: { phone: 2, desktop: 5 },
  menus: { phone: 2, desktop: 4 },
};

// Tools with only a submenu (their own click does nothing): the shortcut
// in the menus opens their menu at them instead.
const SUBMENU_ONLY_TOOLS = new Set(["upAxis", "environmentMap", "rendering", "background", "hierarchy", "statistics", "save", "rakingLight", "sunStudy"]);
// Always on the bar already, or the toolbar's own.
const NEVER_PROMOTED = new Set(["moveToolbar", "orbit", "move", "rotate", "scale", "expand"]);

const isToolKey = (value) => typeof value === "string" && value.trim() !== "";

// The profile for `kind`, with the settings' or manifest's own
// (viewer.editorToolbar.profile: { enabled, promote, hide }) in place of
// the lists it gives.
export function resolveFormatProfile(viewer, kind) {
  const config = core.CONFIG?.viewer?.editorToolbar?.profile ?? viewer?.CONFIG?.viewer?.editorToolbar?.profile;
  if (config === false || config?.enabled === false) return { kind, promote: [], hide: [] };
  const base = FORMAT_TOOL_PROFILES[kind] || { promote: [], hide: [] };
  const own = config && typeof config === "object" ? config : {};
  const promote = Array.isArray(own.promote) ? own.promote.filter(isToolKey) : base.promote;
  const hide = Array.isArray(own.hide) ? own.hide.filter(isToolKey) : base.hide;
  return {
    kind,
    promote: promote.filter((key) => !NEVER_PROMOTED.has(key) && !hide.includes(key)),
    hide: hide.filter((key) => !NEVER_PROMOTED.has(key)),
  };
}

function isMenus(viewer) {
  return Boolean(viewer.menuToolbar && core.editorToolbar?.classList.contains("viewer-menus"));
}

function limitFor(viewer) {
  if (isMenus(viewer)) {
    return viewer.menuToolbar.state?.mode === "desktop" ? FORMAT_TOOL_LIMITS.menus.desktop : FORMAT_TOOL_LIMITS.menus.phone;
  }
  return window.matchMedia(PHONE_TOOLBAR_QUERY).matches ? FORMAT_TOOL_LIMITS.classic.phone : FORMAT_TOOL_LIMITS.classic.desktop;
}

// Whether the tool is there for this model (the rules of
// updateEditorToolbarState have run) and can come to the top.
function isPromotable(button) {
  return Boolean(button)
    && !button.hidden
    && !button.classList.contains("is-format-hidden")
    // Moved into the main menu (classic toolbar's actionMenuToolKeys).
    && !button.classList.contains("viewer-action-menu_editor-tool");
}

function formatState(viewer) {
  viewer.formatTools ??= { kind: undefined, signature: null, promoted: [], hidden: [], homes: new Map(), shortcuts: new Map() };
  return viewer.formatTools;
}

// After every toolbar update (updateEditorToolbarState) and on a change of
// layout: moves tools only when what is to be on top changed, so nothing
// jumps while the model is looked at.
export function syncFormatTools(viewer) {
  const toolbar = core.editorToolbar;
  const buttons = viewer?.editorToolbarButtons;
  if (!toolbar || !buttons) return;
  const state = formatState(viewer);
  const kind = getModelKind(viewer);
  const profile = resolveFormatProfile(viewer, MODEL_KINDS.includes(kind) ? kind : null);

  // Left out for this model: a class, not `hidden`, which the toolbar's own
  // rules set and clear on every update.
  state.hidden.filter((key) => !profile.hide.includes(key)).forEach((key) => buttons[key]?.classList.remove("is-format-hidden"));
  profile.hide.forEach((key) => buttons[key]?.classList.add("is-format-hidden"));
  state.hidden = profile.hide.filter((key) => buttons[key]);

  // The ones on top now: in their own place first, so a tool that came back
  // is judged where it normally is.
  const limit = limitFor(viewer);
  const promote = profile.promote.filter((key) => isPromotable(buttons[key])).slice(0, limit);
  const menus = isMenus(viewer);
  const signature = `${menus ? "menus" : "classic"}:${promote.join(",")}`;
  state.kind = kind;
  toolbar.dataset.modelKind = kind || "";
  if (signature !== state.signature) {
    state.signature = signature;
    if (menus) showMenuShortcuts(viewer, state, promote);
    else promoteOnBar(viewer, toolbar, state, promote);
    state.promoted = promote;
    if (!menus) {
      syncEditorToolbarSecondaryTrayWidth(viewer);
      updateToolbarGroups();
    }
  }
  if (menus) syncMenuShortcuts(viewer, state);
  else {
    // The tooltip says whose tool it is ("Hierarchy · IFC building model").
    promote.forEach((key) => {
      const button = buttons[key];
      button.setAttribute("title", formatTitle(kind, button.getAttribute("aria-label") || key));
    });
  }
}

function formatTitle(kind, label) {
  return kind ? `${label} · ${t(`modelKind.${kind}`, kind)}` : label;
}

// ---- The classic toolbar: onto the bar, after moving, turning, scaling ----

function barAnchor(viewer, toolbar) {
  let anchor = viewer.formatToolsAnchor;
  if (anchor?.parentNode === toolbar) return anchor;
  // A comment: no room taken, not one of the toolbar's children.
  anchor = document.createComment("format tools");
  const transform = [...toolbar.children].filter((child) => child.dataset?.group === "transform");
  const after = transform[transform.length - 1];
  if (after) after.after(anchor);
  else toolbar.insertBefore(anchor, toolbar.querySelector(":scope > .viewer-editor-toolbar_secondary-tray"));
  viewer.formatToolsAnchor = anchor;
  return anchor;
}

function returnHome(state, key, button) {
  const home = state.homes.get(key);
  if (home?.parentNode) home.replaceWith(button);
  state.homes.delete(key);
  button.classList.remove("is-format-tool");
  const label = button.getAttribute("aria-label");
  if (label) button.setAttribute("title", label);
  if (button.dataset.homeGroup !== undefined) {
    if (button.dataset.homeGroup) button.dataset.group = button.dataset.homeGroup;
    else delete button.dataset.group;
    delete button.dataset.homeGroup;
  }
}

function promoteOnBar(viewer, toolbar, state, promote) {
  const buttons = viewer.editorToolbarButtons;
  state.promoted.filter((key) => !promote.includes(key)).forEach((key) => {
    if (buttons[key]) returnHome(state, key, buttons[key]);
  });
  const anchor = barAnchor(viewer, toolbar);
  promote.forEach((key) => {
    const button = buttons[key];
    if (!state.homes.has(key)) {
      const home = document.createComment(`home of ${key}`);
      button.before(home);
      state.homes.set(key, home);
      button.dataset.homeGroup = button.dataset.group || "";
    }
    // Closed when it moves (the phone tray opens submenus on a tap).
    button.classList.remove("submenu-open");
    button.dataset.group = "format";
    button.classList.add("is-format-tool");
    toolbar.insertBefore(button, anchor);
  });
}

// ---- The menus: shortcuts in the navigation, the tools staying in their menus ----

function menuShortcutsBox(viewer) {
  const menus = viewer.menuToolbar;
  let box = menus.formatBox;
  if (box?.isConnected) return box;
  box = document.createElement("span");
  box.className = "viewer-menus_format";
  box.setAttribute("role", "group");
  box.hidden = true;
  const divider = document.createElement("span");
  divider.className = "viewer-menus_nav-divider viewer-menus_nav-divider--format";
  divider.setAttribute("aria-hidden", "true");
  box.appendChild(divider);
  const before = menus.nav.querySelector(":scope > .viewer-menus_nav-divider--device");
  menus.nav.insertBefore(box, before || null);
  menus.formatBox = box;
  return box;
}

function openToolInMenu(viewer, button) {
  const group = button.closest(".viewer-menus_group");
  const menus = viewer.menuToolbar;
  if (!group || !menus) return;
  const category = menus.categories.find((entry) => entry.id === group.dataset.category);
  viewer.openToolbarMenu?.(category?.more && menus.state.mode !== "desktop" ? "more" : group.dataset.category);
  if (button.classList.contains("has-submenu")) {
    button.classList.add("is-open");
    button.setAttribute("aria-expanded", "true");
  }
  button.scrollIntoView?.({ block: "nearest" });
}

function createMenuShortcut(viewer, key) {
  const shortcut = document.createElement("button");
  shortcut.type = "button";
  shortcut.className = "viewer-editor-tool viewer-menus_format-tool is-format-tool";
  shortcut.dataset.formatTool = key;
  viewer.bindEventListener(shortcut, "click", (event) => {
    event.stopPropagation();
    const button = viewer.editorToolbarButtons?.[key];
    const tool = viewer.editorToolbarTools?.[key];
    if (!button) return;
    viewer.stopHandMode?.();
    if (SUBMENU_ONLY_TOOLS.has(key) || !tool?.onClick) {
      openToolInMenu(viewer, button);
      return;
    }
    // A phone's sheet gets out of the way of what the tool shows.
    if (viewer.menuToolbar?.state.mode !== "desktop" && viewer.isToolbarMenuOpen?.()) viewer.openToolbarMenu?.(null);
    tool.onClick();
  });
  return shortcut;
}

function showMenuShortcuts(viewer, state, promote) {
  const buttons = viewer.editorToolbarButtons;
  const box = menuShortcutsBox(viewer);
  state.promoted.forEach((key) => buttons[key]?.classList.remove("is-format-tool"));
  state.shortcuts.forEach((shortcut, key) => {
    if (!promote.includes(key)) {
      shortcut.remove();
      state.shortcuts.delete(key);
    }
  });
  promote.forEach((key) => {
    let shortcut = state.shortcuts.get(key);
    if (!shortcut) {
      shortcut = createMenuShortcut(viewer, key);
      state.shortcuts.set(key, shortcut);
    }
    box.appendChild(shortcut);
    // Marked in its menu too, as the model's own.
    buttons[key]?.classList.add("is-format-tool");
  });
  box.hidden = promote.length === 0;
  box.setAttribute("aria-label", t("modelKind.forModel", "for this model"));
}

// The shortcuts show what their tools show: icon, name, state.
function syncMenuShortcuts(viewer, state) {
  state.shortcuts.forEach((shortcut, key) => {
    const button = viewer.editorToolbarButtons?.[key];
    if (!button) return;
    const icon = button.querySelector(":scope > .viewer-editor-tool_icon")?.innerHTML || "";
    if (shortcut.dataset.icon !== icon) {
      shortcut.dataset.icon = icon;
      shortcut.innerHTML = `<span class="viewer-editor-tool_icon" aria-hidden="true">${icon}</span>`;
    }
    const label = button.getAttribute("aria-label") || button.getAttribute("title") || key;
    shortcut.setAttribute("aria-label", label);
    shortcut.setAttribute("title", formatTitle(state.kind, label));
    shortcut.classList.toggle("is-active", button.classList.contains("is-active"));
    shortcut.classList.toggle("plan-locked", button.classList.contains("plan-locked"));
    const pressed = button.getAttribute("aria-pressed");
    if (pressed !== null) shortcut.setAttribute("aria-pressed", pressed);
    else shortcut.removeAttribute("aria-pressed");
    shortcut.disabled = button.disabled;
  });
}

import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { makePanelWindow } from "./panel-window.js";
import { attachToolPanelChrome, refreshToolPanelChrome } from "./tool-panel-chrome.js";
import { GROUND_PRESETS } from "../ground.js";

// What the model stands on (ground.js), picked in a window of tiles: Look ->
// Ground. The window stays open after a pick, to compare the grounds; it
// moves by its header and minimizes to a round icon (ui/tool-panel-chrome.js).

const GROUND_LABELS = {
  contact: "Contact shadow",
  mirror: "Mirror",
  grid: "Grid",
  turntable: "Turntable",
  spotlight: "Spotlight",
  dots: "Dot grid",
};

// Drawn at 48 px: the floor in perspective, the model as a block.
const BLOCK = '<path d="M19 13h10v15H19z" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>';
export const GROUND_ICONS = {
  contact: `<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="30" rx="13" ry="3.6" fill="currentColor" fill-opacity="0.45"/><ellipse cx="24" cy="29" rx="7" ry="1.6" fill="currentColor" fill-opacity="0.55"/>${BLOCK}</svg>`,
  mirror: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M4 28h40" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.6"/><path d="M19 28h10v11H19z" fill="currentColor" fill-opacity="0.12"/><path d="M19 39h10" stroke="currentColor" stroke-width="1" stroke-opacity="0.25"/>${BLOCK}</svg>`,
  grid: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M2 42 12 26h24l10 16zM8.7 32h30.6M5.3 37.5h37.4M18 26l-4 16M24 26v16M30 26l4 16" fill="none" stroke="currentColor" stroke-width="1" stroke-opacity="0.55" stroke-linejoin="round"/><path d="M24 26v16" stroke="#3f74d6" stroke-width="1.4"/><path d="M5.3 37.5h37.4" stroke="#d24a4a" stroke-width="1.4"/>${BLOCK}</svg>`,
  turntable: `<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="30" rx="17" ry="5.5" fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="1.4"/><path d="M7 30v2.5c0 3 7.6 5.5 17 5.5s17-2.5 17-5.5V30" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M24 24.5v1.6M38 30h-1.6M10 30h1.6" stroke="currentColor" stroke-width="1.2"/><path d="M12 43h6M24 43h6" stroke="currentColor" stroke-width="2"/><path d="M18 43h6" stroke="currentColor" stroke-opacity="0.35" stroke-width="2"/>${BLOCK}</svg>`,
  spotlight: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="2" y="2" width="44" height="44" rx="6" fill="currentColor" fill-opacity="0.16"/><path d="M20 3h8l-1.5 4h-5z" fill="currentColor"/><path d="M21.5 7 9 30M26.5 7 39 30" fill="none" stroke="#e9c37f" stroke-width="1" stroke-dasharray="2 2"/><ellipse cx="24" cy="30" rx="15" ry="4.5" fill="#e9c37f" fill-opacity="0.5"/>${BLOCK}</svg>`,
  dots: `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="currentColor" fill-opacity="0.6">${[24, 30, 36, 42].map((y, row) => [-3, -2, -1, 0, 1, 2, 3].map((column) => `<circle cx="${24 + column * (5.5 + row * 1.5)}" cy="${y}" r="${0.8 + row * 0.25}"/>`).join("")).join("")}</g>${BLOCK}</svg>`,
};

// The minimized window's icon, as the toolbar's (editor-toolbar.js).
const GROUND_PIP_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><rect x="8" y="5" width="8" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/><ellipse cx="12" cy="18.5" rx="7" ry="1.8" fill="currentColor" fill-opacity="0.45"/></svg>';

export function groundLabel(preset) {
  return t(`gui.ground.${preset}`, GROUND_LABELS[preset]);
}

export function attachGroundPanel(Viewer) {
  Object.assign(Viewer, {
    isGroundPanelOpen() {
      return Boolean(this.groundPanel && !this.groundPanel.hidden);
    },

    closeGroundPanel() {
      if (this.groundPanel) this.groundPanel.hidden = true;
      this.updateEditorToolbarState?.();
    },

    toggleGroundPanel() {
      if (this.isGroundPanelOpen()) {
        this.closeGroundPanel();
        return;
      }
      this.createGroundPanel();
      if (!this.groundPanel) return;
      this.refreshGroundPanel();
      this.groundPanel.hidden = false;
      this.openToolbarMenu?.(null);
      this.updateEditorToolbarState?.();
    },

    createGroundPanel() {
      if (!core.container || this.groundPanel) return;
      const panel = document.createElement("div");
      panel.id = "groundPanel";
      panel.hidden = true;
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-labelledby", "groundPanelTitle");
      panel.innerHTML = `
        <div class="upload-panel-header">
          <span id="groundPanelTitle"></span>
          <button type="button" data-action="close">X</button>
        </div>
        <div class="ground-panel-grid" role="radiogroup"></div>
      `;
      const grid = panel.querySelector(".ground-panel-grid");
      GROUND_PRESETS.forEach((preset) => {
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "ground-panel-tile";
        tile.dataset.ground = preset;
        tile.setAttribute("role", "radio");
        tile.innerHTML = `<span class="ground-panel-icon">${GROUND_ICONS[preset]}</span><span class="ground-panel-label"></span>`;
        this.bindEventListener(tile, "click", () => this.setGroundPreset(preset));
        grid.appendChild(tile);
      });
      core.container.appendChild(panel);
      this.groundPanel = panel;
      this.bindEventListener(panel.querySelector('[data-action="close"]'), "click", () => this.closeGroundPanel());
      const header = panel.querySelector(".upload-panel-header");
      makePanelWindow(this, panel, header, () => this.closeGroundPanel());
      // Dragged by the header already (makePanelWindow): no grip.
      attachToolPanelChrome(panel, header, {
        before: header.querySelector('[data-action="close"]'),
        movable: false,
        icon: GROUND_PIP_ICON,
        label: () => t("gui.groundTitle", "Ground"),
      });
      this.localizeGroundPanel();
    },

    localizeGroundPanel() {
      const panel = this.groundPanel;
      if (!panel) return;
      const title = t("gui.groundTitle", "Ground");
      panel.querySelector("#groundPanelTitle").textContent = title;
      panel.querySelector(".ground-panel-grid").setAttribute("aria-label", title);
      const close = panel.querySelector('[data-action="close"]');
      close.title = t("validationReport.close", "Close");
      close.setAttribute("aria-label", close.title);
      panel.querySelectorAll(".ground-panel-tile").forEach((tile) => {
        const label = groundLabel(tile.dataset.ground);
        tile.querySelector(".ground-panel-label").textContent = label;
        tile.title = label;
      });
      refreshToolPanelChrome(panel);
    },

    // The tile of the ground shown now, marked.
    refreshGroundPanel() {
      const panel = this.groundPanel;
      if (!panel) return;
      const current = this.getGroundPreset?.();
      panel.querySelectorAll(".ground-panel-tile").forEach((tile) => {
        const active = tile.dataset.ground === current;
        tile.classList.toggle("is-active", active);
        tile.setAttribute("aria-checked", active ? "true" : "false");
      });
    },
  });
}

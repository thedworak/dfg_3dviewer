import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { getViewerSideStack } from "../ui/side-stack.js";
import { attachToolPanelChrome, PANEL_ICONS } from "../ui/tool-panel-chrome.js";
import {
  SURROUNDINGS_ERAS,
  SURROUNDINGS_KINDS,
  SURROUNDINGS_REGIONS,
  SURROUNDINGS_SEASONS,
  SURROUNDINGS_SLIDER_SPAN,
  SURROUNDINGS_SLIDER_STEPS,
  SURROUNDINGS_STYLES,
  surroundingsPeriod,
  surroundingsSliderToYear,
  surroundingsYearToSlider,
} from "./surroundings-rules.js";

// The surroundings' window (Look > Generated surroundings): on or off, the
// year on a slider (its period follows), the kind of place, the look, the
// season, the water, the real terrain, following the timeline, another
// layout. Every change is drawn at once through setSurroundingsOptions
// (editor/surroundings.js); the slider waits for the hand to rest.
//
// The slider gives each period the same width (surroundings-rules.js,
// surroundingsYearToSlider): the years where the look changes most - the
// periods' starts - are its milestones, marked on it and a click away.

// While the slider moves: drawn this long after it stops.
const SLIDER_DELAY = 250;

export function attachSurroundingsPanel(Viewer) {
  Object.assign(Viewer, {
    surroundingsPanel: null,

    isSurroundingsPanelOpen() {
      return Boolean(Viewer.surroundingsPanel);
    },

    toggleSurroundingsPanel(open = !Viewer.surroundingsPanel) {
      if (open) Viewer.createSurroundingsPanel();
      else Viewer.removeSurroundingsPanel();
      Viewer.updateEditorToolbarState?.();
    },

    createSurroundingsPanel() {
      if (Viewer.surroundingsPanel || !core.container || Viewer.urlOptions?.hideUi === true) return;
      const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
      };
      const field = (name, control) => {
        const label = el("label", "viewer-surroundings-panel_field");
        label.dataset.field = name;
        const text = el("span", "viewer-surroundings-panel_label");
        label.append(text, control);
        return { label, text };
      };
      const select = (name, values) => {
        const node = el("select");
        node.name = name;
        values.forEach((value) => {
          const option = el("option");
          option.value = value;
          node.append(option);
        });
        node.addEventListener("change", () => Viewer.setSurroundingsOptions({ [name]: node.value }));
        return node;
      };
      const checkbox = (name, onChange) => {
        const node = el("input");
        node.type = "checkbox";
        node.name = name;
        node.addEventListener("change", () => onChange(node.checked));
        return node;
      };

      const panel = el("section", "viewer-scene viewer-surroundings-panel");
      panel.id = "viewerSurroundingsPanel";
      panel.setAttribute("role", "group");
      const header = el("div", "viewer-scene_header");
      const title = el("span", "viewer-scene_title");
      const closeButton = el("button", "viewer-scene_icon", "×");
      closeButton.type = "button";
      header.append(title, closeButton);

      const enabled = checkbox("enabled", (on) => (on ? Viewer.setSurroundingsOptions({}) : Viewer.setSurroundings(false)));
      const enabledField = field("enabled", enabled);
      enabledField.label.classList.add("viewer-surroundings-panel_toggle");

      // The year: 900-1990, its period beside it; each period a stretch of
      // the same length.
      const year = el("input");
      year.type = "range";
      year.name = "year";
      year.min = "0";
      year.max = String(SURROUNDINGS_SLIDER_SPAN);
      year.step = "1";
      // The milestones: a mark on the track where each period begins, the
      // year under it, a click away.
      const track = el("div", "viewer-surroundings-panel_track");
      const milestones = el("div", "viewer-surroundings-panel_milestones");
      const milestoneButtons = SURROUNDINGS_ERAS.slice(1).map((era, index) => {
        const share = ((index + 1) * SURROUNDINGS_SLIDER_STEPS) / SURROUNDINGS_SLIDER_SPAN;
        const tick = el("span", "viewer-surroundings-panel_tick");
        tick.style.setProperty("--at", String(share));
        track.append(tick);
        const button = el("button", "viewer-surroundings-panel_milestone", String(era.start));
        button.type = "button";
        button.dataset.year = String(era.start);
        button.dataset.period = era.period;
        button.style.setProperty("--at", String(share));
        button.addEventListener("click", () => {
          clearTimeout(timer);
          timer = 0;
          year.value = String(surroundingsYearToSlider(era.start));
          showYear(era.start);
          Viewer.setSurroundingsOptions({ year: era.start, period: era.period });
        });
        milestones.append(button);
        return button;
      });
      track.prepend(year);
      const yearValue = el("output", "viewer-surroundings-panel_year");
      const periodValue = el("span", "viewer-surroundings-panel_period");
      const yearHead = el("div", "viewer-surroundings-panel_year-head");
      const yearLabel = el("span", "viewer-surroundings-panel_label");
      yearHead.append(yearLabel, yearValue, periodValue);
      const yearBox = el("div", "viewer-surroundings-panel_field");
      yearBox.dataset.field = "year";
      yearBox.append(yearHead, track, milestones);
      let timer = 0;
      const showYear = (value) => {
        yearValue.textContent = String(value);
        const period = surroundingsPeriod(value);
        periodValue.textContent = period ? t(`surroundings.period.${period}`, period) : "";
      };
      const drawYear = () => {
        clearTimeout(timer);
        timer = 0;
        const value = surroundingsSliderToYear(year.value);
        if (value === Viewer.surroundings.year && Viewer.surroundings.enabled) return;
        Viewer.setSurroundingsOptions({ year: value, period: surroundingsPeriod(value) });
      };
      year.addEventListener("input", () => {
        showYear(surroundingsSliderToYear(year.value));
        clearTimeout(timer);
        timer = setTimeout(drawYear, SLIDER_DELAY);
      });
      year.addEventListener("change", drawYear);

      const follow = checkbox("followTimeline", (on) => Viewer.setSurroundingsOptions({ followTimeline: on }));
      const followField = field("followTimeline", follow);
      followField.label.classList.add("viewer-surroundings-panel_toggle");

      const kind = select("kind", SURROUNDINGS_KINDS);
      const region = select("region", SURROUNDINGS_REGIONS);
      const style = select("style", SURROUNDINGS_STYLES);
      const season = select("season", SURROUNDINGS_SEASONS);
      const kindField = field("kind", kind);
      const regionField = field("region", region);
      const styleField = field("style", style);
      const seasonField = field("season", season);
      const grid = el("div", "viewer-surroundings-panel_grid");
      grid.append(kindField.label, regionField.label, styleField.label, seasonField.label);

      const water = checkbox("water", (on) => Viewer.setSurroundingsOptions({ water: on }));
      const terrain = checkbox("terrain", (on) => Viewer.setSurroundingsOptions({ terrain: on ? "real" : "generated" }));
      const waterField = field("water", water);
      const terrainField = field("terrain", terrain);
      [waterField, terrainField].forEach((item) => item.label.classList.add("viewer-surroundings-panel_toggle"));

      const actions = el("div", "viewer-scene_actions");
      const reshuffle = el("button", "viewer-surroundings-panel_reshuffle");
      reshuffle.type = "button";
      reshuffle.addEventListener("click", () => Viewer.reshuffleSurroundings());
      actions.append(reshuffle);
      const status = el("p", "viewer-scene_status");
      status.setAttribute("role", "status");
      const note = el("p", "viewer-scene_intro viewer-surroundings-panel_note");

      panel.append(header, enabledField.label, yearBox, followField.label, grid, waterField.label, terrainField.label, actions, status, note);
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        panel.addEventListener(type, (event) => event.stopPropagation());
      });
      closeButton.addEventListener("click", () => Viewer.toggleSurroundingsPanel(false));
      attachToolPanelChrome(panel, header, {
        before: closeButton,
        icon: PANEL_ICONS.surroundings,
        label: () => t("surroundings.title", "Generated surroundings"),
      });
      getViewerSideStack()?.append(panel);
      Viewer.surroundingsPanel = {
        panel, title, closeButton, enabled, enabledField, year, yearLabel, showYear, follow, followField, milestoneButtons,
        kind, kindField, region, regionField, style, styleField, season, seasonField, water, waterField, terrain, terrainField,
        reshuffle, status, note, stopTimer: () => clearTimeout(timer),
      };
      Viewer.updateSurroundingsPanelLabels();
    },

    removeSurroundingsPanel() {
      Viewer.surroundingsPanel?.stopTimer();
      Viewer.surroundingsPanel?.panel.remove();
      Viewer.surroundingsPanel = null;
    },

    updateSurroundingsPanelLabels() {
      const ui = Viewer.surroundingsPanel;
      if (!ui) return;
      ui.title.textContent = t("surroundings.title", "Generated surroundings");
      ui.closeButton.title = t("surroundings.panel.close", "Close");
      ui.closeButton.setAttribute("aria-label", ui.closeButton.title);
      ui.enabledField.text.textContent = t("surroundings.panel.show", "Show round the model");
      ui.yearLabel.textContent = t("surroundings.panel.year", "Year");
      ui.followField.text.textContent = t("surroundings.panel.followTimeline", "Follow the timeline's year");
      ui.kindField.text.textContent = t("surroundings.panel.kind", "Place");
      ui.regionField.text.textContent = t("surroundings.panel.region", "Region");
      [...ui.region.options].forEach((option) => { option.textContent = t(`surroundings.region.${option.value}`, option.value); });
      ui.milestoneButtons.forEach((button) => {
        const period = button.dataset.period;
        button.title = t("surroundings.panel.milestone", { year: button.dataset.year, period: t(`surroundings.period.${period}`, period), what: t(`surroundings.panel.changes.${period}`, "") }, "{year}: {period} - {what}");
        button.setAttribute("aria-label", button.title);
      });
      ui.styleField.text.textContent = t("surroundings.panel.style", "Look");
      ui.seasonField.text.textContent = t("surroundings.panel.season", "Season");
      ui.waterField.text.textContent = t("surroundings.panel.water", "Water (a moat, a river)");
      ui.terrainField.text.textContent = t("surroundings.panel.terrain", "The place's real terrain");
      [...ui.kind.options].forEach((option) => { option.textContent = t(`surroundings.kind.${option.value}`, option.value); });
      [...ui.style.options].forEach((option) => { option.textContent = t(`surroundings.panel.styles.${option.value}`, option.value); });
      [...ui.season.options].forEach((option) => { option.textContent = t(`scene.season.${option.value}`, option.value); });
      ui.reshuffle.textContent = `↻ ${t("surroundings.reshuffle", "Another layout")}`;
      ui.note.textContent = t("surroundings.panel.note", "A typical setting of the kind and time, worked out from rules - not this place's own. Years 900-1990, Central Europe and the Mediterranean.");
      Viewer.syncSurroundingsPanel();
    },

    // The controls as the surroundings are now.
    syncSurroundingsPanel() {
      const ui = Viewer.surroundingsPanel;
      if (!ui) return;
      const state = Viewer.surroundings;
      ui.enabled.checked = state.enabled === true;
      const following = state.followTimeline === true && Viewer.hasTimeline?.() === true;
      // Not while the hand is on it.
      if (document.activeElement !== ui.year) {
        ui.year.value = String(surroundingsYearToSlider(state.year));
        ui.showYear(state.year);
      }
      ui.milestoneButtons.forEach((button) => {
        button.disabled = following;
        button.classList.toggle("is-passed", Number(button.dataset.year) <= state.year);
        button.setAttribute("aria-pressed", surroundingsPeriod(state.year) === button.dataset.period ? "true" : "false");
      });
      ui.year.disabled = following;
      ui.follow.checked = state.followTimeline === true;
      ui.followField.label.hidden = !Viewer.hasTimeline?.() && state.followTimeline !== true;
      ui.kind.value = state.kind;
      ui.region.value = state.region;
      ui.style.value = state.style;
      ui.season.value = state.season;
      ui.water.checked = state.water !== false;
      ui.terrain.checked = state.terrain === "real";
      const place = (Number.isFinite(state.latitude) && Number.isFinite(state.longitude))
        || (Viewer.sunStudy?.locationSet && Number.isFinite(Viewer.sunStudy?.latitude));
      ui.terrain.disabled = !place && state.terrain !== "real";
      ui.terrainField.label.title = ui.terrain.disabled ? t("surroundings.panel.noPlace", "Set the place first (Sun study) for the real terrain") : "";
      ui.reshuffle.disabled = !state.enabled;
      ui.status.textContent = state.enabled && Viewer.surroundingsObjects
        ? Viewer.describeSurroundings()
        : state.enabled || core.scene == null || Viewer.getSurroundingsSite?.() ? "" : t("surroundings.panel.noModel", "Open a model first.");
    },
  });
}

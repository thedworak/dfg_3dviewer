import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { fitPanelToViewer, getViewerSideStack } from "../ui/side-stack.js";
import { attachToolPanelChrome, PANEL_ICONS, refreshToolPanelChrome } from "../ui/tool-panel-chrome.js";
import { ADDABLE_LIGHT_TYPES } from "./scene-lights.js";

// The lights window (the Lights tool): the scene's lights listed -
// the key light and the ones added here or brought by a manifest - one of
// them chosen and edited (scene-lights.js: where it is, where it aims, its
// colour and strength), lights added and removed, and the ambient light.
// Like the other tool panels it can be moved and minimized to an icon.
// While it is open the chosen light shows its helper and every light its
// icon (light-markers.js); closing it puts them and the handles away.

// The chosen light's own fields (Viewer.activeLightSettings); `spot`: only
// for a spot light.
const LIGHT_FIELDS = [
  { key: "enabled", type: "toggle", label: ["gui.lightEnabled", "On"] },
  { key: "color", type: "color", label: ["gui.color", "Color"] },
  { key: "intensity", type: "range", min: 0, max: 10, step: 0.01, label: ["gui.intensity", "Intensity"], format: (value) => value.toFixed(2) },
  { key: "castShadow", type: "toggle", label: ["gui.lightCastShadow", "Shadows"] },
  { key: "angle", type: "range", min: 1, max: 90, step: 1, spot: true, label: ["gui.lightConeAngle", "Cone angle"], format: (value) => `${Math.round(value)}°` },
  { key: "penumbra", type: "range", min: 0, max: 1, step: 0.01, spot: true, label: ["gui.lightPenumbra", "Soft edge"], format: (value) => value.toFixed(2) },
];

// Round its target (Viewer.lightAngles).
const ANGLE_FIELDS = [
  { key: "direction", min: 0, max: 359, label: ["gui.lightDirection", "Direction"] },
  { key: "height", min: -89, max: 89, label: ["gui.lightHeight", "Height"] },
];

const TYPE_ADD_LABELS = {
  DirectionalLight: ["gui.lightTypeDirectional", "Directional light"],
  PointLight: ["gui.lightTypePoint", "Point light"],
  SpotLight: ["gui.lightTypeSpot", "Spot light"],
};

const label = ([key, fallback]) => t(key, fallback);
const round = (value) => Math.round(value * 1000) / 1000;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(className, onClick) {
  const node = el("button", className);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

// A row: name, input, value shown beside it.
function fieldRow(type, { min, max, step } = {}) {
  const row = el("label", "viewer-lights_field");
  const name = el("span", "viewer-lights_field-name");
  const input = el("input");
  if (type === "range") {
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step ?? 1);
  } else if (type === "toggle") {
    input.type = "checkbox";
  } else {
    input.type = "color";
  }
  const value = el("span", "viewer-lights_field-value");
  row.append(name, input, value);
  return { row, name, input, value };
}

// x, y, z number fields of a vector of the chosen light.
function vectorRow(onChange) {
  const row = el("div", "viewer-lights_vector");
  const name = el("span", "viewer-lights_field-name");
  row.append(name);
  const inputs = ["x", "y", "z"].map((axis) => {
    const input = el("input", "viewer-lights_number");
    input.type = "number";
    input.step = "any";
    input.dataset.axis = axis;
    input.setAttribute("aria-label", axis.toUpperCase());
    input.addEventListener("change", () => {
      const values = inputs.map((item) => Number(item.value));
      if (values.every(Number.isFinite)) onChange(values);
    });
    row.append(input);
    return input;
  });
  return { row, name, inputs };
}

function setIfIdle(input, value) {
  if (document.activeElement === input) return;
  if (input.type === "checkbox") input.checked = Boolean(value);
  else if (input.value !== String(value)) input.value = String(value);
}

export function attachLightsPanel(Viewer) {
  Object.assign(Viewer, {
    lightsPanel: null,

    isLightsPanelOpen() {
      return Boolean(Viewer.lightsPanel);
    },

    toggleLightsPanel(open = !Viewer.lightsPanel) {
      if (open) Viewer.createLightsPanel();
      else Viewer.removeLightsPanel();
      Viewer.updateLightsSubmenuState?.();
      Viewer.updateEditorToolbarState?.();
    },

    createLightsPanel() {
      if (Viewer.lightsPanel || !core.container || Viewer.urlOptions?.hideUi === true) return;
      const panel = el("section", "viewer-lights viewer-scene");
      panel.id = "viewerLights";
      panel.setAttribute("role", "group");
      const header = el("div", "viewer-scene_header");
      const title = el("span", "viewer-scene_title");
      const closeButton = button("viewer-scene_icon", () => Viewer.toggleLightsPanel(false));
      closeButton.textContent = "×";
      header.append(title, closeButton);

      const list = el("ul", "viewer-lights_list");
      list.setAttribute("role", "listbox");

      const addBar = el("div", "viewer-lights_add");
      const addTitle = el("span", "viewer-lights_add-title");
      addBar.append(addTitle);
      const addButtons = {};
      ADDABLE_LIGHT_TYPES.forEach((type) => {
        const addButton = button("viewer-lights_add-button", () => Viewer.addLight(type));
        addButton.dataset.type = type;
        addBar.append(addButton);
        addButtons[type] = addButton;
      });

      // The chosen light.
      const current = el("div", "viewer-lights_current");
      const nameInput = el("input", "viewer-lights_name");
      nameInput.type = "text";
      nameInput.addEventListener("input", () => {
        Viewer.activeLightSettings.name = nameInput.value;
      });
      const removeButton = button("viewer-lights_remove", () => Viewer.removeActiveLight());
      current.append(nameInput, removeButton);

      const placementTitle = el("div", "viewer-lights_heading");
      const handles = el("div", "viewer-lights_handles");
      const handlesName = el("span", "viewer-lights_field-name");
      const moveButton = button("viewer-lights_handle", () => Viewer.toggleLightTransformMode("translate"));
      const targetButton = button("viewer-lights_handle", () => Viewer.toggleLightTransformMode("rotate"));
      handles.append(handlesName, moveButton, targetButton);
      const angleInputs = {};
      const angleRows = ANGLE_FIELDS.map((field) => {
        const row = fieldRow("range", field);
        row.input.addEventListener("input", () => Viewer.setLightAngles({ [field.key]: Number(row.input.value) }));
        angleInputs[field.key] = { ...row, field };
        return row.row;
      });
      const position = vectorRow((values) => {
        Viewer.getActiveLight()?.position.fromArray(values);
        Viewer.syncActiveLight();
      });
      const target = vectorRow((values) => {
        Viewer.getActiveLight()?.target?.position.fromArray(values);
        Viewer.syncActiveLight();
      });
      const fitButton = button("viewer-lights_fit", () => Viewer.resetActiveLight());

      const settingsTitle = el("div", "viewer-lights_heading");
      const fields = el("div", "viewer-lights_fields");
      const fieldInputs = {};
      LIGHT_FIELDS.forEach((field) => {
        const row = fieldRow(field.type, field);
        const read = () => (field.type === "toggle" ? row.input.checked : field.type === "range" ? Number(row.input.value) : row.input.value);
        row.input.addEventListener("input", () => {
          Viewer.activeLightSettings[field.key] = read();
          Viewer.syncLightsPanelFields();
          Viewer.syncLightsList();
        });
        fields.append(row.row);
        fieldInputs[field.key] = { ...row, field };
      });

      // The ambient light: the viewer's own, everywhere at once.
      const ambientTitle = el("div", "viewer-lights_heading");
      const ambientColor = fieldRow("color");
      ambientColor.input.addEventListener("input", () => {
        Viewer.colors.AmbientLight = ambientColor.input.value;
        Viewer.ambientLight?.color.set(ambientColor.input.value);
      });
      const ambientIntensity = fieldRow("range", { min: 0, max: 10, step: 0.01 });
      ambientIntensity.input.addEventListener("input", () => {
        const value = Number(ambientIntensity.input.value);
        Viewer.intensity.startIntensityAmbient = value;
        if (Viewer.ambientLight) Viewer.ambientLight.intensity = value;
        ambientIntensity.value.textContent = value.toFixed(2);
      });

      const note = el("p", "viewer-scene_status");

      panel.append(
        header, list, addBar, current,
        placementTitle, handles, ...angleRows, position.row, target.row, fitButton,
        settingsTitle, fields,
        ambientTitle, ambientColor.row, ambientIntensity.row,
        note,
      );
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        panel.addEventListener(type, (event) => event.stopPropagation());
      });
      attachToolPanelChrome(panel, header, {
        before: closeButton,
        icon: PANEL_ICONS.light,
        label: () => t("gui.sceneLights", "Scene lights"),
      });
      getViewerSideStack()?.append(panel);
      fitPanelToViewer(panel);
      Viewer.lightsPanel = {
        panel, title, closeButton, list, addTitle, addButtons, nameInput, removeButton,
        placementTitle, handlesName, moveButton, targetButton, angleInputs, position, target, fitButton,
        settingsTitle, fieldInputs, ambientTitle, ambientColor, ambientIntensity, note,
      };
      Viewer.updateLightsPanelLabels();
      // The chosen light's helper while the window is open.
      Viewer.attachLightTransform?.(Viewer.transformText["Transform Light"]);
    },

    removeLightsPanel() {
      const ui = Viewer.lightsPanel;
      if (!ui) return;
      ui.panel.remove();
      Viewer.lightsPanel = null;
      // The handles and the helper go with the window.
      Viewer.setLightTransformMode?.("");
    },

    updateLightsPanelLabels() {
      const ui = Viewer.lightsPanel;
      if (!ui) return;
      const name = t("gui.sceneLights", "Scene lights");
      ui.panel.setAttribute("aria-label", name);
      ui.title.textContent = name;
      refreshToolPanelChrome(ui.panel);
      ui.closeButton.title = t("scene.close", "Close");
      ui.closeButton.setAttribute("aria-label", ui.closeButton.title);
      ui.list.setAttribute("aria-label", name);
      ui.addTitle.textContent = t("gui.addLight", "Add light");
      Object.entries(ui.addButtons).forEach(([type, addButton]) => {
        addButton.textContent = `+ ${label(TYPE_ADD_LABELS[type])}`;
      });
      ui.nameInput.setAttribute("aria-label", t("gui.lightName", "Name"));
      ui.removeButton.textContent = t("gui.removeLight", "Remove light");
      ui.placementTitle.textContent = t("gui.lightPlacement", "Placement");
      ui.handlesName.textContent = t("gui.lightHandles", "Handles");
      ui.moveButton.textContent = t("gui.move", "Move");
      ui.targetButton.textContent = t("gui.target", "Target");
      Object.values(ui.angleInputs).forEach(({ name: fieldName, field }) => {
        fieldName.textContent = label(field.label);
      });
      ui.position.name.textContent = t("gui.position", "Position");
      ui.target.name.textContent = t("gui.target", "Target");
      ui.fitButton.textContent = t("gui.lightReset", "Fit to the model");
      ui.settingsTitle.textContent = t("gui.light", "Light");
      Object.values(ui.fieldInputs).forEach(({ name: fieldName, field }) => {
        fieldName.textContent = label(field.label);
      });
      ui.ambientTitle.textContent = t("gui.ambientLight", "Ambient Light");
      ui.ambientColor.name.textContent = t("gui.color", "Color");
      ui.ambientIntensity.name.textContent = t("gui.intensity", "Intensity");
      ui.note.textContent = t("gui.lightsNote", "The added lights are saved in the exported manifest.");
      Viewer.syncLightsPanel();
    },

    // Everything: the list and the chosen light's fields.
    syncLightsPanel() {
      if (!Viewer.lightsPanel) return;
      Viewer.syncLightsList();
      Viewer.syncLightsPanelFields();
    },

    syncLightsList() {
      const ui = Viewer.lightsPanel;
      if (!ui) return;
      const active = Viewer.getActiveLight();
      ui.list.replaceChildren(...Viewer.getEditableLights().map((light) => {
        const item = el("li", "viewer-lights_item");
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", String(light === active));
        item.classList.toggle("is-selected", light === active);
        item.classList.toggle("is-off", light.visible === false);
        item.tabIndex = 0;
        const swatch = el("span", "viewer-lights_swatch");
        swatch.style.background = `#${light.color.getHexString()}`;
        const text = el("span", "viewer-lights_item-name", Viewer.getLightLabel(light));
        const kind = el("span", "viewer-lights_item-meta", label(TYPE_ADD_LABELS[light.type] || [light.type, light.type]));
        item.append(swatch, text, kind);
        const choose = () => Viewer.setActiveLight(light);
        item.addEventListener("click", choose);
        item.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            choose();
          }
        });
        return item;
      }));
    },

    // The chosen light's fields; while dragged by its handles, every change.
    syncLightsPanelFields() {
      const ui = Viewer.lightsPanel;
      const light = Viewer.getActiveLight();
      if (!ui || !light) return;
      const settings = Viewer.activeLightSettings;
      setIfIdle(ui.nameInput, settings.name);
      ui.nameInput.placeholder = Viewer.getLightLabel(light, { named: false });
      ui.removeButton.disabled = light === core.dirLight;
      ui.removeButton.title = light === core.dirLight
        ? t("gui.keyLightStays", "The key light stays: switch it off instead")
        : "";
      const mode = Viewer.transformText["Transform Light"];
      ui.moveButton.classList.toggle("is-active", mode === "translate");
      ui.targetButton.classList.toggle("is-active", mode === "rotate");
      ui.targetButton.disabled = !light.target;
      Object.values(ui.angleInputs).forEach(({ input, value, field }) => {
        const angle = Viewer.lightAngles[field.key];
        setIfIdle(input, angle);
        value.textContent = `${angle}°`;
      });
      ui.position.inputs.forEach((input) => setIfIdle(input, round(light.position[input.dataset.axis])));
      ui.target.row.hidden = !light.target;
      if (light.target) ui.target.inputs.forEach((input) => setIfIdle(input, round(light.target.position[input.dataset.axis])));
      Object.values(ui.fieldInputs).forEach(({ row, input, value, field }) => {
        row.hidden = field.spot === true && !light.isSpotLight;
        if (row.hidden) return;
        const current = settings[field.key];
        setIfIdle(input, current);
        value.textContent = field.format ? field.format(Number(current)) : "";
      });
      const ambient = Viewer.ambientLight;
      if (ambient) {
        setIfIdle(ui.ambientColor.input, `#${ambient.color.getHexString()}`);
        setIfIdle(ui.ambientIntensity.input, ambient.intensity);
        ui.ambientIntensity.value.textContent = ambient.intensity.toFixed(2);
      }
    },
  });
}


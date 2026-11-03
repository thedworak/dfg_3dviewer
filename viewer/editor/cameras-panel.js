import { t } from "../i18n-utils.js";
import { core } from "../core.js";
import { fitPanelToViewer, getViewerSideStack } from "../ui/side-stack.js";
import { attachToolPanelChrome, PANEL_ICONS, refreshToolPanelChrome } from "../ui/tool-panel-chrome.js";
import { cameraTypeLabel, SCENE_CAMERA_TYPES } from "./scene-cameras.js";

// The cameras window (the Cameras tool), like the lights window
// (lights-panel.js): the scene's cameras listed (scene-cameras.js) - the
// ones a manifest brought and the ones added here from the current view.
// A click on one in the list looks through it (the view flies there); the
// arrows step to the previous and next one. The chosen one is edited: its
// name, its lens, where it stands and where it looks, set again from the
// current view, made the start view, or removed. While the window is open
// every camera shows its icon in the scene (camera-markers.js). Like the
// other tool panels it can be moved and minimized to an icon. As a light's,
// the chosen camera's handles move where it stands ("Move") or where it
// looks ("Target"); closing the window puts them away.

// A camera, as the list's icon (Blender's: a frame with a triangle on top).
const CAMERA_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M2 6.5h9v7H2z"/><path d="m11 8.5 3-2v7l-3-2"/><path d="M4.5 4.5h4L6.5 2z" fill="currentColor"/></svg>';

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

// x, y, z number fields of a vector of the chosen camera.
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
  if (input.value !== String(value)) input.value = String(value);
}

export function attachCamerasPanel(Viewer) {
  Object.assign(Viewer, {
    camerasPanel: null,

    isCamerasPanelOpen() {
      return Boolean(Viewer.camerasPanel);
    },

    toggleCamerasPanel(open = !Viewer.camerasPanel) {
      if (open) Viewer.createCamerasPanel();
      else Viewer.removeCamerasPanel();
      Viewer.updateEditorToolbarState?.();
    },

    createCamerasPanel() {
      if (Viewer.camerasPanel || !core.container || Viewer.urlOptions?.hideUi === true) return;
      const panel = el("section", "viewer-lights viewer-cameras viewer-scene");
      panel.id = "viewerCameras";
      panel.setAttribute("role", "group");
      const header = el("div", "viewer-scene_header");
      const title = el("span", "viewer-scene_title");
      const closeButton = button("viewer-scene_icon", () => Viewer.toggleCamerasPanel(false));
      closeButton.textContent = "×";
      header.append(title, closeButton);

      const list = el("ul", "viewer-lights_list");
      list.setAttribute("role", "listbox");
      const empty = el("p", "viewer-scene_status");

      // Switching: the previous and next camera.
      const switchRow = el("div", "viewer-lights_handles");
      const switchName = el("span", "viewer-lights_field-name");
      const previousButton = button("viewer-lights_handle", () => Viewer.stepSceneCamera(-1));
      const nextButton = button("viewer-lights_handle", () => Viewer.stepSceneCamera(1));
      switchRow.append(switchName, previousButton, nextButton);

      const addBar = el("div", "viewer-lights_add");
      const addButton = button("viewer-lights_add-button", () => Viewer.addSceneCameraFromView());
      addBar.append(addButton);

      // The chosen camera.
      const current = el("div", "viewer-lights_current");
      const nameInput = el("input", "viewer-lights_name");
      nameInput.type = "text";
      nameInput.addEventListener("input", () => Viewer.setSceneCameraProperty("label", nameInput.value));
      const removeButton = button("viewer-lights_remove", () => Viewer.removeActiveSceneCamera());
      current.append(nameInput, removeButton);

      const actions = el("div", "viewer-lights_add");
      const viewButton = button("viewer-lights_add-button", () => Viewer.viewSceneCamera());
      const updateButton = button("viewer-lights_add-button", () => Viewer.updateSceneCameraFromView());
      const startButton = button("viewer-lights_add-button", () => Viewer.makeStartSceneCamera());
      actions.append(viewButton, updateButton, startButton);

      const lensTitle = el("div", "viewer-lights_heading");
      const typeRow = el("div", "viewer-lights_handles");
      const typeName = el("span", "viewer-lights_field-name");
      typeRow.append(typeName);
      const typeButtons = {};
      SCENE_CAMERA_TYPES.forEach((type) => {
        const typeButton = button("viewer-lights_handle", () => Viewer.setSceneCameraProperty("type", type));
        typeButton.dataset.type = type;
        typeRow.append(typeButton);
        typeButtons[type] = typeButton;
      });
      const fovRow = el("label", "viewer-lights_field");
      const fovName = el("span", "viewer-lights_field-name");
      const fovInput = el("input");
      fovInput.type = "range";
      fovInput.min = "5";
      fovInput.max = "120";
      fovInput.step = "1";
      const fovValue = el("span", "viewer-lights_field-value");
      fovRow.append(fovName, fovInput, fovValue);
      fovInput.addEventListener("input", () => Viewer.setSceneCameraProperty("fov", Number(fovInput.value)));

      const placementTitle = el("div", "viewer-lights_heading");
      const handlesRow = el("div", "viewer-lights_handles");
      const handlesName = el("span", "viewer-lights_field-name");
      const moveButton = button("viewer-lights_handle", () => Viewer.toggleSceneCameraHandles("position"));
      const targetButton = button("viewer-lights_handle", () => Viewer.toggleSceneCameraHandles("target"));
      handlesRow.append(handlesName, moveButton, targetButton);
      const position = vectorRow((values) => Viewer.setSceneCameraProperty("position", values));
      const target = vectorRow((values) => Viewer.setSceneCameraProperty("target", values));

      const note = el("p", "viewer-scene_status");

      const editor = el("div", "viewer-cameras_editor");
      editor.append(current, actions, lensTitle, typeRow, fovRow, placementTitle, handlesRow, position.row, target.row);
      panel.append(header, list, empty, switchRow, addBar, editor, note);
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        panel.addEventListener(type, (event) => event.stopPropagation());
      });
      attachToolPanelChrome(panel, header, {
        before: closeButton,
        icon: PANEL_ICONS.camera,
        label: () => t("gui.sceneCameras", "Scene cameras"),
      });
      getViewerSideStack()?.append(panel);
      fitPanelToViewer(panel);
      Viewer.camerasPanel = {
        panel, title, closeButton, list, empty, switchRow, switchName, previousButton, nextButton,
        addButton, editor, nameInput, removeButton, viewButton, updateButton, startButton,
        lensTitle, typeName, typeButtons, fovRow, fovName, fovInput, fovValue,
        placementTitle, handlesName, moveButton, targetButton, position, target, note,
      };
      Viewer.updateCamerasPanelLabels();
    },

    removeCamerasPanel() {
      const ui = Viewer.camerasPanel;
      if (!ui) return;
      ui.panel.remove();
      Viewer.camerasPanel = null;
      // The handles go with the window.
      Viewer.setSceneCameraHandles?.("");
    },

    updateCamerasPanelLabels() {
      const ui = Viewer.camerasPanel;
      if (!ui) return;
      const name = t("gui.sceneCameras", "Scene cameras");
      ui.panel.setAttribute("aria-label", name);
      ui.title.textContent = name;
      refreshToolPanelChrome(ui.panel);
      ui.closeButton.title = t("scene.close", "Close");
      ui.closeButton.setAttribute("aria-label", ui.closeButton.title);
      ui.list.setAttribute("aria-label", name);
      ui.empty.textContent = t("gui.camerasEmpty", "No cameras yet: add one from the current view.");
      ui.switchName.textContent = t("gui.cameraSwitch", "Switch");
      ui.previousButton.textContent = `‹ ${t("gui.cameraPrevious", "Previous")}`;
      ui.nextButton.textContent = `${t("gui.cameraNext", "Next")} ›`;
      ui.addButton.textContent = `+ ${t("gui.addCameraFromView", "Camera from the current view")}`;
      ui.nameInput.setAttribute("aria-label", t("gui.lightName", "Name"));
      ui.removeButton.textContent = t("gui.removeCamera", "Remove camera");
      ui.viewButton.textContent = t("gui.cameraLookThrough", "Look through");
      ui.updateButton.textContent = t("gui.cameraFromView", "Set to the current view");
      ui.startButton.textContent = t("gui.cameraMakeStart", "Make it the start view");
      ui.lensTitle.textContent = t("gui.cameraLens", "Lens");
      ui.typeName.textContent = t("gui.cameraProjection", "Projection");
      Object.entries(ui.typeButtons).forEach(([type, typeButton]) => {
        typeButton.textContent = cameraTypeLabel(type);
      });
      ui.fovName.textContent = t("gui.cameraFov", "Field of view");
      ui.placementTitle.textContent = t("gui.lightPlacement", "Placement");
      ui.handlesName.textContent = t("gui.lightHandles", "Handles");
      ui.moveButton.textContent = t("gui.move", "Move");
      ui.targetButton.textContent = t("gui.target", "Target");
      ui.position.name.textContent = t("gui.position", "Position");
      ui.target.name.textContent = t("gui.target", "Target");
      ui.note.textContent = t("gui.camerasNote", "The cameras are saved in the exported manifest; the first one is the start view.");
      Viewer.syncCamerasPanel();
    },

    // Everything: the list and the chosen camera's fields.
    syncCamerasPanel() {
      const ui = Viewer.camerasPanel;
      if (!ui) return;
      const cameras = Viewer.getSceneCameras();
      const active = Viewer.getActiveSceneCamera();
      ui.list.replaceChildren(...cameras.map((camera, index) => {
        const item = el("li", "viewer-lights_item viewer-cameras_item");
        const selected = camera === active;
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", String(selected));
        item.classList.toggle("is-selected", selected);
        item.classList.toggle("is-viewing", Viewer.isViewingSceneCamera(camera));
        item.tabIndex = 0;
        const icon = el("span", "viewer-cameras_icon");
        icon.innerHTML = CAMERA_ICON;
        const text = el("span", "viewer-lights_item-name", Viewer.getSceneCameraLabel(camera));
        const meta = [cameraTypeLabel(camera.type)];
        if (index === 0) meta.unshift(t("gui.cameraStart", "Start"));
        const kind = el("span", "viewer-lights_item-meta", meta.join(" · "));
        item.append(icon, text, kind);
        const look = () => Viewer.viewSceneCamera(camera);
        item.addEventListener("click", look);
        item.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            look();
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            Viewer.stepSceneCamera(event.key === "ArrowDown" ? 1 : -1);
            ui.list.querySelector(".is-selected")?.focus();
          }
        });
        return item;
      }));
      // The chosen one in sight in the list (not the page scrolled).
      const chosen = ui.list.querySelector(".is-selected");
      if (chosen && cameras.length) {
        const top = chosen.offsetTop - ui.list.offsetTop;
        if (top < ui.list.scrollTop) ui.list.scrollTop = top;
        else if (top + chosen.offsetHeight > ui.list.scrollTop + ui.list.clientHeight) {
          ui.list.scrollTop = top + chosen.offsetHeight - ui.list.clientHeight;
        }
      }
      ui.empty.hidden = cameras.length > 0;
      ui.list.hidden = cameras.length === 0;
      ui.switchRow.hidden = cameras.length < 2;
      ui.editor.hidden = !active;
      if (!active) return;
      setIfIdle(ui.nameInput, active.label || "");
      ui.nameInput.placeholder = Viewer.getSceneCameraLabel(active, { named: false });
      ui.startButton.disabled = cameras.indexOf(active) === 0;
      Object.entries(ui.typeButtons).forEach(([type, typeButton]) => {
        typeButton.classList.toggle("is-active", active.type === type);
        typeButton.setAttribute("aria-pressed", String(active.type === type));
      });
      const perspective = active.type === "PerspectiveCamera";
      ui.fovRow.hidden = !perspective;
      if (perspective) {
        const fov = Math.round(active.fov ?? core.camera?.fov ?? 45);
        setIfIdle(ui.fovInput, fov);
        ui.fovValue.textContent = `${fov}°`;
      }
      const handles = Viewer.getSceneCameraHandles?.() || "";
      [[ui.moveButton, "position"], [ui.targetButton, "target"]].forEach(([handleButton, mode]) => {
        handleButton.classList.toggle("is-active", handles === mode);
        handleButton.setAttribute("aria-pressed", String(handles === mode));
      });
      ui.position.inputs.forEach((input) => setIfIdle(input, round(active.position[input.dataset.axis])));
      ui.target.inputs.forEach((input) => setIfIdle(input, round(active.target[input.dataset.axis])));
    },
  });
}

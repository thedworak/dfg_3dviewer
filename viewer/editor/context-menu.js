import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import {
  canHideSelectedIfcElement,
  getSelectedIfcElement,
  hasIfcProperties,
  hideSelectedIfcElement,
  ifcHiddenCount,
  showAllIfcHidden,
  showIfcProperties,
} from "../ifc-properties.js";
import { showToast } from "../viewer-utils.js";

// The actions for the point under the pointer: a right click (mouse), a
// press and hold (touch, pen), or the ContextMenu key / Shift+F10 (the
// centre of the canvas). On an IFC element it is picked first - its
// properties open, as on a tap - so "Ask about this element" asks about it.
// What it offers follows the mode: while measuring, the measurement's
// finish / last point / cancel (a phone has no Enter or Backspace); while
// picking faces, annotating or clearing them; else the element, the point
// (zoom, measure, annotate, cut, coordinates) and the view; beside the
// model, moving, rotating and scaling it.
//
// The right button also pans (OrbitControls): only a right click that did
// not move opens the menu, on release. A long press ends in a pointerup the
// tap handlers must not take as a tap (consumeContextMenuPointer).
//
// A quick tap of two fingers together is a step back (ui/back-navigation.js).

const LONG_PRESS_MS = 500;
const LONG_PRESS_MAX_MOVE_PX = 10; // finger jitter allowed while holding
const RIGHT_CLICK_MAX_MOVE_PX = 6; // more is a pan
const TWO_FINGER_TAP_MS = 300;     // both fingers down within it, up within twice it
const TWO_FINGER_TAP_MAX_MOVE_PX = 12;
const EDGE_PX = 8;
// After a press and hold opened the menu under the finger, the release's
// click lands on an item: clicks count only this long after the release.
const RELEASE_CLICK_GUARD_MS = 400;
const MIN_MEASUREMENT_POINTS = { distance: 2, angle: 3, area: 3 };

// A toolbar tool the viewer offers here (settings and plans can hide them).
function hasTool(Viewer, key) {
  const button = Viewer.editorToolbarButtons?.[key];
  return Boolean(button && !button.hidden);
}

function formatCoordinate(value) {
  return Number(value.toFixed(3)).toString();
}

export function attachContextMenu(Viewer) {
  Object.assign(Viewer, {
    contextMenu: null,
    // The pointer whose long press opened the menu: its pointerup is not a tap.
    contextMenuPointerId: null,
    // The fingers of a gesture of two or more (pinch, two-finger tap): their
    // pointerups are not taps either.
    multiTouchPointerIds: new Set(),
    contextMenuClicksFrom: 0,

    isContextMenuOpen() {
      return Boolean(Viewer.contextMenu && !Viewer.contextMenu.hidden);
    },

    closeContextMenu() {
      if (!Viewer.isContextMenuOpen()) return false;
      Viewer.contextMenu.hidden = true;
      Viewer.contextMenu.textContent = "";
      return true;
    },

    consumeContextMenuPointer(event) {
      if (Viewer.multiTouchPointerIds.delete(event.pointerId)) return true;
      if (Viewer.contextMenuPointerId === null || event.pointerId !== Viewer.contextMenuPointerId) return false;
      Viewer.contextMenuPointerId = null;
      return true;
    },

    // Not while drawing a point cloud profile (its taps are its ends).
    canLongPressContextMenu() {
      if (Viewer.isPointCloudProfilePicking?.()) return false;
      return Boolean(core.camera && core.controls && core.controls.enabled !== false);
    },

    // Groups of items ({ key, label, run, locked, checked }); a group may
    // start with a title ({ title }).
    contextMenuItems(clientX, clientY) {
      const view = [{ key: "reset", label: t("contextMenu.reset", "Reset view"), run: () => Viewer.resetCamera() }];
      if (Viewer.RULER_MODE) return [Viewer.measurementMenuItems(), view];
      if (Viewer.pickingMode) return [Viewer.facePickingMenuItems(), view];

      const hit = Viewer.pickModelAt(clientX, clientY);
      const element = hit && hasIfcProperties() && showIfcProperties(hit.object, hit) ? Viewer.ifcElementMenuItems() : [];
      const elements = [];
      const hidden = hasIfcProperties() ? ifcHiddenCount() : 0;
      if (hidden) {
        elements.push({
          key: "showHidden",
          label: t("contextMenu.showHidden", { count: hidden }, "Show hidden elements ({count})"),
          run: showAllIfcHidden,
        });
      }
      if (Viewer.isIfcQueryViewActive?.()) {
        elements.push({ key: "showAll", label: t("contextMenu.showAll", "Show all elements"), run: () => Viewer.resetIfcQueryView() });
      }
      // The material under the pointer, in the materials window.
      const material = hit && !hit.isPointCloudHit && hasTool(Viewer, "materials") ? Viewer.getMaterialItemForHit?.(hit) : null;
      const materials = material
        ? [{ key: "editMaterial", label: t("contextMenu.editMaterial", { name: material.label }, "Edit the material “{name}”"), run: () => Viewer.openMaterialsPanel(material.id) }]
        : [];
      const point = hit?.point ? Viewer.pointMenuItems(hit.point.clone(), clientX, clientY) : [];
      const transform = hit ? [] : Viewer.transformMenuItems();
      if (Viewer.hasActiveClipping?.()) {
        view.unshift({ key: "removeCuts", label: t("contextMenu.removeCuts", "Remove sections"), run: () => Viewer.removeAllClipping() });
      }
      return [element, elements, materials, point, transform, view];
    },

    measurementMenuItems() {
      const draft = Viewer.measurementDraft;
      const items = [];
      if (draft?.points.length) {
        if (draft.points.length >= MIN_MEASUREMENT_POINTS[draft.mode]) {
          items.push({ key: "finishMeasurement", label: t("contextMenu.finishMeasurement", "Finish measurement"), run: () => Viewer.finishMeasurementDraft() });
        }
        items.push({ key: "undoPoint", label: t("contextMenu.undoPoint", "Remove last point"), run: () => Viewer.undoMeasurementPoint() });
        items.push({ key: "cancelMeasurement", label: t("contextMenu.cancelMeasurement", "Discard measurement"), run: () => Viewer.cancelMeasurementDraft() });
      }
      items.push({ key: "stopMeasuring", label: t("contextMenu.stopMeasuring", "Stop measuring"), run: () => Viewer.toggleDistanceMeasurement() });
      return items;
    },

    facePickingMenuItems() {
      const count = Viewer.selectedFaces?.length || 0;
      const items = [];
      if (count) {
        items.push({
          key: "annotateFaces",
          label: t("contextMenu.annotateFaces", { count }, "Annotate selected faces ({count})"),
          run: () => Viewer.openAnnotationDialog(),
        });
        items.push({ key: "clearFaces", label: t("contextMenu.clearFaces", "Clear selection"), run: () => Viewer.clearSelectedFaces() });
      }
      items.push({ key: "stopPicking", label: t("contextMenu.stopPicking", "Stop selecting faces"), run: () => Viewer.togglePickingMode() });
      return items;
    },

    // The IFC element just picked (its properties panel is open).
    ifcElementMenuItems() {
      const items = [];
      const selected = getSelectedIfcElement();
      if (selected) {
        items.push({ title: [selected.entry.name, selected.entry.type].filter(Boolean).join(" · ") || selected.guid });
      }
      const aiState = Viewer.ifcQueryAIState?.() || "off";
      if (aiState !== "off") {
        items.push({
          key: "ask",
          label: t("contextMenu.ask", "Ask about this element"),
          locked: aiState === "locked",
          run: () => Viewer.askAboutIfcSelection(),
        });
      }
      if (selected) {
        const matches = (kind, toastKey) => async () => {
          const count = await Viewer.showIfcSelectionMatches(kind);
          if (count && toastKey) showToast(toastKey, "info", { count, duration: 2600 });
        };
        items.push({ key: "sameType", label: t("contextMenu.sameType", "Select all of this type"), run: matches("sameType", "contextMenu.sameTypeFound") });
        items.push({ key: "isolate", label: t("contextMenu.isolate", "Show only this element"), run: matches("isolate") });
      }
      if (canHideSelectedIfcElement()) {
        items.push({ key: "hide", label: t("contextMenu.hide", "Hide element"), run: hideSelectedIfcElement });
      }
      if (selected?.guid) {
        items.push({
          key: "copyGuid",
          label: t("contextMenu.copyGuid", "Copy GlobalId"),
          run: () => Viewer.copyToClipboard(selected.guid, "contextMenu.guidCopied"),
        });
      }
      return items;
    },

    // The model's gizmo, as the toolbar's move / rotate / scale: the mode
    // on is ticked, choosing it again turns it off.
    transformMenuItems() {
      if (!core.helperObjects?.[0]) return [];
      const current = Viewer.transformText?.["Transform 3D Object"] || "";
      return [
        { key: "move", mode: "translate", label: t("gui.move", "Move") },
        { key: "rotate", mode: "rotate", label: t("gui.rotate", "Rotate") },
        { key: "scale", mode: "scale", label: t("gui.scale", "Scale") },
      ]
        .filter(({ key }) => hasTool(Viewer, key))
        .map(({ key, mode, label }) => ({
          key,
          label,
          checked: current === mode,
          run: () => Viewer.toggleObjectTransformMode(mode),
        }));
    },

    // A point of the model (world space).
    pointMenuItems(point, clientX, clientY) {
      const items = [];
      if (core.controls?.enabled !== false) {
        items.push({ key: "focus", label: t("contextMenu.focus", "Zoom to this point"), run: () => Viewer.focusCameraAt(clientX, clientY) });
      }
      if (hasTool(Viewer, "ruler")) {
        items.push({
          key: "measure",
          label: t("contextMenu.measure", "Measure from here"),
          run: () => {
            if (!Viewer.RULER_MODE) Viewer.toggleDistanceMeasurement();
            Viewer.addMeasurementPoint(point);
          },
        });
      }
      if ((hasTool(Viewer, "annotate") || hasTool(Viewer, "picking")) && !Viewer.isPreviewModelActive?.()) {
        items.push({ key: "annotate", label: t("contextMenu.annotate", "Annotate here"), run: () => Viewer.startPointAnnotationAt(point) });
      }
      if (Viewer.isClippingAvailable?.() && hasTool(Viewer, "clippingPlanes")) {
        items.push({ key: "cut", label: t("contextMenu.cut", "Cut horizontally here"), run: () => Viewer.cutHorizontallyAt(point) });
      }
      items.push({
        key: "copyPoint",
        label: t("contextMenu.copyPoint", "Copy coordinates"),
        run: () => Viewer.copyToClipboard(
          [point.x, point.y, point.z].map(formatCoordinate).join(", "),
          "contextMenu.pointCopied",
        ),
      });
      return items;
    },

    // A floor plan view: the model above the point cut away (Y up).
    cutHorizontallyAt(point) {
      Viewer.setClippingAxisEnabled("y", true, { silent: true });
      Viewer.setClippingAxisNegated("y", false);
      Viewer.setClippingAxisPosition("y", point.y, { clamp: false });
      Viewer.applyClippingState();
    },

    removeAllClipping() {
      ["x", "y", "z"].forEach((axis) => {
        if (Viewer.isClippingAxisEnabled(axis)) Viewer.setClippingAxisEnabled(axis, false, { silent: true });
      });
    },

    async copyToClipboard(text, toastKey) {
      try {
        await navigator.clipboard.writeText(text);
        showToast(toastKey, "success", { value: text, duration: 2400 });
      } catch {
        showToast("contextMenu.copyFailed", "warning", { value: text, duration: 6000 });
      }
    },

    openContextMenu(clientX, clientY, { focus = false } = {}) {
      const container = core.container;
      if (!container || !core.camera) return false;
      Viewer.closeAnnotationPOITooltip?.();
      Viewer.openToolbarMenu?.(null);
      const menu = Viewer.ensureContextMenu();
      menu.textContent = "";
      Viewer.contextMenuItems(clientX, clientY).filter((group) => group.some((item) => item.key)).forEach((group, index) => {
        group.forEach((item, itemIndex) => {
          const separated = index > 0 && itemIndex === 0;
          if (item.title) {
            const title = document.createElement("div");
            title.className = "viewer-context-menu_title";
            title.classList.toggle("is-separated", separated);
            title.textContent = item.title;
            menu.appendChild(title);
            return;
          }
          Viewer.appendContextMenuItem(menu, item, separated);
        });
      });
      menu.hidden = false;

      // At the pointer, kept inside the viewer.
      const box = container.getBoundingClientRect();
      const maxLeft = Math.max(EDGE_PX, box.width - menu.offsetWidth - EDGE_PX);
      const maxTop = Math.max(EDGE_PX, box.height - menu.offsetHeight - EDGE_PX);
      menu.style.left = `${Math.min(Math.max(clientX - box.left, EDGE_PX), maxLeft)}px`;
      menu.style.top = `${Math.min(Math.max(clientY - box.top, EDGE_PX), maxTop)}px`;
      if (focus) menu.querySelector("button")?.focus({ preventScroll: true });
      return true;
    },

    appendContextMenuItem(menu, item, separated) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", item.checked === undefined ? "menuitem" : "menuitemcheckbox");
      if (item.checked !== undefined) button.setAttribute("aria-checked", String(item.checked));
      button.dataset.action = item.key;
      button.textContent = item.label;
      if (item.locked) button.classList.add("is-locked");
      button.classList.toggle("is-separated", separated);
      button.addEventListener("click", () => {
        if (performance.now() < Viewer.contextMenuClicksFrom) return;
        Viewer.closeContextMenu();
        item.run();
      });
      menu.appendChild(button);
    },

    ensureContextMenu() {
      if (Viewer.contextMenu?.isConnected) return Viewer.contextMenu;
      const menu = document.createElement("div");
      menu.className = "viewer-context-menu";
      menu.setAttribute("role", "menu");
      menu.setAttribute("aria-label", t("contextMenu.aria", "Actions"));
      menu.hidden = true;
      // Not a tap, drag or key for the canvas below.
      ["pointerdown", "pointerup", "wheel", "dblclick"].forEach((type) => {
        menu.addEventListener(type, (event) => event.stopPropagation());
      });
      menu.addEventListener("contextmenu", (event) => event.preventDefault());
      menu.addEventListener("keydown", (event) => {
        const buttons = [...menu.querySelectorAll("button")];
        const index = buttons.indexOf(document.activeElement);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const step = event.key === "ArrowDown" ? 1 : -1;
          buttons[(index + step + buttons.length) % buttons.length]?.focus();
        } else if (event.key === "Escape" || event.key === "Tab") {
          event.preventDefault();
          Viewer.closeContextMenu();
          core.renderer?.domElement?.focus({ preventScroll: true });
        }
        event.stopPropagation();
      });
      core.container.appendChild(menu);
      Viewer.contextMenu = menu;
      return menu;
    },

    bindContextMenu() {
      const canvas = core.renderer.domElement;
      let rightDown = null;
      let press = null;
      // The finger whose hold opened the menu, until it lifts.
      let holding = null;
      // pointerId -> where and when the finger went down.
      const touches = new Map();
      // Two fingers put down together: a step back if both lift quickly
      // without moving.
      let pair = null;

      const cancelPress = () => {
        if (press) clearTimeout(press.timer);
        press = null;
      };

      // Anywhere else: a press outside, a wheel turn, a resize closes it.
      Viewer.bindEventListener(document, "pointerdown", (event) => {
        if (Viewer.isContextMenuOpen() && !Viewer.contextMenu.contains(event.target)) Viewer.closeContextMenu();
      }, true);
      Viewer.bindEventListener(canvas, "wheel", () => Viewer.closeContextMenu(), { passive: true });
      Viewer.bindEventListener(window, "resize", () => Viewer.closeContextMenu());
      // OrbitControls already keeps the browser's own menu off the canvas.
      Viewer.bindEventListener(canvas, "contextmenu", (event) => event.preventDefault());

      Viewer.bindEventListener(canvas, "pointerdown", (event) => {
        if (event.pointerType === "mouse") {
          rightDown = event.button === 2 ? { x: event.clientX, y: event.clientY } : null;
          return;
        }
        touches.set(event.pointerId, { x: event.clientX, y: event.clientY, time: event.timeStamp });
        cancelPress();
        if (touches.size > 1) touches.forEach((_, id) => Viewer.multiTouchPointerIds.add(id));
        if (touches.size === 2) {
          const times = [...touches.values()].map((touch) => touch.time);
          pair = Math.max(...times) - Math.min(...times) <= TWO_FINGER_TAP_MS ? { start: Math.min(...times) } : null;
        } else {
          pair = null;
        }
        // A second finger is a pinch or a pan.
        if (touches.size > 1 || !event.isPrimary || !Viewer.canLongPressContextMenu()) return;
        const start = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
        start.timer = setTimeout(() => {
          press = null;
          if (!Viewer.openContextMenu(start.x, start.y)) return;
          Viewer.contextMenuPointerId = start.pointerId;
          Viewer.contextMenuClicksFrom = Infinity;
          holding = start.pointerId;
        }, LONG_PRESS_MS);
        press = start;
      });

      Viewer.bindEventListener(canvas, "pointermove", (event) => {
        const touch = touches.get(event.pointerId);
        if (pair && touch && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > TWO_FINGER_TAP_MAX_MOVE_PX) pair = null;
        if (!press || event.pointerId !== press.pointerId) return;
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > LONG_PRESS_MAX_MOVE_PX) cancelPress();
      });

      const release = (event) => {
        touches.delete(event.pointerId);
        if (press?.pointerId === event.pointerId) cancelPress();
      };
      Viewer.bindEventListener(canvas, "pointercancel", (event) => {
        pair = null;
        if (event.pointerId === holding) {
          holding = null;
          Viewer.contextMenuClicksFrom = performance.now() + RELEASE_CLICK_GUARD_MS;
        }
        Viewer.multiTouchPointerIds.delete(event.pointerId);
        release(event);
        if (event.pointerId === Viewer.contextMenuPointerId) Viewer.contextMenuPointerId = null;
      });
      Viewer.bindEventListener(canvas, "pointerup", (event) => {
        if (event.pointerType !== "mouse") {
          if (event.pointerId === holding) {
            holding = null;
            Viewer.contextMenuClicksFrom = performance.now() + RELEASE_CLICK_GUARD_MS;
          }
          const tapped = pair && touches.has(event.pointerId) && touches.size === 1
            && event.timeStamp - pair.start <= TWO_FINGER_TAP_MS * 2;
          release(event);
          if (touches.size === 0) {
            pair = null;
            Viewer.multiTouchPointerIds.clear();
          }
          if (tapped) Viewer.goBack();
          return;
        }
        const down = rightDown;
        rightDown = null;
        if (event.button !== 2 || !down) return;
        if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > RIGHT_CLICK_MAX_MOVE_PX) return;
        Viewer.openContextMenu(event.clientX, event.clientY);
      });

      Viewer.bindEventListener(canvas, "keydown", (event) => {
        if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
        event.preventDefault();
        event.stopPropagation();
        const box = canvas.getBoundingClientRect();
        Viewer.openContextMenu(box.left + box.width / 2, box.top + box.height / 2, { focus: true });
      });
    },
  });
}

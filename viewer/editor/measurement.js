import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { toastHelper } from "../viewer-utils.js";
import { getViewerSideStack } from "../ui/side-stack.js";
import THREE from "../init.js";
import { MODEL_UNITS } from "./model-units.js";

// Measurement tools behind the ruler button:
//   distance   - click points along a path; each segment and the total length
//   angle      - three clicks: start, vertex, end
//   area       - click the corners of a polygon; click the first point again
//                (or press Enter) to close it
//   dimensions - bounding box, surface area and volume of the whole model
// Results are drawn in the scene and listed in a readout panel. Lengths use
// viewer.measurement.modelUnitInMeters from viewer-settings.json.

export const MEASUREMENT_MODES = ["distance", "angle", "area"];

const COLORS = {
  line: 0x1e88e5,
  point: 0xff3d00,
  fill: 0x1e88e5,
  box: 0xffb300,
};
// Screen distance (px) within which a click on the first corner closes an area.
const CLOSE_POLYGON_PX = 14;
const POINT_SIZE_PX = 10;

let pointSprite = null;

function getPointSprite() {
  if (pointSprite) return pointSprite;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.beginPath();
  ctx.arc(32, 32, 26, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
  ctx.stroke();
  pointSprite = new THREE.CanvasTexture(canvas);
  pointSprite.colorSpace = THREE.SRGBColorSpace;
  return pointSprite;
}

function overlayMaterialProps() {
  return { depthTest: false, depthWrite: false, transparent: true };
}

function createPoints(points) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.PointsMaterial({
    ...overlayMaterialProps(),
    color: COLORS.point,
    map: getPointSprite(),
    alphaTest: 0.5,
    size: POINT_SIZE_PX,
    sizeAttenuation: false,
  });
  const object = new THREE.Points(geometry, material);
  object.renderOrder = 1001;
  return object;
}

function createLine(points, { closed = false, color = COLORS.line } = {}) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ ...overlayMaterialProps(), color });
  const object = closed ? new THREE.LineLoop(geometry, material) : new THREE.Line(geometry, material);
  object.renderOrder = 1000;
  return object;
}

// Vector area of a (possibly non-planar) polygon, Newell's method. Its length
// is the polygon area; its direction is the polygon normal.
function polygonVectorArea(points) {
  const sum = new THREE.Vector3();
  const cross = new THREE.Vector3();
  for (let i = 0; i < points.length; i++) {
    cross.crossVectors(points[i], points[(i + 1) % points.length]);
    sum.add(cross);
  }
  return sum.multiplyScalar(0.5);
}

function createPolygonFill(points) {
  const normal = polygonVectorArea(points).normalize();
  if (normal.lengthSq() === 0) return null;
  // Triangulate in the polygon's own plane so concave outlines fill correctly.
  const u = new THREE.Vector3().subVectors(points[1], points[0]).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u);
  const flat = points.map((p) => {
    const d = new THREE.Vector3().subVectors(p, points[0]);
    return new THREE.Vector2(d.dot(u), d.dot(v));
  });
  const triangles = THREE.ShapeUtils.triangulateShape(flat, []);
  if (!triangles.length) return null;
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.setIndex(triangles.flat());
  const material = new THREE.MeshBasicMaterial({
    ...overlayMaterialProps(),
    color: COLORS.fill,
    opacity: 0.22,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 999;
  return mesh;
}

function createAngleArc(vertex, a, b, radius) {
  const dirA = new THREE.Vector3().subVectors(a, vertex).normalize();
  const dirB = new THREE.Vector3().subVectors(b, vertex).normalize();
  const angle = dirA.angleTo(dirB);
  const axis = new THREE.Vector3().crossVectors(dirA, dirB);
  if (axis.lengthSq() < 1e-12 || angle < 1e-4) return null;
  axis.normalize();
  const steps = Math.max(8, Math.ceil(angle / (Math.PI / 32)));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const q = new THREE.Quaternion().setFromAxisAngle(axis, (angle * i) / steps);
    points.push(dirA.clone().applyQuaternion(q).multiplyScalar(radius).add(vertex));
  }
  return createLine(points, { color: COLORS.point });
}

function centroid(points) {
  const c = new THREE.Vector3();
  points.forEach((p) => c.add(p));
  return c.divideScalar(points.length || 1);
}

function getModelRoots() {
  return (core.mainObject || []).flatMap((entry) => (Array.isArray(entry) ? entry : [entry])).filter(Boolean);
}

// Surface area and enclosed volume of all meshes, in world units. The volume
// is only meaningful for closed (watertight) meshes.
function computeMeshTotals(roots) {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  let area = 0;
  let volume = 0;
  let triangles = 0;

  roots.forEach((root) => {
    root.updateMatrixWorld(true);
    root.traverse((child) => {
      if (!child.isMesh || child.userData?.isMeasurement) return;
      const position = child.geometry?.attributes?.position;
      if (!position) return;
      const index = child.geometry.index;
      const count = index ? index.count : position.count;
      const matrix = child.matrixWorld;
      for (let i = 0; i + 2 < count; i += 3) {
        const ia = index ? index.getX(i) : i;
        const ib = index ? index.getX(i + 1) : i + 1;
        const ic = index ? index.getX(i + 2) : i + 2;
        a.fromBufferAttribute(position, ia).applyMatrix4(matrix);
        b.fromBufferAttribute(position, ib).applyMatrix4(matrix);
        c.fromBufferAttribute(position, ic).applyMatrix4(matrix);
        ab.subVectors(b, a);
        ac.subVectors(c, a);
        area += ab.cross(ac).length() / 2;
        volume += a.dot(b.clone().cross(c)) / 6;
        triangles++;
      }
    });
  });
  return { area, volume: Math.abs(volume), triangles };
}

export function attachMeasurement(Viewer) {
  Object.assign(Viewer, {
    measurementMode: "distance",
    measurementDraft: null,
    measurementResults: [],
    measurementLabels: [],
    measurementDimensions: null,

    // Entry point from the click handler in picking.js while RULER_MODE is on.
    buildRuler(intersection) {
      if (!intersection?.point) return;
      Viewer.addMeasurementPoint(intersection.point.clone());
    },

    setMeasurementMode(mode) {
      if (!MEASUREMENT_MODES.includes(mode)) return;
      Viewer.finishMeasurementDraft();
      Viewer.measurementMode = mode;
      if (!Viewer.RULER_MODE) {
        Viewer.toggleDistanceMeasurement();
      } else {
        Viewer.showMeasurementHint();
      }
      Viewer.updateMeasurementReadout();
      Viewer.updateEditorToolbarState();
    },

    showMeasurementHint() {
      const hintKey = {
        distance: "distanceHint",
        angle: "angleHint",
        area: "areaHint",
      }[Viewer.measurementMode];
      toastHelper(hintKey, { duration: 5200 });
    },

    getMeasurementScale() {
      return Viewer.getDistanceMeasurementScaleMeters();
    },

    // Areas and volumes in the model's unit and the chosen display system
    // (editor/model-units.js).
    formatMeasuredArea(rawArea) {
      return Viewer.formatArea(rawArea);
    },

    formatMeasuredVolume(rawVolume) {
      return Viewer.formatVolume(rawVolume);
    },

    // After the model unit or the display system changed: every label,
    // the model dimensions and the readout in the new unit.
    refreshMeasurementUnits() {
      const draft = Viewer.measurementDraft;
      Viewer.measurementResults.forEach((entry) => {
        Viewer.measurementDraft = entry;
        Viewer.redrawMeasurementDraft({ closed: true });
      });
      Viewer.measurementDraft = draft;
      if (draft) Viewer.redrawMeasurementDraft();
      if (Viewer.measurementDimensions) {
        Viewer.hideModelDimensions();
        Viewer.showModelDimensions();
      }
      Viewer.updateMeasurementReadout();
    },

    addMeasurementPoint(point) {
      const mode = Viewer.measurementMode;
      let draft = Viewer.measurementDraft;
      if (!draft || draft.mode !== mode) {
        Viewer.finishMeasurementDraft();
        draft = Viewer.startMeasurementDraft(mode);
      }

      if (mode === "area" && draft.points.length >= 3 && Viewer.isNearScreenPoint(point, draft.points[0])) {
        Viewer.finishMeasurementDraft();
        return;
      }

      draft.points.push(point);
      Viewer.redrawMeasurementDraft();

      if (mode === "angle" && draft.points.length === 3) {
        Viewer.finishMeasurementDraft();
      }
    },

    startMeasurementDraft(mode) {
      const group = new THREE.Group();
      group.userData.isMeasurement = true;
      group.userData.noClipping = true;
      core.scene.add(group);
      Viewer.ruler.push(group);
      const draft = { mode, points: [], group, labels: [] };
      Viewer.measurementDraft = draft;
      return draft;
    },

    isNearScreenPoint(a, b) {
      const canvas = core.renderer?.domElement;
      if (!canvas || !core.camera) return false;
      const pa = a.clone().project(core.camera);
      const pb = b.clone().project(core.camera);
      const dx = ((pa.x - pb.x) / 2) * canvas.clientWidth;
      const dy = ((pa.y - pb.y) / 2) * canvas.clientHeight;
      return Math.hypot(dx, dy) <= CLOSE_POLYGON_PX;
    },

    redrawMeasurementDraft({ closed = false } = {}) {
      const draft = Viewer.measurementDraft;
      if (!draft) return;
      const { group, points, mode } = draft;
      group.children.slice().forEach((child) => Viewer.removeAndDisposeFromScene(child));
      draft.labels.forEach((label) => Viewer.removeMeasurementLabel(label));
      draft.labels = [];

      if (points.length > 1) {
        group.add(createLine(points, { closed: closed && mode === "area" }));
      }
      if (mode === "area" && points.length >= 3) {
        const fill = createPolygonFill(points);
        if (fill) group.add(fill);
      }
      group.add(createPoints(points));

      const result = Viewer.describeMeasurement(draft);
      if (mode === "distance") {
        for (let i = 1; i < points.length; i++) {
          const mid = points[i - 1].clone().add(points[i]).multiplyScalar(0.5);
          const text = Viewer.formatMeasuredDistance(points[i - 1].distanceTo(points[i])).text;
          draft.labels.push(Viewer.addMeasurementLabel(text, mid));
        }
      } else if (mode === "angle" && points.length === 3) {
        const radius = Math.min(points[0].distanceTo(points[1]), points[2].distanceTo(points[1])) * 0.25;
        const arc = createAngleArc(points[1], points[0], points[2], radius);
        if (arc) group.add(arc);
        draft.labels.push(Viewer.addMeasurementLabel(result.value, points[1], { accent: true }));
      } else if (mode === "area" && points.length >= 3) {
        draft.labels.push(Viewer.addMeasurementLabel(result.value, centroid(points), { accent: true }));
      }
      Viewer.updateMeasurementReadout();
    },

    describeMeasurement(entry) {
      const { mode, points } = entry;
      if (mode === "distance") {
        let total = 0;
        for (let i = 1; i < points.length; i++) total += points[i - 1].distanceTo(points[i]);
        const segments = Math.max(points.length - 1, 0);
        return {
          title: t("measurement.distance", "Distance"),
          value: Viewer.formatMeasuredDistance(total).text,
          detail: segments > 1 ? Viewer.tFormat("measurement.segments", { count: segments }, "{count} segments") : "",
        };
      }
      if (mode === "angle") {
        if (points.length < 3) {
          return { title: t("measurement.angle", "Angle"), value: "…", detail: "" };
        }
        const dirA = new THREE.Vector3().subVectors(points[0], points[1]);
        const dirB = new THREE.Vector3().subVectors(points[2], points[1]);
        const degrees = THREE.MathUtils.radToDeg(dirA.angleTo(dirB));
        return { title: t("measurement.angle", "Angle"), value: `${degrees.toFixed(1)}°`, detail: "" };
      }
      const area = points.length >= 3 ? polygonVectorArea(points).length() : 0;
      let perimeter = 0;
      for (let i = 0; i < points.length; i++) {
        if (i + 1 < points.length || points.length >= 3) {
          perimeter += points[i].distanceTo(points[(i + 1) % points.length]);
        }
      }
      return {
        title: t("measurement.area", "Area"),
        value: points.length >= 3 ? Viewer.formatMeasuredArea(area) : "…",
        detail: points.length >= 2
          ? `${t("measurement.perimeter", "Perimeter")}: ${Viewer.formatMeasuredDistance(perimeter).text}`
          : "",
      };
    },

    finishMeasurementDraft() {
      const draft = Viewer.measurementDraft;
      if (!draft) return;
      Viewer.measurementDraft = null;
      const minPoints = { distance: 2, angle: 3, area: 3 }[draft.mode];
      if (draft.points.length < minPoints) {
        Viewer.discardMeasurement(draft);
      } else {
        Viewer.measurementDraft = draft;
        Viewer.redrawMeasurementDraft({ closed: true });
        Viewer.measurementDraft = null;
        Viewer.measurementResults.push(draft);
      }
      Viewer.updateMeasurementReadout();
    },

    cancelMeasurementDraft() {
      const draft = Viewer.measurementDraft;
      if (!draft) return false;
      Viewer.measurementDraft = null;
      Viewer.discardMeasurement(draft);
      Viewer.updateMeasurementReadout();
      return true;
    },

    discardMeasurement(entry) {
      entry.labels.forEach((label) => Viewer.removeMeasurementLabel(label));
      Viewer.removeAndDisposeFromScene(entry.group);
      Viewer.ruler = Viewer.ruler.filter((item) => item !== entry.group);
    },

    clearMeasurements() {
      Viewer.cancelMeasurementDraft();
      Viewer.measurementResults.forEach((entry) => Viewer.discardMeasurement(entry));
      Viewer.measurementResults = [];
      Viewer.hideModelDimensions();
      (Viewer.ruler || []).forEach((item) => Viewer.removeAndDisposeFromScene(item));
      Viewer.ruler = [];
      Viewer.rulerObject = null;
      Viewer.linePoints = [];
      Viewer.measurementLabels.slice().forEach((label) => Viewer.removeMeasurementLabel(label));
      Viewer.updateMeasurementReadout();
    },

    toggleModelDimensions() {
      if (Viewer.measurementDimensions) {
        Viewer.hideModelDimensions();
      } else {
        Viewer.showModelDimensions();
      }
      Viewer.updateMeasurementReadout();
      Viewer.updateEditorToolbarState();
    },

    showModelDimensions() {
      const roots = getModelRoots();
      if (!roots.length) return;
      const box = new THREE.Box3();
      roots.forEach((root) => box.expandByObject(root));
      if (box.isEmpty()) return;

      const helper = new THREE.Box3Helper(box, COLORS.box);
      helper.material.depthTest = false;
      helper.material.transparent = true;
      helper.renderOrder = 998;
      helper.userData.isMeasurement = true;
      helper.userData.noClipping = true;
      core.scene.add(helper);

      const size = box.getSize(new THREE.Vector3());
      const { min, max } = box;
      const labels = [
        Viewer.addMeasurementLabel(
          `X ${Viewer.formatMeasuredDistance(size.x).text}`,
          new THREE.Vector3((min.x + max.x) / 2, min.y, max.z)
        ),
        Viewer.addMeasurementLabel(
          `Y ${Viewer.formatMeasuredDistance(size.y).text}`,
          new THREE.Vector3(max.x, (min.y + max.y) / 2, max.z)
        ),
        Viewer.addMeasurementLabel(
          `Z ${Viewer.formatMeasuredDistance(size.z).text}`,
          new THREE.Vector3(max.x, min.y, (min.z + max.z) / 2)
        ),
      ];
      Viewer.measurementDimensions = { helper, labels, size, totals: computeMeshTotals(roots) };
    },

    hideModelDimensions() {
      const dims = Viewer.measurementDimensions;
      if (!dims) return;
      dims.labels.forEach((label) => Viewer.removeMeasurementLabel(label));
      Viewer.removeAndDisposeFromScene(dims.helper);
      Viewer.measurementDimensions = null;
    },

    // ---- HTML labels, projected onto the canvas every frame -------------

    getMeasurementLabelLayer() {
      if (Viewer.measurementLabelLayer?.isConnected) return Viewer.measurementLabelLayer;
      const canvas = core.renderer?.domElement;
      const host = canvas?.parentElement;
      if (!host) return null;
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      const layer = document.createElement("div");
      layer.className = "viewer-measure-label-layer";
      layer.setAttribute("aria-hidden", "true");
      host.appendChild(layer);
      Viewer.measurementLabelLayer = layer;
      return layer;
    },

    addMeasurementLabel(text, position, { accent = false } = {}) {
      const layer = Viewer.getMeasurementLabelLayer();
      const element = document.createElement("div");
      element.className = "viewer-measure-label";
      if (accent) element.classList.add("viewer-measure-label--accent");
      element.textContent = text;
      layer?.appendChild(element);
      const label = { element, position: position.clone() };
      Viewer.measurementLabels.push(label);
      return label;
    },

    removeMeasurementLabel(label) {
      label?.element?.remove();
      Viewer.measurementLabels = Viewer.measurementLabels.filter((item) => item !== label);
    },

    updateMeasurementLabels() {
      if (!Viewer.measurementLabels.length || !core.camera) return;
      const canvas = core.renderer?.domElement;
      const layer = Viewer.measurementLabelLayer;
      if (!canvas || !layer) return;
      const canvasRect = canvas.getBoundingClientRect();
      const layerRect = layer.getBoundingClientRect();
      const offsetX = canvasRect.left - layerRect.left;
      const offsetY = canvasRect.top - layerRect.top;
      const projected = new THREE.Vector3();
      Viewer.measurementLabels.forEach(({ element, position }) => {
        projected.copy(position).project(core.camera);
        const visible = projected.z > -1 && projected.z < 1;
        element.hidden = !visible;
        if (!visible) return;
        const x = offsetX + ((projected.x + 1) / 2) * canvasRect.width;
        const y = offsetY + ((1 - projected.y) / 2) * canvasRect.height;
        element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      });
    },

    // ---- Readout panel ---------------------------------------------------

    // The model unit and where it comes from, a hint when the model's size
    // looks wrong for it, and metric / imperial display.
    buildMeasurementUnitsBlock() {
      const block = document.createElement("div");
      block.className = "viewer-measure-units";
      const unit = Viewer.resolveModelUnit();
      const unitName = unit.key || `${Number(unit.meters.toPrecision(4))} m`;

      const line = document.createElement("div");
      line.className = "viewer-measure-units_line";
      line.textContent = Viewer.tFormat(
        "measurement.unitLine",
        { unit: unitName, source: Viewer.describeModelUnitSource(unit.source) },
        "Model unit: {unit} ({source})"
      );
      block.appendChild(line);

      const warning = Viewer.getModelUnitWarning();
      if (warning) {
        const hint = document.createElement("div");
        hint.className = "viewer-measure-units_warning";
        hint.setAttribute("role", "status");
        const text = document.createElement("span");
        text.textContent = Viewer.tFormat(
          "measurement.unitImplausible",
          { size: Viewer.formatLength(Viewer.getModelLargestSide()).text },
          "The model measures {size} across - is its unit right?"
        );
        hint.appendChild(text);
        const choices = document.createElement("div");
        choices.className = "viewer-measure-units_choices";
        warning.suggestions.forEach((key) => {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.unit = key;
          const size = Viewer.getModelLargestSide() * MODEL_UNITS[key];
          button.textContent = `${key} → ${Number(size.toPrecision(3))} m`;
          button.title = Viewer.tFormat("measurement.unitUse", { unit: key }, "Treat the model as drawn in {unit}");
          button.addEventListener("click", () => Viewer.setModelUnit(key));
          choices.appendChild(button);
        });
        const keep = document.createElement("button");
        keep.type = "button";
        keep.dataset.unit = unit.key || "m";
        keep.className = "is-quiet";
        keep.textContent = Viewer.tFormat("measurement.unitKeep", { unit: unitName }, "{unit} is right");
        keep.addEventListener("click", () => Viewer.setModelUnit(unit.key || "m"));
        choices.appendChild(keep);
        hint.appendChild(choices);
        block.appendChild(hint);
      }

      const display = document.createElement("div");
      display.className = "viewer-measure-units_display";
      display.setAttribute("role", "group");
      display.setAttribute("aria-label", t("measurement.displaySystem", "Show in"));
      const system = Viewer.getMeasureDisplaySystem();
      [["metric", t("measurement.metric", "Metric")], ["imperial", t("measurement.imperial", "Imperial")]].forEach(([value, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.system = value;
        button.textContent = label;
        button.setAttribute("aria-pressed", String(system === value));
        button.classList.toggle("is-active", system === value);
        button.addEventListener("click", () => Viewer.setMeasureDisplaySystem(value));
        display.appendChild(button);
      });
      block.appendChild(display);
      return block;
    },

    ensureMeasurementReadout() {
      if (Viewer.measurementReadout?.isConnected) return Viewer.measurementReadout;
      const stack = getViewerSideStack();
      if (!stack) return null;
      const panel = document.createElement("div");
      panel.id = "viewerMeasurementReadout";
      panel.className = "viewer-measure-readout";
      panel.hidden = true;
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        panel.addEventListener(type, (event) => event.stopPropagation());
      });
      stack.appendChild(panel);
      Viewer.measurementReadout = panel;
      return panel;
    },

    updateMeasurementReadout() {
      const panel = Viewer.ensureMeasurementReadout();
      if (!panel) return;
      const entries = [...Viewer.measurementResults];
      if (Viewer.measurementDraft?.points.length) entries.push(Viewer.measurementDraft);
      const dims = Viewer.measurementDimensions;
      panel.hidden = !(Viewer.RULER_MODE || entries.length || dims);
      if (panel.hidden) return;

      panel.replaceChildren();
      const header = document.createElement("div");
      header.className = "viewer-measure-readout_header";
      const title = document.createElement("strong");
      const modeLabel = t(`measurement.${Viewer.measurementMode}`, Viewer.measurementMode);
      title.textContent = Viewer.RULER_MODE
        ? `${t("measurement.title", "Measurements")} · ${modeLabel}`
        : t("measurement.title", "Measurements");
      header.appendChild(title);
      // Same as switching the ruler tool off: measuring ends and the results
      // go. With the ruler already off, the panel only shows model dimensions.
      const close = document.createElement("button");
      close.type = "button";
      close.className = "viewer-measure-readout_close";
      close.textContent = "✕";
      close.title = t("measurement.close", "Close measurements (ends measuring and clears them)");
      close.setAttribute("aria-label", close.title);
      close.addEventListener("click", () => {
        if (Viewer.RULER_MODE) {
          Viewer.toggleDistanceMeasurement();
        } else {
          Viewer.clearMeasurements();
          Viewer.updateEditorToolbarState();
        }
      });
      header.appendChild(close);
      panel.appendChild(header);

      const list = document.createElement("ul");
      list.className = "viewer-measure-readout_list";
      const addRow = (label, value, detail = "", isDraft = false) => {
        const row = document.createElement("li");
        if (isDraft) row.classList.add("is-draft");
        const name = document.createElement("span");
        name.textContent = label;
        const val = document.createElement("span");
        val.className = "viewer-measure-readout_value";
        val.textContent = value;
        row.append(name, val);
        if (detail) {
          const small = document.createElement("small");
          small.textContent = detail;
          row.appendChild(small);
        }
        list.appendChild(row);
      };

      entries.forEach((entry) => {
        const { title: label, value, detail } = Viewer.describeMeasurement(entry);
        addRow(label, value, detail, entry === Viewer.measurementDraft);
      });
      if (dims) {
        const f = (v) => Viewer.formatMeasuredDistance(v).text;
        addRow(t("measurement.dimensions", "Model dimensions"), `${f(dims.size.x)} × ${f(dims.size.y)} × ${f(dims.size.z)}`);
        addRow(t("measurement.surface", "Surface area"), Viewer.formatMeasuredArea(dims.totals.area));
        addRow(
          t("measurement.volume", "Volume"),
          Viewer.formatMeasuredVolume(dims.totals.volume),
          t("measurement.volumeNote", "Valid for closed meshes only")
        );
      }
      if (!entries.length && !dims) {
        const empty = document.createElement("li");
        empty.className = "viewer-measure-readout_empty";
        empty.textContent = t(`measurement.hint.${Viewer.measurementMode}`, "");
        list.appendChild(empty);
      }
      panel.appendChild(list);
      panel.appendChild(Viewer.buildMeasurementUnitsBlock());

      const actions = document.createElement("div");
      actions.className = "viewer-measure-readout_actions";
      if (Viewer.measurementDraft && Viewer.measurementMode !== "angle") {
        const finish = document.createElement("button");
        finish.type = "button";
        finish.textContent = t("measurement.finish", "Finish");
        finish.title = t("measurement.finishHint", "Finish the current measurement (Enter)");
        finish.addEventListener("click", () => Viewer.finishMeasurementDraft());
        actions.appendChild(finish);
      }
      if (entries.length || dims) {
        const clear = document.createElement("button");
        clear.type = "button";
        clear.textContent = t("measurement.clear", "Clear");
        clear.addEventListener("click", () => {
          Viewer.clearMeasurements();
          Viewer.updateEditorToolbarState();
        });
        actions.appendChild(clear);
      }
      if (actions.children.length) panel.appendChild(actions);
    },
  });
}

import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { surroundingsTerrainHeight } from "./surroundings-rules.js";
import { mapGeoJsonToAnswer, mapProjector, mapUnprojector } from "./surroundings-map.js";

// Correcting what the AI read from an old map (editor/surroundings.js,
// readSurroundingsOldMap): its roads, buildings, fields, water and walls
// drawn over the ground, each in its colour, with a point at each corner.
//
//   drag a point          moves it
//   click a line          selects the feature; Delete removes it
//   Draw (the window)     a new feature of a kind: click its points,
//                         double-click or Enter to finish, Esc to cancel
//   Undo (Ctrl+Z)         the last change
//
// Every change goes into the reading (GeoJSON, in degrees: the features
// keep `source: "ai"`, a changed one gets `edited: true`, a drawn one
// `source: "hand"`) and the surroundings are drawn again from it. Saved as
// before (downloadSurroundingsOldMap), to become the model's `layoutUrl`.

// What can be drawn, and how.
export const SURROUNDINGS_EDIT_KINDS = ["road", "building", "field", "river", "lake", "wall"];
const POLYGONS = new Set(["building", "field", "lake", "sea"]);
const COLOURS = {
  road: 0xf5a524, building: 0xff5a4f, field: 0xe9d46b, river: 0x3fa9f5, stream: 0x3fa9f5, lake: 0x3fa9f5, sea: 0x3fa9f5,
  coastline: 0x3fa9f5, wall: 0xd05ad0, palisade: 0xd05ad0, rampart: 0xd05ad0,
};
const NEW_PROPERTIES = {
  road: { width: 5 },
  building: { role: "house", height: 6 },
  river: { width: 8 },
};
// How near the pointer must come (CSS pixels): to a point, to a line.
const POINT_REACH = 12;
const LINE_REACH = 8;
// A click: the pointer moved less than this between down and up.
const CLICK_SLOP = 5;
// Over the ground, in metres.
const LIFT = 1.2;
const HISTORY = 50;

export function attachSurroundingsEditor(Viewer) {
  Object.assign(Viewer, {
    // active; the selected feature's index (-1: none); the changes to undo
    // (the reading as JSON before each); a feature being drawn ({ kind,
    // points }); a point being dragged.
    surroundingsEdit: { active: false, selected: -1, history: [], adding: null, drag: null, down: null, listeners: null },

    canEditSurroundingsReading() {
      const state = Viewer.surroundings;
      return Boolean(Viewer.surroundingsOldMap?.aiGeojson && state.latitude != null && state.longitude != null && Viewer.surroundingsObjects && core.camera);
    },

    setSurroundingsEditing(on = true) {
      const edit = Viewer.surroundingsEdit;
      const active = on === true && Viewer.canEditSurroundingsReading();
      if (active === edit.active) {
        Viewer.syncSurroundingsPanel?.();
        return active;
      }
      edit.active = active;
      edit.selected = -1;
      edit.adding = null;
      edit.drag = null;
      if (active) {
        const container = core.container;
        const down = (event) => Viewer.surroundingsEditPointer("down", event);
        const move = (event) => Viewer.surroundingsEditPointer("move", event);
        const up = (event) => Viewer.surroundingsEditPointer("up", event);
        const double = (event) => {
          if (event.target !== core.renderer?.domElement || !edit.adding) return;
          event.stopPropagation();
          Viewer.finishSurroundingsDrawing();
        };
        const key = (event) => Viewer.surroundingsEditKey(event);
        // Captured on the viewer, before the camera's controls see them.
        container.addEventListener("pointerdown", down, true);
        window.addEventListener("pointermove", move, true);
        window.addEventListener("pointerup", up, true);
        container.addEventListener("dblclick", double, true);
        window.addEventListener("keydown", key);
        edit.listeners = () => {
          container.removeEventListener("pointerdown", down, true);
          window.removeEventListener("pointermove", move, true);
          window.removeEventListener("pointerup", up, true);
          container.removeEventListener("dblclick", double, true);
          window.removeEventListener("keydown", key);
        };
      } else {
        edit.listeners?.();
        edit.listeners = null;
        if (core.controls) core.controls.enabled = true;
      }
      Viewer.drawSurroundingsEditOverlay();
      Viewer.syncSurroundingsPanel?.();
      return active;
    },

    // ---- the reading's geometry, in the layout's metres --------------------

    surroundingsEditProjection() {
      const state = Viewer.surroundings;
      const north = Viewer.sunStudy?.north || 0;
      return {
        project: mapProjector(state.latitude, state.longitude, north),
        unproject: mapUnprojector(state.latitude, state.longitude, north),
      };
    },

    // A feature's parts: { coordinates (its array of [lon, lat]), closed }
    // - a line, or a polygon's outer ring (its closing point left out).
    surroundingsEditParts(feature) {
      const geometry = feature?.geometry;
      if (!geometry) return [];
      if (geometry.type === "LineString") return [{ coordinates: geometry.coordinates, closed: false }];
      if (geometry.type === "MultiLineString") return geometry.coordinates.map((coordinates) => ({ coordinates, closed: false }));
      if (geometry.type === "Polygon") return geometry.coordinates.slice(0, 1).map((coordinates) => ({ coordinates, closed: true }));
      if (geometry.type === "MultiPolygon") return geometry.coordinates.map((rings) => ({ coordinates: rings[0], closed: true }));
      return [];
    },

    // Every corner of the reading: [{ feature, part, index, x, z }].
    surroundingsEditVertices() {
      const features = Viewer.surroundingsOldMap.aiGeojson?.features || [];
      const { project } = Viewer.surroundingsEditProjection();
      const vertices = [];
      features.forEach((feature, featureIndex) => {
        Viewer.surroundingsEditParts(feature).forEach(({ coordinates, closed }, part) => {
          const count = closed ? coordinates.length - 1 : coordinates.length;
          for (let index = 0; index < count; index += 1) {
            const [lon, lat] = coordinates[index];
            const [x, z] = project(lat, lon);
            vertices.push({ feature: featureIndex, part, index, x, z });
          }
        });
      });
      return vertices;
    },

    // A place of the layout (metres) in the scene, over the ground.
    surroundingsEditToScene(x, z) {
      const objects = Viewer.surroundingsObjects;
      const y = surroundingsTerrainHeight(objects.layout, x, z) + LIFT;
      return objects.group.localToWorld(new THREE.Vector3(x, y, z));
    },

    // A place of the layout on the screen (CSS pixels in the page), or null
    // behind the camera.
    surroundingsEditToScreen(x, z) {
      const point = Viewer.surroundingsEditToScene(x, z).project(core.camera);
      if (point.z > 1) return null;
      const rect = core.renderer.domElement.getBoundingClientRect();
      return { x: rect.left + ((point.x + 1) / 2) * rect.width, y: rect.top + ((1 - point.y) / 2) * rect.height };
    },

    // Where a pointer meets the ground (the layout's plane), in metres.
    surroundingsEditFromPointer(event) {
      const objects = Viewer.surroundingsObjects;
      const canvas = core.renderer?.domElement;
      if (!objects || !canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, core.camera);
      const inverse = objects.group.matrixWorld.clone().invert();
      const ray = raycaster.ray.clone().applyMatrix4(inverse);
      const hit = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
      return hit ? [hit.x, hit.z] : null;
    },

    // ---- pointer and keys ---------------------------------------------------

    surroundingsEditPointer(phase, event) {
      const edit = Viewer.surroundingsEdit;
      if (!edit.active || !Viewer.surroundingsObjects || !Viewer.surroundingsOldMap.aiGeojson) return;
      const canvas = core.renderer?.domElement;
      if (phase === "down") {
        if (event.target !== canvas || event.button !== 0) return;
        edit.down = { x: event.clientX, y: event.clientY };
        if (edit.adding) return;
        const vertex = Viewer.nearestSurroundingsEditVertex(event.clientX, event.clientY);
        if (!vertex) return;
        // A point taken: dragged, not the camera.
        event.stopPropagation();
        event.preventDefault();
        if (core.controls) core.controls.enabled = false;
        edit.drag = { ...vertex, before: JSON.stringify(Viewer.surroundingsOldMap.aiGeojson), moved: false };
        edit.selected = vertex.feature;
        Viewer.drawSurroundingsEditOverlay();
        Viewer.syncSurroundingsPanel?.();
        return;
      }
      if (phase === "move") {
        if (!edit.drag) return;
        const place = Viewer.surroundingsEditFromPointer(event);
        if (!place) return;
        Viewer.setSurroundingsEditVertex(edit.drag, place);
        edit.drag.moved = true;
        Viewer.drawSurroundingsEditOverlay();
        return;
      }
      // Up: the end of a drag, or a click.
      const down = edit.down;
      edit.down = null;
      if (edit.drag) {
        const drag = edit.drag;
        edit.drag = null;
        if (core.controls) core.controls.enabled = true;
        if (drag.moved) {
          const feature = Viewer.surroundingsOldMap.aiGeojson.features[drag.feature];
          if (feature) feature.properties = { ...feature.properties, edited: true };
          Viewer.pushSurroundingsEditHistory(drag.before);
          Viewer.applySurroundingsEdit();
        }
        return;
      }
      if (!down || event.target !== canvas || Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_SLOP) return;
      if (edit.adding) {
        const place = Viewer.surroundingsEditFromPointer(event);
        if (place) edit.adding.points.push(place);
        Viewer.drawSurroundingsEditOverlay();
        Viewer.syncSurroundingsPanel?.();
        return;
      }
      edit.selected = Viewer.nearestSurroundingsEditFeature(event.clientX, event.clientY);
      Viewer.drawSurroundingsEditOverlay();
      Viewer.syncSurroundingsPanel?.();
    },

    surroundingsEditKey(event) {
      const edit = Viewer.surroundingsEdit;
      if (!edit.active) return;
      const target = event.target;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      let handled = true;
      if ((event.key === "Delete" || event.key === "Backspace") && edit.selected >= 0 && !edit.adding) Viewer.deleteSurroundingsEditFeature();
      else if (event.key === "Enter" && edit.adding) Viewer.finishSurroundingsDrawing();
      else if (event.key === "Escape" && edit.adding) Viewer.drawSurroundingsFeature(null);
      else if (event.key === "Escape" && edit.selected >= 0) {
        edit.selected = -1;
        Viewer.drawSurroundingsEditOverlay();
        Viewer.syncSurroundingsPanel?.();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") Viewer.undoSurroundingsEdit();
      else handled = false;
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    },

    nearestSurroundingsEditVertex(clientX, clientY) {
      let best = null;
      let bestDistance = POINT_REACH;
      Viewer.surroundingsEditVertices().forEach((vertex) => {
        const screen = Viewer.surroundingsEditToScreen(vertex.x, vertex.z);
        if (!screen) return;
        const distance = Math.hypot(screen.x - clientX, screen.y - clientY);
        // The selected feature's points first where they overlap.
        const weight = vertex.feature === Viewer.surroundingsEdit.selected ? distance - 2 : distance;
        if (weight < bestDistance) {
          bestDistance = weight;
          best = vertex;
        }
      });
      return best;
    },

    nearestSurroundingsEditFeature(clientX, clientY) {
      const features = Viewer.surroundingsOldMap.aiGeojson?.features || [];
      const { project } = Viewer.surroundingsEditProjection();
      let best = -1;
      let bestDistance = LINE_REACH;
      features.forEach((feature, featureIndex) => {
        Viewer.surroundingsEditParts(feature).forEach(({ coordinates }) => {
          const screens = coordinates.map(([lon, lat]) => Viewer.surroundingsEditToScreen(...project(lat, lon)));
          for (let index = 0; index < screens.length - 1; index += 1) {
            const a = screens[index];
            const b = screens[index + 1];
            if (!a || !b) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const length = dx * dx + dy * dy || 1;
            const s = Math.min(1, Math.max(0, ((clientX - a.x) * dx + (clientY - a.y) * dy) / length));
            const distance = Math.hypot(clientX - (a.x + dx * s), clientY - (a.y + dy * s));
            if (distance < bestDistance) {
              bestDistance = distance;
              best = featureIndex;
            }
          }
        });
      });
      return best;
    },

    // ---- changes --------------------------------------------------------------

    setSurroundingsEditVertex({ feature, part, index }, [x, z]) {
      const target = Viewer.surroundingsOldMap.aiGeojson?.features[feature];
      const entry = Viewer.surroundingsEditParts(target)[part];
      if (!entry) return;
      const { unproject } = Viewer.surroundingsEditProjection();
      const [lon, lat] = unproject(x, z);
      const value = [Math.round(lon * 1e7) / 1e7, Math.round(lat * 1e7) / 1e7];
      entry.coordinates[index] = value;
      // A ring's first point is its last too.
      if (entry.closed && index === 0) entry.coordinates[entry.coordinates.length - 1] = [...value];
    },

    pushSurroundingsEditHistory(before) {
      const history = Viewer.surroundingsEdit.history;
      history.push(before);
      if (history.length > HISTORY) history.shift();
    },

    // The reading changed: the surroundings drawn again from it.
    applySurroundingsEdit() {
      const old = Viewer.surroundingsOldMap;
      if (old.aiGeojson) {
        old.aiGeojson.properties = { ...old.aiGeojson.properties, checked_by_hand: true };
        old.aiAnswer = mapGeoJsonToAnswer(old.aiGeojson);
      }
      if (Viewer.surroundings.enabled) Viewer.rebuildSurroundings();
      Viewer.syncSurroundingsBadge?.();
      Viewer.drawSurroundingsEditOverlay();
      Viewer.syncSurroundingsPanel?.();
    },

    deleteSurroundingsEditFeature(index = Viewer.surroundingsEdit.selected) {
      const features = Viewer.surroundingsOldMap.aiGeojson?.features;
      if (!features?.[index]) return false;
      Viewer.pushSurroundingsEditHistory(JSON.stringify(Viewer.surroundingsOldMap.aiGeojson));
      features.splice(index, 1);
      Viewer.surroundingsEdit.selected = -1;
      Viewer.applySurroundingsEdit();
      return true;
    },

    undoSurroundingsEdit() {
      const edit = Viewer.surroundingsEdit;
      const before = edit.history.pop();
      if (!before) return false;
      Viewer.surroundingsOldMap.aiGeojson = JSON.parse(before);
      edit.selected = -1;
      Viewer.applySurroundingsEdit();
      return true;
    },

    // Drawing a new feature of `kind` (null: stop drawing).
    drawSurroundingsFeature(kind) {
      const edit = Viewer.surroundingsEdit;
      if (kind && !edit.active) Viewer.setSurroundingsEditing(true);
      edit.adding = kind && SURROUNDINGS_EDIT_KINDS.includes(kind) && edit.active ? { kind, points: [] } : null;
      edit.selected = -1;
      Viewer.drawSurroundingsEditOverlay();
      Viewer.syncSurroundingsPanel?.();
      return Boolean(edit.adding);
    },

    // The drawn points become a feature: a line from two, an outline from
    // three (else nothing).
    finishSurroundingsDrawing() {
      const edit = Viewer.surroundingsEdit;
      const adding = edit.adding;
      if (!adding) return false;
      edit.adding = null;
      const polygon = POLYGONS.has(adding.kind);
      // A double-click's two clicks put the last point twice.
      const points = adding.points.filter((point, index, list) => index === 0 || Math.hypot(point[0] - list[index - 1][0], point[1] - list[index - 1][1]) > 0.5);
      if (points.length < (polygon ? 3 : 2)) {
        Viewer.drawSurroundingsEditOverlay();
        Viewer.syncSurroundingsPanel?.();
        return false;
      }
      const { unproject } = Viewer.surroundingsEditProjection();
      const coordinates = points.map(([x, z]) => unproject(x, z).map((value) => Math.round(value * 1e7) / 1e7));
      const old = Viewer.surroundingsOldMap;
      Viewer.pushSurroundingsEditHistory(JSON.stringify(old.aiGeojson));
      old.aiGeojson.features.push({
        type: "Feature",
        properties: { kind: adding.kind, source: "hand", ...(NEW_PROPERTIES[adding.kind] || {}) },
        geometry: polygon ? { type: "Polygon", coordinates: [[...coordinates, [...coordinates[0]]]] } : { type: "LineString", coordinates },
      });
      edit.selected = old.aiGeojson.features.length - 1;
      Viewer.applySurroundingsEdit();
      return true;
    },

    // ---- drawing the reading over the ground -----------------------------------

    drawSurroundingsEditOverlay() {
      const edit = Viewer.surroundingsEdit;
      const objects = Viewer.surroundingsObjects;
      objects?.group.children.filter((child) => child.name === "surroundings-edit").forEach((child) => {
        child.removeFromParent();
        child.traverse((object) => {
          object.geometry?.dispose();
          object.material?.dispose();
        });
      });
      if (!edit.active) return;
      // Gone (another map, another model): editing ends.
      if (!Viewer.canEditSurroundingsReading()) {
        Viewer.setSurroundingsEditing(false);
        return;
      }
      const layout = objects.layout;
      const at = (x, z) => new THREE.Vector3(x, surroundingsTerrainHeight(layout, x, z) + LIFT, z);
      const group = new THREE.Group();
      group.name = "surroundings-edit";
      const line = (points, closed, colour, opacity) => {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity, depthTest: false, depthWrite: false });
        const object = closed ? new THREE.LineLoop(geometry, material) : new THREE.Line(geometry, material);
        object.renderOrder = 20;
        group.add(object);
      };
      const dots = (points, colour, size) => {
        if (!points.length) return;
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.PointsMaterial({ color: colour, size, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true });
        const object = new THREE.Points(geometry, material);
        object.renderOrder = 21;
        group.add(object);
      };
      const { project } = Viewer.surroundingsEditProjection();
      const corners = [];
      const chosen = [];
      (Viewer.surroundingsOldMap.aiGeojson.features || []).forEach((feature, featureIndex) => {
        const selected = featureIndex === edit.selected;
        const colour = selected ? 0xffffff : COLOURS[feature.properties?.kind] ?? 0xffffff;
        Viewer.surroundingsEditParts(feature).forEach(({ coordinates, closed }) => {
          const points = (closed ? coordinates.slice(0, -1) : coordinates).map(([lon, lat]) => at(...project(lat, lon)));
          if (points.length < 2) return;
          line(points, closed, colour, selected ? 1 : 0.9);
          (selected ? chosen : corners).push(...points);
        });
      });
      dots(corners, 0xffffff, 7);
      dots(chosen, 0xf5a524, 11);
      if (edit.adding) {
        const points = edit.adding.points.map(([x, z]) => at(x, z));
        if (points.length > 1) line(points, false, COLOURS[edit.adding.kind] ?? 0xffffff, 1);
        dots(points, COLOURS[edit.adding.kind] ?? 0xffffff, 10);
      }
      group.traverse((object) => {
        object.raycast = () => {};
        object.frustumCulled = false;
      });
      objects.group.add(group);
    },
  });
}

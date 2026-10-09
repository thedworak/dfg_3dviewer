import { core } from "../core.js";
import { hasIfcProperties, showIfcProperties, closeIfcPanel } from "../ifc-properties.js";
import THREE from "../init.js";
import TWEEN from "three/examples/jsm/libs/tween.module.js";

function getNormalizedPointerPosition(Viewer, clientX, clientY, targetVector) {
  targetVector.x =
    ((clientX - Viewer.mainCanvas.getBoundingClientRect().left) /
      core.renderer.domElement.clientWidth) *
    2 -
    1;
  targetVector.y =
    -(
      (clientY - Viewer.mainCanvas.getBoundingClientRect().top) /
      core.renderer.domElement.clientHeight
    ) *
    2 +
    1;
}

function getPrimaryModelIntersection(Viewer, pointerVector) {
  Viewer.raycaster.setFromCamera(pointerVector, core.camera);
  let intersects = [];

  if (core.mainObject.length > 1) {
    for (let ii = 0; ii < core.mainObject.length; ii++) {
      intersects.push(
        ...Viewer.raycaster.intersectObjects(
          core.mainObject[ii].children,
          true
        )
      );
    }
    if (intersects.length <= 0) {
      intersects = Viewer.raycaster.intersectObjects(core.mainObject, true);
    }
  } else if (core.mainObject[0]) {
    intersects = Viewer.raycaster.intersectObject(core.mainObject[0], true);
  }

  return Viewer.getPrimaryIntersection(intersects);
}

function getPoiHit(Viewer, pointerVector) {
  Viewer.raycaster.setFromCamera(pointerVector, core.camera);
  const poiIntersects = Viewer.raycaster.intersectObjects(
    Viewer.annotationPOIMarkers || [],
    true
  );
  return poiIntersects.find(
    (entry) => entry?.object?.userData?.isAnnotationPOI === true
  ) || null;
}

// Double tap (touch) / double click (mouse) on the canvas: fly towards the
// point under it; on empty space, back to the whole model (resetCamera).
const DOUBLE_TAP_MS = 350;       // between the two taps
const TAP_MAX_MS = 300;          // a press longer than this is not a tap
const TAP_MAX_MOVE_PX = 10;      // finger jitter allowed within one tap
const DOUBLE_TAP_MAX_GAP_PX = 30; // between the two taps
const FOCUS_ZOOM = 0.5;          // camera distance kept after a focus
const FOCUS_DURATION_MS = 450;

export function attachPicking(Viewer) {
  Object.assign(Viewer, {
    // Not while taps place points (ruler, face picking), when interaction is
    // off, or over an annotation marker (its own tap opens the annotation).
    canFocusOnDoubleTap(clientX, clientY) {
      if (Viewer.pickingMode || Viewer.RULER_MODE) return false;
      if (!core.camera || !core.controls || core.controls.enabled === false) return false;
      const pointer = new THREE.Vector2();
      getNormalizedPointerPosition(Viewer, clientX, clientY, pointer);
      return !getPoiHit(Viewer, pointer);
    },

    focusCameraAt(clientX, clientY) {
      const pointer = new THREE.Vector2();
      getNormalizedPointerPosition(Viewer, clientX, clientY, pointer);
      const hit = getPrimaryModelIntersection(Viewer, pointer);
      if (!hit?.point) {
        Viewer.resetCamera();
        return;
      }

      // Keep the viewing direction: the camera moves along with the point
      // it now orbits around, and comes closer.
      const target = hit.point.clone();
      const offset = core.camera.position.clone().sub(core.controls.target);
      if (core.camera.isPerspectiveCamera) {
        const distance = Math.max(offset.length() * FOCUS_ZOOM, core.controls.minDistance || 0, 1e-3);
        offset.setLength(distance);
      } else {
        const zoom = { value: core.camera.zoom };
        new TWEEN.Tween(zoom)
          .to({ value: Math.min(core.camera.zoom / FOCUS_ZOOM, core.controls.maxZoom ?? Infinity) }, FOCUS_DURATION_MS)
          .easing(TWEEN.Easing.Quadratic.Out)
          .onUpdate(() => {
            core.camera.zoom = zoom.value;
            core.camera.updateProjectionMatrix();
          })
          .start();
      }
      Viewer.animateKeyboardCameraTo(target.clone().add(offset), target, FOCUS_DURATION_MS);
    },

    // Mouse: the browser's dblclick. Touch and pen: two quick taps close
    // together, detected here - the canvas has touch-action: none, so the
    // browser does not report them as dblclick reliably. A second finger
    // (pinch) cancels the tap.
    bindDoubleTapFocus() {
      const canvas = core.renderer.domElement;
      const activeTouches = new Map();
      let lastTap = null;

      Viewer.bindEventListener(canvas, "dblclick", (event) => {
        if (!Viewer.canFocusOnDoubleTap(event.clientX, event.clientY)) return;
        Viewer.focusCameraAt(event.clientX, event.clientY);
      });

      Viewer.bindEventListener(canvas, "pointerdown", (event) => {
        if (event.pointerType === "mouse") return;
        activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY, time: event.timeStamp, multi: activeTouches.size > 0 });
        if (activeTouches.size > 1) {
          activeTouches.forEach((touch) => { touch.multi = true; });
          lastTap = null;
        }
      });

      const release = (event) => {
        const touch = activeTouches.get(event.pointerId);
        activeTouches.delete(event.pointerId);
        return touch;
      };
      Viewer.bindEventListener(canvas, "pointercancel", release);

      Viewer.bindEventListener(canvas, "pointerup", (event) => {
        if (event.pointerType === "mouse") return;
        const touch = release(event);
        if (!touch || touch.multi) return;
        const isTap =
          event.timeStamp - touch.time <= TAP_MAX_MS &&
          Math.hypot(event.clientX - touch.x, event.clientY - touch.y) <= TAP_MAX_MOVE_PX;
        if (!isTap) {
          lastTap = null;
          return;
        }
        const isDouble =
          lastTap &&
          event.timeStamp - lastTap.time <= DOUBLE_TAP_MS &&
          Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) <= DOUBLE_TAP_MAX_GAP_PX;
        if (!isDouble) {
          lastTap = { x: event.clientX, y: event.clientY, time: event.timeStamp };
          return;
        }
        lastTap = null;
        if (Viewer.canFocusOnDoubleTap(event.clientX, event.clientY)) {
          Viewer.focusCameraAt(event.clientX, event.clientY);
        }
      });
    },

    createTriangleGeometry(intersection) {
      const position = intersection?.object?.geometry?.attributes?.position;
      const face = intersection?.face;

      if (!position || !face) return null;

      const trianglePositions = new Float32Array([
        position.getX(face.a), position.getY(face.a), position.getZ(face.a),
        position.getX(face.b), position.getY(face.b), position.getZ(face.b),
        position.getX(face.c), position.getY(face.c), position.getZ(face.c),
      ]);

      const triangleGeometry = new THREE.BufferGeometry();
      triangleGeometry.setAttribute("position", new THREE.BufferAttribute(trianglePositions, 3));
      triangleGeometry.computeVertexNormals();

      return triangleGeometry;
    },

    createPickingFaceOverlay(intersection, options = {}) {
      const triangleGeometry = Viewer.createTriangleGeometry(intersection);
      if (!triangleGeometry) return null;
      return Viewer.createPickingOverlayFromGeometry(triangleGeometry, options);
    },

    createPickingOverlayFromGeometry(triangleGeometry, options = {}) {
      const fillColor = options.fillColor ?? 0xff0000;
      const lineColor = options.lineColor ?? 0xffffff;
      const opacity = options.opacity ?? 0.65;

      const overlayMaterial = new THREE.MeshBasicMaterial({
        color: fillColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
        toneMapped: false,
      });

      const fillMesh = new THREE.Mesh(triangleGeometry, overlayMaterial);
      fillMesh.renderOrder = 999;

      const lineGeometry = new THREE.EdgesGeometry(triangleGeometry);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: lineColor,
        transparent: true,
        opacity: Math.min(opacity + 0.2, 1),
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
      lineSegments.renderOrder = 1000;

      const overlayGroup = new THREE.Group();
      overlayGroup.name = "picking-face-overlay";
      overlayGroup.userData.isPickingOverlay = true;
      fillMesh.userData.isPickingOverlay = true;
      lineSegments.userData.isPickingOverlay = true;
      overlayGroup.add(fillMesh);
      overlayGroup.add(lineSegments);

      return overlayGroup;
    },

    isPickingOverlayObject(object) {
      let current = object;

      while (current) {
        if (current.userData?.isPickingOverlay === true || current.name === "picking-face-overlay") {
          return true;
        }
        current = current.parent;
      }

      return false;
    },

    getPrimaryIntersection(intersections) {
      if (!Array.isArray(intersections) || intersections.length === 0) return null;

      // Raycaster ignores Object3D.visible, so skip hits on hidden objects
      // (e.g. IFC elements hidden from the properties panel) explicitly.
      const isVisible = (object) => {
        for (let node = object; node; node = node.parent) {
          if (node.visible === false) return false;
        }
        return true;
      };
      return intersections.find(
        (entry) => !Viewer.isPickingOverlayObject(entry?.object) && isVisible(entry?.object)
      ) ?? null;
    },

    getFaceSelectionKey(targetId, faceIndex) {
      if (!targetId || faceIndex === null || faceIndex === undefined) return "";
      return `${targetId}:${faceIndex}`;
    },

    findSelectedFaceIndex(targetId, faceIndex) {
      const key = Viewer.getFaceSelectionKey(targetId, faceIndex);
      return Viewer.selectedFaces.findIndex((entry) => entry.key === key);
    },

    updateSelectedFacesCount() {
      Viewer.pickingStats["Selected faces"] = Array.isArray(Viewer.selectedFaces)
        ? Viewer.selectedFaces.length
        : 0;
      const selectedFacesCount = Array.isArray(Viewer.selectedFaces) ? Viewer.selectedFaces.length : 0;
      if (selectedFacesCount < 1 && Viewer.annotationDialog && Viewer.annotationDialog.hidden === false) {
        Viewer.closeAnnotationDialog();
      }
      Viewer.updateAddAnnotationControllerState();
      Viewer.updatePickingHintVisibility();
    },

    toStableIdToken(value) {
      const normalized = String(value || "")
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      return normalized || "target";
    },

    getSelectionRootObject(object) {
      let current = object;
      while (current?.parent && current.parent !== core.scene) {
        current = current.parent;
      }
      return current || object;
    },

    getSelectionRootSlot(rootObject) {
      if (!rootObject || !Array.isArray(core.mainObject)) return -1;
      return core.mainObject.findIndex((entry) => {
        if (entry === rootObject) return true;
        return Array.isArray(entry) && entry.includes(rootObject);
      });
    },

    getObjectHierarchyPath(object, rootObject) {
      if (!object || !rootObject) return "";
      const path = [];
      let current = object;
      while (current && current !== rootObject) {
        const parent = current.parent;
        if (!parent) break;
        const index = parent.children.indexOf(current);
        path.push(index >= 0 ? String(index) : "x");
        current = parent;
      }
      return path.reverse().join(".") || "root";
    },

    resolveFaceTargetId(object) {
      if (!object) return "";

      const explicitId = object.userData?.annotationTargetId || object.userData?.id;
      if (explicitId) return String(explicitId);

      const rootObject = Viewer.getSelectionRootObject(object);
      const rootSlot = Viewer.getSelectionRootSlot(rootObject);
      const path = Viewer.getObjectHierarchyPath(object, rootObject);
      let rootTag = rootSlot >= 0 ? `m${rootSlot}` : "m0";
      if (rootSlot >= 0 && Array.isArray(core.mainObject?.[rootSlot])) {
        const rootIndex = core.mainObject[rootSlot].indexOf(rootObject);
        if (rootIndex >= 0) {
          rootTag = `${rootTag}.${rootIndex}`;
        }
      }
      const targetId = `${rootTag}:${path}`;

      object.userData ??= {};
      object.userData.annotationTargetId = targetId;
      return targetId;
    },

    resolveObjectByTargetId(targetId) {
      const raw = String(targetId || "").trim();
      const match = raw.match(/^m(\d+)(?:\.(\d+))?:(.+)$/);
      if (!match) return null;

      const slot = Number.parseInt(match[1], 10);
      const rootIndex = Number.parseInt(match[2] || "0", 10);
      const path = match[3] || "root";
      if (!Number.isInteger(slot) || slot < 0) return null;

      const entry = core.mainObject?.[slot];
      if (!entry) return null;
      let rootObject = Array.isArray(entry) ? entry[rootIndex] : entry;
      if (!rootObject) return null;

      if (path === "root") return rootObject;
      const segments = path.split(".").filter(Boolean);
      for (const segment of segments) {
        const childIndex = Number.parseInt(segment, 10);
        if (!Number.isInteger(childIndex) || childIndex < 0) return null;
        rootObject = rootObject.children?.[childIndex];
        if (!rootObject) return null;
      }

      return rootObject;
    },

    getFaceCentroidWorld(object, faceIndex) {
      const vertices = Viewer.getFaceVerticesWorld(object, faceIndex);
      if (!vertices) return null;
      const [va, vb, vc] = vertices;
      return va.add(vb).add(vc).multiplyScalar(1 / 3);
    },

    // Unit normal of a triangle in world space (winding order), or null for
    // a missing or degenerate face.
    getFaceNormalWorld(object, faceIndex) {
      const vertices = Viewer.getFaceVerticesWorld(object, faceIndex);
      if (!vertices) return null;
      const [va, vb, vc] = vertices;
      const normal = new THREE.Vector3().subVectors(vc, vb).cross(new THREE.Vector3().subVectors(va, vb));
      if (normal.lengthSq() === 0) return null;
      return normal.normalize();
    },

    getFaceVerticesWorld(object, faceIndex) {
      const vertices = Viewer.getFaceVerticesLocal(object, faceIndex);
      if (!vertices) return null;
      object.updateMatrixWorld?.(true);
      return vertices.map((vertex) => vertex.applyMatrix4(object.matrixWorld));
    },

    getFaceVerticesLocal(object, faceIndex) {
      const geometry = object?.geometry;
      if (!geometry || !geometry.getAttribute) return null;
      const position = geometry.getAttribute("position");
      if (!position) return null;
      const face = Number(faceIndex);
      if (!Number.isInteger(face) || face < 0) return null;

      let ia = face * 3;
      let ib = ia + 1;
      let ic = ia + 2;
      const index = geometry.getIndex?.() || geometry.index || null;
      if (index?.array) {
        const arr = index.array;
        if (ic >= arr.length) return null;
        ia = arr[ia];
        ib = arr[ib];
        ic = arr[ic];
      } else if (ic >= position.count) {
        return null;
      }

      const va = new THREE.Vector3().fromBufferAttribute(position, ia);
      const vb = new THREE.Vector3().fromBufferAttribute(position, ib);
      const vc = new THREE.Vector3().fromBufferAttribute(position, ic);
      return [va, vb, vc];
    },

    clearSelectedFaces() {
      if (!Array.isArray(Viewer.selectedFaces) || Viewer.selectedFaces.length === 0) {
        Viewer.updateSelectedFacesCount();
        return;
      }

      Viewer.selectedFaces.length = 0;
      Viewer.scheduleSelectionOverlayRefresh();
      Viewer.updateSelectedFacesCount();
    },

    // Selected faces are drawn as one merged overlay per mesh (fill plus the
    // outline of the selected region) instead of one mesh per face, so that
    // area selections of thousands of faces stay cheap. Changes made in the
    // same task are coalesced into a single rebuild.
    scheduleSelectionOverlayRefresh() {
      if (Viewer.selectionOverlayRefreshPending) return;
      Viewer.selectionOverlayRefreshPending = true;
      queueMicrotask(() => {
        Viewer.selectionOverlayRefreshPending = false;
        Viewer.refreshSelectionOverlays();
      });
    },

    disposeSelectionOverlays() {
      (Viewer.selectionOverlays || []).forEach((overlay) => {
        overlay.removeFromParent();
        Viewer.disposeObjectResources(overlay);
      });
      Viewer.selectionOverlays = [];
    },

    refreshSelectionOverlays() {
      Viewer.disposeSelectionOverlays();
      const facesByObject = new Map();
      (Viewer.selectedFaces || []).forEach((entry) => {
        const object = Viewer.resolveObjectByTargetId(entry.targetId);
        if (!object?.geometry) return;
        if (!facesByObject.has(object)) facesByObject.set(object, []);
        facesByObject.get(object).push(entry.faceIndex);
      });

      facesByObject.forEach((faces, object) => {
        const positions = new Float32Array(faces.length * 9);
        let offset = 0;
        faces.forEach((faceIndex) => {
          const vertices = Viewer.getFaceVerticesLocal(object, faceIndex);
          if (!vertices) return;
          vertices.forEach((vertex) => {
            positions[offset++] = vertex.x;
            positions[offset++] = vertex.y;
            positions[offset++] = vertex.z;
          });
        });
        if (offset === 0) return;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions.subarray(0, offset), 3));
        const overlay = Viewer.createPickingOverlayFromGeometry(geometry, {
          fillColor: 0x00c853,
          lineColor: 0xe8ffe8,
          opacity: 0.5,
        });
        object.add(overlay);
        Viewer.selectionOverlays.push(overlay);
      });
    },

    // Adds (or with subtract removes) faces without toggling. Used by area
    // selection; hits are { object, faceIndex }.
    applyFaceSelection(hits, { subtract = false } = {}) {
      let changed = 0;
      const indexByKey = new Map(Viewer.selectedFaces.map((entry, index) => [entry.key, index]));
      const removeKeys = new Set();
      hits.forEach(({ object, faceIndex }) => {
        const targetId = Viewer.resolveFaceTargetId(object);
        if (!targetId || !Number.isInteger(faceIndex)) return;
        const key = Viewer.getFaceSelectionKey(targetId, faceIndex);
        if (subtract) {
          if (indexByKey.has(key)) removeKeys.add(key);
          return;
        }
        if (indexByKey.has(key)) return;
        indexByKey.set(key, Viewer.selectedFaces.length);
        Viewer.selectedFaces.push({
          key,
          targetId,
          object: targetId,
          runtimeObjectId: object.id,
          faceIndex,
          overlay: null,
        });
        changed += 1;
      });
      if (removeKeys.size) {
        // In place: other modules keep a reference to this array.
        let kept = 0;
        Viewer.selectedFaces.forEach((entry) => {
          if (!removeKeys.has(entry.key)) Viewer.selectedFaces[kept++] = entry;
        });
        Viewer.selectedFaces.length = kept;
        changed += removeKeys.size;
      }
      if (changed) {
        Viewer.scheduleSelectionOverlayRefresh();
        Viewer.updateSelectedFacesCount();
      }
      return changed;
    },

    restoreLastPickedFace() {
      if (!Viewer.lastPickedFace.overlay) {
        Viewer.lastPickedFace = { id: "", object: "", faceIndex: null, overlay: null };
        return;
      }

      Viewer.disposeFaceOverlay(Viewer.lastPickedFace);
      Viewer.lastPickedFace = { id: "", object: "", faceIndex: null, overlay: null };
    },

    pickFaces(intersection) {
      const hoveredObjectId = intersection?.object?.id ?? "";
      const hoveredFaceIndex = intersection?.faceIndex ?? null;
      if (!hoveredObjectId) {
        Viewer.restoreLastPickedFace();
        return;
      }

      if (
        Viewer.lastPickedFace.object === hoveredObjectId &&
        Viewer.lastPickedFace.faceIndex === hoveredFaceIndex
      ) {
        return;
      }

      Viewer.restoreLastPickedFace();
      const overlay = Viewer.createPickingFaceOverlay(intersection, {
        fillColor: 0xff3b30,
        lineColor: 0xffffff,
        opacity: 0.4,
      });
      if (!overlay) return;

      Viewer.lastPickedFace = {
        id: hoveredObjectId,
        object: hoveredObjectId,
        faceIndex: hoveredFaceIndex,
        overlay,
      };

      intersection.object.add(overlay);
    },

    toggleSelectedFace(intersection, options = {}) {
      const targetId = Viewer.resolveFaceTargetId(intersection?.object);
      const runtimeObjectId = intersection?.object?.id ?? "";
      const faceIndex = intersection?.faceIndex ?? null;
      if (!targetId || faceIndex === null) return;

      const multiSelect = options.multiSelect === true;
      const selectedFaceIndex = Viewer.findSelectedFaceIndex(targetId, faceIndex);

      if (!multiSelect) {
        const clickedFaceKey = Viewer.getFaceSelectionKey(targetId, faceIndex);
        const clickedFaceAlreadySelected =
          selectedFaceIndex >= 0 && Viewer.selectedFaces.length === 1 &&
          Viewer.selectedFaces[0]?.key === clickedFaceKey;

        Viewer.clearSelectedFaces();

        if (clickedFaceAlreadySelected) {
          return;
        }
      }

      if (selectedFaceIndex >= 0) {
        Viewer.selectedFaces.splice(selectedFaceIndex, 1);
        Viewer.scheduleSelectionOverlayRefresh();
        Viewer.updateSelectedFacesCount();
        return;
      }

      Viewer.selectedFaces.push({
        key: Viewer.getFaceSelectionKey(targetId, faceIndex),
        targetId,
        object: targetId,
        runtimeObjectId,
        faceIndex,
        overlay: null,
      });
      Viewer.scheduleSelectionOverlayRefresh();
      Viewer.updateSelectedFacesCount();
    },

    onPointerDown(e) {
      Viewer.disableInteractionHint();
      e.stopPropagation();
      if (e.button === 0) {
        getNormalizedPointerPosition(Viewer, e.clientX, e.clientY, Viewer.onDownPosition);
      }
    },

    onPointerUp(e) {
      if (e.button !== 0) return;

      getNormalizedPointerPosition(Viewer, e.clientX, e.clientY, Viewer.onUpPosition);
      if (
        Viewer.onUpPosition.x !== Viewer.onDownPosition.x ||
        Viewer.onUpPosition.y !== Viewer.onDownPosition.y
      ) {
        return;
      }

      if (Viewer.handleViewHelperClick(e)) return;

      if (!Viewer.pickingMode && !Viewer.RULER_MODE) {
        const poiHit = getPoiHit(Viewer, Viewer.onUpPosition);
        if (poiHit?.object) {
          if (!Viewer.goToTourStepForMarker(poiHit.object)) {
            Viewer.openAnnotationDialogFromPOIMarker(poiHit.object);
          }
          return;
        }
        Viewer.closeAnnotationPOITooltip();
        if (hasIfcProperties()) {
          const hit = getPrimaryModelIntersection(Viewer, Viewer.onUpPosition);
          if (!hit || !showIfcProperties(hit.object, hit)) closeIfcPanel();
        }
      }

      if (Viewer.pickingMode || Viewer.RULER_MODE) {
        const primaryIntersection = getPrimaryModelIntersection(Viewer, Viewer.onUpPosition);
        if (!primaryIntersection) return;

        if (Viewer.RULER_MODE) {
          Viewer.buildRuler(primaryIntersection);
        } else if (Viewer.pickingMode) {
          // Ctrl/Cmd + click adds or removes a face; Shift + click is kept
          // for compatibility (Shift + drag selects an area, see
          // face-area-selection.js).
          Viewer.toggleSelectedFace(primaryIntersection, {
            multiSelect: e.ctrlKey || e.metaKey || e.shiftKey,
          });
        }
      }
    },

    onPointerMove(e) {
      getNormalizedPointerPosition(Viewer, e.clientX, e.clientY, Viewer.pointer);
      if (e.buttons !== 0) {
        Viewer.disableInteractionHint();
        Viewer.closeAnnotationPOITooltip();
      }
      if (e.buttons == 1) {
        if (Viewer.pointer.x !== Viewer.onDownPosition.x && Viewer.pointer.y !== Viewer.onDownPosition.y) {
          Viewer.cameraLight.position.set(
            core.camera.position.x,
            core.camera.position.y,
            core.camera.position.z
          );
        }
        return;
      }

      if (!Viewer.pickingMode && !Viewer.RULER_MODE) {
        if (Viewer.annotationDialog && Viewer.annotationDialog.hidden === false) {
          Viewer.closeAnnotationPOITooltip();
        } else {
          const poiHit = getPoiHit(Viewer, Viewer.pointer);
          if (poiHit?.object) {
            Viewer.openAnnotationPOITooltip(poiHit.object);
          } else {
            Viewer.closeAnnotationPOITooltip();
          }
        }
      }

      if (Viewer.pickingMode) {
        const primaryIntersection = getPrimaryModelIntersection(Viewer, Viewer.pointer);
        if (primaryIntersection) {
          Viewer.pickFaces(primaryIntersection);
        } else {
          Viewer.pickFaces("");
        }
      }
    },
  });
}

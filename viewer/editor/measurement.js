import { core } from "../core.js";
import { distanceBetweenPointsVector, vectorBetweenPoints, halfwayBetweenPoints, interpolateDistanceBetweenPoints } from "../utils.js";
import { toastHelper } from "../viewer-utils.js";
import THREE from "../init.js";

export function attachMeasurement(Viewer) {
  Object.assign(Viewer, {
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

      return intersections.find((entry) => !Viewer.isPickingOverlayObject(entry?.object)) ?? null;
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

    getFaceCentroidWorld(object, faceIndex) {
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
      const center = va.add(vb).add(vc).multiplyScalar(1 / 3);
      object.updateMatrixWorld?.(true);
      center.applyMatrix4(object.matrixWorld);
      return center;
    },

    clearSelectedFaces() {
      if (!Array.isArray(Viewer.selectedFaces) || Viewer.selectedFaces.length === 0) {
        Viewer.updateSelectedFacesCount();
        return;
      }

      Viewer.selectedFaces.forEach((entry) => {
        Viewer.disposeFaceOverlay(entry);
      });
      Viewer.selectedFaces.length = 0;
      Viewer.updateSelectedFacesCount();
    },

    restoreLastPickedFace() {
      if (!Viewer.lastPickedFace.overlay) {
        Viewer.lastPickedFace = { id: "", object: "", faceIndex: null, overlay: null };
        return;
      }

      Viewer.disposeFaceOverlay(Viewer.lastPickedFace);

      Viewer.lastPickedFace = { id: "", object: "", faceIndex: null, overlay: null };
    },

    pickFaces(_id) {
      const hoveredObjectId = _id?.object?.id ?? "";
      const hoveredFaceIndex = _id?.faceIndex ?? null;
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
      const overlay = Viewer.createPickingFaceOverlay(_id, {
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

      _id.object.add(overlay);
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
        const [selectedFace] = Viewer.selectedFaces.splice(selectedFaceIndex, 1);
        Viewer.disposeFaceOverlay(selectedFace);
        Viewer.updateSelectedFacesCount();
        return;
      }

      const overlay = Viewer.createPickingFaceOverlay(intersection, {
        fillColor: 0x00c853,
        lineColor: 0xe8ffe8,
        opacity: 0.5,
      });
      if (!overlay) return;

      intersection.object.add(overlay);
      Viewer.selectedFaces.push({
        key: Viewer.getFaceSelectionKey(targetId, faceIndex),
        targetId,
        object: targetId,
        runtimeObjectId,
        faceIndex,
        overlay,
      });
      Viewer.updateSelectedFacesCount();
    },

    buildRuler(_id) {
      Viewer.rulerObject = new THREE.Object3D();
      const gridSize = Viewer.gridSize || core.gridSize || 1;
      const sphereRadius = Math.max(gridSize / 150, 0.001);
      const textScale = Math.max(gridSize / 100, 0.01);
      const measureSize = Math.max(gridSize / 200, 0.01);

      var sphere = new THREE.Mesh(
        new THREE.SphereGeometry(sphereRadius, 7, 7),
        new THREE.MeshStandardMaterial({
          color: 0xff0000,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
        })
      );
      var newPoint = new THREE.Vector3(_id.point.x, _id.point.y, _id.point.z);
      sphere.position.set(newPoint.x, newPoint.y, newPoint.z);
      Viewer.rulerObject.add(sphere);
      Viewer.linePoints.push(newPoint);
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(Viewer.linePoints);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      Viewer.rulerObject.add(line);
      var lineMtr = new THREE.LineBasicMaterial({
        color: 0x0000ff,
        linewidth: 3,
        opacity: 1,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      });
      if (Viewer.linePoints.length > 1) {
        var vectorPoints = vectorBetweenPoints(
          Viewer.linePoints[Viewer.linePoints.length - 2],
          newPoint
        );
        var distancePoints = distanceBetweenPointsVector(vectorPoints);
        const measuredDistance = Viewer.formatMeasuredDistance(distancePoints);

        //var distancePoints = distanceBetweenPoints(Viewer.linePoints[Viewer.linePoints.length-2], newPoint);
        var halfwayPoints = halfwayBetweenPoints(
          Viewer.linePoints[Viewer.linePoints.length - 2],
          newPoint
        );
        Viewer.addTextPoint(measuredDistance.text, textScale, halfwayPoints);
        var rulerI = 0;
        // `measureSize` was already precomputed outside, keep same scale
        while (rulerI <= distancePoints * 100) {
          const geoSegm = [];
          var interpolatePoints = interpolateDistanceBetweenPoints(
            Viewer.linePoints[Viewer.linePoints.length - 2],
            vectorPoints,
            distancePoints,
            rulerI / 100
          );
          geoSegm.push(
            new THREE.Vector3(
              interpolatePoints.x,
              interpolatePoints.y,
              interpolatePoints.z
            )
          );
          geoSegm.push(
            new THREE.Vector3(
              interpolatePoints.x + measureSize,
              interpolatePoints.y + measureSize,
              interpolatePoints.z + measureSize
            )
          );
          const geometryLine = new THREE.BufferGeometry().setFromPoints(geoSegm);
          var lineSegm = new THREE.Line(geometryLine, lineMtr);
          Viewer.rulerObject.add(lineSegm);
          rulerI += 10;
        }
      }
      Viewer.rulerObject.renderOrder = 10;
      core.scene.add(Viewer.rulerObject);
      Viewer.ruler.push(Viewer.rulerObject);
    },
  });
}

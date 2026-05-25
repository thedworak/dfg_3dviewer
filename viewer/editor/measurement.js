import { core } from "../core.js";
import { distanceBetweenPointsVector, vectorBetweenPoints, halfwayBetweenPoints, interpolateDistanceBetweenPoints } from "../utils.js";
import THREE from "../init.js";

export function attachMeasurement(Viewer) {
  Object.assign(Viewer, {
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

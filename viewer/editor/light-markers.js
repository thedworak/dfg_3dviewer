import THREE from "../init.js";
import { core } from "../core.js";

// Where each light is, as in Blender's viewport: while the lights window
// (lights-panel.js) is open, every light the editor moves gets a small icon
// at its place - a sun for a directional light, a bulb for a point light, a
// bulb with a cone for a spot light - in its own colour, the chosen one
// ringed in gold, a switched-off one faded, and a dashed line to where a
// directional or spot light aims - for a spot light, its cone. The icons
// keep their size on screen and
// show through the model. A click on one chooses that light; on the chosen
// one the click goes to its handles (TransformControls) underneath.

// The icon's size on screen, in CSS pixels.
const MARKER_PX = 44;
const TEXTURE_PX = 128;
const GOLD = "#e9b264";
const ORDER = 999;

const textures = new Map();
const projected = new THREE.Vector3();
const worldPosition = new THREE.Vector3();
const targetPosition = new THREE.Vector3();
const axis = new THREE.Vector3();
const side = new THREE.Vector3();
const up = new THREE.Vector3();
// Segments of a spot light's cone: its rim, and four lines from the bulb.
const CONE_SEGMENTS = 32;
const CONE_SIDES = 4;

// The icon of a light, drawn once per look and kept.
function markerTexture(type, color, selected, on) {
  const key = `${type}|${color}|${selected}|${on}`;
  if (textures.has(key)) return textures.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TEXTURE_PX;
  const ctx = canvas.getContext("2d");
  const c = TEXTURE_PX / 2;
  const r = TEXTURE_PX * 0.2;
  ctx.globalAlpha = on ? 1 : 0.45;
  ctx.lineCap = "round";
  const ring = selected ? GOLD : "#ffffff";
  // Strokes twice: a dark halo, then light, readable on any background.
  const stroke = (path, width) => {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctx.lineWidth = width + 5;
    path();
    ctx.stroke();
    ctx.strokeStyle = ring;
    ctx.lineWidth = width;
    path();
    ctx.stroke();
  };
  if (type === "DirectionalLight") {
    // Sun: rays round the disc.
    stroke(() => {
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        ctx.moveTo(c + Math.cos(angle) * (r + 9), c + Math.sin(angle) * (r + 9));
        ctx.lineTo(c + Math.cos(angle) * (r + 22), c + Math.sin(angle) * (r + 22));
      }
    }, 6);
  } else if (type === "SpotLight") {
    // Spot: a cone opening below the bulb.
    stroke(() => {
      ctx.beginPath();
      ctx.moveTo(c - r * 0.7, c + r * 0.7);
      ctx.lineTo(c - r - 16, c + r + 24);
      ctx.moveTo(c + r * 0.7, c + r * 0.7);
      ctx.lineTo(c + r + 16, c + r + 24);
    }, 6);
  }
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  stroke(() => {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
  }, selected ? 8 : 6);
  if (type === "PointLight") {
    // Point: a dot in the bulb, as Blender's.
    ctx.beginPath();
    ctx.arc(c, c, r * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = ring;
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textures.set(key, texture);
  return texture;
}

function makeMarker() {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    depthTest: false,
    depthWrite: false,
    transparent: true,
  }));
  sprite.renderOrder = ORDER;
  // Chosen by a click on the screen (pickLightMarker), never by the
  // scene's raycasts (picking, measuring).
  sprite.raycast = () => {};
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false }),
  );
  line.renderOrder = ORDER;
  line.raycast = () => {};
  line.frustumCulled = false;
  const cone = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array((CONE_SEGMENTS + CONE_SIDES) * 2 * 3), 3)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthTest: false, depthWrite: false }),
  );
  cone.renderOrder = ORDER;
  cone.raycast = () => {};
  cone.frustumCulled = false;
  return { sprite, line, cone };
}

// A spot light's cone, from the bulb to the plane of its target.
function placeCone(cone, light, from, to) {
  axis.subVectors(to, from);
  const length = axis.length();
  if (length < 1e-9) return;
  axis.divideScalar(length);
  const rim = Math.tan(Math.min(light.angle, Math.PI / 2 - 0.01)) * length;
  side.set(0, 1, 0);
  if (Math.abs(axis.dot(side)) > 0.99) side.set(1, 0, 0);
  up.crossVectors(axis, side).normalize();
  side.crossVectors(up, axis).normalize();
  const positions = cone.geometry.attributes.position;
  const point = (angle, target) => target.copy(to)
    .addScaledVector(side, Math.cos(angle) * rim)
    .addScaledVector(up, Math.sin(angle) * rim);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  let index = 0;
  for (let i = 0; i < CONE_SEGMENTS; i += 1) {
    point((i / CONE_SEGMENTS) * Math.PI * 2, a);
    point(((i + 1) / CONE_SEGMENTS) * Math.PI * 2, b);
    positions.setXYZ(index++, a.x, a.y, a.z);
    positions.setXYZ(index++, b.x, b.y, b.z);
  }
  for (let i = 0; i < CONE_SIDES; i += 1) {
    point((i / CONE_SIDES) * Math.PI * 2, a);
    positions.setXYZ(index++, from.x, from.y, from.z);
    positions.setXYZ(index++, a.x, a.y, a.z);
  }
  positions.needsUpdate = true;
}

// World units one CSS pixel covers at `position`, for the camera.
function worldPerPixel(camera, position, viewportHeight) {
  if (camera.isOrthographicCamera) return (camera.top - camera.bottom) / camera.zoom / viewportHeight;
  const distance = camera.position.distanceTo(position);
  return (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance) / (camera.zoom || 1) / viewportHeight;
}

export function attachLightMarkers(Viewer) {
  const markers = new Map();
  let group = null;
  let bound = false;
  let pressed = null;

  const remove = (light) => {
    const marker = markers.get(light);
    if (!marker) return;
    marker.sprite.removeFromParent();
    marker.sprite.material.dispose();
    [marker.line, marker.cone].forEach((line) => {
      line.removeFromParent();
      line.geometry.dispose();
      line.material.dispose();
    });
    markers.delete(light);
  };

  // The light whose icon is under the pointer, if any.
  const lightAt = (event) => {
    const canvas = core.renderer?.domElement;
    const camera = core.camera;
    if (!group?.visible || !canvas || !camera) return null;
    const rect = canvas.getBoundingClientRect();
    let best = null;
    let bestDistance = MARKER_PX * 0.6;
    markers.forEach((marker, light) => {
      projected.copy(marker.sprite.position).project(camera);
      if (projected.z > 1) return;
      const x = rect.left + ((projected.x + 1) / 2) * rect.width;
      const y = rect.top + ((1 - projected.y) / 2) * rect.height;
      const distance = Math.hypot(event.clientX - x, event.clientY - y);
      if (distance < bestDistance) {
        best = light;
        bestDistance = distance;
      }
    });
    return best;
  };

  // Before the camera controls, the handles and picking (capture, on the
  // canvas): a click on another light's icon chooses it and goes no further.
  const bindPicking = () => {
    const canvas = core.renderer?.domElement;
    if (bound || !canvas) return;
    bound = true;
    Viewer.bindEventListener(canvas, "pointerdown", (event) => {
      pressed = null;
      if (!event.isPrimary || event.button !== 0) return;
      const light = lightAt(event);
      if (!light || light === Viewer.getActiveLight()) return;
      pressed = { light, x: event.clientX, y: event.clientY };
      event.stopImmediatePropagation();
      event.preventDefault();
    }, { capture: true });
    Viewer.bindEventListener(canvas, "pointerup", (event) => {
      const press = pressed;
      pressed = null;
      if (!press) return;
      event.stopImmediatePropagation();
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) return;
      Viewer.setActiveLight(press.light);
    }, { capture: true });
  };

  Object.assign(Viewer, {
    // Every frame (main.js animate): the icons where the lights are.
    updateLightMarkers() {
      if (!core.scene || !core.camera) return;
      const visible = Viewer.isLightsPanelOpen?.() === true;
      if (!visible) {
        if (group) group.visible = false;
        return;
      }
      if (!group) {
        group = new THREE.Group();
        group.name = "light-markers";
        group.userData.isEditorHelper = true;
      }
      if (group.parent !== core.scene) core.scene.add(group);
      group.visible = true;
      bindPicking();

      const lights = Viewer.getEditableLights();
      [...markers.keys()].forEach((light) => {
        if (!lights.includes(light)) remove(light);
      });
      const active = Viewer.getActiveLight();
      const height = core.renderer?.domElement?.clientHeight || 1;
      const radius = core.lightBounds?.radius ?? 1;
      lights.forEach((light) => {
        let marker = markers.get(light);
        if (!marker) {
          marker = makeMarker();
          markers.set(light, marker);
          group.add(marker.sprite, marker.line, marker.cone);
        }
        light.updateWorldMatrix(true, false);
        light.getWorldPosition(worldPosition);
        const selected = light === active;
        const on = light.visible !== false;
        const map = markerTexture(light.type, `#${light.color.getHexString()}`, selected, on);
        if (marker.sprite.material.map !== map) {
          marker.sprite.material.map = map;
          marker.sprite.material.needsUpdate = true;
        }
        marker.sprite.position.copy(worldPosition);
        const size = MARKER_PX * worldPerPixel(core.camera, worldPosition, height);
        marker.sprite.scale.set(size, size, 1);

        // To where it aims.
        marker.line.visible = Boolean(light.target);
        if (light.target) {
          light.target.getWorldPosition(targetPosition);
          const positions = marker.line.geometry.attributes.position;
          positions.setXYZ(0, worldPosition.x, worldPosition.y, worldPosition.z);
          positions.setXYZ(1, targetPosition.x, targetPosition.y, targetPosition.z);
          positions.needsUpdate = true;
          marker.line.computeLineDistances();
          marker.line.material.color.set(selected ? GOLD : 0xffffff);
          marker.line.material.opacity = on ? 0.8 : 0.35;
          marker.line.material.dashSize = radius * 0.06;
          marker.line.material.gapSize = radius * 0.04;
        }
        marker.cone.visible = Boolean(light.isSpotLight && light.target);
        if (marker.cone.visible) {
          placeCone(marker.cone, light, worldPosition, targetPosition);
          marker.cone.material.color.set(selected ? GOLD : 0xffffff);
          marker.cone.material.opacity = on ? 0.7 : 0.3;
        }
      });
    },
  });
}

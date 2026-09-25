import THREE from "../init.js";
import { core } from "../core.js";

// IIIF Presentation 4 (3D) scene content beyond the models themselves, read
// from and written to plain manifest JSON (draft spec, IIIF 3D TSG; the
// vocabulary @iiif/3d-manifesto-dev implements):
//
//   cameras   painting annotations with a PerspectiveCamera (fieldOfView,
//             near, far, lookAt) or OrthographicCamera (viewHeight) body,
//             positioned by the target's PointSelector
//   lights    painting annotations with AmbientLight / DirectionalLight /
//             PointLight / SpotLight bodies: color, intensity {type: "Value",
//             unit: "relative"}, lookAt, angle (spot half-angle, degrees)
//   comments  commenting annotations (on the Scene or the Manifest) targeting
//             a point in the scene (SpecificResource + PointSelector); the
//             camera annotation referenced by its `scope` is the view to show
//             it from (as in the IIIF 3D "activating annotations" examples)
//
// Scene coordinates are the viewer's world coordinates; point annotations are
// stored relative to the model root so they follow it when it is moved.

const CAMERA_TYPES = new Set(["PerspectiveCamera", "OrthographicCamera"]);
const LIGHT_TYPES = new Set(["AmbientLight", "DirectionalLight", "PointLight", "SpotLight"]);
const COMMENT_MOTIVATIONS = new Set(["commenting", "describing", "tagging", "identifying", "linking"]);
// three.js intensity for a relative intensity of 1.
const LIGHT_INTENSITY_SCALE = { AmbientLight: 1, DirectionalLight: 3, PointLight: 3, SpotLight: 3 };

let importedLights = null;

const asArray = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);
const typeOf = (value) => value?.type || value?.["@type"] || null;

function firstLanguageValue(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const values = value.en || value.none || Object.values(value)[0];
  return asArray(values)[0] || "";
}

function pointFromSelector(selector) {
  const point = asArray(selector).find((item) => typeOf(item) === "PointSelector");
  if (!point) return null;
  const values = [point.x, point.y, point.z].map(Number);
  return values.every(Number.isFinite) ? new THREE.Vector3(...values) : null;
}

// The body itself, or the source of a SpecificResource wrapping it.
function resolveBody(body) {
  const first = asArray(body)[0];
  if (typeOf(first) === "SpecificResource" && first.source && typeof first.source === "object") {
    return { resource: first.source, wrapper: first };
  }
  return { resource: first, wrapper: null };
}

// Position a painting/commenting annotation places its body at.
function targetPoint(annotation) {
  const target = asArray(annotation?.target)[0];
  if (!target || typeof target !== "object") return null;
  return pointFromSelector(target.selector);
}

function scenesOf(manifest) {
  return asArray(manifest?.items).filter((item) => typeOf(item) === "Scene");
}

function annotationsOfPages(pages) {
  return asArray(pages)
    .filter((page) => typeOf(page) === "AnnotationPage")
    .flatMap((page) => asArray(page.items))
    .filter((annotation) => typeOf(annotation) === "Annotation");
}

function motivationsOf(annotation) {
  return asArray(annotation?.motivation).map((value) => String(value).toLowerCase());
}

// lookAt: a PointSelector, a SpecificResource with one, or the id of another
// annotation in the scene (its target point). Missing: the scene origin.
function resolveLookAt(lookAt, sceneAnnotations) {
  if (!lookAt) return new THREE.Vector3();
  if (typeOf(lookAt) === "PointSelector") return pointFromSelector(lookAt) || new THREE.Vector3();
  if (typeOf(lookAt) === "SpecificResource") return pointFromSelector(lookAt.selector) || new THREE.Vector3();
  const id = typeof lookAt === "string" ? lookAt : lookAt.id;
  const referenced = sceneAnnotations.find((annotation) => annotation.id === id);
  return (referenced && targetPoint(referenced)) || new THREE.Vector3();
}

// Orientation from the body's transforms (a SpecificResource around a camera
// or light): RotateTransforms turn the default direction - cameras face -Z,
// lights shine along -Y - and TranslateTransforms move the position.
// Rotations are in degrees about the scene's x, then y, then z axis.
function applyBodyTransforms(wrapper, defaultDirection, position) {
  const direction = defaultDirection.clone();
  const moved = position.clone();
  asArray(wrapper?.transform).forEach((transform) => {
    const x = Number(transform.x) || 0;
    const y = Number(transform.y) || 0;
    const z = Number(transform.z) || 0;
    if (typeOf(transform) === "RotateTransform") {
      const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z), "ZYX"
      );
      direction.applyEuler(euler);
    } else if (typeOf(transform) === "TranslateTransform") {
      moved.add(new THREE.Vector3(x, y, z));
    }
  });
  return { direction: direction.normalize(), position: moved };
}

function colorFrom(value, fallback = "#ffffff") {
  try {
    return new THREE.Color(typeof value === "string" ? value : fallback);
  } catch (_error) {
    return new THREE.Color(fallback);
  }
}

function relativeIntensity(value) {
  if (Number.isFinite(Number(value))) return Number(value);
  if (value && typeof value === "object" && Number.isFinite(Number(value.value))) return Number(value.value);
  return 1;
}

// ---- reading ---------------------------------------------------------------

// Cameras, lights and point comments of the manifest's first Scene.
export function readSceneContent(manifest) {
  const scene = scenesOf(manifest)[0];
  if (!scene) return { cameras: [], lights: [], comments: [] };
  const painting = annotationsOfPages(scene.items);
  const all = painting.concat(annotationsOfPages(scene.annotations));

  const cameras = [];
  const lights = [];
  const camerasById = new Map();
  painting.forEach((annotation) => {
    if (!motivationsOf(annotation).includes("painting")) return;
    const { resource, wrapper } = resolveBody(annotation.body);
    const type = typeOf(resource);
    const isCamera = CAMERA_TYPES.has(type);
    if (!isCamera && !LIGHT_TYPES.has(type)) return;
    const oriented = applyBodyTransforms(
      wrapper,
      isCamera ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, -1, 0),
      targetPoint(annotation) || new THREE.Vector3()
    );
    const position = oriented.position;
    // Either an explicit lookAt point, or a direction (lookAt: null).
    const lookAt = resource.lookAt ? resolveLookAt(resource.lookAt, all) : null;
    if (isCamera) {
      const camera = {
        id: annotation.id || null,
        type,
        position,
        lookAt,
        direction: oriented.direction,
        fieldOfView: Number(resource.fieldOfView),
        viewHeight: Number(resource.viewHeight),
        near: Number(resource.near),
        far: Number(resource.far),
      };
      cameras.push(camera);
      if (camera.id) camerasById.set(camera.id, camera);
    } else {
      lights.push({
        type,
        position,
        lookAt,
        direction: oriented.direction,
        color: colorFrom(resource.color),
        intensity: relativeIntensity(resource.intensity),
        angle: Number(resource.angle),
      });
    }
  });

  const comments = annotationsOfPages(scene.annotations)
    .concat(annotationsOfPages(manifest.annotations))
    .filter((annotation) => motivationsOf(annotation).some((motivation) => COMMENT_MOTIVATIONS.has(motivation)))
    .map((annotation) => {
      const point = targetPoint(annotation);
      if (!point) return null;
      const bodies = asArray(annotation.body);
      const textual = bodies.find((body) => typeOf(body) === "TextualBody") || bodies[0];
      const description = typeof textual === "string"
        ? textual
        : textual?.value || firstLanguageValue(textual?.label) || "";
      const target = asArray(annotation.target)[0];
      const scopeCamera = cameraView(asArray(annotation.scope).map((ref) => camerasById.get(ref?.id || ref)).find(Boolean))
        || readScopeCamera(target?.scope, all);
      return {
        id: String(annotation.id || ""),
        title: firstLanguageValue(annotation.label) || firstLanguageValue(textual?.label) || "",
        description: String(description).trim(),
        point,
        view: scopeCamera,
        created: annotation.created || "",
        modified: annotation.modified || "",
        custom: annotation.AIM3DViewer || null,
      };
    })
    .filter(Boolean);

  return { cameras, lights, comments };
}

// A scene camera as a stored annotation view.
function cameraView(camera) {
  if (!camera) return null;
  const target = camera.lookAt
    || camera.position.clone().addScaledVector(camera.direction, Math.max(camera.position.length(), 1));
  const view = { position: camera.position.toArray(), target: target.toArray() };
  if (Number.isFinite(camera.fieldOfView) && camera.fieldOfView > 0) view.fov = camera.fieldOfView;
  return view;
}

// Older form: a camera painted inside a content-state `scope` on the target.
function readScopeCamera(scope, sceneAnnotations) {
  const scopeTarget = asArray(scope?.target)[0];
  const annotations = annotationsOfPages(scopeTarget?.items);
  for (const annotation of annotations) {
    const { resource, wrapper } = resolveBody(annotation.body);
    if (!CAMERA_TYPES.has(typeOf(resource))) continue;
    const point = targetPoint(annotation);
    if (!point) continue;
    const { position, direction } = applyBodyTransforms(wrapper, new THREE.Vector3(0, 0, -1), point);
    const target = resource.lookAt
      ? resolveLookAt(resource.lookAt, sceneAnnotations)
      : position.clone().addScaledVector(direction, Math.max(position.length(), 1));
    const view = { position: position.toArray(), target: target.toArray() };
    const fov = Number(resource.fieldOfView);
    if (Number.isFinite(fov) && fov > 0) view.fov = fov;
    return view;
  }
  return null;
}

// ---- applying --------------------------------------------------------------

export function removeImportedLights() {
  if (!importedLights) return;
  importedLights.traverse((child) => child.dispose?.());
  importedLights.removeFromParent();
  importedLights = null;
}

// Imported lights the viewer has no own light for live in one group, removed
// again with the model (removeImportedLights).
export function addImportedLight(light) {
  if (!core.scene) return light;
  if (!importedLights) {
    importedLights = new THREE.Group();
    importedLights.name = "iiif-lights";
    core.scene.add(importedLights);
  }
  if (light.target) importedLights.add(light.target);
  importedLights.add(light);
  return light;
}

// The imported lights, for exporting them again.
export function importedLightObjects() {
  return importedLights ? importedLights.children.filter((child) => child.isLight) : [];
}

// Centre and radius of the loaded models (targets for direction-only lights).
function sceneBounds() {
  const box = new THREE.Box3();
  (core.mainObject || []).flat().forEach((object) => {
    if (object?.isObject3D) box.expandByObject(object);
  });
  if (box.isEmpty()) return { center: new THREE.Vector3(), radius: 1 };
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  return { center: sphere.center, radius: sphere.radius || 1 };
}

// Where a light points, and where a directional light sits: an explicit
// lookAt, or the light's direction through the middle of the scene.
function lightAim(light) {
  const bounds = sceneBounds();
  if (light.lookAt) return { position: light.position, target: light.lookAt };
  if (light.type === "DirectionalLight") {
    return {
      position: bounds.center.clone().addScaledVector(light.direction, -2 * bounds.radius),
      target: bounds.center.clone(),
    };
  }
  return { position: light.position, target: light.position.clone().addScaledVector(light.direction, bounds.radius) };
}

// Cancels the intro fly-in a model load starts, so it doesn't overwrite a
// camera applied from a manifest.
export function stopCameraIntro() {
  core.cameraTweenToken = (core.cameraTweenToken ?? 0) + 1;
  core.cameraTween?.stop?.();
  core.targetTween?.stop?.();
  if (core.GESTURE?.active) window.Viewer?.stopGesture?.();
  if (core.GESTURE) core.GESTURE.rotate = false;
  if (core.handHint) core.handHint.hidden = true;
}

export function applyCamera(camera, viewer) {
  if (!camera || !core.camera || !core.controls) return false;
  stopCameraIntro();
  viewer?.setCameraProjection?.(camera.type === "OrthographicCamera" ? "orthographic" : "perspective");
  core.camera.position.copy(camera.position);
  // Without lookAt: along the camera's direction, as far as the model is.
  const target = camera.lookAt || camera.position.clone().addScaledVector(
    camera.direction,
    Math.max(camera.position.distanceTo(sceneBounds().center), 1e-3)
  );
  core.controls.target.copy(target);
  if (core.camera.isPerspectiveCamera && Number.isFinite(camera.fieldOfView) && camera.fieldOfView > 0) {
    core.camera.fov = THREE.MathUtils.clamp(camera.fieldOfView, 1, 179);
  }
  if (Number.isFinite(camera.near) && camera.near > 0) core.camera.near = camera.near;
  if (Number.isFinite(camera.far) && camera.far > core.camera.near) core.camera.far = camera.far;
  if (core.camera.isOrthographicCamera && Number.isFinite(camera.viewHeight) && camera.viewHeight > 0) {
    const frustumHeight = core.camera.top - core.camera.bottom;
    if (frustumHeight > 0) core.camera.zoom = frustumHeight / camera.viewHeight;
  }
  core.camera.updateProjectionMatrix();
  core.cameraLight?.position?.copy?.(core.camera.position);
  core.controls.update();
  // "Reset camera" returns to the manifest's camera.
  core.cameraCoords = core.camera.position.clone();
  core.controlsTarget = core.controls.target.clone();
  return true;
}

export function applyLights(lights) {
  removeImportedLights();
  if (!lights.length || !core.scene) return 0;
  let usedDirectional = false;
  lights.forEach((light) => {
    const intensity = light.intensity * (LIGHT_INTENSITY_SCALE[light.type] || 1);
    if (light.type === "AmbientLight") {
      if (core.ambientLight) {
        core.ambientLight.color.copy(light.color);
        core.ambientLight.intensity = intensity;
      } else {
        addImportedLight(new THREE.AmbientLight(light.color, intensity));
      }
      return;
    }
    if (light.type === "DirectionalLight" && !usedDirectional && core.dirLight) {
      // The first directional light drives the viewer's own, which the light
      // controls in the editor act on.
      usedDirectional = true;
      const aim = lightAim(light);
      core.dirLight.color.copy(light.color);
      core.dirLight.intensity = intensity;
      core.dirLight.position.copy(aim.position);
      core.dirLight.target?.position?.copy?.(aim.target);
      core.dirLight.target?.updateMatrixWorld?.();
      return;
    }
    let object;
    if (light.type === "DirectionalLight") {
      object = new THREE.DirectionalLight(light.color, intensity);
    } else if (light.type === "PointLight") {
      object = new THREE.PointLight(light.color, intensity, 0, 0);
    } else {
      const angle = Number.isFinite(light.angle) && light.angle > 0 ? light.angle : 30;
      object = new THREE.SpotLight(light.color, intensity, 0, THREE.MathUtils.degToRad(angle), 0.2, 0);
    }
    const aim = lightAim(light);
    object.position.copy(aim.position);
    object.target?.position.copy(aim.target);
    object.name = `iiif-${light.type}`;
    addImportedLight(object);
  });
  return lights.length;
}

// Comments -> viewer annotation entries anchored to a point of the model root.
export function commentsToAnnotationEntries(comments, root) {
  if (!root) return [];
  root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  return comments.map((comment, index) => ({
    id: comment.id || `anno-point-${index + 1}`,
    point: comment.point.clone().applyMatrix4(inverse).toArray(),
    title: comment.title,
    description: comment.description,
    ...(comment.view ? { view: comment.view } : {}),
    createdAt: comment.created ? String(comment.created) : "",
    updatedAt: comment.modified ? String(comment.modified) : "",
  }));
}

// ---- writing ---------------------------------------------------------------

const round = (value) => Math.round(value * 1e6) / 1e6;
const pointSelector = (vector) => ({
  type: "PointSelector",
  x: round(vector.x),
  y: round(vector.y),
  z: round(vector.z),
});

function scenePointTarget(sceneId, vector) {
  return {
    type: "SpecificResource",
    source: { id: sceneId, type: "Scene" },
    selector: [pointSelector(vector)],
  };
}

export function buildCameraAnnotation(sceneId, id) {
  const camera = core.camera;
  const target = core.controls?.target || new THREE.Vector3();
  const body = camera.isOrthographicCamera
    ? {
      type: "OrthographicCamera",
      viewHeight: round((camera.top - camera.bottom) / (camera.zoom || 1)),
      near: round(camera.near),
      far: round(camera.far),
      lookAt: pointSelector(target),
    }
    : {
      type: "PerspectiveCamera",
      fieldOfView: round(camera.fov),
      near: round(camera.near),
      far: round(camera.far),
      lookAt: pointSelector(target),
    };
  return {
    id,
    type: "Annotation",
    motivation: ["painting"],
    body,
    target: scenePointTarget(sceneId, camera.position),
  };
}

export function buildLightAnnotations(sceneId, baseId) {
  const annotations = [];
  const toHex = (color) => `#${color.getHexString()}`;
  const intensityValue = (light, type) => ({
    type: "Value",
    value: round(light.intensity / (LIGHT_INTENSITY_SCALE[type] || 1)),
    unit: "relative",
  });
  const lights = [];
  core.scene?.traverse((object) => {
    if (object.isLight && object.visible !== false) lights.push(object);
  });
  lights.forEach((light, index) => {
    const type = light.isAmbientLight ? "AmbientLight"
      : light.isDirectionalLight ? "DirectionalLight"
        : light.isSpotLight ? "SpotLight"
          : light.isPointLight ? "PointLight" : null;
    if (!type) return;
    const body = { type, color: toHex(light.color), intensity: intensityValue(light, type) };
    if (light.target) body.lookAt = pointSelector(light.target.getWorldPosition(new THREE.Vector3()));
    if (type === "SpotLight") body.angle = round(THREE.MathUtils.radToDeg(light.angle));
    const position = light.getWorldPosition(new THREE.Vector3());
    annotations.push({
      id: `${baseId}/${index + 1}`,
      type: "Annotation",
      motivation: ["painting"],
      body,
      target: type === "AmbientLight" ? { id: sceneId, type: "Scene" } : scenePointTarget(sceneId, position),
    });
  });
  return annotations;
}

// A model painted into the scene: SpecificResource with the root transform
// (scale, then rotation in degrees, then translation).
export function buildModelAnnotation(sceneId, id, modelBody, root) {
  const transform = [];
  if (root) {
    const { scale, rotation, position } = root;
    if (scale.x !== 1 || scale.y !== 1 || scale.z !== 1) {
      transform.push({ type: "ScaleTransform", x: round(scale.x), y: round(scale.y), z: round(scale.z) });
    }
    if (rotation.x || rotation.y || rotation.z) {
      transform.push({
        type: "RotateTransform",
        x: round(THREE.MathUtils.radToDeg(rotation.x)),
        y: round(THREE.MathUtils.radToDeg(rotation.y)),
        z: round(THREE.MathUtils.radToDeg(rotation.z)),
      });
    }
    if (position.x || position.y || position.z) {
      transform.push({ type: "TranslateTransform", x: round(position.x), y: round(position.y), z: round(position.z) });
    }
  }
  return {
    id,
    type: "Annotation",
    motivation: ["painting"],
    body: transform.length
      ? { type: "SpecificResource", source: modelBody, transform }
      : modelBody,
    target: { id: sceneId, type: "Scene" },
  };
}

// A comment's target: a point of the scene.
export function buildCommentTarget(sceneId, worldPoint) {
  return scenePointTarget(sceneId, worldPoint);
}

// A comment's saved view as a camera painted into the scene; the comment
// refers to it from `scope: [{ id, type: "Annotation" }]`.
export function buildViewCameraAnnotation(sceneId, id, view) {
  if (!view?.position || !view?.target) return null;
  return {
    id,
    type: "Annotation",
    motivation: ["painting"],
    body: {
      type: "PerspectiveCamera",
      ...(Number.isFinite(view.fov) ? { fieldOfView: round(view.fov) } : {}),
      lookAt: pointSelector(new THREE.Vector3().fromArray(view.target)),
    },
    target: scenePointTarget(sceneId, new THREE.Vector3().fromArray(view.position)),
  };
}

// Model painting annotation? (Model body, or a SpecificResource around one.)
export function isModelBody(body) {
  const { resource } = resolveBody(body);
  const type = String(typeOf(resource) || "").toLowerCase();
  return type === "model" || (!CAMERA_TYPES.has(typeOf(resource)) && !LIGHT_TYPES.has(typeOf(resource))
    && typeOf(asArray(body)[0]) === "SpecificResource" && Boolean(resource?.id));
}

export function modelUrlOf(body) {
  return resolveBody(body).resource?.id || null;
}

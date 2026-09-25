import THREE from "../init.js";
import { core } from "../core.js";
import { unitNameToMeters } from "../editor/model-units.js";

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
// The viewer's own lights while a manifest's lights replace them.
let defaultLightState = null;

const asArray = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);
const typeOf = (value) => value?.type || value?.["@type"] || null;

// ---- comment text -----------------------------------------------------------

// A IIIF language map ({ en: ["Glove"], es: ["Guante"] }) or a plain string as
// { language: text }; "none" for text without a language.
function languageMap(value) {
  if (typeof value === "string") return value.trim() ? { none: value.trim() } : {};
  if (!value || typeof value !== "object") return {};
  const map = {};
  Object.entries(value).forEach(([language, texts]) => {
    const text = String(asArray(texts)[0] ?? "").trim();
    if (text) map[language] = text;
  });
  return map;
}

// Plain text of an HTML fragment: the markup is parsed, never rendered or run.
export function htmlToText(html) {
  const source = String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, "$&\n");
  if (typeof DOMParser === "undefined") return source.replace(/<[^>]*>/g, "").trim();
  const doc = new DOMParser().parseFromString(source, "text/html");
  doc.querySelectorAll("script, style, template").forEach((node) => node.remove());
  return String(doc.body?.textContent || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Text of a TextualBody (HTML turned into plain text).
function bodyText(body) {
  if (typeof body === "string") return body.trim();
  const value = String(body?.value ?? "");
  return /html/i.test(String(body?.format || "")) ? htmlToText(value) : value.trim();
}

// Title and description of a comment annotation, per language: the label's
// language map, and the TextualBody - or a Choice of them, one per language.
export function readCommentText(annotation) {
  const bodies = asArray(annotation?.body)
    .flatMap((body) => (typeOf(body) === "Choice" ? asArray(body.items) : [body]))
    .filter((body) => typeof body === "string" || typeOf(body) === "TextualBody" || typeof body?.value === "string");
  const descriptions = {};
  bodies.forEach((body) => {
    const text = bodyText(body);
    const language = String(asArray(body?.language)[0] || "none");
    if (text && !(language in descriptions)) descriptions[language] = text;
  });
  let titles = languageMap(annotation?.label);
  if (!Object.keys(titles).length) titles = languageMap(bodies.find((body) => body?.label)?.label);
  return { titles, descriptions };
}

// The language of a text map to show: the viewer's, then English, then text
// without a language, then any.
export function pickLanguageKey(map, language = core.currentLanguage) {
  const keys = Object.keys(map || {});
  if (!keys.length) return null;
  const wanted = String(language || "en").toLowerCase();
  return keys.find((key) => key.toLowerCase() === wanted)
    || keys.find((key) => key.toLowerCase().split("-")[0] === wanted.split("-")[0])
    || (keys.includes("en") ? "en" : null)
    || (keys.includes("none") ? "none" : null)
    || keys[0];
}

export function pickLanguage(map, language) {
  const key = pickLanguageKey(map, language);
  return key ? map[key] : "";
}

// A label (IIIF language map or string) in the viewer's language.
export function labelText(value) {
  return pickLanguage(languageMap(value));
}

// The Scenes of a manifest a viewer offers, with their labels (a Scene
// nested in another is shown as part of it).
export function manifestScenes(manifest) {
  const nested = nestedSceneIds(manifest);
  return scenesOf(manifest)
    .map((scene, index) => ({ index, id: scene.id || "", label: labelText(scene.label) }))
    .filter((scene) => !nested.has(scene.id));
}

// Title and description texts of an annotation entry in several languages;
// null when there is only one.
export function localizedTexts(titles, descriptions) {
  const several = (map) => Object.keys(map || {}).length > 1;
  if (!several(titles) && !several(descriptions)) return null;
  return {
    ...(several(titles) ? { title: { ...titles } } : {}),
    ...(several(descriptions) ? { description: { ...descriptions } } : {}),
  };
}

// Points of a WKT geometry with z ("POLYGON Z ((x y z, ...))", also POINT Z,
// LINESTRING Z, MULTIPOINT Z); a polygon's closing point is dropped.
export function parseWkt(value) {
  const match = String(value || "").match(/^\s*(POLYGON|LINESTRING|MULTIPOINT|POINT)\s*Z?\s*\(+([^)]*)\)/i);
  if (!match) return null;
  const points = match[2]
    .split(",")
    .map((pair) => pair.trim().replace(/^\(|\)$/g, "").split(/\s+/).map(Number))
    .filter((values) => values.length >= 3 && values.slice(0, 3).every(Number.isFinite))
    .map((values) => new THREE.Vector3(values[0], values[1], values[2]));
  if (points.length > 2 && points[0].equals(points[points.length - 1])) points.pop();
  return points.length ? { type: match[1].toUpperCase(), points } : null;
}

export function wktPolygon(points) {
  const ring = points.concat(points.slice(0, 1));
  return `POLYGON Z ((${ring.map((point) => [point.x, point.y, point.z].map(round).join(" ")).join(", ")}))`;
}

function centroidOf(points) {
  if (!points?.length) return null;
  return points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
}

// The points of a WktSelector among the selectors, if any.
function polygonFromSelector(selector) {
  const wkt = asArray(selector).find((item) => typeOf(item) === "WktSelector");
  return wkt ? parseWkt(wkt.value)?.points || null : null;
}

// A PointSelector's point - or the centre of a WktSelector's geometry.
function pointFromSelector(selector) {
  const point = asArray(selector).find((item) => typeOf(item) === "PointSelector");
  if (!point) return centroidOf(polygonFromSelector(selector));
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

// Every resource of a body: a Choice gives one per item (the first is the
// default), each possibly wrapped in a SpecificResource.
function bodyResources(body) {
  return asArray(body).flatMap((item) => (
    typeOf(item) === "Choice"
      ? asArray(item.items).map((choiceItem) => ({ ...resolveBody(choiceItem), choice: item.id || true }))
      : [{ ...resolveBody(item), choice: null }]
  ));
}

// behavior: ["hidden"] - not shown until an activating annotation shows it.
const isHidden = (annotation) => asArray(annotation?.behavior).some((value) => String(value).toLowerCase() === "hidden");

const idOf = (value) => (typeof value === "string" ? value : value?.id || null);

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
  if (typeOf(lookAt) === "PointSelector" || typeOf(lookAt) === "WktSelector") {
    return pointFromSelector(lookAt) || new THREE.Vector3();
  }
  if (typeOf(lookAt) === "SpecificResource") return pointFromSelector(lookAt.selector) || new THREE.Vector3();
  const id = typeof lookAt === "string" ? lookAt : lookAt.id;
  const referenced = sceneAnnotations.find((annotation) => annotation.id === id);
  return (referenced && targetPoint(referenced)) || new THREE.Vector3();
}

// A transform list (ScaleTransform / RotateTransform / TranslateTransform) as
// one matrix, applied in the order listed: [translate, rotate] moves the
// resource, then rotates it about the scene origin. RotateTransform angles are
// degrees, as a three.js "XYZ" Euler rotation - the order the IIIF 3D
// examples use (tipped_and_rotated_astronaut undoes its model's own rotation
// exactly with it).
export function transformMatrix(transforms) {
  const matrix = new THREE.Matrix4();
  const step = new THREE.Matrix4();
  asArray(transforms).forEach((transform) => {
    const x = Number(transform?.x);
    const y = Number(transform?.y);
    const z = Number(transform?.z);
    const type = typeOf(transform);
    if (type === "ScaleTransform") {
      step.makeScale(Number.isFinite(x) ? x : 1, Number.isFinite(y) ? y : 1, Number.isFinite(z) ? z : 1);
    } else if (type === "RotateTransform") {
      step.makeRotationFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(x || 0), THREE.MathUtils.degToRad(y || 0), THREE.MathUtils.degToRad(z || 0), "XYZ"
      ));
    } else if (type === "TranslateTransform") {
      step.makeTranslation(x || 0, y || 0, z || 0);
    } else {
      return;
    }
    matrix.premultiply(step);
  });
  return matrix;
}

// A model's transform list as the position / rotation (degrees, three.js's
// default "XYZ" order) / scale of its root, as the model config stores them.
export function modelTransformConfig(transforms) {
  return matrixTransformConfig(transformMatrix(transforms));
}

// A model root's matrix as that position / rotation / scale.
export function matrixTransformConfig(matrix) {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);
  const rotation = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
  // Floating-point noise from composing and decomposing (0.9999999 for 1).
  const clean = (value) => {
    const nearest = Math.round(value);
    return Math.abs(value - nearest) < 1e-9 ? nearest + 0 : value;
  };
  return {
    position: { x: clean(position.x), y: clean(position.y), z: clean(position.z) },
    rotation: {
      x: clean(THREE.MathUtils.radToDeg(rotation.x)),
      y: clean(THREE.MathUtils.radToDeg(rotation.y)),
      z: clean(THREE.MathUtils.radToDeg(rotation.z)),
    },
    scale: { x: clean(scale.x), y: clean(scale.y), z: clean(scale.z) },
  };
}

// Orientation from the body's transforms (a SpecificResource around a camera
// or light): the resource starts at the origin facing its default direction -
// cameras face -Z, lights shine along -Y - is transformed in order, and is
// then placed at the target's point.
function applyBodyTransforms(wrapper, defaultDirection, position) {
  const matrix = transformMatrix(wrapper?.transform);
  const direction = defaultDirection.clone().transformDirection(matrix);
  const moved = position.clone().add(new THREE.Vector3().applyMatrix4(matrix));
  return { direction, position: moved };
}

function colorFrom(value, fallback = "#ffffff") {
  try {
    return new THREE.Color(typeof value === "string" ? value : fallback);
  } catch (_error) {
    return new THREE.Color(fallback);
  }
}

// intensity: a number, or a Quantity {quantityValue, unit: "relative"} (older
// drafts: a Value with `value`).
function relativeIntensity(value) {
  if (Number.isFinite(Number(value))) return Number(value);
  if (value && typeof value === "object") {
    const amount = Number(value.quantityValue ?? value.value);
    if (Number.isFinite(amount)) return amount;
  }
  return 1;
}

// ---- reading ---------------------------------------------------------------

// Ids of the Scenes painted into another Scene (nesting): they are shown as
// part of it, not on their own.
function nestedSceneIds(manifest) {
  const ids = new Set();
  scenesOf(manifest).forEach((scene) => {
    annotationsOfPages(scene.items).forEach((annotation) => {
      const { resource } = resolveBody(annotation.body);
      if (typeOf(resource) === "Scene" && idOf(resource) && idOf(resource) !== scene.id) ids.add(idOf(resource));
    });
  });
  return ids;
}

// The index of the Scene to show: `index` when the manifest has it, else its
// first Scene that is not nested in another.
export function sceneIndexOf(manifest, index) {
  const scenes = scenesOf(manifest);
  if (Number.isInteger(index) && index >= 0 && index < scenes.length) return index;
  const nested = nestedSceneIds(manifest);
  const first = scenes.findIndex((scene) => !nested.has(scene.id));
  return first >= 0 ? first : 0;
}

// Everything painted into a Scene at its place: its models and Canvases, and
// those of the Scenes painted into it, each with its whole transform - the
// target's point, after the body's transform list, inside the transform of
// the Scene it is nested in. Hidden ones (behavior: hidden) are left out.
export function scenePlacements(manifest, sceneIndex) {
  const placements = { models: [], canvases: [] };
  const scenes = scenesOf(manifest);
  const scene = scenes[sceneIndexOf(manifest, sceneIndex)];
  if (!scene) return placements;
  const resources = new Map(asArray(manifest?.items).filter((item) => item?.id).map((item) => [item.id, item]));
  const full = (resource) => (resource && (resource.items ? resource : resources.get(idOf(resource)))) || null;

  const visit = (container, parentMatrix, seen) => {
    annotationsOfPages(container.items).forEach((annotation) => {
      if (!motivationsOf(annotation).includes("painting") || isHidden(annotation)) return;
      const { resource, wrapper } = resolveBody(annotation.body);
      const type = typeOf(resource);
      if (CAMERA_TYPES.has(type) || LIGHT_TYPES.has(type)) return;
      const point = targetPoint(annotation) || new THREE.Vector3();
      const matrix = parentMatrix.clone()
        .multiply(new THREE.Matrix4().makeTranslation(point.x, point.y, point.z))
        .multiply(transformMatrix(wrapper?.transform));
      if (type === "Scene") {
        const nested = full(resource);
        if (nested && !seen.has(nested.id) && seen.size < 16) visit(nested, matrix, new Set(seen).add(nested.id));
        return;
      }
      if (type === "Canvas") {
        const canvas = full(resource);
        if (canvas) placements.canvases.push({ canvas, matrix, annotation });
        return;
      }
      const url = isModelBody(annotation.body) ? modelUrlOf(annotation.body) : null;
      if (!url) return;
      placements.models.push({
        url,
        format: resource?.format || null,
        matrix,
        annotation,
        // exclude: the model's own "Cameras" / "Lights" (/ "Audio",
        // "Animations") are not used.
        exclude: asArray(annotation.exclude).map((value) => String(value).toLowerCase()),
      });
    });
  };
  visit(scene, new THREE.Matrix4(), new Set([scene.id]));
  return placements;
}

// Scene.spatialScale: the size of one scene unit, a Quantity
// ({ quantityValue: 0.01, unit: "m" } - one unit is a centimeter). In
// meters, or null when the scene does not say.
export function readSpatialScale(manifest, sceneIndex) {
  const scene = scenesOf(manifest)[sceneIndexOf(manifest, sceneIndex)];
  const scale = scene?.spatialScale;
  if (!scale || typeof scale !== "object") return null;
  const value = Number(scale.quantityValue ?? scale.value);
  const unitMeters = unitNameToMeters(scale.unit || "m");
  return Number.isFinite(value) && value > 0 && unitMeters ? value * unitMeters : null;
}

export function buildSpatialScale(meters) {
  return { type: "Quantity", quantityValue: round(meters), unit: "m" };
}

// A manifest-level annotation belongs to the scene its target names; one
// that names no scene belongs to the first.
function targetsScene(annotation, scene, scenes) {
  const target = asArray(annotation?.target)[0];
  const sourceId = typeof target === "string"
    ? target.split("#")[0]
    : target?.source?.id || (typeof target?.source === "string" ? target.source : null) || target?.id || null;
  const sceneIds = scenes.map((item) => item.id).filter(Boolean);
  if (!sourceId || !sceneIds.includes(sourceId)) return scene === scenes[0];
  return sourceId === scene.id;
}

// Cameras, lights and point comments of one Scene of the manifest.
export function readSceneContent(manifest, sceneIndex = 0) {
  const scenes = scenesOf(manifest);
  const scene = scenes[sceneIndexOf(manifest, sceneIndex)];
  if (!scene) return { cameras: [], cameraChoices: [], defaultCamera: null, lights: [], comments: [] };
  const painting = annotationsOfPages(scene.items);
  const all = painting.concat(annotationsOfPages(scene.annotations));

  const cameras = [];
  const lights = [];
  const camerasById = new Map();
  painting.forEach((annotation) => {
    if (!motivationsOf(annotation).includes("painting")) return;
    const hidden = isHidden(annotation);
    bodyResources(annotation.body).forEach(({ resource, wrapper, choice }, choiceIndex) => {
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
          id: (choice ? idOf(resource) : null) || annotation.id || null,
          annotationId: annotation.id || null,
          type,
          label: labelText(resource.label) || labelText(annotation.label),
          hidden,
          // A Choice's items after the first are alternatives, not defaults.
          alternative: Boolean(choice) && choiceIndex > 0,
          position,
          lookAt,
          direction: oriented.direction,
          fieldOfView: Number(resource.fieldOfView),
          viewHeight: Number(resource.viewHeight),
          near: Number(resource.near),
          far: Number(resource.far),
        };
        cameras.push(camera);
        [camera.id, camera.annotationId, idOf(resource)].filter(Boolean).forEach((id) => {
          if (!camerasById.has(id)) camerasById.set(id, camera);
        });
      } else if (!hidden) {
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
  });

  const sceneComments = annotationsOfPages(scene.annotations)
    .concat(annotationsOfPages(manifest.annotations).filter((annotation) => targetsScene(annotation, scene, scenes)));

  // activating annotations: selecting their target (a comment) activates
  // their body's source - here, a camera: the comment's view.
  const activatedCameras = new Map();
  sceneComments.concat(painting)
    .filter((annotation) => motivationsOf(annotation).includes("activating"))
    .forEach((annotation) => {
      const camera = asArray(annotation.body)
        .map((body) => idOf(typeOf(body) === "SpecificResource" ? body.source : body))
        .map((id) => camerasById.get(id))
        .find(Boolean);
      if (!camera) return;
      asArray(annotation.target).map(idOf).filter(Boolean).forEach((id) => {
        if (!activatedCameras.has(id)) activatedCameras.set(id, camera);
      });
    });

  const comments = sceneComments
    .filter((annotation) => motivationsOf(annotation).some((motivation) => COMMENT_MOTIVATIONS.has(motivation)))
    .map((annotation) => {
      const point = targetPoint(annotation);
      if (!point) return null;
      const { titles, descriptions } = readCommentText(annotation);
      const target = asArray(annotation.target)[0];
      const scopeCamera = cameraView(asArray(annotation.scope).map((ref) => camerasById.get(idOf(ref))).find(Boolean))
        || cameraView(activatedCameras.get(annotation.id))
        || readScopeCamera(target?.scope, all);
      const polygon = polygonFromSelector(target?.selector);
      return {
        id: String(annotation.id || ""),
        title: pickLanguage(titles),
        description: pickLanguage(descriptions),
        localized: localizedTexts(titles, descriptions),
        point,
        ...(polygon && polygon.length > 1 ? { polygon } : {}),
        view: scopeCamera,
        created: annotation.created || "",
        modified: annotation.modified || "",
        custom: annotation.AIM3DViewer || null,
      };
    })
    .filter(Boolean);

  // Cameras a viewer may offer: not hidden, not a Choice's alternative - the
  // first is the scene's default view. `choices` are all the shown ones.
  const choices = cameras.filter((camera) => !camera.hidden);
  const defaultCamera = choices.find((camera) => !camera.alternative) || null;
  return { cameras, cameraChoices: choices, defaultCamera, lights, comments };
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
  restoreDefaultLights();
  if (!importedLights) return;
  importedLights.traverse((child) => child.dispose?.());
  importedLights.removeFromParent();
  importedLights = null;
}

// The viewer's own lights (hemisphere, ambient, key and camera light) light a
// scene only when its manifest brings no lights. A manifest that does switches
// them off - reusing the ambient and key light for its first ambient and
// directional light - until the next model is loaded. With `hide` false they
// are only remembered, for a manifest that sets them itself.
export function suspendDefaultLights({ hide = true } = {}) {
  if (defaultLightState || !core.scene) return;
  defaultLightState = [];
  core.scene.children.forEach((light) => {
    if (!light.isLight) return;
    defaultLightState.push({
      light,
      visible: light.visible,
      intensity: light.intensity,
      color: light.color.clone(),
      position: light.position.clone(),
      target: light.target?.position?.clone?.() || null,
    });
    if (hide) light.visible = false;
  });
}

function restoreDefaultLights() {
  if (!defaultLightState) return;
  defaultLightState.forEach(({ light, visible, intensity, color, position, target }) => {
    light.visible = visible;
    light.intensity = intensity;
    light.color.copy(color);
    light.position.copy(position);
    if (target && light.target) {
      light.target.position.copy(target);
      light.target.updateMatrixWorld?.();
    }
  });
  defaultLightState = null;
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

// ---- Canvases in a scene ----------------------------------------------------

let importedCanvases = null;
// Longest side, in pixels, of an image fetched from a IIIF Image service.
const CANVAS_IMAGE_SIZE = 2048;

export function removeImportedCanvases() {
  if (!importedCanvases) return;
  importedCanvases.traverse((child) => {
    child.geometry?.dispose?.();
    child.material?.map?.dispose?.();
    child.material?.dispose?.();
  });
  importedCanvases.removeFromParent();
  importedCanvases = null;
}

// Where an image goes on its Canvas: the target's xywh fragment (in the URL
// or a FragmentSelector), else the whole Canvas.
function canvasRegion(target, width, height) {
  const first = asArray(target)[0];
  const fragment = typeof first === "string"
    ? first.split("#")[1]
    : asArray(first?.selector).find((selector) => typeOf(selector) === "FragmentSelector")?.value
      || String(first?.id || "").split("#")[1];
  const match = String(fragment || "").match(/xywh=(?:pixel:)?([\d.]+),([\d.]+),([\d.]+),([\d.]+)/);
  if (!match) return { x: 0, y: 0, width, height };
  const [x, y, w, h] = match.slice(1).map(Number);
  return { x, y, width: w, height: h };
}

// The URL to fetch an Image body from: its IIIF Image service at a size a
// texture can take, else the image itself.
export function canvasImageUrl(image) {
  const service = asArray(image?.service)[0];
  const base = String(service?.id || service?.["@id"] || "").replace(/\/$/, "");
  if (base) {
    const size = Math.min(CANVAS_IMAGE_SIZE, Number(image.width) || CANVAS_IMAGE_SIZE);
    return `${base}/full/${Math.round(size)},/0/default.jpg`;
  }
  return idOf(image);
}

// Each Canvas painted into the scene as a flat panel: the target point is its
// top-left corner, x to the right and y down the Canvas (scene -y), in Canvas
// units (Scale/Rotate/TranslateTransform size and turn it). Its background
// colour, then its images, each on its own region.
export function applyCanvases(canvasPlacements) {
  removeImportedCanvases();
  if (!canvasPlacements?.length || !core.scene) return 0;
  importedCanvases = new THREE.Group();
  importedCanvases.name = "iiif-canvases";
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");

  const panel = (region, material, depth) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(region.width, region.height), material);
    mesh.position.set(region.x + region.width / 2, -(region.y + region.height / 2), depth);
    return mesh;
  };

  canvasPlacements.forEach(({ canvas, matrix }) => {
    const width = Number(canvas.width) || 1;
    const height = Number(canvas.height) || 1;
    const group = new THREE.Group();
    group.name = `iiif-canvas:${canvas.id || ""}`;
    group.matrixAutoUpdate = false;
    group.matrix.copy(matrix);
    if (canvas.backgroundColor) {
      group.add(panel(
        { x: 0, y: 0, width, height },
        new THREE.MeshBasicMaterial({ color: colorFrom(canvas.backgroundColor), side: THREE.DoubleSide }),
        0
      ));
    }
    annotationsOfPages(canvas.items)
      .filter((annotation) => motivationsOf(annotation).includes("painting"))
      .forEach((annotation, index) => {
        const { resource } = bodyResources(annotation.body)[0] || {};
        if (typeOf(resource) !== "Image") return;
        const url = canvasImageUrl(resource);
        if (!url) return;
        const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true });
        loader.load(url, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          material.map = texture;
          material.needsUpdate = true;
        }, undefined, (error) => console.warn("Could not load a Canvas image", url, error));
        // Slightly in front of the background, later images above earlier.
        group.add(panel(canvasRegion(annotation.target, width, height), material, 0.001 * (index + 1)));
      });
    importedCanvases.add(group);
  });
  core.scene.add(importedCanvases);
  return canvasPlacements.length;
}

// ---- the models' own cameras and lights -------------------------------------

// A model may bring its own cameras and lights (glTF). Unless its painting
// annotation excludes them, they are used where the manifest has none: its
// camera is the view, its lights replace the viewer's. Excluded lights are
// switched off. `roots` are the models' roots, in the placements' order.
export function applyModelFeatures(modelPlacements, roots, content, viewer) {
  let modelCamera = null;
  let modelLights = false;
  roots.forEach((root, index) => {
    if (!root) return;
    const exclude = modelPlacements?.[index]?.exclude || [];
    root.traverse((object) => {
      if (object.isLight) {
        if (exclude.includes("lights")) object.visible = false;
        else if (object.visible) modelLights = true;
      } else if (object.isCamera && !modelCamera && !exclude.includes("cameras")) {
        modelCamera = object;
      }
    });
  });
  if (modelLights && !content?.lights?.length) suspendDefaultLights();
  if (modelCamera && !content?.defaultCamera) {
    modelCamera.updateWorldMatrix(true, false);
    const position = modelCamera.getWorldPosition(new THREE.Vector3());
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(modelCamera.getWorldQuaternion(new THREE.Quaternion()));
    applyCamera({
      type: modelCamera.isOrthographicCamera ? "OrthographicCamera" : "PerspectiveCamera",
      position,
      lookAt: null,
      direction,
      fieldOfView: modelCamera.fov,
      near: modelCamera.near,
      far: modelCamera.far,
    }, viewer);
    return true;
  }
  return false;
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
  suspendDefaultLights();
  let usedAmbient = false;
  let usedDirectional = false;
  lights.forEach((light) => {
    const intensity = light.intensity * (LIGHT_INTENSITY_SCALE[light.type] || 1);
    if (light.type === "AmbientLight") {
      if (core.ambientLight && !usedAmbient) {
        usedAmbient = true;
        core.ambientLight.visible = true;
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
      core.dirLight.visible = true;
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
    ...(comment.polygon ? { polygon: comment.polygon.map((point) => point.clone().applyMatrix4(inverse).toArray()) } : {}),
    title: comment.title,
    description: comment.description,
    ...(comment.localized ? { localized: comment.localized } : {}),
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
    type: "Quantity",
    quantityValue: round(light.intensity / (LIGHT_INTENSITY_SCALE[type] || 1)),
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
    const { scale, position } = root;
    // RotateTransform angles are a three.js "XYZ" Euler rotation.
    const rotation = new THREE.Euler().setFromQuaternion(root.quaternion, "XYZ");
    if (round(scale.x) !== 1 || round(scale.y) !== 1 || round(scale.z) !== 1) {
      transform.push({ type: "ScaleTransform", x: round(scale.x), y: round(scale.y), z: round(scale.z) });
    }
    if (round(rotation.x) || round(rotation.y) || round(rotation.z)) {
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

// A Canvas painted into the scene, placed as `matrix` places it: its size and
// turn as Scale / RotateTransform, its top-left corner as the target point.
export function buildCanvasAnnotation(sceneId, id, canvas, matrix) {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);
  const rotation = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
  const transform = [];
  if (round(scale.x) !== 1 || round(scale.y) !== 1 || round(scale.z) !== 1) {
    transform.push({ type: "ScaleTransform", x: round(scale.x), y: round(scale.y), z: round(scale.z) });
  }
  if (round(rotation.x) || round(rotation.y) || round(rotation.z)) {
    transform.push({
      type: "RotateTransform",
      x: round(THREE.MathUtils.radToDeg(rotation.x)),
      y: round(THREE.MathUtils.radToDeg(rotation.y)),
      z: round(THREE.MathUtils.radToDeg(rotation.z)),
    });
  }
  // By reference to a Canvas of the manifest; a Canvas without an id inline.
  const source = canvas.id ? { id: canvas.id, type: "Canvas" } : structuredClone(canvas);
  return {
    id,
    type: "Annotation",
    motivation: ["painting"],
    body: transform.length ? { type: "SpecificResource", source, transform } : source,
    target: scenePointTarget(sceneId, position),
  };
}

// A comment's target: a point of the scene - or, for a comment on a region,
// the polygon (WktSelector), with its centre as the PointSelector.
export function buildCommentTarget(sceneId, worldPoint, worldPolygon = null) {
  const target = scenePointTarget(sceneId, worldPoint);
  if (worldPolygon?.length > 1) target.selector = [{ type: "WktSelector", value: wktPolygon(worldPolygon) }];
  return target;
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
// Other kinds of resource a Scene may be painted with.
const NON_MODEL_TYPES = new Set(["Scene", "Canvas", "Image", "Video", "Sound", "Audio", "Text", "TextualBody", "Choice"]);

export function isModelBody(body) {
  const { resource } = resolveBody(body);
  const type = String(typeOf(resource) || "").toLowerCase();
  return type === "model" || (!CAMERA_TYPES.has(typeOf(resource)) && !LIGHT_TYPES.has(typeOf(resource))
    && !NON_MODEL_TYPES.has(typeOf(resource))
    && typeOf(asArray(body)[0]) === "SpecificResource" && Boolean(resource?.id));
}

// Media type of a model file, from its extension (null when unknown).
const MODEL_FORMATS = {
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  obj: "model/obj",
  stl: "model/stl",
  usdz: "model/vnd.usdz+zip",
};
export function modelFormatOf(url) {
  const extension = String(url || "").split(/[?#]/)[0].split(".").pop().toLowerCase();
  return MODEL_FORMATS[extension] || null;
}

export function modelUrlOf(body) {
  return resolveBody(body).resource?.id || null;
}

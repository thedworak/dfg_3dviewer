import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { addImportedLight, importedLightObjects } from "../IIIF/presentation4.js";

// The lights the editor moves (the lights window, lights-panel.js):
// the viewer's key light (core.dirLight) and the directional, point and spot
// lights added to it or brought by a manifest. One of them is the active
// light, which the handles (TransformControls on the light or on its
// target), the angles and the numbers act on. Angles are round the light's
// target (a point light: the middle of the model) - `direction` round the
// vertical (0 = front, +Z; 90 = right, +X), `height` above the horizon.
// On each model the key light is placed round it, sized to it, unless the
// saved settings say where. Added lights live with the imported ones
// (IIIF/presentation4.js), so they go out with the manifest and away with
// the model.

export const LIGHT_ANGLE_DEFAULTS = Object.freeze({ direction: 35, height: 50 });
// The light's distance from its target, in radii of the model.
const DISTANCE_RADII = 2;
// Lights that can be added (Lights > Add light).
export const ADDABLE_LIGHT_TYPES = ["DirectionalLight", "PointLight", "SpotLight"];

const offset = new THREE.Vector3();

// [x, y, z], {x, y, z} or numeric strings -> Vector3, or null.
export function toLightVector(value) {
  const parts = Array.isArray(value) ? value : value && typeof value === "object" ? [value.x, value.y, value.z] : null;
  if (!parts || parts.length < 3) return null;
  const numbers = parts.slice(0, 3).map((part) => (part === "" || part == null ? NaN : Number(part)));
  return numbers.every(Number.isFinite) ? new THREE.Vector3(...numbers) : null;
}

// Whether a light is one the editor moves.
function isEditableLight(light) {
  return Boolean(light?.isDirectionalLight || light?.isPointLight || light?.isSpotLight);
}

// The light's target in the scene, so moving it (and its matrix) counts.
export function ensureLightTarget(light) {
  if (!light?.target || !core.scene) return null;
  if (!light.target.parent) core.scene.add(light.target);
  return light.target;
}

// What the light turns round: its target, or (a point light) the model.
function lightPivot(light) {
  return light.target?.position ?? core.lightBounds?.center ?? new THREE.Vector3();
}

// Direction and height (degrees) of the light round its pivot, and how far.
export function getLightAngles(light) {
  offset.subVectors(light.position, lightPivot(light));
  const distance = offset.length();
  if (distance < 1e-9) return { ...LIGHT_ANGLE_DEFAULTS, distance: 0 };
  const direction = THREE.MathUtils.radToDeg(Math.atan2(offset.x, offset.z));
  const height = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(offset.y / distance, -1, 1)));
  return { direction: (direction + 360) % 360, height, distance };
}

// Puts the light at these angles round its pivot; the distance is kept
// unless given. Either angle may be left out.
export function setLightAngles(light, { direction, height, distance } = {}) {
  const current = getLightAngles(light);
  const d = THREE.MathUtils.degToRad(Number.isFinite(direction) ? direction : current.direction);
  const h = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(Number.isFinite(height) ? height : current.height, -89, 89));
  const r = Number.isFinite(distance) && distance > 0 ? distance : current.distance || 1;
  light.position.set(
    Math.cos(h) * Math.sin(d),
    Math.sin(h),
    Math.cos(h) * Math.cos(d)
  ).multiplyScalar(r).add(lightPivot(light));
}

// A directional light's shadow covers the model wherever the light is.
export function fitLightShadow(light, center, radius) {
  const camera = light.shadow?.camera;
  if (!camera?.isOrthographicCamera) return;
  const r = Math.max(radius, 1e-3) * 1.2;
  camera.left = -r;
  camera.right = r;
  camera.top = r;
  camera.bottom = -r;
  camera.near = Math.max(r * 0.001, 1e-4);
  camera.far = light.position.distanceTo(center) + r * 2;
  camera.updateProjectionMatrix();
}

// Round the model: aiming at its middle, at these angles.
export function fitLightToBounds(light, center, radius, angles = LIGHT_ANGLE_DEFAULTS) {
  // A point light turns round the middle of the model (lightPivot).
  light.target?.position.copy(center);
  const distance = Math.max(radius, 1e-3) * DISTANCE_RADII;
  setLightAngles(light, { ...angles, distance });
  light.target?.updateMatrixWorld();
}

function boundsSphere(box) {
  const sphere = box && !box.isEmpty() ? box.getBoundingSphere(new THREE.Sphere()) : new THREE.Sphere(new THREE.Vector3(), 1);
  if (!(sphere.radius > 0)) sphere.radius = 1;
  return sphere;
}

function makeLightHelper(light, size) {
  if (light.isDirectionalLight) return new THREE.DirectionalLightHelper(light, size);
  // A spot light's cone is drawn with its icon (light-markers.js): three's
  // helper draws it as long as the light reaches, without end by default.
  if (light.isPointLight) return new THREE.PointLightHelper(light, size * 0.3);
  return null;
}

// The helper (lines from the active light to its target), one at a time,
// sized to the model; shown while the light is being moved.
function rebuildLightHelper(light) {
  const visible = core.lightHelper?.visible === true;
  if (core.lightHelper) {
    core.lightHelper.removeFromParent();
    core.lightHelper.dispose?.();
    core.lightHelper = null;
  }
  if (!light || !core.scene) return;
  core.lightHelper = makeLightHelper(light, (core.lightBounds?.radius ?? 1) * 0.5);
  if (!core.lightHelper) return;
  core.lightHelper.visible = visible;
  core.scene.add(core.lightHelper);
  core.lightHelper.update?.();
}

// A model loaded (viewer-utils.js, fitCameraToCenteredObject): the key light
// where `placement` says ({position, target}: saved settings), else round
// the model.
export function placeDirectionalLight(light, box, placement = {}) {
  if (!light || !core.scene) return;
  ensureLightTarget(light);
  core.dirLightTarget = light.target;
  const sphere = boundsSphere(box);
  core.lightBounds = sphere;
  const position = toLightVector(placement.position);
  if (position) {
    light.position.copy(position);
    light.target.position.copy(toLightVector(placement.target) ?? sphere.center);
    light.target.updateMatrixWorld();
  } else {
    fitLightToBounds(light, sphere.center, sphere.radius);
  }
  fitLightShadow(light, sphere.center, sphere.radius);
  // The helper sized to this model.
  rebuildLightHelper(window.Viewer?.getActiveLight?.() ?? light);
}

const LIGHT_TYPE_LABELS = {
  DirectionalLight: ["gui.lightTypeDirectional", "Directional light"],
  PointLight: ["gui.lightTypePoint", "Point light"],
  SpotLight: ["gui.lightTypeSpot", "Spot light"],
};

function typeLabel(type) {
  const [key, fallback] = LIGHT_TYPE_LABELS[type] || [];
  return key ? t(key, fallback) : type;
}

export function attachSceneLights(Viewer) {
  // The active light's own settings, for the colour, intensity and the
  // other fields (lil-gui and the toolbar read and write them).
  const settings = {};
  const active = () => Viewer.getActiveLight();
  const changed = () => Viewer.syncActiveLight();
  Object.defineProperties(settings, {
    // Its own name (exported as the manifest light's `name`); empty: the
    // default one (getLightLabel).
    name: {
      enumerable: true,
      get: () => String(active()?.userData?.label ?? ""),
      set: (value) => {
        const light = active();
        if (!light) return;
        // Kept as typed (the field reads it back while typing); blank: none.
        const name = String(value ?? "");
        if (name.trim()) light.userData.label = name;
        else delete light.userData.label;
        Viewer.refreshLightList();
      },
    },
    enabled: {
      enumerable: true,
      get: () => active()?.visible !== false,
      set: (value) => { if (active()) { active().visible = value === true; changed(); } },
    },
    color: {
      enumerable: true,
      get: () => `#${(active()?.color ?? new THREE.Color(0xffffff)).getHexString()}`,
      set: (value) => {
        const light = active();
        if (!light) return;
        try {
          light.color.set(String(value).replace(/^0x/i, "#"));
        } catch {
          return;
        }
        if (light === core.dirLight) Viewer.colors.DirectionalLight = `#${light.color.getHexString()}`;
      },
    },
    intensity: {
      enumerable: true,
      get: () => active()?.intensity ?? 0,
      set: (value) => {
        const light = active();
        if (!light || !Number.isFinite(Number(value))) return;
        light.intensity = Number(value);
        if (light === core.dirLight) Viewer.intensity.startIntensityDir = light.intensity;
      },
    },
    castShadow: {
      enumerable: true,
      get: () => active()?.castShadow === true,
      set: (value) => { if (active()) active().castShadow = value === true; },
    },
    // A spot light's cone half-angle, in degrees, and its soft edge.
    angle: {
      enumerable: true,
      get: () => (active()?.isSpotLight ? Math.round(THREE.MathUtils.radToDeg(active().angle)) : 30),
      set: (value) => {
        const light = active();
        if (!light?.isSpotLight || !Number.isFinite(Number(value))) return;
        light.angle = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(Number(value), 1, 90));
        changed();
      },
    },
    penumbra: {
      enumerable: true,
      get: () => (active()?.isSpotLight ? active().penumbra : 0),
      set: (value) => {
        const light = active();
        if (!light?.isSpotLight || !Number.isFinite(Number(value))) return;
        light.penumbra = THREE.MathUtils.clamp(Number(value), 0, 1);
      },
    },
  });

  Object.assign(Viewer, {
    activeLightSettings: settings,
    // The angles the Direction and Height sliders show.
    lightAngles: { ...LIGHT_ANGLE_DEFAULTS },
    // The light the Lights folder's list shows (its index in getEditableLights).
    lightList: { active: 0 },

    // The key light first, then the added and imported ones.
    getEditableLights() {
      return [core.dirLight, ...importedLightObjects()].filter(isEditableLight);
    },

    // The active light, while it is still in the scene; else the key light.
    getActiveLight() {
      const light = core.activeLight;
      if (light && light !== core.dirLight && Viewer.getEditableLights().includes(light)) return light;
      return core.dirLight ?? null;
    },

    // Its own name, or (`named` false, or none given) the default one.
    getLightLabel(light, { named = true } = {}) {
      if (!light) return "";
      if (named && light.userData?.label) return String(light.userData.label);
      if (light === core.dirLight) return t("gui.keyLight", "Key light");
      const sameType = Viewer.getEditableLights().filter((other) => other !== core.dirLight && other.type === light.type);
      return `${typeLabel(light.type)} ${sameType.indexOf(light) + 1}`;
    },

    setActiveLight(light) {
      if (!isEditableLight(light)) return;
      const mode = Viewer.transformText["Transform Light"];
      core.transformControlLight?.detach?.();
      core.transformControlLightTarget?.detach?.();
      core.activeLight = light;
      rebuildLightHelper(light);
      // The handles go along, onto the light (a point light has no target).
      Viewer.attachLightTransform(mode === "rotate" && !light.target ? "" : mode);
      Viewer.syncActiveLight();
      Viewer.refreshLightList();
    },

    // The handles on the active light ("translate") or its target ("rotate").
    attachLightTransform(mode) {
      const light = Viewer.getActiveLight();
      core.transformControlLight?.detach?.();
      core.transformControlLightTarget?.detach?.();
      Viewer.transformText["Transform Light"] = mode === "translate" || (mode === "rotate" && light?.target) ? mode : "";
      // The helper while it is being moved, and while the lights window is open.
      if (core.lightHelper) core.lightHelper.visible = Boolean(Viewer.transformText["Transform Light"]) || Viewer.isLightsPanelOpen?.() === true;
      if (!light) return;
      if (Viewer.transformText["Transform Light"] === "translate") {
        core.transformControlLight?.setMode("translate");
        core.transformControlLight?.attach(light);
      } else if (Viewer.transformText["Transform Light"] === "rotate") {
        ensureLightTarget(light);
        core.transformControlLightTarget?.setMode("translate");
        core.transformControlLightTarget?.attach(light.target);
      }
      Viewer.syncLightsPanelFields?.();
    },

    // A light of `type` round the model, from another side than the others.
    addLight(type = "DirectionalLight") {
      if (!core.scene || !ADDABLE_LIGHT_TYPES.includes(type)) return null;
      const light = type === "PointLight" ? new THREE.PointLight(0xffffff, 1, 0, 0)
        : type === "SpotLight" ? new THREE.SpotLight(0xffffff, 1, 0, THREE.MathUtils.degToRad(30), 0.2, 0)
          : new THREE.DirectionalLight(0xffffff, 1);
      light.name = `editor-${type}`;
      light.userData.isEditorLight = true;
      addImportedLight(light);
      const bounds = core.lightBounds ?? new THREE.Sphere(new THREE.Vector3(), 1);
      const count = Viewer.getEditableLights().length - 1;
      fitLightToBounds(light, bounds.center, bounds.radius, {
        direction: (LIGHT_ANGLE_DEFAULTS.direction + 120 * count) % 360,
        height: 40,
      });
      Viewer.setActiveLight(light);
      // Seen where it went at once.
      if (core.lightHelper) core.lightHelper.visible = true;
      Viewer.updateLightsSubmenuState?.();
      return light;
    },

    // The active light, unless it is the key light (that one is switched off).
    removeActiveLight() {
      const light = Viewer.getActiveLight();
      if (!light || light === core.dirLight) return false;
      core.transformControlLight?.detach?.();
      core.transformControlLightTarget?.detach?.();
      light.target?.removeFromParent();
      light.removeFromParent();
      light.dispose?.();
      Viewer.setActiveLight(core.dirLight);
      Viewer.updateLightsSubmenuState?.();
      return true;
    },

    // After the active light moved or changed (its handles, the numbers, a
    // manifest): the helper, the shadow, the fields and the sliders follow.
    syncActiveLight() {
      const light = Viewer.getActiveLight();
      if (!light) return;
      if (core.lightHelper?.light !== light) rebuildLightHelper(light);
      light.target?.updateMatrixWorld();
      const bounds = core.lightBounds;
      if (bounds) fitLightShadow(light, bounds.center, bounds.radius);
      core.lightHelper?.update?.();
      const { direction, height } = getLightAngles(light);
      Viewer.lightAngles.direction = Math.round(direction);
      Viewer.lightAngles.height = Math.round(height);
      Viewer.syncActiveLightControls();
    },

    // Lights came or went (a model, a manifest): the active one and the list.
    refreshLights() {
      Viewer.syncActiveLight();
      Viewer.refreshLightList();
    },

    // Direction and height in degrees, round the pivot; either may be left out.
    setLightAngles({ direction, height } = {}) {
      const light = Viewer.getActiveLight();
      if (!light) return;
      setLightAngles(light, { direction: Number(direction), height: Number(height) });
      Viewer.syncActiveLight();
    },

    // Back round the model: the key light at the default angles, another
    // one where it was placed when added.
    resetActiveLight() {
      const light = Viewer.getActiveLight();
      const bounds = core.lightBounds;
      if (!light || !bounds) return;
      const angles = light === core.dirLight ? LIGHT_ANGLE_DEFAULTS : getLightAngles(light);
      fitLightToBounds(light, bounds.center, bounds.radius, angles);
      Viewer.syncActiveLight();
    },

    // The lights window (lights-panel.js): the list and the chosen light.
    refreshLightList() {
      Viewer.syncLightsPanel?.();
      Viewer.updateLightsSubmenuState?.();
    },

    // While the chosen light moves (its handles, the angles): its fields.
    syncActiveLightControls() {
      Viewer.syncLightsPanelFields?.();
    },
  });
}

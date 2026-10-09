import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { unzipSync } from "three/examples/jsm/libs/fflate.module.js";

// The size of one scene unit, in meters, for measurements. Taken from, in
// this order:
//   user      the unit picked in the measurement menu, remembered per model
//   manifest  IIIF Presentation 4 Scene.spatialScale, or AIM3DViewer units
//   file      the model file's own unit (FBX UnitScaleFactor, 3MF / AMF unit,
//             USD metersPerUnit, COLLADA <unit>)
//   config    viewer.measurement.modelUnitInMeters (viewer-settings.json)
//   default   meters (glTF, IFC and point clouds are meters by definition;
//             OBJ, STL, PLY have no unit)
// Files are wrong sometimes (a model made in centimeters, exported to glTF
// as if in meters): a model of implausible size gets a hint in the
// measurement panel, with the units that would make it plausible.

export const MODEL_UNITS = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
  in: 0.0254,
  ft: 0.3048,
};

// Unit names as manifests and files write them.
const UNIT_ALIASES = {
  m: 1, meter: 1, meters: 1, metre: 1, metres: 1,
  cm: 0.01, centimeter: 0.01, centimeters: 0.01, centimetre: 0.01, centimetres: 0.01,
  mm: 0.001, millimeter: 0.001, millimeters: 0.001, millimetre: 0.001, millimetres: 0.001,
  um: 1e-6, micron: 1e-6, micrometer: 1e-6, micrometre: 1e-6,
  km: 1000, kilometer: 1000, kilometre: 1000,
  in: 0.0254, inch: 0.0254, inches: 0.0254,
  ft: 0.3048, foot: 0.3048, feet: 0.3048,
  yd: 0.9144, yard: 0.9144,
};

// A model whose largest side lies outside this range (in meters) is
// probably in another unit than the one assumed.
const PLAUSIBLE_SIZE = { min: 0.005, max: 500 };
// ...and the units suggested are those giving it a size in this range.
const SUGGESTED_SIZE = { min: 0.05, max: 300 };

const STORAGE_PREFIX = "dfg3dviewer-model-unit:";
const DISPLAY_STORAGE_KEY = "dfg3dviewer-measure-display";

export function unitNameToMeters(name) {
  const meters = UNIT_ALIASES[String(name || "").trim().toLowerCase()];
  return Number.isFinite(meters) ? meters : null;
}

// The unit key of a size in meters (0.01 -> "cm"), or null for another one.
export function unitKeyOf(meters) {
  return Object.keys(MODEL_UNITS).find((key) => Math.abs(MODEL_UNITS[key] - meters) <= MODEL_UNITS[key] * 1e-6) || null;
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch (_error) {
    // Storage blocked: the choice lasts for this page only.
  }
}

// The 3MF model part's unit attribute (default millimeter), read from the
// archive without parsing its geometry again.
async function read3MFUnit(url) {
  const response = await fetch(url);
  if (!response.ok) return null;
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()), {
    filter: (file) => /\.model$/i.test(file.name),
  });
  const model = Object.values(files)[0];
  if (!model) return null;
  const head = new TextDecoder().decode(model.subarray(0, 4096));
  const unit = head.match(/<model\b[^>]*\bunit\s*=\s*["']([^"']+)["']/i)?.[1] || "millimeter";
  return unitNameToMeters(unit);
}

// The unit of a loaded model file, in meters per unit of its geometry - or
// null when the file has none. Call before the loader's root transform is
// reset (loaders.js): COLLADA and USD put their unit in the root's scale.
export async function detectFileUnit(object, extension, url) {
  const ext = String(extension || "").toLowerCase();
  const root = Array.isArray(object) ? object[0] : object;
  if (!root) return null;
  try {
    if (ext === "fbx") {
      // Centimeters per unit.
      const factor = Number(root.userData?.unitScaleFactor);
      return Number.isFinite(factor) && factor > 0 ? factor / 100 : null;
    }
    if (ext === "amf") {
      // AMFLoader scales the geometry to millimeters.
      return 0.001;
    }
    if (ext === "3mf") {
      return url ? await read3MFUnit(url) : 0.001;
    }
    if (ext === "dae" || ext === "usd" || ext === "usda" || ext === "usdc" || ext === "usdz") {
      // <unit meter="..."> / metersPerUnit, as the root's (uniform) scale.
      const { x, y, z } = root.scale;
      const uniform = Math.abs(x - y) < 1e-9 && Math.abs(x - z) < 1e-9;
      return uniform && x > 0 && Math.abs(x - 1) > 1e-9 ? x : null;
    }
  } catch (error) {
    console.warn("Could not read the model file's unit", error);
  }
  return null;
}

function trim(value, digits) {
  return Number(value.toFixed(digits)).toString();
}

export function attachModelUnits(Viewer) {
  Object.assign(Viewer, {
    // Set per load: the manifest's unit and the file's (meters per unit).
    manifestUnitMeters: null,
    detectedModelUnitMeters: null,

    resetModelUnits() {
      Viewer.manifestUnitMeters = null;
      Viewer.detectedModelUnitMeters = null;
    },

    // The model the user's unit choice is remembered for.
    getModelUnitStorageKey() {
      const id = core.fileObject?.originalPath || "";
      return id ? `${STORAGE_PREFIX}${id}` : null;
    },

    getModelUnitOverride() {
      const key = Viewer.getModelUnitStorageKey();
      const stored = key ? readStorage(key) : null;
      return stored && MODEL_UNITS[stored] ? stored : null;
    },

    // { meters, source, key } for one scene unit.
    resolveModelUnit() {
      const pick = (meters, source) => ({ meters, source, key: unitKeyOf(meters) });
      const override = Viewer.getModelUnitOverride();
      if (override) return pick(MODEL_UNITS[override], "user");
      if (Number(Viewer.manifestUnitMeters) > 0) return pick(Number(Viewer.manifestUnitMeters), "manifest");
      if (Number(Viewer.detectedModelUnitMeters) > 0) return pick(Number(Viewer.detectedModelUnitMeters), "file");
      const configured = Number(core.CONFIG?.viewer?.measurement?.modelUnitInMeters);
      if (Number.isFinite(configured) && configured > 0 && configured !== 1) return pick(configured, "config");
      return pick(1, "default");
    },

    // "auto" (or null) forgets the user's choice for this model.
    setModelUnit(unit) {
      const key = Viewer.getModelUnitStorageKey();
      if (key) writeStorage(key, unit && unit !== "auto" && MODEL_UNITS[unit] ? unit : null);
      Viewer.refreshMeasurementUnits?.();
      Viewer.updateEditorToolbarState?.();
    },

    getMeasureDisplaySystem() {
      return readStorage(DISPLAY_STORAGE_KEY) === "imperial" ? "imperial" : "metric";
    },

    setMeasureDisplaySystem(system) {
      writeStorage(DISPLAY_STORAGE_KEY, system === "imperial" ? "imperial" : null);
      Viewer.refreshMeasurementUnits?.();
      Viewer.updateEditorToolbarState?.();
    },

    // ---- formatting, from scene units -------------------------------------

    formatLength(sceneUnits) {
      const meters = sceneUnits * Viewer.resolveModelUnit().meters;
      if (!Number.isFinite(meters)) return { text: "0", meters: 0 };
      if (Viewer.getMeasureDisplaySystem() === "imperial") {
        const feet = meters / 0.3048;
        if (feet >= 5280) return { text: `${trim(feet / 5280, 2)} mi`, meters };
        if (feet >= 1) return { text: `${feet.toFixed(2)} ft`, meters };
        return { text: `${(feet * 12).toFixed(feet * 12 >= 1 ? 1 : 2)} in`, meters };
      }
      if (meters >= 1000) return { text: `${trim(meters / 1000, 2)} km`, meters };
      if (meters >= 1) return { text: `${meters.toFixed(2)} m`, meters };
      if (meters >= 0.01) return { text: `${(meters * 100).toFixed(1)} cm`, meters };
      return { text: `${(meters * 1000).toFixed(meters * 1000 >= 1 ? 0 : 2)} mm`, meters };
    },

    formatArea(sceneUnits2) {
      const scale = Viewer.resolveModelUnit().meters;
      const m2 = sceneUnits2 * scale * scale;
      if (!Number.isFinite(m2)) return "0";
      if (Viewer.getMeasureDisplaySystem() === "imperial") {
        const ft2 = m2 / (0.3048 * 0.3048);
        if (ft2 >= 1) return `${ft2.toFixed(2)} ft²`;
        return `${(ft2 * 144).toFixed(1)} in²`;
      }
      if (m2 >= 1e6) return `${trim(m2 / 1e6, 3)} km²`;
      if (m2 >= 0.01) return `${m2.toFixed(m2 >= 1 ? 2 : 3)} m²`;
      if (m2 >= 1e-4) return `${(m2 * 1e4).toFixed(1)} cm²`;
      return `${(m2 * 1e6).toFixed(0)} mm²`;
    },

    formatVolume(sceneUnits3) {
      const scale = Viewer.resolveModelUnit().meters;
      const m3 = sceneUnits3 * scale * scale * scale;
      if (!Number.isFinite(m3)) return "0";
      if (Viewer.getMeasureDisplaySystem() === "imperial") {
        const ft3 = m3 / (0.3048 ** 3);
        if (ft3 >= 1000) return `${Math.round(ft3).toLocaleString("en-US")} ft³`;
        if (ft3 >= 1) return `${ft3.toFixed(2)} ft³`;
        return `${(ft3 * 1728).toFixed(1)} in³`;
      }
      if (m3 >= 1e9) return `${trim(m3 / 1e9, 2)} km³`;
      if (m3 >= 1000) return `${Math.round(m3).toLocaleString("en-US")} m³`;
      if (m3 >= 0.001) return `${m3.toFixed(3)} m³`;
      if (m3 >= 1e-6) return `${(m3 * 1e6).toFixed(1)} cm³`;
      return `${(m3 * 1e9).toFixed(0)} mm³`;
    },

    // ---- plausibility -----------------------------------------------------

    // The models' largest side, in scene units (0 when nothing is loaded).
    getModelLargestSide() {
      const box = new THREE.Box3();
      (core.mainObject || []).flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
        .filter((root) => root?.isObject3D)
        .forEach((root) => box.expandByObject(root));
      if (box.isEmpty()) return 0;
      const size = box.getSize(new THREE.Vector3());
      return Math.max(size.x, size.y, size.z);
    },

    // null, or { meters: the largest side as measured now, suggestions: unit
    // keys that would make it plausible } - unless the user chose the unit.
    getModelUnitWarning() {
      const unit = Viewer.resolveModelUnit();
      if (unit.source === "user") return null;
      const side = Viewer.getModelLargestSide();
      if (!(side > 0)) return null;
      const meters = side * unit.meters;
      if (meters >= PLAUSIBLE_SIZE.min && meters <= PLAUSIBLE_SIZE.max) return null;
      const suggestions = Object.keys(MODEL_UNITS)
        .filter((key) => key !== unit.key)
        .filter((key) => {
          const size = side * MODEL_UNITS[key];
          return size >= SUGGESTED_SIZE.min && size <= SUGGESTED_SIZE.max;
        })
        // Metric first, then the closest to the unit assumed now.
        .sort((a, b) => {
          const imperial = (key) => (key === "in" || key === "ft" ? 1 : 0);
          const distance = (key) => Math.abs(Math.log(MODEL_UNITS[key] / unit.meters));
          return imperial(a) - imperial(b) || distance(a) - distance(b);
        });
      return { meters, suggestions: suggestions.slice(0, 3) };
    },

    describeModelUnitSource(source) {
      return t(`measurement.unitSource.${source}`, source);
    },
  });
}

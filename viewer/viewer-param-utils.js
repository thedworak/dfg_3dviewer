import THREE from "./init.js";

export function normalizeLanguage(value) {
  if (value == null) return null;
  const normalizedValue = String(value).trim().toLowerCase();
  if (normalizedValue.startsWith("pl")) return "pl";
  if (normalizedValue.startsWith("de")) return "de";
  if (normalizedValue.startsWith("en")) return "en";
  return null;
}

export function parseBooleanParam(value) {
  if (value == null) return null;
  const normalizedValue = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalizedValue)) return true;
  if (["0", "false", "no", "off"].includes(normalizedValue)) return false;
  return null;
}

export function parseFloatParam(value) {
  if (value == null || value === "") return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseVector2Param(value) {
  if (value == null || value === "") return null;
  const cleaned = String(value).replace(/[\[\]()]/g, " ").trim();
  const parts = cleaned.split(/[\s,;|]+/).filter(Boolean);
  if (parts.length !== 2) return null;
  const x = Number.parseFloat(parts[0]);
  const y = Number.parseFloat(parts[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return new THREE.Vector2(x, y);
}

export function parseVector3Param(value) {
  if (value == null || value === "") return null;
  const cleaned = String(value).replace(/[\[\]()]/g, " ").trim();
  const parts = cleaned.split(/[\s,;|]+/).filter(Boolean);
  if (parts.length !== 3) return null;
  const x = Number.parseFloat(parts[0]);
  const y = Number.parseFloat(parts[1]);
  const z = Number.parseFloat(parts[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return new THREE.Vector3(x, y, z);
}

export function formatVector3Param(vector) {
  if (!vector || typeof vector !== "object") return null;
  const x = Number(vector.x);
  const y = Number(vector.y);
  const z = Number(vector.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
}

export function parseProjectionParam(value) {
  if (value == null) return null;
  const normalizedValue = String(value).trim().toLowerCase();
  if (["perspective", "persp", "p"].includes(normalizedValue)) return "perspective";
  if (["orthographic", "ortho", "o"].includes(normalizedValue)) return "orthographic";
  return null;
}

export function parseClippingModeParam(value) {
  if (value == null) return null;
  const normalizedValue = String(value).trim().toLowerCase().replace(/[^xyz]/g, "");
  if (normalizedValue === "") return null;
  return {
    x: normalizedValue.includes("x"),
    y: normalizedValue.includes("y"),
    z: normalizedValue.includes("z"),
  };
}

export function formatClippingModeParam(mode) {
  if (!mode || typeof mode !== "object") return null;
  const value = [mode.x ? "x" : "", mode.y ? "y" : "", mode.z ? "z" : ""].join("");
  return value || null;
}

export function attachViewerParamHelpers(target) {
  return Object.assign(target, {
    normalizeLanguage,
    parseBooleanParam,
    parseFloatParam,
    parseVector2Param,
    parseVector3Param,
    formatVector3Param,
    parseProjectionParam,
    parseClippingModeParam,
    formatClippingModeParam,
  });
}

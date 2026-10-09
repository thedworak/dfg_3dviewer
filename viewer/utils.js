import { core, setCore } from './core.js';

// Geometry helpers
export function distanceBetweenPoints(pointA, pointB) {
  return Math.sqrt(
    Math.pow(pointB.x - pointA.x, 2) +
    Math.pow(pointB.y - pointA.y, 2) +
    Math.pow(pointB.z - pointA.z, 2)
  );
}

export function distanceBetweenPointsVector(vector) {
  return Math.sqrt(
    Math.pow(vector.x, 2) +
    Math.pow(vector.y, 2) +
    Math.pow(vector.z, 2)
  );
}

export function vectorBetweenPoints(pointA, pointB) {
  return {
    x: pointB.x - pointA.x,
    y: pointB.y - pointA.y,
    z: pointB.z - pointA.z
  };
}

export function halfwayBetweenPoints(pointA, pointB) {
  return {
    x: (pointB.x + pointA.x) / 2,
    y: (pointB.y + pointA.y) / 2,
    z: (pointB.z + pointA.z) / 2
  };
}

export function interpolateDistanceBetweenPoints(pointA, vector, length, scalar) {
  const _x = pointA.x + (scalar / Math.abs(length)) * vector.x;
  const _y = pointA.y + (scalar / Math.abs(length)) * vector.y;
  const _z = pointA.z + (scalar / Math.abs(length)) * vector.z;
  return { x: _x, y: _y, z: _z };
}

export function detectColorFormat(color) {
  const hexRegex = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  const rgbRegex = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/;
  if (hexRegex.test(color)) return "hex";
  if (rgbRegex.test(color)) return "rgb";
  return "unknown";
}

export function hexToRgb(hex) {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map((char) => char + char).join("");
  }
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgb(${r}, ${g}, ${b})`;
}

// String helpers
export function isValidUrl(urlString) {
  const urlPattern = new RegExp(
    "^(https?:\\/\\/)?" +
    "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" +
    "((\\d{1,3}\\.){3}\\d{1,3}))" +
    "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" +
    "(\\?[;&a-z\\d%_.~+=-]*)?" +
    "(\\#[-a-z\\d_]*)?$",
    "i"
  );
  return !!urlPattern.test(urlString);
}

export function truncateString(str, n) {
  if (str.length === 0) return str;
  if (str.length > n) return str.substring(0, n) + "...";
  return str;
}

// Path helpers
export function getProxyPath(url, config) {
  const tempPath = decodeURIComponent(config.mainUrl);
  return tempPath.replace(core.fileObject.originalPath, encodeURIComponent(url));
}

setCore("getProxyPath", getProxyPath);

export function normalizeColor(value) {
  if (value == null) return null;

  //legacy: [[r,g,b]]
  if (Array.isArray(value) && Array.isArray(value[0])) {
    value = value[0];
  }

  //already normalized
  if (
    typeof value === "object" &&
    value !== null &&
    typeof value.r === "number" &&
    typeof value.g === "number" &&
    typeof value.b === "number"
  ) {
    return {
      r: value.r,
      g: value.g,
      b: value.b,
      a: value.a ?? 1
    };
  }

  //[r, g, b, a?]
  if (Array.isArray(value)) {
    const [r, g, b, a = 1] = value;
    if (
      typeof r === "number" &&
      typeof g === "number" &&
      typeof b === "number"
    ) {
      return { r, g, b, a };
    }
    return null;
  }

  //number (0xffffff or 16777215)
  if (typeof value === "number") {
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255,
      a: 1
    };
  }

  //string
  if (typeof value === "string") {
    return parseCssColor(value);
  }

  return null;
}

export function parseCssColor(str) {
  if (typeof str !== "string") return null;

  str = str.trim();

  // 0xFFFFFF
  if (str.startsWith("0x")) {
    const n = parseInt(str, 16);
    return {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255,
      a: 1
    };
  }

  // #RGB / #RRGGBB
  if (str.startsWith("#")) {
    let hex = str.slice(1);

    if (hex.length === 3) {
      hex = hex.split("").map(c => c + c).join("");
    }

    if (hex.length !== 6) return null;

    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1
    };
  }

  // rgb / rgba
  const m = str.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i
  );

  if (m) {
    const [, r, g, b, a] = m;
    return {
      r: +r,
      g: +g,
      b: +b,
      a: a !== undefined ? +a : 1
    };
  }

  return null;
}

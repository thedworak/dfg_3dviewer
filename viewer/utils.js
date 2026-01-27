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
export function getProxyPath(url, config, fileObject) {
  const tempPath = decodeURIComponent(config.mainUrl);
  return tempPath.replace(fileObject.originalPath, encodeURIComponent(url));
}


export function normalizeColor(value) {
  if (Array.isArray(value)) value = value[0];

  if (typeof value === "number") {
    return new THREE.Color(value);
  }

  if (typeof value === "string") {
    if (value.startsWith("#")) {
      return new THREE.Color(value);
    }

    if (value.startsWith("0x")) {
      return new THREE.Color(parseInt(value, 16));
    }
  }

  return new THREE.Color(0xffffff);
};
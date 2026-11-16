// The real terrain round a place, for the generated surroundings
// (editor/surroundings.js, `terrain: "real"`): elevation tiles in the
// Terrarium encoding (height = R * 256 + G + B / 256 - 32768 metres), by
// default the open Terrain Tiles on AWS (Mapzen; SRTM, EU-DEM and others,
// about 10-30 m in Europe). Only the place's coordinates go out, as tile
// numbers. `viewer.surroundings.elevationUrl` in viewer-settings.json
// changes the source; null switches the real terrain off.
//
// The heights are relative to the model's place, and blended to it near the
// model (the model keeps standing where it stands).

export const DEFAULT_ELEVATION_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const TILE = 256;
const EARTH = 156543.03392;
// Elevations fetched: one per place, size and source.
const cache = new Map();

// The metres per pixel of a zoom at a latitude.
export function metresPerPixel(latitude, zoom) {
  return (EARTH * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
}

// The zoom that covers `radius` metres with about 1.5 tiles each way, at
// most 14 (about 6 m a pixel in Central Europe), at least 8.
export function elevationZoom(latitude, radius) {
  const wanted = Math.max((radius * 2) / (TILE * 2.5), 5);
  return Math.min(14, Math.max(8, Math.round(Math.log2((EARTH * Math.cos((latitude * Math.PI) / 180)) / wanted))));
}

// The place in pixels of the whole world at a zoom (Web Mercator).
export function worldPixel(latitude, longitude, zoom) {
  const size = TILE * 2 ** zoom;
  const sin = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

export function decodeTerrarium(r, g, b) {
  return r * 256 + g + b / 256 - 32768;
}

async function fetchTile(url) {
  const response = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!response.ok) throw new Error(`Elevation tile ${response.status}: ${url}`);
  const bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const canvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(TILE, TILE) : Object.assign(document.createElement("canvas"), { width: TILE, height: TILE });
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, TILE, TILE);
  bitmap.close?.();
  return context.getImageData(0, 0, TILE, TILE).data;
}

/**
 * The elevation round a place: { zoom, metresPerPixel, origin: {x, y} (the
 * place in the grid's pixels), width, height, heights (Float32Array),
 * centre (the place's height) }. Fetched once per place and radius.
 */
export function loadElevation({ latitude, longitude, radius, url = DEFAULT_ELEVATION_URL }) {
  const zoom = elevationZoom(latitude, radius);
  const key = [latitude.toFixed(5), longitude.toFixed(5), zoom, Math.round(radius), url].join("|");
  if (cache.has(key)) return cache.get(key);
  const promise = (async () => {
    const mpp = metresPerPixel(latitude, zoom);
    const centre = worldPixel(latitude, longitude, zoom);
    const span = radius / mpp + 2;
    const tiles = { x0: Math.floor((centre.x - span) / TILE), x1: Math.floor((centre.x + span) / TILE), y0: Math.floor((centre.y - span) / TILE), y1: Math.floor((centre.y + span) / TILE) };
    const count = 2 ** zoom;
    const width = (tiles.x1 - tiles.x0 + 1) * TILE;
    const height = (tiles.y1 - tiles.y0 + 1) * TILE;
    const heights = new Float32Array(width * height);
    const jobs = [];
    for (let ty = tiles.y0; ty <= tiles.y1; ty += 1) {
      for (let tx = tiles.x0; tx <= tiles.x1; tx += 1) {
        const wrapped = ((tx % count) + count) % count;
        const tileUrl = url.replace("{z}", zoom).replace("{x}", wrapped).replace("{y}", ty);
        jobs.push(fetchTile(tileUrl).then((data) => {
          const ox = (tx - tiles.x0) * TILE;
          const oy = (ty - tiles.y0) * TILE;
          for (let y = 0; y < TILE; y += 1) {
            for (let x = 0; x < TILE; x += 1) {
              const index = (y * TILE + x) * 4;
              heights[(oy + y) * width + ox + x] = decodeTerrarium(data[index], data[index + 1], data[index + 2]);
            }
          }
        }));
      }
    }
    await Promise.all(jobs);
    const origin = { x: centre.x - tiles.x0 * TILE, y: centre.y - tiles.y0 * TILE };
    const elevation = { zoom, metresPerPixel: mpp, origin, width, height, heights, centre: 0 };
    elevation.centre = sampleElevation(elevation, origin.x, origin.y);
    return elevation;
  })();
  cache.set(key, promise);
  // A failure is not kept: tried again next time.
  promise.catch(() => cache.delete(key));
  return promise;
}

// Bilinear, in the grid's pixels.
export function sampleElevation(elevation, px, py) {
  const { width, height, heights } = elevation;
  const x = Math.min(Math.max(px - 0.5, 0), width - 1.001);
  const y = Math.min(Math.max(py - 0.5, 0), height - 1.001);
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const at = (cx, cy) => heights[cy * width + cx];
  const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * fx;
  const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * fx;
  return top + (bottom - top) * fy;
}

/**
 * The height at a place of the layout (x, z in metres round the model), as
 * surroundings-rules.js reads it (layout.heightfield): relative to the
 * model's place, 0 within `flat` metres of it, blended in up to `blend`.
 * `north`: degrees clockwise from -Z where north lies (the sun study's).
 */
export function createHeightfield(elevation, { north = 0, flat = 30, blend = 80 } = {}) {
  const angle = (north * Math.PI) / 180;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const mpp = elevation.metresPerPixel;
  return (x, z) => {
    const distance = Math.hypot(x, z);
    if (distance <= flat) return 0;
    const northing = x * sin - z * cos;
    const easting = x * cos + z * sin;
    const relative = sampleElevation(elevation, elevation.origin.x + easting / mpp, elevation.origin.y - northing / mpp) - elevation.centre;
    const t = Math.min(1, (distance - flat) / Math.max(blend - flat, 1));
    return relative * t * t * (3 - 2 * t);
  };
}

/**
 * An old map's tiles round a place, stitched: { canvas, zoom,
 * metresPerPixel, origin (the place in the canvas's pixels), centre (the
 * place in the world's pixels of the zoom), width, height }. `url` has {z}, {x}, {y} (and {s}: "a"); the tiles must allow
 * cross-origin use. At most `maxTiles` along each side (the zoom is chosen
 * for it). Tiles that fail stay empty. Loaded once per place and URL.
 */
export function loadMapOverlay({ latitude, longitude, radius, url, maxTiles = 10 }) {
  const minMpp = (radius * 2) / (maxTiles * TILE - 2 * TILE);
  const zoom = Math.min(19, Math.max(1, Math.floor(Math.log2((EARTH * Math.cos((latitude * Math.PI) / 180)) / minMpp))));
  const key = ["overlay", latitude.toFixed(5), longitude.toFixed(5), zoom, url].join("|");
  if (cache.has(key)) return cache.get(key);
  const promise = (async () => {
    const mpp = metresPerPixel(latitude, zoom);
    const centre = worldPixel(latitude, longitude, zoom);
    const span = radius / mpp + 2;
    const x0 = Math.floor((centre.x - span) / TILE);
    const x1 = Math.floor((centre.x + span) / TILE);
    const y0 = Math.floor((centre.y - span) / TILE);
    const y1 = Math.floor((centre.y + span) / TILE);
    const width = (x1 - x0 + 1) * TILE;
    const height = (y1 - y0 + 1) * TILE;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    const count = 2 ** zoom;
    let loaded = 0;
    const jobs = [];
    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        const wrapped = ((tx % count) + count) % count;
        const tileUrl = url.replace("{s}", "a").replace("{z}", zoom).replace("{x}", wrapped).replace("{y}", ty);
        jobs.push(fetch(tileUrl, { mode: "cors", credentials: "omit" })
          .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(`Map tile ${response.status}`))))
          .then((blob) => createImageBitmap(blob))
          .then((bitmap) => {
            context.drawImage(bitmap, (tx - x0) * TILE, (ty - y0) * TILE, TILE, TILE);
            bitmap.close?.();
            loaded += 1;
          })
          .catch(() => {}));
      }
    }
    await Promise.all(jobs);
    if (!loaded) throw new Error("No tile of the old map could be loaded");
    return { canvas, zoom, metresPerPixel: mpp, origin: { x: centre.x - x0 * TILE, y: centre.y - y0 * TILE }, centre, width, height };
  })();
  cache.set(key, promise);
  promise.catch(() => cache.delete(key));
  return promise;
}

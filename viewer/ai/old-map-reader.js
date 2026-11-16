import { apiUrl, appRequestHeaders } from "../remote.js";
import { t } from "../i18n-utils.js";
import { AIRequestError, aiRequest } from "./ai-client.js";

// An old map read by the worker's AI assistance (worker/ai.py, "old-map"):
// the picture of the map draped over the generated surroundings
// (editor/surroundings.js, its tiles stitched by surroundings-terrain.js)
// goes to the worker, which asks Claude for the roads, buildings, fields,
// water and walls it draws, in the picture's pixels; they come back as
// GeoJSON in degrees, for the surroundings and for the researcher to check
// and correct (in QGIS, say) before relying on them. Every feature carries
// `source: "ai"`.
//
// The reading runs in the background on the worker (it takes minutes):
// POST /api/ai/old-map answers an id, GET /api/ai/old-map/<id> how it goes.

// The longest side sent: what the current models read at full resolution
// (their coordinates then map 1:1 to the picture's pixels).
export const OLD_MAP_MAX_SIDE = 2576;
const POLL_MS = 3000;
const POLL_LIMIT_MS = 12 * 60 * 1000;

// A canvas made smaller to at most `maxSide` pixels on its long side:
// { canvas, scale } (scale: picture pixels per canvas pixel).
export function scaleCanvas(source, maxSide = OLD_MAP_MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  if (scale === 1) return { canvas: source, scale };
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(16, Math.round(source.width * scale));
  canvas.height = Math.max(16, Math.round(source.height * scale));
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  return { canvas, scale: canvas.width / source.width };
}

/**
 * Pixels of the stitched map's canvas to degrees: the place sits at
 * `origin` (canvas pixels), at `centre` in the world's pixels of `zoom`
 * (Web Mercator, surroundings-terrain.js worldPixel).
 */
export function canvasPixelToLonLat(x, y, { origin, centre, zoom }) {
  const size = 256 * 2 ** zoom;
  const gx = centre.x + (x - origin.x);
  const gy = centre.y + (y - origin.y);
  const lon = (gx / size) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * gy) / size))) * 180) / Math.PI;
  return [Math.round(lon * 1e7) / 1e7, Math.round(lat * 1e7) / 1e7];
}

/**
 * The worker's answer (pixels of the picture sent, which was `scale` times
 * the canvas) as a GeoJSON FeatureCollection in the format of
 * surroundings-map.js (mapGeoJsonToAnswer).
 */
export function oldMapAnswerToGeoJson(answer, { scale, origin, centre, zoom, metresPerPixel, year = null, model = "" }) {
  const toCoordinates = (points) => (points || []).map((point) => canvasPixelToLonLat(point.x / scale, point.y / scale, { origin, centre, zoom }));
  const ring = (points) => {
    const coordinates = toCoordinates(points);
    if (coordinates.length && (coordinates[0][0] !== coordinates.at(-1)[0] || coordinates[0][1] !== coordinates.at(-1)[1])) coordinates.push(coordinates[0]);
    return coordinates;
  };
  const metres = (pixels) => Math.max(1, Math.round(((Number(pixels) || 0) / scale) * metresPerPixel * 10) / 10);
  const base = { source: "ai", ...(model ? { model } : {}), ...(Number.isFinite(year) ? { read_for_year: year } : {}) };
  const features = [];
  const add = (properties, geometry) => features.push({ type: "Feature", properties: { ...base, ...properties }, geometry });
  (answer.roads || []).forEach((road) => add({ kind: "road", width: metres(road.width_px) }, { type: "LineString", coordinates: toCoordinates(road.points) }));
  (answer.buildings || []).forEach((building) => add(
    { kind: "building", role: building.kind === "other" ? "house" : building.kind, height: building.kind === "church" ? 12 : building.kind === "tower" ? 20 : 6 },
    { type: "Polygon", coordinates: [ring(building.points)] },
  ));
  (answer.fields || []).forEach((field) => add({ kind: "field" }, { type: "Polygon", coordinates: [ring(field.points)] }));
  (answer.water || []).forEach((water) => {
    if (water.kind === "lake") add({ kind: "lake" }, { type: "Polygon", coordinates: [ring(water.points)] });
    else add({ kind: water.kind === "stream" ? "stream" : "river", width: metres(water.width_px) }, { type: "LineString", coordinates: toCoordinates(water.points) });
  });
  (answer.walls || []).forEach((wall) => add({ kind: wall.kind }, { type: "LineString", coordinates: toCoordinates(wall.points) }));
  return { type: "FeatureCollection", features, properties: { notes: answer.notes || "", readable: answer.readable !== false, ...base } };
}

function canvasToBase64(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("The map could not be encoded"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    }, "image/jpeg", 0.88);
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reads the stitched map (`overlay`: surroundings-terrain.js loadMapOverlay,
 * with `centre` - the place in the world's pixels) on the worker; resolves
 * to the GeoJSON. `onProgress(state)`: "sending" | "reading".
 */
export async function readOldMap(overlay, { year = null, onProgress = () => {}, pollMs = POLL_MS } = {}) {
  const { canvas, scale } = scaleCanvas(overlay.canvas);
  onProgress("sending");
  const image = await canvasToBase64(canvas);
  const started = await aiRequest("/api/ai/old-map", {
    image,
    mediaType: "image/jpeg",
    width: canvas.width,
    height: canvas.height,
    metresPerPixel: overlay.metresPerPixel / scale,
    ...(Number.isFinite(year) ? { year } : {}),
  });
  if (!started?.id) throw new AIRequestError(t("ai.failed", "The AI assistant could not answer."));
  onProgress("reading");
  const until = Date.now() + POLL_LIMIT_MS;
  while (Date.now() < until) {
    await wait(pollMs);
    let job;
    try {
      const response = await fetch(apiUrl(`/api/ai/old-map/${started.id}`), { cache: "no-store", headers: appRequestHeaders() });
      job = await response.json();
    } catch {
      continue;
    }
    if (job?.state === "done") {
      return oldMapAnswerToGeoJson(job.answer || {}, { scale, origin: overlay.origin, centre: overlay.centre, zoom: overlay.zoom, metresPerPixel: overlay.metresPerPixel, year, model: job.answer?.model });
    }
    if (job?.state === "failed" || job?.code === "not_found") throw new AIRequestError(job.error || t("ai.failed", "The AI assistant could not answer."), job.status || 0, job.code || "");
  }
  throw new AIRequestError(t("ai.timeout", "The AI answer took too long. Try again or ask a narrower question."), 0, "ai_timeout");
}

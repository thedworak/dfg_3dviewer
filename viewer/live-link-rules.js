// Live link (editor/live-link.js): the rules that need neither the DOM nor
// three.js - what changed between two versions of a manifest, what a shared
// session's camera may hold. This also runs in Node (the tests).

export const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

// The blocks of AIM3DViewer a shared session carries from viewer to viewer
// (the camera and the timeline's year travel beside them, more often).
export const LIVE_SESSION_BLOCKS = ["clipping", "variants", "compare", "lights", "rakingLight", "location", "sun", "weather", "surroundings", "materials", "measurements", "modelTransform", "timeline", "data", "certainty", "photos", "sounds"];

// What a session carries beside those blocks, each read and shown by the
// viewer itself (editor/live-link.js): the comments, the scene's cameras,
// the photo held over the view, and the tools of what is not a mesh - a
// 2D image, a sound file, a point cloud, a volume.
export const LIVE_SESSION_PARTS = ["comments", "cameras", "photo", "image", "audio", "pointCloud", "volume"];

// What a session carries of the `viewer` block, as its "look": the ground,
// the background, the environment and the rendering. The rest of that block
// is each viewer's own (its language, its theme, its toolbars).
export const LIVE_SESSION_LOOK = ["ground", "backgroundColor", "environmentMap", "rendering", "splatLighting"];

// A block larger than this (as JSON) stays out of a state: the relay takes
// 64 kB for all of it.
export const LIVE_SESSION_BLOCK_LIMIT = 24000;

// The look in a `viewer` block, or undefined when it has none of it.
export function sessionLook(viewer) {
  if (!viewer || typeof viewer !== "object") return undefined;
  const look = {};
  LIVE_SESSION_LOOK.forEach((key) => {
    if (viewer[key] !== undefined && viewer[key] !== null) look[key] = viewer[key];
  });
  return Object.keys(look).length ? look : undefined;
}

// The parts of a look that differ from the one shown (`own`).
export function changedSessionLook(look, own) {
  const changed = {};
  if (!look || typeof look !== "object") return changed;
  LIVE_SESSION_LOOK.forEach((key) => {
    if (look[key] === undefined || look[key] === null) return;
    if (JSON.stringify(look[key]) !== JSON.stringify(own?.[key])) changed[key] = look[key];
  });
  return changed;
}

// The background as the canvas shows it: a CSS gradient of colours and
// nothing else (no address to fetch), or null.
export function normalizeSessionBackground(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length <= 400 && /^(?:radial|linear)-gradient\([a-z0-9#%.,()\s-]+\)$/i.test(text) && !/url|image|var|attr|env/i.test(text) ? text : null;
}

export const SESSION_PROJECTIONS = ["perspective", "orthographic"];

// Not the scene: when the manifest was written, and its gallery renders.
const IGNORED_BLOCKS = new Set(["version", "generatedAt", "thumbnails"]);

const ID_LETTERS = "abcdefghijkmnpqrstuvwxyz23456789";

// A session's id: its key, so long and random. Without letters and digits
// that are mistaken for each other when read out (l, o, 0, 1).
export function newSessionId(length = 14) {
  const bytes = new Uint8Array(Math.max(8, length));
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ID_LETTERS[byte % ID_LETTERS.length]).join("");
}

export const SESSION_NICK_LENGTH = 40;

// The name someone comes into a session under, as the others see it: one
// line, no control characters, trimmed (the worker does the same).
export function normalizeSessionNick(value) {
  if (typeof value !== "string") return "";
  const text = value.normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").replace(/\s+/g, " ").trim();
  return Array.from(text).slice(0, SESSION_NICK_LENGTH).join("").trim();
}

const triple = (value) => {
  const list = Array.isArray(value) ? value : value && typeof value === "object" ? [value.x, value.y, value.z] : null;
  if (!list || list.length < 3) return null;
  const numbers = list.slice(0, 3).map(Number);
  return numbers.every((number) => Number.isFinite(number) && Math.abs(number) < 1e9) ? numbers.map((number) => Math.round(number * 1e5) / 1e5) : null;
};

// A camera as a manifest or another viewer gives it -> { position, target,
// up, fov, zoom, projection } with nothing but finite numbers in range (and
// a projection that exists), or null.
export function normalizeSessionCamera(raw) {
  if (!raw || typeof raw !== "object") return null;
  const position = triple(raw.position);
  const target = triple(raw.target);
  if (!position || !target) return null;
  if (position.every((value, index) => value === target[index])) return null;
  const up = triple(raw.up);
  const upLength = up ? Math.hypot(...up) : 0;
  const fov = Number(raw.fov);
  const zoom = Number(raw.zoom);
  return {
    position,
    target,
    ...(upLength > 1e-6 ? { up: up.map((value) => Math.round((value / upLength) * 1e5) / 1e5) } : {}),
    ...(Number.isFinite(fov) && fov >= 1 && fov <= 170 ? { fov: Math.round(fov * 100) / 100 } : {}),
    ...(Number.isFinite(zoom) && zoom > 0 && zoom < 1e6 ? { zoom: Math.round(zoom * 1e4) / 1e4 } : {}),
    ...(SESSION_PROJECTIONS.includes(raw.projection) ? { projection: raw.projection } : {}),
  };
}

// Whether two cameras show the same view (within a ten-thousandth of the
// distance they look from).
export function sameSessionCamera(a, b) {
  if (!a || !b) return false;
  const reach = Math.max(Math.hypot(...a.position.map((value, index) => value - a.target[index])), 1e-6);
  const close = (left, right, scale) => left.every((value, index) => Math.abs(value - right[index]) <= scale);
  return close(a.position, b.position, reach * 1e-4)
    && close(a.target, b.target, reach * 1e-4)
    && Math.abs((a.fov ?? 0) - (b.fov ?? 0)) < 0.05
    && Math.abs((a.zoom ?? 1) - (b.zoom ?? 1)) < 1e-3
    // One that does not say (an older viewer) leaves the projection alone.
    && (!a.projection || !b.projection || a.projection === b.projection)
    && (!a.up || !b.up || close(a.up, b.up, 1e-3));
}

const scenesOf = (manifest) => (Array.isArray(manifest?.items) ? manifest.items.filter((item) => item?.type === "Scene") : []);

// What the manifest's scenes show: each painted body (model, image, sound)
// by its id and type, in order. Another answer means another model.
export function manifestModels(manifest) {
  return scenesOf(manifest).map((scene) => (Array.isArray(scene.items) ? scene.items : [])
    .flatMap((page) => (Array.isArray(page?.items) ? page.items : []))
    .map((annotation) => {
      const body = Array.isArray(annotation?.body) ? annotation.body[0] : annotation?.body;
      const source = body?.source && typeof body.source === "object" ? (Array.isArray(body.source) ? body.source[0] : body.source) : body;
      return source?.id && /^(Model|Image|Sound|Canvas|Video)$/.test(source.type || "") ? `${source.type}:${source.id}` : null;
    })
    .filter(Boolean));
}

function commentsOf(manifest) {
  return [
    ...scenesOf(manifest).map((scene) => scene.annotations ?? null),
    manifest?.annotations ?? null,
  ];
}

// The parts of the scene that differ between two versions of a manifest:
// the keys of AIM3DViewer (a block added, changed or taken away), and
// "annotations" for the comments.
export function changedManifestBlocks(before, after) {
  const old = before?.AIM3DViewer && typeof before.AIM3DViewer === "object" ? before.AIM3DViewer : {};
  const now = after?.AIM3DViewer && typeof after.AIM3DViewer === "object" ? after.AIM3DViewer : {};
  const changed = [...new Set([...Object.keys(old), ...Object.keys(now)])]
    .filter((key) => !IGNORED_BLOCKS.has(key) && JSON.stringify(old[key]) !== JSON.stringify(now[key]));
  if (JSON.stringify(commentsOf(before)) !== JSON.stringify(commentsOf(after))) changed.push("annotations");
  return changed;
}

// What an AIM3D/IIIF manifest contains and whether each of its values is
// right: every attribute (every leaf of the JSON) is checked against a
// description of the known attributes below, and the result is grouped into
// features (model, annotations, timeline, photos...) - one icon each in the
// manifest lists. No three.js and no DOM here: this also runs in Node
// (scripts/inspect-manifest.mjs, the tests).
//
//   inspectAIM3DManifest(manifest) -> {
//     status: "ok" | "warning" | "error",
//     summary: { errors, warnings, infos, attributes, unknown },
//     features: [{ id, icon, label, present, count, status, errors, warnings }],
//     attributes: [{ path, value, level, feature, known, issues: [{ level, message }] }],
//   }
//
// Levels: "error" - the viewer cannot use the value (validateAIM3DManifest
// would reject the manifest, or IIIF requires otherwise); "warning" - it
// loads, but the value is probably wrong (a local URL, an empty text, a
// colour the browser does not know); "info" - worth knowing (an attribute
// the viewer does not know and ignores, a recommended one missing); "ok".
// validateAIM3DManifest stays the authority: its errors always win.

import {
  COMPARE_KINDS,
  COMPARE_LIGHTINGS,
  COMPARE_MODES,
  RENDERING_ANTIALIAS_MODES,
  RENDERING_TONE_MAPPINGS,
  SHADING_MODES,
  TIMELINE_STAGE_TYPES,
  TIMELINE_TRANSITIONS,
  WEATHER_TYPES,
  normalizeAIM3DManifest,
  validateAIM3DManifest,
} from "./aim3dviewer-validation.js";
import { CERTAINTY_SCOPES } from "./certainty-scale.js";

export const INSPECTION_SCHEMA = "explora4d-manifest-inspection/1";

const LEVELS = ["ok", "info", "warning", "error"];
const MAX_TEXT = 200;

// Keep in sync with LIGHT_TYPES / CAMERA_TYPES in viewer/IIIF/presentation4.js
// and the light types annotations.js exports.
const LIGHT_TYPES = ["AmbientLight", "DirectionalLight", "PointLight", "SpotLight", "HemisphereLight"];
const CAMERA_TYPES = ["PerspectiveCamera", "OrthographicCamera"];
const TRANSFORM_TYPES = ["RotateTransform", "ScaleTransform", "TranslateTransform"];
const MOTIVATIONS = [
  "painting", "supplementing", "commenting", "describing", "tagging", "linking", "highlighting",
  "identifying", "assessing", "bookmarking", "classifying", "editing", "moderating", "questioning",
  "replying", "contentState", "activating", "transforming",
];
const ROTATION_ORDERS = ["XYZ", "XZY", "YXZ", "YZX", "ZXY", "ZYX"];

// ---- the features (icons) ------------------------------------------------------

const isObject = (value) => value != null && typeof value === "object" && !Array.isArray(value);
const asArray = (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value]);
const typeOf = (value) => (isObject(value) ? value.type || value["@type"] || null : null);
const block = (manifest) => (isObject(manifest.AIM3DViewer) ? manifest.AIM3DViewer : {});
const has = (value) => (value !== undefined ? 1 : 0);
const length = (value) => (Array.isArray(value) ? value.length : 0);

function annotationsOf(manifest, pages) {
  return asArray(manifest.items).flatMap((scene) => asArray(scene?.[pages]))
    .concat(pages === "annotations" ? asArray(manifest.annotations) : [])
    .flatMap((page) => asArray(page?.items))
    .filter(isObject);
}

function paintedBodies(manifest) {
  return annotationsOf(manifest, "items").flatMap((annotation) => asArray(annotation.body))
    .map((body) => (typeOf(body) === "SpecificResource" && isObject(body.source) ? body.source : body))
    .filter(isObject);
}

function bodyFeature(body) {
  const resource = typeOf(body) === "SpecificResource" && isObject(body?.source) ? body.source : body;
  const type = typeOf(resource);
  if (CAMERA_TYPES.includes(type)) return "camera";
  if (LIGHT_TYPES.includes(type)) return "lights";
  return "model";
}

// The order is the order of the icons. `count` says whether the manifest has
// the feature (0 = not set) and how much of it.
export const MANIFEST_FEATURES = [
  { id: "model", label: "3D model", count: (m) => paintedBodies(m).filter((body) => bodyFeature(body) === "model").length },
  {
    id: "metadata",
    label: "Descriptive metadata",
    count: (m) => ["label", "summary", "metadata", "provider", "homepage", "navDate"].filter((key) => m[key] !== undefined).length,
  },
  { id: "rights", label: "Rights and attribution", count: (m) => has(m.rights) + has(m.requiredStatement) },
  { id: "annotations", label: "Annotations", count: (m) => annotationsOf(m, "annotations").length },
  {
    id: "camera",
    label: "Camera view",
    count: (m) => has(block(m).camera) + paintedBodies(m).filter((body) => bodyFeature(body) === "camera").length,
  },
  {
    id: "lights",
    label: "Lights",
    count: (m) => length(block(m).lights) + paintedBodies(m).filter((body) => bodyFeature(body) === "lights").length,
  },
  { id: "raking-light", label: "Raking light", count: (m) => has(block(m).rakingLight) },
  { id: "clipping", label: "Section planes", count: (m) => has(block(m).clipping) + has(block(m).viewer?.clipping) },
  { id: "timeline", label: "4D timeline", count: (m) => (block(m).timeline ? Math.max(length(block(m).timeline.stages), 1) : 0) },
  { id: "variants", label: "Reconstruction variants", count: (m) => length(block(m).variants?.items) || has(block(m).variants) },
  { id: "compare", label: "Comparison view", count: (m) => has(block(m).compare) },
  { id: "photos", label: "Historical photos", count: (m) => length(block(m).photos) },
  { id: "location", label: "Geographic location", count: (m) => has(block(m).location) },
  { id: "sun", label: "Sun study", count: (m) => has(block(m).sun) },
  { id: "weather", label: "Weather", count: (m) => has(block(m).weather) },
  {
    id: "certainty",
    label: "Level of certainty",
    count: (m) => has(block(m).certainty)
      + annotationsOf(m, "annotations").filter((annotation) => annotation.AIM3DViewer?.certainty !== undefined).length,
  },
  { id: "thumbnails", label: "Thumbnails", count: (m) => length(block(m).thumbnails) },
  { id: "transform", label: "Model transform and shading", count: (m) => has(block(m).modelTransform) },
  {
    id: "rendering",
    label: "Rendering and environment",
    count: (m) => has(block(m).viewer?.rendering) + has(block(m).viewer?.environmentMap) + has(block(m).viewer?.backgroundColor),
  },
  { id: "tour", label: "Guided tour", count: (m) => has(block(m).viewer?.tour) },
  { id: "settings", label: "Viewer settings", count: (m) => has(block(m).viewer) + has(block(m).integration) },
  { id: "manifest", label: "IIIF structure", count: () => 1 },
];

// ---- value checks ------------------------------------------------------------
// A check returns null (fine) or [level, message].

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

function text(value) {
  if (typeof value !== "string") return ["error", "must be a string"];
  if (!value.trim()) return ["warning", "is empty"];
  return null;
}

const anyString = (value) => (typeof value === "string" ? null : ["error", "must be a string"]);
const bool = (value) => (typeof value === "boolean" ? null : ["error", "must be a boolean"]);

function number({ min, max, above, below, integer, level = "error" } = {}) {
  return (value) => {
    if (!isFiniteNumber(value)) return ["error", "must be a finite number"];
    if (integer && !Number.isInteger(value)) return [level, "must be a whole number"];
    if (min !== undefined && value < min) return [level, max !== undefined ? `must be from ${min} to ${max}` : `must be >= ${min}`];
    if (max !== undefined && value > max) return [level, min !== undefined ? `must be from ${min} to ${max}` : `must be <= ${max}`];
    if (above !== undefined && value <= above) return [level, below !== undefined ? `must be between ${above} and ${below}` : `must be > ${above}`];
    if (below !== undefined && value >= below) return [level, above !== undefined ? `must be between ${above} and ${below}` : `must be < ${below}`];
    return null;
  };
}

const num = number();

function oneOf(values, level = "error") {
  return (value) => (values.includes(value) ? null : [level, `must be one of: ${values.join(", ")}`]);
}

const LOCAL_HOST = /^(localhost|127(?:\.\d+){3}|0\.0\.0\.0|\[::1\])$/i;

// An absolute URI (http(s), urn, data, mailto...) or a path relative to the
// manifest. Addresses of this computer work for nobody else.
function url(value, fetched = false) {
  const problem = text(value);
  if (problem) return problem;
  const trimmed = value.trim();
  if (/\s/.test(trimmed)) return ["warning", "contains spaces - must be URL-encoded"];
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Relative: resolved against the manifest's own URL.
    return null;
  }
  if (/^https?:$/.test(parsed.protocol) && LOCAL_HOST.test(parsed.hostname)) {
    return ["warning", `points at ${parsed.hostname} - works only on the computer that made it`];
  }
  // Identifiers may be http; files the viewer downloads are blocked on https pages.
  if (fetched && parsed.protocol === "http:") return ["info", "uses http - browsers block it on https pages (mixed content)"];
  return null;
}

// Colours the viewer passes to three.js / CSS: #rgb, #rrggbb, rgb(), hsl()
// or a colour name.
function color(value) {
  if (typeof value !== "string") return ["error", "must be a colour string"];
  const trimmed = value.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return null;
  if (/^#([0-9a-f]{4}|[0-9a-f]{8})$/i.test(trimmed)) return ["info", "has an alpha channel, which the viewer ignores"];
  if (/^(rgb|hsl)a?\([^)]*\)$/i.test(trimmed) || /^[a-z]+$/i.test(trimmed)) return null;
  return ["warning", "is not a colour (#rrggbb expected)"];
}

function isoDate(value) {
  if (typeof value !== "string") return ["error", "must be a date string"];
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(value.trim()) || Number.isNaN(Date.parse(value))) {
    return ["warning", "is not an ISO 8601 date (YYYY-MM-DDThh:mm:ssZ)"];
  }
  return null;
}

function mediaType(value) {
  if (typeof value !== "string") return ["error", "must be a string"];
  return /^[a-z]+\/[a-z0-9.+-]+$/i.test(value.trim()) ? null : ["warning", "is not a media type (e.g. model/gltf-binary)"];
}

// IIIF rights: a Creative Commons licence or a RightsStatements.org statement.
function rights(value) {
  if (typeof value === "string" && !/^[a-z][a-z0-9+.-]*:/i.test(value.trim())) {
    return ["warning", "must be a licence URI, e.g. https://creativecommons.org/licenses/by/4.0/"];
  }
  const problem = url(value);
  if (problem) return problem;
  if (!/^https?:\/\/(creativecommons\.org\/(licenses|publicdomain)\/|rightsstatements\.org\/vocab\/)/.test(value.trim())) {
    return ["info", "is not a Creative Commons or RightsStatements.org URI, which IIIF expects"];
  }
  return null;
}

const languageKey = (key) => (
  key === "none" || /^[a-z]{2,3}(-[A-Za-z0-9]{1,8})*$/.test(key) ? null : ["warning", `"${key}" is not a language code (BCP 47, e.g. "en", "pl")`]
);

const sunDate = (value) => (
  typeof value === "string" && /^(-?\d{1,4}-)?(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])$/.test(value.trim())
    ? null : ["error", 'must be "MM-DD" or "YYYY-MM-DD"']
);
const sunTime = (value) => (
  typeof value === "string" && /^([01]?\d|2[0-3]):[0-5]\d$|^24:00$/.test(value.trim()) ? null : ["error", 'must be "HH:MM"']
);

// ---- the known attributes ------------------------------------------------------
// leaf(check) a value; obj({...}) an object with these keys (others: "info,
// unknown"), arr(item) an array, map(value) an object with free keys (language
// maps), alt({ string, number, boolean, array, object }) by the value's type,
// ANY a free-form value the viewer passes on as it is. A function is a lazy
// spec (for recursion).

const leaf = (check) => ({ kind: "leaf", check });
const obj = (props, options = {}) => ({ kind: "object", props, ...options });
const arr = (items, options = {}) => ({ kind: "array", items, ...options });
const map = (value, options = {}) => ({ kind: "map", value, ...options });
const alt = (byType, options = {}) => ({ kind: "alt", byType, ...options });
const ANY = { kind: "any" };
const tag = (feature, spec) => ({ ...spec, feature });

const TEXT = leaf(text);
const STRING = leaf(anyString);
const BOOL = leaf(bool);
const NUM = leaf(num);
const URL_ = leaf(url);
// A file the viewer downloads (model, photo, thumbnail, metadata).
const FILE_URL = leaf((value) => url(value, true));
const COLOR = leaf(color);
const DATE = leaf(isoDate);
const LANG = alt({ string: TEXT, object: map(alt({ array: arr(TEXT), string: TEXT }), { key: languageKey }) }, { name: "a string or a language map" });
const NODE_NAMES = arr(TEXT);

const vector = (size) => alt({
  array: arr(NUM, { minLength: size }),
  object: obj(Object.fromEntries(["x", "y", "z"].slice(0, size).map((axis) => [axis, NUM])), { expect: [["x", "error"], ["y", "error"], ...(size === 3 ? [["z", "error"]] : [])] }),
}, { name: `a ${size}D vector array or object` });
const VEC2 = vector(2);
const VEC3 = vector(3);
const TRIPLE = arr(NUM, { exactLength: 3 });

const PANEL = obj({ position: VEC2, size: obj({ width: alt({ number: NUM, null: leaf(() => null) }), height: alt({ number: NUM, null: leaf(() => null) }) }) });
const CLIPPING = tag("clipping", obj({
  mode: obj({ x: BOOL, y: BOOL, z: BOOL }),
  // Planes flipped to keep the other side (editor/clipping.js).
  negated: obj({ x: BOOL, y: BOOL, z: BOOL }),
  constants: VEC3,
  outlineVisible: BOOL,
  outline: BOOL,
}));

const VIEWER = obj({
  container: TEXT,
  mailUrl: TEXT,
  mainUrl: FILE_URL,
  baseModulePath: STRING,
  background: STRING,
  credits: ANY,
  auth: obj({ enabled: BOOL, allowRegistration: BOOL }),
  manifestoForm: PANEL,
  metadataContainer: PANEL,
  baseNamespace: URL_,
  metadataUrl: FILE_URL,
  theme: leaf(oneOf(["light", "dark"])),
  language: leaf(oneOf(["en", "pl", "de"])),
  backgroundColor: tag("rendering", COLOR),
  environmentMap: tag("rendering", obj({ intensity: leaf(number({ min: 0 })), preset: TEXT, enabled: BOOL })),
  rendering: tag("rendering", obj({
    toneMapping: leaf(oneOf(RENDERING_TONE_MAPPINGS)),
    exposure: leaf(number({ min: 0 })),
    postprocessing: obj({
      enabled: BOOL,
      antialias: leaf(oneOf(RENDERING_ANTIALIAS_MODES)),
      ao: BOOL,
      aoIntensity: leaf(number({ min: 0, max: 2 })),
    }),
  })),
  ...Object.fromEntries([
    "presentationMode", "sandbox", "lightweight", "editor", "forceLocalPreview", "autorotate",
    "disableInteraction", "hideUi", "hideMetadata", "showNotifications",
  ].map((key) => [key, BOOL])),
  autorotateSpeed: NUM,
  scale: VEC2,
  window: obj({ position: VEC2, size: obj({ width: NUM, height: NUM }) }),
  performance: leaf((value) => anyString(value) || oneOf(["high-performance", "low-power", "default"], "warning")(value)),
  units: alt({ number: NUM, string: TEXT }),
  gallery: ANY,
  editorToolbar: obj({ enabled: BOOL, position: VEC2, expanded: BOOL, visible: BOOL }),
  menuToolbar: obj({ enabled: BOOL, position: VEC2 }),
  clipping: CLIPPING,
  tour: tag("tour", obj({
    autostart: BOOL,
    autoplay: BOOL,
    loop: BOOL,
    stepDuration: leaf(number({ above: 0 })),
    transitionDuration: leaf(number({ min: 0 })),
  })),
});

const CERTAINTY_LEVEL = obj({ value: NUM, code: TEXT, symbol: STRING, color: COLOR, label: LANG, description: LANG }, {
  expect: [["value", "error"], ["code", "error"], ["color", "error"]],
});

const AIM3D_BLOCK = obj({
  version: TEXT,
  generatedAt: DATE,
  camera: tag("camera", obj({
    position: VEC3,
    target: VEC3,
    up: VEC3,
    fov: leaf(number({ above: 0, below: 180, level: "warning" })),
    zoom: leaf(number({ above: 0, level: "warning" })),
    distance: leaf(number({ min: 0, level: "warning" })),
    perspectiveMode: leaf(oneOf(["perspective", "orthographic"])),
  })),
  viewer: tag("settings", VIEWER),
  integration: tag("settings", obj({
    type: TEXT,
    exportViewerUrl: URL_,
    api: obj({ thumbnailUploadEndpoint: STRING }),
  }, { open: true })),
  lights: tag("lights", arr(obj({
    type: leaf(oneOf(LIGHT_TYPES, "warning")),
    position: VEC3,
    target: VEC3,
    color: COLOR,
    groundColor: COLOR,
    intensity: leaf(number({ min: 0, level: "warning" })),
    distance: leaf(number({ min: 0, level: "warning" })),
    decay: leaf(number({ min: 0, level: "warning" })),
    angle: leaf(number({ above: 0, max: Math.PI / 2, level: "warning" })),
    penumbra: leaf(number({ min: 0, max: 1, level: "warning" })),
    visible: BOOL,
  }))),
  certainty: tag("certainty", obj({
    label: LANG,
    min: NUM,
    max: NUM,
    unassessedColor: COLOR,
    visible: BOOL,
    opacity: leaf(number({ min: 0, max: 1 })),
    levels: arr(CERTAINTY_LEVEL, { minLength: 1 }),
  })),
  rakingLight: tag("raking-light", obj({
    enabled: BOOL,
    sweep: BOOL,
    direction: leaf(number({ min: 0, max: 360 })),
    height: leaf(number({ min: 1, max: 89 })),
  })),
  timeline: tag("timeline", obj({
    enabled: BOOL,
    showPanel: BOOL,
    year: NUM,
    startYear: NUM,
    endYear: NUM,
    label: LANG,
    description: LANG,
    transition: leaf(oneOf(TIMELINE_TRANSITIONS)),
    transitionDuration: leaf(number({ min: 0 })),
    playback: obj({
      autoplay: BOOL,
      loop: BOOL,
      yearsPerSecond: leaf(number({ above: 0 })),
      speed: leaf(number({ above: 0 })),
      pauseAtEvents: leaf(number({ min: 0 })),
    }),
    stages: arr(obj({
      year: NUM,
      type: leaf(oneOf(TIMELINE_STAGE_TYPES)),
      approximate: BOOL,
      yearLabel: LANG,
      label: LANG,
      description: LANG,
      source: LANG,
      nodes: NODE_NAMES,
    }, { expect: [["year", "error"], ["label", "info"]] })),
  })),
  variants: tag("variants", obj({
    enabled: BOOL,
    showPanel: BOOL,
    label: LANG,
    description: LANG,
    active: TEXT,
    items: arr(obj({
      id: TEXT,
      label: LANG,
      description: LANG,
      source: LANG,
      certainty: NUM,
      nodes: NODE_NAMES,
    }, { expect: [["id", "error"], ["label", "info"]] })),
  })),
  compare: tag("compare", obj({
    enabled: BOOL,
    mode: leaf(oneOf(COMPARE_MODES)),
    kind: leaf(oneOf(COMPARE_KINDS)),
    position: leaf(number({ min: 0, max: 1 })),
    left: obj({ variant: TEXT, year: NUM, shading: leaf(oneOf(SHADING_MODES)), lighting: leaf(oneOf(COMPARE_LIGHTINGS)) }),
    right: obj({ variant: TEXT, year: NUM, shading: leaf(oneOf(SHADING_MODES)), lighting: leaf(oneOf(COMPARE_LIGHTINGS)) }),
  })),
  photos: tag("photos", arr(obj({
    id: TEXT,
    src: FILE_URL,
    service: alt({ string: FILE_URL, object: ANY }),
    label: LANG,
    description: LANG,
    source: LANG,
    year: leaf(number({ integer: true, level: "warning" })),
    opacity: leaf(number({ min: 0, max: 1 })),
    view: obj({
      position: TRIPLE,
      target: TRIPLE,
      fov: leaf(number({ above: 0, below: 180 })),
      roll: NUM,
    }, { expect: [["position", "error"], ["target", "error"]] }),
  }, { expect: [["label", "info"], ["source", "info"]] }))),
  location: tag("location", obj({
    latitude: leaf(number({ min: -90, max: 90 })),
    longitude: leaf(number({ min: -180, max: 180 })),
    north: leaf(number({ min: -360, max: 360, level: "warning" })),
    utcOffset: leaf(number({ min: -14, max: 14 })),
  }, { expect: [["latitude", "error"], ["longitude", "error"]] })),
  sun: tag("sun", obj({ enabled: BOOL, followTimeline: BOOL, animate: BOOL, date: leaf(sunDate), time: leaf(sunTime) })),
  weather: tag("weather", obj({
    type: leaf(oneOf(WEATHER_TYPES)),
    intensity: leaf(number({ min: 0, max: 1 })),
    wind: leaf(number({ min: 0, max: 1 })),
    windDirection: leaf(number({ min: -360, max: 360, level: "warning" })),
    mistHeight: leaf(number({ min: 0, max: 1 })),
    mistDensity: leaf(number({ min: 0, max: 1 })),
    mistSpread: leaf(number({ min: 0, max: 1 })),
    sky: BOOL,
    surfaces: BOOL,
  }, { expect: [["type", "error"]] })),
  thumbnails: tag("thumbnails", arr(alt({ string: FILE_URL, object: obj({ src: FILE_URL, label: LANG }, { expect: [["src", "error"]] }) }))),
  modelTransform: tag("transform", obj({
    position: VEC3,
    rotation: obj({ x: NUM, y: NUM, z: NUM, order: leaf(oneOf(ROTATION_ORDERS, "warning")) }),
    scale: VEC3,
    wireframe: BOOL,
    shadingMode: leaf(oneOf(SHADING_MODES)),
    customShader: obj({ vertexShader: TEXT, fragmentShader: TEXT }),
  })),
  clipping: CLIPPING,
});

// IIIF Presentation 3/4. Linking and descriptive properties every resource
// may have.
const DESCRIPTIVE = {
  label: LANG,
  summary: LANG,
  metadata: arr(obj({ label: LANG, value: LANG }, { expect: [["label", "error"], ["value", "error"]] })),
  requiredStatement: tag("rights", obj({ label: LANG, value: LANG }, { expect: [["label", "error"], ["value", "error"]] })),
  rights: tag("rights", leaf(rights)),
  provider: ANY,
  homepage: ANY,
  thumbnail: ANY,
  logo: ANY,
  seeAlso: ANY,
  service: ANY,
  services: ANY,
  partOf: ANY,
  rendering: ANY,
  start: ANY,
  navDate: DATE,
  navPlace: ANY,
  behavior: arr(TEXT),
  viewingDirection: leaf(oneOf(["left-to-right", "right-to-left", "top-to-bottom", "bottom-to-top"])),
  created: DATE,
  modified: DATE,
};

const QUANTITY = obj({ type: leaf(oneOf(["Quantity"], "warning")), quantityValue: NUM, unit: TEXT }, { expect: [["quantityValue", "error"]] });
const POINT = obj({ type: TEXT, x: NUM, y: NUM, z: NUM, id: URL_ });
const TRANSFORM = obj({ type: leaf(oneOf(TRANSFORM_TYPES)), x: NUM, y: NUM, z: NUM }, { expect: [["type", "error"]] });
const SELECTOR = obj({ type: TEXT, x: NUM, y: NUM, z: NUM, value: STRING }, { open: true });

// Bodies: a model, a light, a camera, a SpecificResource around one of them,
// a TextualBody of a comment, or a Choice / List of bodies.
const BODY = () => obj({
  id: FILE_URL,
  type: TEXT,
  format: leaf(mediaType),
  language: alt({ string: TEXT, array: arr(TEXT) }),
  value: STRING,
  label: LANG,
  source: alt({ string: URL_, object: BODY }),
  selector: alt({ object: SELECTOR, array: arr(SELECTOR) }),
  transform: arr(TRANSFORM),
  items: arr(BODY),
  color: COLOR,
  intensity: alt({ number: leaf(number({ min: 0, level: "warning" })), object: QUANTITY }),
  angle: leaf(number({ above: 0, max: 90, level: "warning" })),
  fieldOfView: leaf(number({ above: 0, below: 180, level: "warning" })),
  near: leaf(number({ min: 0, level: "warning" })),
  far: leaf(number({ above: 0, level: "warning" })),
  lookAt: alt({ string: URL_, object: POINT }),
  purpose: TEXT,
  ...DESCRIPTIVE,
});

const TARGET = obj({
  id: URL_,
  type: TEXT,
  source: alt({ string: URL_, object: obj({ id: URL_, type: TEXT }) }),
  selector: alt({ object: SELECTOR, array: arr(SELECTOR) }),
});

// annotation.AIM3DViewer: where an annotation sits on the model.
const ANNOTATION_AIM3D = obj({
  certainty: tag("certainty", obj({ value: NUM, code: TEXT, scope: leaf(oneOf(CERTAINTY_SCOPES)), targetId: STRING })),
  faceIndex: leaf(number({ min: 0, integer: true })),
  faceNumbers: arr(leaf(number({ min: 0, integer: true }))),
  groupId: STRING,
  key: alt({ string: STRING, number: NUM }),
  object: STRING,
  point: TRIPLE,
  targetId: STRING,
  view: obj({ position: TRIPLE, target: TRIPLE, fov: leaf(number({ above: 0, below: 180 })) }),
});

const MOTIVATION = leaf((value) => anyString(value) || oneOf(MOTIVATIONS, "info")(value));

const annotation = (feature) => obj({
  id: URL_,
  type: leaf(oneOf(["Annotation"])),
  motivation: alt({ string: MOTIVATION, array: arr(MOTIVATION) }),
  body: alt({ string: URL_, object: BODY, array: arr(BODY) }),
  bodyValue: STRING,
  target: alt({ string: URL_, object: TARGET, array: arr(TARGET) }),
  scope: ANY,
  stylesheet: ANY,
  timeMode: ANY,
  AIM3DViewer: ANNOTATION_AIM3D,
  ...DESCRIPTIVE,
}, {
  feature,
  expect: [["id", "warning"], ["type", "warning"], ["target", "error"], ["motivation", "info"]],
});

// Painting annotations are the model, its lights and cameras; the others
// are the annotations of the "annotations" feature.
const PAINTING = annotation((value) => bodyFeature(asArray(value?.body)[0]));
const COMMENT = annotation("annotations");

const page = (item) => obj({
  id: URL_,
  type: leaf(oneOf(["AnnotationPage"])),
  items: arr(item),
  ...DESCRIPTIVE,
}, { expect: [["id", "warning"], ["type", "warning"]] });

const SCENE = obj({
  id: URL_,
  type: leaf(oneOf(["Scene", "Canvas"])),
  backgroundColor: tag("rendering", COLOR),
  spatialScale: QUANTITY,
  height: leaf(number({ above: 0 })),
  width: leaf(number({ above: 0 })),
  duration: leaf(number({ above: 0 })),
  items: arr(page(PAINTING)),
  annotations: arr(page(COMMENT)),
  placeholderContainer: ANY,
  accompanyingContainer: ANY,
  ...DESCRIPTIVE,
}, { expect: [["id", "warning"], ["type", "warning"], ["items", "warning"]] });

const MANIFEST = obj({
  "@context": alt({ string: URL_, array: arr(alt({ string: URL_, object: ANY })) }),
  id: URL_,
  type: leaf(oneOf(["Manifest"])),
  items: arr(SCENE),
  structures: ANY,
  annotations: arr(page(COMMENT)),
  AIM3DViewer: AIM3D_BLOCK,
  ...Object.fromEntries(Object.entries(DESCRIPTIVE).map(([key, spec]) => [key, spec.feature ? spec : tag("metadata", spec)])),
}, {
  feature: "manifest",
  expect: [["id", "warning"], ["type", "warning"], ["label", "warning"], ["items", "info"], ["summary", "info"], ["rights", "info"]],
});

// ---- the walk ----------------------------------------------------------------

function kindOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function shown(value) {
  if (typeof value === "string") return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
  if (Array.isArray(value)) return `[${value.length}]`;
  if (isObject(value)) return `{${Object.keys(value).length}}`;
  return value;
}

class Collector {
  constructor() {
    this.entries = new Map();
  }

  entry(path, value, feature, known = true) {
    let entry = this.entries.get(path);
    if (!entry) {
      entry = { path, value: shown(value), level: "ok", feature, known, issues: [] };
      this.entries.set(path, entry);
    }
    return entry;
  }

  issue(path, level, message, value, feature) {
    const entry = this.entry(path, value, feature);
    if (entry.issues.some((issue) => issue.message === message)) return;
    entry.issues.push({ level, message });
    if (LEVELS.indexOf(level) > LEVELS.indexOf(entry.level)) entry.level = level;
  }
}

function walk(value, spec, path, feature, out) {
  if (typeof spec === "function") spec = spec();
  if (spec.feature) feature = typeof spec.feature === "function" ? spec.feature(value) : spec.feature;

  switch (spec.kind) {
    case "any":
      out.entry(path, value, feature);
      return;
    case "leaf": {
      out.entry(path, value, feature);
      const problem = spec.check(value);
      if (problem) out.issue(path, problem[0], problem[1], value, feature);
      return;
    }
    case "alt": {
      const next = spec.byType[kindOf(value)];
      if (!next) {
        const expected = spec.name || Object.keys(spec.byType).join(" or ");
        out.issue(path, "error", `must be ${expected}`, value, feature);
        return;
      }
      walk(value, next, path, feature, out);
      return;
    }
    case "array": {
      if (!Array.isArray(value)) {
        out.issue(path, "error", "must be an array", value, feature);
        return;
      }
      if (value.length === 0) out.entry(path, value, feature);
      if (spec.minLength !== undefined && value.length < spec.minLength) {
        out.issue(path, "error", `must contain at least ${spec.minLength} item${spec.minLength === 1 ? "" : "s"}`, value, feature);
      }
      if (spec.exactLength !== undefined && value.length !== spec.exactLength) {
        out.issue(path, "error", `must contain exactly ${spec.exactLength} items`, value, feature);
      }
      value.forEach((item, index) => walk(item, spec.items, `${path}[${index}]`, feature, out));
      return;
    }
    case "map": {
      if (!isObject(value)) {
        out.issue(path, "error", "must be an object", value, feature);
        return;
      }
      if (Object.keys(value).length === 0) out.issue(path, "warning", "is empty", value, feature);
      Object.entries(value).forEach(([key, item]) => {
        const problem = spec.key?.(key);
        if (problem) out.issue(`${path}.${key}`, problem[0], problem[1], item, feature);
        walk(item, spec.value, `${path}.${key}`, feature, out);
      });
      return;
    }
    case "object": {
      if (!isObject(value)) {
        out.issue(path, "error", "must be an object", value, feature);
        return;
      }
      if (Object.keys(value).length === 0) out.entry(path, value, feature);
      (spec.expect || []).forEach(([key, level]) => {
        if (value[key] === undefined) {
          out.issue(`${path}.${key}`, level, level === "info" ? "is not set (recommended)" : "is missing", undefined, feature);
        }
      });
      Object.entries(value).forEach(([key, item]) => {
        const childPath = `${path}.${key}`;
        const child = spec.props[key];
        if (child) {
          walk(item, child, childPath, feature, out);
        } else if (spec.open) {
          out.entry(childPath, item, feature);
        } else {
          out.entry(childPath, item, feature, false);
          out.issue(childPath, "info", "is not a known attribute - the viewer ignores it", item, feature);
        }
      });
      return;
    }
    default:
      throw new Error(`Unknown spec kind: ${spec.kind}`);
  }
}

// ---- checks across attributes --------------------------------------------------

function crossChecks(manifest, out) {
  const aim = block(manifest);

  // IIIF resources need their own ids; the viewer looks scenes up by id.
  const ids = new Map();
  const remember = (resource, path) => {
    if (!isObject(resource) || typeof resource.id !== "string") return;
    if (ids.has(resource.id)) {
      out.issue(`${path}.id`, "warning", `is the same id as ${ids.get(resource.id)}`, resource.id);
    } else {
      ids.set(resource.id, path);
    }
  };
  const sceneIds = new Set();
  remember(manifest, "$");
  asArray(manifest.items).forEach((scene, sceneIndex) => {
    const scenePath = `$.items[${sceneIndex}]`;
    remember(scene, scenePath);
    if (typeof scene?.id === "string") sceneIds.add(scene.id);
    ["items", "annotations"].forEach((pages) => {
      asArray(scene?.[pages]).forEach((annotationPage, pageIndex) => {
        const pagePath = `${scenePath}.${pages}[${pageIndex}]`;
        remember(annotationPage, pagePath);
        asArray(annotationPage?.items).forEach((item, index) => remember(item, `${pagePath}.items[${index}]`));
      });
    });
  });

  // Annotation targets must be one of the manifest's scenes.
  if (sceneIds.size) {
    asArray(manifest.items).forEach((scene, sceneIndex) => {
      ["items", "annotations"].forEach((pages) => {
        asArray(scene?.[pages]).forEach((annotationPage, pageIndex) => {
          asArray(annotationPage?.items).forEach((item, index) => {
            asArray(item?.target).forEach((target, targetIndex) => {
              const source = typeof target === "string" ? target : typeof target?.source === "string" ? target.source : target?.source?.id ?? target?.id;
              if (typeof source !== "string") return;
              const scene = source.split("#")[0];
              if (sceneIds.has(scene)) return;
              const targets = Array.isArray(item.target) ? `.target[${targetIndex}]` : ".target";
              out.issue(
                `$.items[${sceneIndex}].${pages}[${pageIndex}].items[${index}]${targets}`,
                "warning",
                `points at "${shown(scene)}", which is not a scene of this manifest`,
                target,
              );
            });
          });
        });
      });
    });
  }

  // The comparison view shows variants by id.
  const variantIds = new Set(asArray(aim.variants?.items).map((item) => item?.id).filter((id) => typeof id === "string"));
  ["left", "right"].forEach((side) => {
    const variant = aim.compare?.[side]?.variant;
    if (typeof variant === "string" && !variantIds.has(variant)) {
      out.issue(`$.AIM3DViewer.compare.${side}.variant`, "warning", "is not the id of one of AIM3DViewer.variants.items", variant, "compare");
    }
  });

  // Vectors that make the view or the model degenerate.
  const zero = (vector) => {
    const values = Array.isArray(vector) ? vector.slice(0, 3) : isObject(vector) ? [vector.x, vector.y, vector.z] : null;
    return values && values.every(isFiniteNumber) && values.every((v) => v === 0);
  };
  if (zero(aim.camera?.up)) out.issue("$.AIM3DViewer.camera.up", "warning", "is a zero vector - the camera has no up direction", aim.camera.up, "camera");
  const scale = aim.modelTransform?.scale;
  const scales = Array.isArray(scale) ? scale : isObject(scale) ? [scale.x, scale.y, scale.z] : [];
  if (scales.some((v) => v === 0)) {
    out.issue("$.AIM3DViewer.modelTransform.scale", "warning", "has a zero component - the model becomes flat or invisible", scale, "transform");
  }
  const { startYear, endYear } = aim.timeline || {};
  asArray(aim.timeline?.stages).forEach((stage, index) => {
    if (!isFiniteNumber(stage?.year)) return;
    if ((isFiniteNumber(startYear) && stage.year < startYear) || (isFiniteNumber(endYear) && stage.year > endYear)) {
      out.issue(`$.AIM3DViewer.timeline.stages[${index}].year`, "warning", "lies outside startYear..endYear", stage.year, "timeline");
    }
  });
}

// ---- the result ----------------------------------------------------------------

// The feature an attribute path belongs to, for validator errors at paths
// the walk did not reach (e.g. a missing value).
const LAST_SEGMENT = /(\.[^.[\]]+|\[\d+\])$/;

function featureOfPath(path, out) {
  let prefix = path;
  while (true) {
    const entry = out.entries.get(prefix);
    if (entry) return entry.feature;
    if (!LAST_SEGMENT.test(prefix)) return "manifest";
    prefix = prefix.replace(LAST_SEGMENT, "");
  }
}

export function inspectAIM3DManifest(manifest) {
  const out = new Collector();
  if (!isObject(manifest)) {
    out.issue("$", "error", "must be an object", manifest, "manifest");
  } else {
    // As the viewer reads it: older exports keep numbers as strings.
    const normalized = normalizeAIM3DManifest(structuredClone(manifest));
    walk(normalized, MANIFEST, "$", "manifest", out);
    crossChecks(normalized, out);
    // The validator decides what the viewer rejects; an attribute the walk
    // already marked as an error keeps that message.
    validateAIM3DManifest(normalized).errors.forEach(({ path, message }) => {
      if (out.entries.get(path)?.level === "error") return;
      out.issue(path, "error", message, undefined, featureOfPath(path, out));
    });
  }

  const attributes = [...out.entries.values()];
  const count = (level) => attributes.reduce((sum, entry) => sum + entry.issues.filter((issue) => issue.level === level).length, 0);
  const summary = {
    errors: count("error"),
    warnings: count("warning"),
    infos: count("info"),
    attributes: attributes.length,
    unknown: attributes.filter((entry) => !entry.known).length,
  };

  const features = MANIFEST_FEATURES.map((feature) => {
    const own = attributes.filter((entry) => entry.feature === feature.id);
    const issues = own.flatMap((entry) => entry.issues);
    const errors = issues.filter((issue) => issue.level === "error").length;
    const warnings = issues.filter((issue) => issue.level === "warning").length;
    const featureCount = isObject(manifest) ? feature.count(manifest) : 0;
    return {
      id: feature.id,
      icon: feature.id,
      label: feature.label,
      present: featureCount > 0,
      count: featureCount,
      status: errors ? "error" : warnings ? "warning" : "ok",
      errors,
      warnings,
    };
  });

  return {
    schema: INSPECTION_SCHEMA,
    status: summary.errors ? "error" : summary.warnings ? "warning" : "ok",
    summary,
    features,
    attributes,
  };
}

// The model files a manifest paints (body ids), resolved against its URL.
export function manifestModelUrls(manifest, base = undefined) {
  if (!isObject(manifest)) return [];
  return paintedBodies(manifest)
    .filter((body) => bodyFeature(body) === "model" && typeof body.id === "string")
    .map((body) => {
      try {
        return base ? new URL(body.id, base).href : body.id;
      } catch {
        return body.id;
      }
    });
}

// What the manifest lists show: the features that are set, in icon order,
// with their status (the structure itself only when something is wrong).
export function manifestFeatureIcons(inspection) {
  return inspection.features
    .filter((feature) => feature.present && (feature.id !== "manifest" || feature.status !== "ok"))
    .map(({ id, icon, label, count, status }) => ({ id, icon, label, count, status }));
}

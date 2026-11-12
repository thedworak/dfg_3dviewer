// The sun's position for a place, day and hour - the astronomy of the
// viewer's sun study (editor/sun-study.js), on its own so that pages without
// the viewer (the intro, viewer/intro/feature-tour.js) can use it too.
//
// The Astronomical Almanac's low-precision formulas, good to a fraction of a
// degree; dates before 1582 are taken as proleptic Gregorian.

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
// The sun's centre this far below the horizon at sunrise and sunset
// (refraction and its radius).
const HORIZON = -0.833;

const pad = (value) => String(value).padStart(2, "0");

function formatSunTime(minutes) {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

// Milliseconds since 1970 (UTC) of a local date and time, `utcOffset` hours
// ahead of UTC. Years below 100 stay themselves (Date.UTC would add 1900).
function sunTimestamp({ year, month, day, minutes, utcOffset = 0 }) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime() + (minutes - utcOffset * 60) * 60000;
}

// Sun position at `timestamp` (ms, UTC) seen from latitude / longitude
// (degrees): elevation above the horizon and azimuth from north, clockwise,
// both in degrees. The Astronomical Almanac's low-precision formulas: the
// mean longitude runs at the tropical rate, so the seasons stay right
// centuries away from J2000.
function solarPosition(timestamp, latitude, longitude) {
  const days = timestamp / DAY_MS - 0.5 + J1970 - J2000;
  const meanLongitude = RAD * (280.46 + 0.9856474 * days);
  const meanAnomaly = RAD * (357.528 + 0.9856003 * days);
  const eclipticLongitude = meanLongitude + RAD * (1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly));
  const obliquity = RAD * (23.439 - 0.0000004 * days);
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude));
  const sidereal = RAD * (280.46061837 + 360.98564736629 * days) + RAD * longitude;
  const hourAngle = sidereal - rightAscension;
  const phi = RAD * latitude;
  const elevation = Math.asin(Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle));
  // From south, westwards; turned to a compass bearing.
  const fromSouth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi));
  const azimuth = ((fromSouth / RAD + 180) % 360 + 360) % 360;
  return { elevation: elevation / RAD, azimuth };
}

// Sunrise and sunset (minutes of the local day), or null for polar day / night.
function sunriseSunset({ year, month, day, utcOffset, latitude, longitude }) {
  const start = sunTimestamp({ year, month, day, minutes: 0, utcOffset });
  let sunrise = null;
  let sunset = null;
  let previous = solarPosition(start, latitude, longitude).elevation - HORIZON;
  for (let minutes = 2; minutes <= 1440; minutes += 2) {
    const current = solarPosition(start + minutes * 60000, latitude, longitude).elevation - HORIZON;
    if (previous < 0 && current >= 0 && sunrise == null) sunrise = minutes - 2 * (current / (current - previous));
    if (previous >= 0 && current < 0) sunset = minutes - 2 * (current / (current - previous));
    previous = current;
  }
  return { sunrise, sunset };
}

// The intro's model and everything that depends on it - the "scene". The
// intro itself (the cloud, the landing, the reveal, the feature tour, the
// sound) is the same for every deployment; a deployment swaps only the
// scene, with viewer.intro.scene in viewer-settings.json (docs/intro.md,
// "Another model"):
//
//   "intro": {
//     "scene": "brand/intro/scene.json"     // a file, or the object itself
//   }
//
// Paths in a scene file resolve against that file, paths in an inline
// object against the intro page. Anything left out keeps a neutral default
// (no pins, the measurement on the bounding box, no time travel); without a
// scene the intro shows the Wołpa Synagogue (DEFAULT_SCENE).
//
// The intro page also takes the deployment's branding (the logo and the
// name, ../branding.js) from the same file.

const DEFAULT_SCENE = Object.freeze({
  // E4DP point file (scripts/build-intro-points.mjs) and the model shown
  // after it, in the same coordinates.
  points: 'assets/intro/synagogue-points.bin',
  model: 'examples/WolpaSynagogue-progressive.glb',
  // Where "Enter the viewer" leads (same site only).
  next: './?model=./examples/WolpaSynagogue-progressive.glb',
  // Metres per model unit (the synagogue is in centimetres).
  unitInMeters: 0.01,
  // The camera's angle around the model at the landing (radians; 0: from +Z).
  front: 0.3,
  // The model's ground (y, model units): sun study compass, snow, section.
  ground: 0,
  // Annotations (model units): "annotation" pins are bright, "poi" pins blue.
  pins: [
    { key: 'roof', at: [300, 1361, -733], lift: 0.22, kind: 'annotation' },
    { key: 'pavilion', at: [-943, 817, 645], lift: 0.42, kind: 'poi' },
  ],
  // The height measurement: a vertical line at (x, z) from y = from to to.
  measure: { x: 1340, z: 1111, from: 0, to: 1675 },
  // The sun study's place and day (local time = UTC + utcOffset; north: the
  // model's north from -Z, degrees clockwise).
  site: { latitude: 53.37, longitude: 24.37, utcOffset: 3, north: 0, month: 6, day: 21 },
  // The 4D time travel: a folder with time.json and the stages' textures
  // (scripts/build-intro-time.mjs); false leaves the chapter out.
  time: 'assets/intro/time/',
  // Texts per language over the intro's own (intro.js TEXTS): caption,
  // tagline, hint, hintTouch, tour.sunDate, tour.labels.<pin key>,
  // tour.timeNotes.<year>.
  texts: null,
});

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Same origin only (the intro fetches and draws them), else null.
function sameOriginUrl(value, base) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), base);
    return url.origin === window.location.origin ? url.href : null;
  } catch {
    return null;
  }
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function vector(value) {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const out = value.map(Number);
  return out.every(Number.isFinite) ? out : null;
}

// A scene from the settings, checked and completed. base: the URL its
// relative paths resolve against.
function normalizeScene(input, base) {
  const scene = isObject(input) ? input : {};
  const points = sameOriginUrl(scene.points, base);
  const model = sameOriginUrl(scene.model, base);
  if (!points) return null; // without points there is no intro of it
  const pins = (Array.isArray(scene.pins) ? scene.pins : [])
    .map((pin, index) => {
      const at = vector(pin?.at);
      if (!at) return null;
      const key = typeof pin.key === 'string' && /^[\w-]+$/.test(pin.key) ? pin.key : `pin${index + 1}`;
      return {
        key,
        at,
        lift: finite(pin.lift, 0.3),
        kind: pin.kind === 'poi' ? 'poi' : 'annotation',
        label: pin.label ?? null,
      };
    })
    .filter(Boolean);
  const measure = isObject(scene.measure)
    && [scene.measure.x, scene.measure.z, scene.measure.from, scene.measure.to].every((v) => Number.isFinite(Number(v)))
    ? { x: +scene.measure.x, z: +scene.measure.z, from: +scene.measure.from, to: +scene.measure.to }
    : null;
  const site = isObject(scene.site) && Number.isFinite(Number(scene.site.latitude)) && Number.isFinite(Number(scene.site.longitude))
    ? {
      latitude: +scene.site.latitude,
      longitude: +scene.site.longitude,
      utcOffset: finite(scene.site.utcOffset, Math.round(+scene.site.longitude / 15)),
      north: finite(scene.site.north, 0),
      month: finite(scene.site.month, 6),
      day: finite(scene.site.day, 21),
    }
    : null;
  let time = false;
  if (typeof scene.time === 'string') {
    const url = sameOriginUrl(scene.time, base);
    if (url) time = url.endsWith('/') ? url : `${url}/`;
  }
  return {
    custom: true,
    points,
    // Without a model the intro ends with the points.
    model,
    next: typeof scene.next === 'string' && scene.next.trim()
      ? scene.next.trim()
      : model ? `./?model=${encodeURIComponent(new URL(model).pathname)}` : './',
    unitInMeters: finite(scene.unitInMeters, 1),
    front: finite(scene.front, 0),
    ground: Number.isFinite(Number(scene.ground)) ? Number(scene.ground) : null, // null: the bounding box's bottom
    pins,
    measure,
    site,
    time,
    texts: isObject(scene.texts) ? scene.texts : null,
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

// { scene, branding }: the deployment's scene (or DEFAULT_SCENE) and its
// branding, from viewer-settings.json next to the intro page. Any failure
// keeps the defaults - the intro never waits on a broken setting.
async function loadIntroScene() {
  const fallback = { scene: { ...DEFAULT_SCENE, custom: false }, branding: {} };
  let settings;
  try {
    settings = await fetchJson(new URL('viewer-settings.json', document.baseURI).href);
  } catch {
    return fallback;
  }
  const branding = isObject(settings?.branding) ? settings.branding : {};
  const value = settings?.viewer?.intro?.scene;
  if (!value) return { ...fallback, branding };
  try {
    if (typeof value === 'string') {
      const url = sameOriginUrl(value, document.baseURI);
      if (!url) throw new Error(`viewer.intro.scene: not a same-site URL: ${value}`);
      const scene = normalizeScene(await fetchJson(url), url);
      if (scene) return { scene, branding };
    } else {
      const scene = normalizeScene(value, document.baseURI);
      if (scene) return { scene, branding };
    }
    console.warn('[intro] viewer.intro.scene has no usable "points"; showing the default intro.');
  } catch (error) {
    console.warn('[intro] viewer.intro.scene could not be read; showing the default intro.', error);
  }
  return { ...fallback, branding };
}

function deepMerge(target, source) {
  if (!isObject(source)) return target;
  const out = { ...target };
  for (const [key, value] of Object.entries(source)) {
    out[key] = isObject(value) && isObject(target?.[key]) ? deepMerge(target[key], value) : value;
  }
  return out;
}

// A text from the settings: a string, or { pl, en, de } (falling back to
// English, then any).
function pickText(value, lang) {
  if (typeof value === 'string') return value;
  if (!isObject(value)) return null;
  return value[lang] ?? value.en ?? Object.values(value).find((v) => typeof v === 'string') ?? null;
}

// The intro's texts for this scene: the built-in ones name the synagogue,
// so a custom scene starts from neutral ones (`generic`), then takes its own.
function sceneTexts(texts, generic, scene, lang) {
  if (!scene.custom) return texts;
  let out = deepMerge(texts, generic);
  const labels = {};
  for (const pin of scene.pins) {
    const label = pickText(pin.label, lang);
    if (label) labels[pin.key] = label;
  }
  // The synagogue's stage notes do not fit another model's years.
  out = { ...out, tour: { ...out.tour, labels: { ...out.tour.labels, ...labels }, timeNotes: {} } };
  // The sun study's day (without a site it runs at the default place).
  const site = scene.site ?? DEFAULT_SCENE.site;
  const date = new Date(Date.UTC(2001, site.month - 1, site.day));
  out.tour.sunDate = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
  const own = scene.texts?.[lang] ?? scene.texts?.en ?? null;
  return deepMerge(out, own);
}

export { DEFAULT_SCENE as D, HORIZON as H, RAD as R, solarPosition as a, sunTimestamp as b, sceneTexts as c, formatSunTime as f, loadIntroScene as l, pickText as p, sunriseSunset as s };
//# sourceMappingURL=intro-scene-TCxdlOLr.js.map

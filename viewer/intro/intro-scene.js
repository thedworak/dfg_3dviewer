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
// scene the intro shows the pagoda (DEFAULT_SCENE). The Wołpa Synagogue is
// a scene of its own (scenes/wolpa/scene.json).
//
// The intro page also takes the deployment's branding (the logo and the
// name, ../branding.js) from the same file.

export const DEFAULT_SCENE = Object.freeze({
  // E4DP point file (scripts/build-intro-points.mjs) and the model shown
  // after it, in the same coordinates: the pagoda, the project's own model
  // (scripts/build-pagoda-examples.mjs).
  points: 'assets/intro/scenes/pagoda/points.bin',
  model: 'examples/pagoda/Pagoda-progressive.glb',
  // Where "Enter the viewer" leads (same site only).
  next: './?model=./examples/pagoda/Pagoda-progressive.glb',
  // Metres per model unit.
  unitInMeters: 1,
  // The camera's angle around the model at the landing (radians; 0: from +Z).
  front: 0.35,
  // The model's ground (y, model units): sun study compass, snow, section.
  ground: 0,
  // Annotations (model units): "annotation" pins are bright, "poi" pins blue.
  pins: [
    // The front's bracket sets (the finial's label would sit under the
    // chapter's name); the bell at the front's left corner, away from the
    // height line (right).
    { key: 'brackets', at: [0, 4.5, 3.4], lift: 0.3, kind: 'annotation' },
    { key: 'bell', at: [-5.76, 8.6, 5.76], lift: 0.35, kind: 'poi' },
  ],
  // The height measurement: a vertical line at (x, z) from y = from to to.
  measure: { x: 7.0, z: 0, from: 0, to: 20.5 },
  // The sun study's place and day (local time = UTC + utcOffset; north: the
  // model's north from -Z, degrees clockwise). The pagoda stands nowhere;
  // the sun is Nara's.
  site: { latitude: 34.68, longitude: 135.83, utcOffset: 9, north: 0, month: 6, day: 21 },
  // The 4D time travel: a folder with time.json and the stages' textures
  // (scripts/build-pagoda-examples.mjs); false leaves the chapter out.
  time: 'assets/intro/scenes/pagoda/time/',
  // The surroundings through time (intro-surroundings.js): the viewer's
  // generated surroundings (docs/surroundings.md) of this kind of place and
  // region through these years (as the viewer covers them), then other kinds
  // of place in other regions (`showcase`, in colour, with their life);
  // false leaves the chapter out.
  surroundings: Object.freeze({
    // The pagoda's own: a temple's precinct in Japan.
    kind: 'monastery', region: 'japanese', masonry: 'stone', seed: 7, years: Object.freeze([900, 2025]),
    showcase: Object.freeze([
      Object.freeze({ kind: 'town', region: 'japanese', year: 1850 }),
      Object.freeze({ kind: 'village', region: 'african', year: 1920 }),
      Object.freeze({ kind: 'town', region: 'central', year: 1880 }),
      Object.freeze({ kind: 'port', region: 'mediterranean', year: 1700 }),
    ]),
  }),
  // The model's credit, a line under the intro: who made it and its
  // licence (a link). CC BY-NC-SA asks for the author's name wherever the
  // model is shown (viewer/examples/CREDITS.md).
  credit: Object.freeze({
    text: Object.freeze({
      pl: 'Model: Oryginał trójkondygnacyjnej Pagody w stylu japońskim (interpretacja - Daniel Dworak)',
      en: 'Model: An original three-storey pagoda in the Japanese manner (interpretation by Daniel Dworak)',
      de: 'Modell: Ein Original Drei-Stockiges Pagoda im japanischen Stil (Interpretation von Daniel Dworak)',
    }),
    license: 'CC BY-NC-SA 4.0',
    url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  }),
  // Texts per language over the intro's own (intro.js TEXTS):
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

// A web address (http or https) to link to, else null.
function webUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

// { text, license, url } (text: a string or { pl, en, de }), else null.
function normalizeCredit(value) {
  if (typeof value === 'string' && value.trim()) return { text: value.trim(), license: null, url: null };
  if (!isObject(value)) return null;
  const text = typeof value.text === 'string' || isObject(value.text) ? value.text : null;
  const license = typeof value.license === 'string' && value.license.trim() ? value.license.trim() : null;
  if (!text && !license) return null;
  return { text, license, url: webUrl(value.url) };
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
export function normalizeScene(input, base) {
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
  // The surroundings: a kind of place and the years, at least.
  const years = Array.isArray(scene.surroundings?.years) ? scene.surroundings.years.map(Number) : null;
  const surroundings = isObject(scene.surroundings) && typeof scene.surroundings.kind === 'string'
    && years?.length === 2 && years.every(Number.isFinite) && years[1] > years[0]
    ? {
      kind: scene.surroundings.kind,
      region: typeof scene.surroundings.region === 'string' ? scene.surroundings.region : 'central',
      masonry: typeof scene.surroundings.masonry === 'string' ? scene.surroundings.masonry : 'brick',
      seed: finite(scene.surroundings.seed, 1),
      density: finite(scene.surroundings.density, 0.6),
      years: [Math.round(years[0]), Math.round(years[1])],
      // Other places after it: [{ kind, region, year }].
      showcase: (Array.isArray(scene.surroundings.showcase) ? scene.surroundings.showcase : [])
        .filter((v) => isObject(v) && typeof v.kind === 'string' && Number.isFinite(Number(v.year)))
        .slice(0, 6)
        .map((v) => ({ kind: v.kind, region: typeof v.region === 'string' ? v.region : 'central', year: Math.round(Number(v.year)) })),
    }
    : false;
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
    surroundings,
    credit: normalizeCredit(scene.credit),
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
export async function loadIntroScene() {
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
export function pickText(value, lang) {
  if (typeof value === 'string') return value;
  if (!isObject(value)) return null;
  return value[lang] ?? value.en ?? Object.values(value).find((v) => typeof v === 'string') ?? null;
}

// The intro's texts for this scene: the built-in ones name the pagoda,
// so a custom scene starts from neutral ones (`generic`), then takes its own.
export function sceneTexts(texts, generic, scene, lang) {
  if (!scene.custom) return texts;
  let out = deepMerge(texts, generic);
  const labels = {};
  for (const pin of scene.pins) {
    const label = pickText(pin.label, lang);
    if (label) labels[pin.key] = label;
  }
  // The pagoda's stage notes do not fit another model's years.
  out = { ...out, tour: { ...out.tour, labels: { ...out.tour.labels, ...labels }, timeNotes: {} } };
  // The sun study's day (without a site it runs at the default place).
  const site = scene.site ?? DEFAULT_SCENE.site;
  const date = new Date(Date.UTC(2001, site.month - 1, site.day));
  out.tour.sunDate = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
  const own = scene.texts?.[lang] ?? scene.texts?.en ?? null;
  return deepMerge(out, own);
}

// The intro page (intro.html): a chaotic cloud of points that, like atoms,
// slowly settles into the Wolpa Synagogue. The very last point takes its
// time, and its landing sends a wave of light through the building; then
// the real model takes the points' place - vertices, edges, faces
// (mesh-reveal.js) - and a button leads into the viewer.
//
// The points come from viewer/intro/synagogue-points.bin, sampled from the
// textured model by scripts/build-intro-points.mjs. Everything moves in the
// vertex shader: per point a start in the cloud, a delay (lower parts of the
// building first) and a seed for its own drift and path.
//
// Page parameters: ?next=<same-origin URL> is where the button leads
// (default: the viewer with the synagogue), ?lang=pl|en|de, ?at=<seconds>
// holds the intro at that moment, ?sound=1 sound on by default (it starts
// with the first click or key press; the visitor's own choice wins),
// ?embedded=1 inside the viewer page (viewer/intro-overlay.js): the buttons
// tell the page instead of leaving it.
//
// Everything follows one clock, the intro's time T (timeline() below):
// "Assemble again" runs it backwards, ?at= stops it.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Spherical,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TIMING, createMeshReveal } from './mesh-reveal.js';
import { createIntroSound } from './intro-sound.js';
import { CHAPTERS, TOUR_LENGTH, createFeatureTour } from './feature-tour.js';

const POINTS_URL = 'assets/intro/synagogue-points.bin';
// The model the points become (also the one the viewer opens next, so it is
// in the browser's cache by then), and the KTX2 transcoder its textures need.
const MODEL_URL = 'examples/WolpaSynagogue-progressive.glb';
const TRANSCODER_PATH = 'assets/basis/';
// The directory's index page (index.html): `serve` and other static servers
// redirect index.html to ./ and lose the query on the way.
const DEFAULT_NEXT = './?model=./examples/WolpaSynagogue-progressive.glb';
// Seconds: the cloud fades in, then gathers into the building.
const FADE_IN = 1.0;
// Only the cloud this long, then the points set off.
const ASSEMBLY_START = 1.5;
const ASSEMBLY = 5.2;
// The last point: sets off late, takes its time, lands on the roof.
const LAST_START = ASSEMBLY_START + ASSEMBLY * 0.72;
const LAST_FLIGHT = 3.8;
const LANDING = LAST_START + LAST_FLIGHT;
const EXIT = 1.3;
// Assemble again: everything runs back into the cloud first.
const REWIND = 3.6;
// The feature tour (feature-tour.js): seconds into the model's act.
const TOUR_START = 11.0;
const INTRO_END = LANDING + TOUR_START + TOUR_LENGTH;
// The progress bar's parts: the cloud gathering, the mesh, the tour's chapters.
const SEGMENTS = [
  { key: 'cloud', from: 0, to: LANDING },
  { key: 'mesh', from: LANDING, to: LANDING + TOUR_START },
  ...CHAPTERS.map((chapter) => ({
    key: chapter.key,
    from: LANDING + TOUR_START + chapter.from,
    to: LANDING + TOUR_START + chapter.to,
  })),
];

const TEXTS = {
  pl: {
    tagline: 'Dziedzictwo w trzech wymiarach — i w czasie',
    caption: 'Synagoga w Wołpie · rekonstrukcja cyfrowa',
    enter: 'Wejdź do viewera',
    skip: 'Pomiń intro',
    replay: 'Złóż ponownie',
    points: (n, total) => `${n} / ${total} punktów na miejscu`,
    mesh: (v, f) => `${v} wierzchołków · ${f} ścianek`,
    loading: 'Wczytywanie punktów…',
    error: 'Nie udało się wczytać intro.',
    hint: 'Najedź na synagogę, by zajrzeć do środka · przeciągnij, aby obrócić',
    hintTouch: 'Dotknij synagogi, by zajrzeć do środka · przeciągnij, aby obrócić',
    lensTip: 'Najedź kursorem – zajrzyj do środka',
    lensTipTouch: 'Dotknij – zajrzyj do środka',
    bar: {
      label: 'Etapy intro',
      cloud: 'Chmura punktów',
      mesh: 'Siatka',
      short: { cloud: 'Chmura', mesh: 'Siatka', section: 'Przekroje', annotations: 'Adnotacje', shading: 'Cieniowanie', sun: 'Słońce', seasons: 'Pory roku', time: '4D' },
    },
    tour: {
      chapters: {
        section: 'Przekroje',
        annotations: 'Adnotacje i punkty POI',
        shading: 'Cieniowanie',
        sun: 'Analiza nasłonecznienia',
        seasons: 'Pory roku i pogoda',
        time: 'Podróż w czasie (4D)',
      },
      shading: { textures: 'tekstury', pbr: 'PBR: połysk i odbicia', raking: 'światło boczne' },
      sun: { night: 'noc' },
      sunDate: 'Wołpa, 21 czerwca',
      compass: { N: 'N', E: 'E', S: 'S', W: 'W' },
      seasons: { spring: 'wiosna', summer: 'lato', autumn: 'jesień', winter: 'zima' },
      labels: { roof: 'Dach', pavilion: 'Narożny pawilon' },
      height: 'wysokość',
    },
    soundOn: 'Wyłącz dźwięk',
    soundOff: 'Włącz dźwięk',
  },
  en: {
    tagline: 'Heritage in three dimensions — and in time',
    caption: 'Wołpa Synagogue · digital reconstruction',
    enter: 'Enter the viewer',
    skip: 'Skip intro',
    replay: 'Assemble again',
    points: (n, total) => `${n} / ${total} points in place`,
    mesh: (v, f) => `${v} vertices · ${f} faces`,
    loading: 'Loading points…',
    error: 'The intro could not be loaded.',
    hint: 'Hover over the synagogue to look inside · drag to rotate',
    hintTouch: 'Touch the synagogue to look inside · drag to rotate',
    lensTip: 'Move the cursor here – look inside',
    lensTipTouch: 'Touch here – look inside',
    bar: {
      label: 'Intro chapters',
      cloud: 'Point cloud',
      mesh: 'Mesh',
      short: { cloud: 'Cloud', mesh: 'Mesh', section: 'Sections', annotations: 'Annotations', shading: 'Shading', sun: 'Sun', seasons: 'Seasons', time: '4D' },
    },
    tour: {
      chapters: {
        section: 'Sections',
        annotations: 'Annotations and POIs',
        shading: 'Shading',
        sun: 'Sun study',
        seasons: 'Seasons and weather',
        time: 'Time travel (4D)',
      },
      shading: { textures: 'textures', pbr: 'PBR: gloss and reflections', raking: 'raking light' },
      timeNotes: {
        1730: 'built: fresh timber and shingles',
        1735: 'the first years: the wood darkens',
        1745: 'the sunny sides turn grey',
        1760: 'patina, the first algae on the north',
        1780: 'old, mossy shingles',
        1781: 'a new shingle roof',
        1790: 'the shingles turn grey',
        1840: 'moss on the northern slopes',
        1902: 'the roof before its repair',
        1903: 'the roof repaired',
        1936: 'as surveyed',
      },
      sun: { night: 'night' },
      sunDate: 'Wołpa, 21 June',
      compass: { N: 'N', E: 'E', S: 'S', W: 'W' },
      seasons: { spring: 'spring', summer: 'summer', autumn: 'autumn', winter: 'winter' },
      labels: { roof: 'Roof', pavilion: 'Corner pavilion' },
      height: 'height',
    },
    soundOn: 'Sound off',
    soundOff: 'Sound on',
  },
  de: {
    tagline: 'Kulturerbe in drei Dimensionen – und in der Zeit',
    caption: 'Synagoge von Wołpa · digitale Rekonstruktion',
    enter: 'Zum Viewer',
    skip: 'Intro überspringen',
    replay: 'Neu zusammensetzen',
    points: (n, total) => `${n} / ${total} Punkte an ihrem Platz`,
    mesh: (v, f) => `${v} Eckpunkte · ${f} Flächen`,
    loading: 'Punkte werden geladen…',
    error: 'Das Intro konnte nicht geladen werden.',
    hint: 'Mit der Maus über die Synagoge fahren, um hineinzusehen · ziehen zum Drehen',
    hintTouch: 'Die Synagoge berühren, um hineinzusehen · ziehen zum Drehen',
    lensTip: 'Mit der Maus hierher – hineinsehen',
    lensTipTouch: 'Hier berühren – hineinsehen',
    bar: {
      label: 'Kapitel des Intros',
      cloud: 'Punktwolke',
      mesh: 'Netz',
      short: { cloud: 'Wolke', mesh: 'Netz', section: 'Schnitte', annotations: 'Annotationen', shading: 'Schattierung', sun: 'Sonne', seasons: 'Jahreszeiten', time: '4D' },
    },
    tour: {
      chapters: {
        section: 'Schnitte',
        annotations: 'Annotationen und POIs',
        shading: 'Schattierung',
        sun: 'Sonnenstudie',
        seasons: 'Jahreszeiten und Wetter',
        time: 'Zeitreise (4D)',
      },
      shading: { textures: 'Texturen', pbr: 'PBR: Glanz und Spiegelung', raking: 'Streiflicht' },
      timeNotes: {
        1730: 'Bau: frisches Holz und Schindeln',
        1735: 'die ersten Jahre: das Holz dunkelt nach',
        1745: 'die Sonnenseiten vergrauen',
        1760: 'Patina, erste Algen auf der Nordseite',
        1780: 'alte, bemooste Schindeln',
        1781: 'neue Schindeldeckung',
        1790: 'die Schindeln vergrauen',
        1840: 'Moos auf den Nordflächen',
        1902: 'das Dach vor der Reparatur',
        1903: 'Dachreparatur',
        1936: 'Zustand der Bauaufnahme',
      },
      sun: { night: 'Nacht' },
      sunDate: 'Wołpa, 21. Juni',
      compass: { N: 'N', E: 'O', S: 'S', W: 'W' },
      seasons: { spring: 'Frühling', summer: 'Sommer', autumn: 'Herbst', winter: 'Winter' },
      labels: { roof: 'Dach', pavilion: 'Eckpavillon' },
      height: 'Höhe',
    },
    soundOn: 'Ton aus',
    soundOff: 'Ton an',
  },
};

// From the query or the hash: the viewer page (intro-overlay.js) passes its
// in the hash, which survives a server's index.html -> ./ style redirect.
const params = new URLSearchParams(window.location.search);
for (const [key, value] of new URLSearchParams(window.location.hash.slice(1))) {
  if (!params.has(key)) params.set(key, value);
}
const lang = pickLanguage(params.get('lang'));
const t = TEXTS[lang];
const nextUrl = safeNextUrl(params.get('next'));
const embedded = params.get('embedded') === '1' && window.parent !== window;
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const numberFormat = new Intl.NumberFormat(lang);

function pickLanguage(requested) {
  const candidates = [requested, ...(navigator.languages || [navigator.language])];
  for (const candidate of candidates) {
    const code = String(candidate || '').slice(0, 2).toLowerCase();
    if (TEXTS[code]) return code;
  }
  return 'en';
}

// Only a page of this site: ?next= must not send visitors elsewhere.
function safeNextUrl(value) {
  if (!value) return DEFAULT_NEXT;
  try {
    const url = new URL(value, window.location.href);
    if (url.origin === window.location.origin) return url.href;
  } catch {
    // fall through
  }
  return DEFAULT_NEXT;
}

// --- Page --------------------------------------------------------------------

const ui = {
  root: document.getElementById('intro'),
  canvas: document.getElementById('intro-canvas'),
  tagline: document.getElementById('intro-tagline'),
  caption: document.getElementById('intro-caption'),
  counter: document.getElementById('intro-counter'),
  enter: document.getElementById('intro-enter'),
  skip: document.getElementById('intro-skip'),
  replay: document.getElementById('intro-replay'),
  hint: document.getElementById('intro-hint'),
  status: document.getElementById('intro-status'),
  sound: document.getElementById('intro-sound'),
  bar: document.getElementById('intro-bar'),
};

document.documentElement.lang = lang;
ui.tagline.textContent = t.tagline;
ui.caption.textContent = t.caption;
ui.enter.textContent = t.enter;
ui.skip.textContent = t.skip;
ui.replay.textContent = t.replay;
ui.replay.title = t.replay;
// A mouse or a finger: what the hints ask for.
const canHover = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? true;
ui.hint.textContent = canHover ? t.hint : t.hintTouch;
// The x-ray lens's tip, next to the lens while it shows itself.
ui.lensTip = document.createElement('p');
ui.lensTip.className = 'intro-lens-tip';
ui.lensTip.setAttribute('aria-hidden', 'true');
ui.lensTip.append(Object.assign(document.createElement('span'), { textContent: canHover ? t.lensTip : t.lensTipTouch }));
ui.root.append(ui.lensTip);
ui.status.textContent = t.loading;
ui.enter.href = nextUrl;
ui.skip.href = nextUrl;

// --- Progress bar ------------------------------------------------------------

// One button per part, equally wide; its fill shows how far the part is.
ui.bar.setAttribute('aria-label', t.bar.label);
const barParts = SEGMENTS.map((segment) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'intro-bar-part';
  const name = segment.key === 'cloud' || segment.key === 'mesh' ? t.bar[segment.key] : t.tour.chapters[segment.key];
  button.title = name;
  button.innerHTML = '<span class="intro-bar-track"><span class="intro-bar-fill"></span></span><span class="intro-bar-name"></span>';
  button.querySelector('.intro-bar-name').textContent = t.bar.short?.[segment.key] || name;
  // Until the points (and for the later parts, the model) are there.
  button.disabled = true;
  button.addEventListener('click', () => seek(segment.from + 0.01));
  ui.bar.appendChild(button);
  return { segment, button, fill: button.querySelector('.intro-bar-fill') };
});

// To that moment of the intro (seconds), at once.
function seek(T) {
  if (!cloud || exitStarted >= 0) return;
  rewindStart = -1;
  if (meshReveal) meshReadyAt = 0;
  if (isHeld()) heldAt = T;
  else started = now() - T;
  lastT = T; // a jump: no single sounds for what was skipped
  userTouched = false;
}

let lastBarState = '';
function showProgress(T) {
  // A model that came late starts its act late: the bar shows the act's own time.
  const late = meshReveal ? Math.max(0, meshReadyAt - LANDING) : 0;
  const shown = T > LANDING ? T - Math.min(late, T - LANDING) : T;
  let state = '';
  for (const part of barParts) {
    const { from, to } = part.segment;
    const amount = Math.min(1, Math.max(0, (shown - from) / (to - from)));
    const active = shown >= from && (shown < to || part === barParts.at(-1));
    // Parts after the cloud need the model.
    const ready = part.segment.key === 'cloud' || Boolean(meshReveal && tour);
    part.fill.style.transform = `scaleX(${amount.toFixed(3)})`;
    state += `${active ? 1 : 0}${ready ? 1 : 0}`;
    part.active = active;
    part.ready = ready;
  }
  if (state === lastBarState) return;
  lastBarState = state;
  for (const part of barParts) {
    part.button.classList.toggle('is-active', part.active);
    part.button.disabled = !part.ready;
    if (part.active) part.button.setAttribute('aria-current', 'step');
    else part.button.removeAttribute('aria-current');
  }
}

// --- Sound -------------------------------------------------------------------

const SOUND_KEY = 'explora4d-intro-sound';
const sound = createIntroSound();
let soundWanted = params.get('sound') === '1';
try {
  const stored = localStorage.getItem(SOUND_KEY);
  if (stored === '1' || stored === '0') soundWanted = stored === '1';
} catch {
  // no storage: the page's default
}

function showSoundState() {
  ui.sound.setAttribute('aria-pressed', String(soundWanted));
  ui.sound.title = soundWanted ? t.soundOn : t.soundOff;
  ui.sound.setAttribute('aria-label', ui.sound.title);
  ui.sound.classList.toggle('is-on', soundWanted);
}

function setSound(on, remember) {
  soundWanted = on;
  showSoundState();
  if (remember) {
    try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  }
  sound.setEnabled(on).catch((error) => console.warn('[intro] sound:', error));
}

showSoundState();
ui.sound.addEventListener('click', () => setSound(!soundWanted, true));
// Wanted from the start: on with the first gesture the browser allows it for.
if (soundWanted) {
  const start = (event) => {
    if (event.target === ui.sound) return; // the button's own click decides
    window.removeEventListener('pointerdown', start, true);
    window.removeEventListener('keydown', start, true);
    if (soundWanted && !sound.enabled) setSound(true, false);
  };
  window.addEventListener('pointerdown', start, true);
  window.addEventListener('keydown', start, true);
}

// Inside the viewer page: tell it (same origin only).
function tellViewer(action) {
  window.parent.postMessage({ type: 'explora4d-intro', action }, window.location.origin);
}

// One set of uniforms for both passes.
const cloudUniforms = {
  uTime: { value: 0 },
  uFade: { value: 0 },
  uProgress: { value: 0 },
  uExit: { value: 0 },
  uViewport: { value: 800 },
  uSize: { value: 0.016 },
  uRayOrigin: { value: new Vector3() },
  uRayDir: { value: new Vector3(0, 0, -1) },
  uHover: { value: 0 },
  uLight: { value: new Vector3(0.55, 0.75, 0.35).normalize() },
  // The last point's landing: where, and seconds since (negative: not yet).
  uFlashPos: { value: new Vector3() },
  uFlash: { value: -1 },
  // The model's faces (0..1) and the points' height range: a point gives
  // way once the faces at its height have formed.
  uFaces: { value: 0 },
  uYRange: { value: new Vector2(0, 1) },
};

// --- Scene -------------------------------------------------------------------

let renderer;
try {
  renderer = new WebGLRenderer({ canvas: ui.canvas, antialias: true, powerPreference: 'high-performance' });
} catch {
  // No WebGL: the page still has its button into the viewer.
  showFallback();
}

const scene = new Scene();
const camera = new PerspectiveCamera(38, 1, 0.01, 100);
// Seconds since the page opened; ?at=<seconds> holds the intro at that
// moment (for stills and screen recordings).
// Held: ?at=, or reduced motion (the end, everything shown). The progress
// bar moves a held intro to another moment.
let heldAt = Number.parseFloat(params.get('at'));
const isHeld = () => Number.isFinite(heldAt);
const pageStart = performance.now();
const now = () => (performance.now() - pageStart) / 1000;
let controls;
let cloud;
let dust;
let total = 0;
let started = -1;
let meshReveal = null;
let tour = null;
let meshReadyAt = -1; // the intro time T when the model was ready
let lastPoint = null;
let exitStarted = -1;
let exitTarget = null;
const pointer = new Vector2(10, 10);
let hover = 0;
let hoverTarget = 0;
let userTouched = false;
// The x-ray lens: where the pointer is (ndc), whether it is on the canvas
// (a mouse over it, a finger down), when it last moved, and whether the
// lens has been used (then it stops showing itself).
const lensPointer = new Vector2();
let lensPointerOn = false;
let lensMovedAt = -Infinity;
let lensUsedFor = 0;
let lensOn = 0;
const lensCentre = new Vector3();
const lensRay = { origin: new Vector3(), dir: new Vector3() };
const LENS_RADIUS = 0.3;
function hideHint() {
  if (userTouched && lensUsedFor > 0.6) ui.hint.classList.add('is-gone');
}

if (renderer) {
  renderer.setClearColor(new Color(0x05070d), 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; // the tour's sun study
  camera.position.set(3.75, 1.25, 4.7);
  controls = new OrbitControls(camera, ui.canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 3.2;
  controls.maxDistance = 11;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.62;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.55;
  controls.target.set(0, 0.12, 0);
  controls.addEventListener('start', () => {
    userTouched = true;
    hideHint();
  });
  resize();
  window.addEventListener('resize', resize);
  ui.canvas.addEventListener('pointermove', (event) => {
    const rect = ui.canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    hoverTarget = event.pointerType === 'mouse' ? 1 : 0;
    lensPointer.copy(pointer);
    if (event.pointerType === 'mouse' || event.buttons) {
      lensPointerOn = true;
      lensMovedAt = now();
    }
  });
  ui.canvas.addEventListener('pointerdown', (event) => {
    const rect = ui.canvas.getBoundingClientRect();
    lensPointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    lensPointerOn = true;
    lensMovedAt = now();
  });
  const lensOff = (event) => { if (event.pointerType !== 'mouse') lensPointerOn = false; };
  ui.canvas.addEventListener('pointerup', lensOff);
  ui.canvas.addEventListener('pointercancel', lensOff);
  ui.canvas.addEventListener('pointerleave', () => {
    hoverTarget = 0;
    lensPointerOn = false;
  });
  load().catch((error) => {
    console.error('[intro]', error);
    ui.status.textContent = t.error;
    showFallback();
  });
}

function showFallback() {
  ui.root.classList.add('is-fallback', 'is-ready', 'is-assembled');
  if (embedded) tellViewer('ready');
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  // A narrow (portrait) screen: further away, so the building fits across.
  camera.zoom = Math.min(1, camera.aspect / 1.15 + 0.15);
  camera.updateProjectionMatrix();
  // Point sizes follow the zoom, as the building does.
  const viewport = height * renderer.getPixelRatio() * camera.zoom;
  cloudUniforms.uViewport.value = viewport;
  if (dust) dust.material.uniforms.uViewport.value = viewport;
  meshReveal?.setViewport(viewport);
  tour?.setViewport(viewport);
}

// --- Data --------------------------------------------------------------------

async function load() {
  const response = await fetch(POINTS_URL);
  if (!response.ok) throw new Error(`${POINTS_URL}: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  const view = new DataView(buffer);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  if (magic !== 'E4DP') throw new Error(`${POINTS_URL}: not an intro point file`);
  total = view.getUint32(4, true);
  const min = [0, 1, 2].map((k) => view.getFloat32(8 + k * 4, true));
  const max = [0, 1, 2].map((k) => view.getFloat32(20 + k * 4, true));
  const quantized = new Uint16Array(buffer, 32, total * 3);
  const srgb = new Uint8Array(buffer, 32 + total * 6, total * 3);
  const normals = new Int8Array(buffer, 32 + total * 9, total * 3);

  // Centred on the ground's middle, about 3 units across.
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const scale = 2.9 / extent;
  const center = [(min[0] + max[0]) / 2, min[1] + (max[1] - min[1]) * 0.42, (min[2] + max[2]) / 2];
  const heightRange = max[1] - min[1];

  const target = new Float32Array(total * 3);
  const start = new Float32Array(total * 3);
  const seed = new Float32Array(total * 4);
  const delay = new Float32Array(total);
  const color = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);

  let rand = 0x9e3779b9;
  const random = () => {
    rand ^= rand << 13; rand ^= rand >>> 17; rand ^= rand << 5;
    return (rand >>> 0) / 4294967296;
  };
  const gaussian = () => (random() + random() + random() - 1.5) / 1.5;

  // The cloud: a few swirling clumps, a nebula, and a thin haze between them.
  const clumps = Array.from({ length: 9 }, () => {
    const angle = random() * Math.PI * 2;
    const distance = 1.4 + random() * 3.2;
    return {
      x: Math.cos(angle) * distance,
      y: (random() - 0.4) * 2.4,
      z: Math.sin(angle) * distance,
      size: 0.5 + random() * 1.1,
    };
  });

  for (let i = 0; i < total; i++) {
    let height = 0;
    for (let k = 0; k < 3; k++) {
      const value = min[k] + (quantized[i * 3 + k] / 65535) * (max[k] - min[k]);
      target[i * 3 + k] = (value - center[k]) * scale;
      if (k === 1) height = (value - min[1]) / heightRange;
      color[i * 3 + k] = srgb[i * 3 + k] / 255;
      normal[i * 3 + k] = normals[i * 3 + k] / 127;
    }
    const pick = random();
    if (pick < 0.62) {
      const clump = clumps[Math.floor(random() * clumps.length)];
      start[i * 3] = clump.x + gaussian() * clump.size;
      start[i * 3 + 1] = clump.y + gaussian() * clump.size * 0.7;
      start[i * 3 + 2] = clump.z + gaussian() * clump.size;
    } else if (pick < 0.88) {
      // A flat, turning disc - the arms of the nebula.
      const arm = Math.floor(random() * 3);
      const r = 0.6 + Math.pow(random(), 0.7) * 5.5;
      const angle = arm * (Math.PI * 2 / 3) + r * 0.85 + gaussian() * 0.35;
      start[i * 3] = Math.cos(angle) * r;
      start[i * 3 + 1] = gaussian() * 0.25 + 0.2;
      start[i * 3 + 2] = Math.sin(angle) * r;
    } else {
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const r = 1 + Math.pow(random(), 0.5) * 6.5;
      start[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      start[i * 3 + 1] = r * Math.cos(phi) * 0.6;
      start[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    for (let k = 0; k < 4; k++) seed[i * 4 + k] = random();
    // Foundations first, the roofs last - loosely, so it reads as gathering
    // rather than a scan line.
    delay[i] = Math.min(1, height * 0.62 + random() * 0.38);
  }

  // The last point: the highest one, the top of the roof. Moved to the end
  // of the arrays and left out of the cloud; it flies on its own.
  let top = 0;
  for (let i = 1; i < total; i++) if (target[i * 3 + 1] > target[top * 3 + 1]) top = i;
  const last = total - 1;
  for (const [array, size] of [[target, 3], [start, 3], [seed, 4], [delay, 1], [color, 3], [normal, 3]]) {
    for (let k = 0; k < size; k++) {
      const tmp = array[top * size + k];
      array[top * size + k] = array[last * size + k];
      array[last * size + k] = tmp;
    }
  }
  lastPoint = createLastPoint(
    new Vector3(target[last * 3], target[last * 3 + 1], target[last * 3 + 2]),
    new Vector3(start[last * 3], start[last * 3 + 1], start[last * 3 + 2]),
  );
  scene.add(lastPoint.group);
  cloudUniforms.uFlashPos.value.copy(lastPoint.target);
  let yMin = Infinity;
  let yMax = -Infinity;
  for (let i = 0; i < total; i++) {
    yMin = Math.min(yMin, target[i * 3 + 1]);
    yMax = Math.max(yMax, target[i * 3 + 1]);
  }
  cloudUniforms.uYRange.value.set(yMin, yMax);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(target, 3));
  geometry.setAttribute('aStart', new BufferAttribute(start, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 4));
  geometry.setAttribute('aDelay', new BufferAttribute(delay, 1));
  geometry.setAttribute('aColor', new BufferAttribute(color, 3));
  geometry.setAttribute('aNormal', new BufferAttribute(normal, 3));
  geometry.setDrawRange(0, total - 1);

  // Drawn twice: the points in flight as additive light, the points in
  // place as solid, lit discs.
  const solid = new Points(geometry, createCloudMaterial(false));
  const glow = new Points(geometry, createCloudMaterial(true));
  solid.frustumCulled = false;
  glow.frustumCulled = false;
  glow.renderOrder = 1;
  cloud = { solid, glow, uniforms: solid.material.uniforms };
  scene.add(solid, glow);

  dust = createDust(random);
  scene.add(dust);
  resize();

  ui.status.textContent = '';
  ui.root.classList.add('is-ready');
  if (embedded) tellViewer('ready');
  started = now();
  // Reduced motion: held at the end, everything shown (the bar still moves it).
  if (reducedMotion && !isHeld()) heldAt = INTRO_END;
  renderer.setAnimationLoop(frame);

  // The model, while the points gather. Without it the intro ends with the
  // points.
  createMeshReveal({ url: MODEL_URL, renderer, center, scale, transcoderPath: TRANSCODER_PATH })
    .then((reveal) => {
      meshReveal = reveal;
      // Late (after the landing): its act starts now. Held (?at=) or shown
      // whole: as if it had been there from the start.
      meshReadyAt = isHeld() ? 0 : timeline(now());
      scene.add(reveal.group);
      // The model's height, from its ground (y = 0, in centimetres).
      const height = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(max[1] / 100);
      tour = createFeatureTour({
        reveal,
        camera,
        renderer,
        root: ui.root,
        texts: t,
        toIntro: (x, y, z) => new Vector3((x - center[0]) * scale, (y - center[1]) * scale, (z - center[2]) * scale),
        heightLabel: `${t.tour.height} ${height} m`,
        lang,
      });
      scene.add(tour.group);
      resize();
    })
    .catch((error) => console.warn('[intro] the model could not be loaded:', error));
}

// --- Materials ---------------------------------------------------------------

const NOISE = /* glsl */ `
  // A smooth, cheap drift: sums of sines with per-point frequencies.
  vec3 drift(vec4 s, float time) {
    return vec3(
      sin(time * (0.21 + s.x * 0.35) + s.y * 6.2831) + 0.5 * sin(time * (0.53 + s.z * 0.4) + s.w * 12.0),
      sin(time * (0.17 + s.y * 0.3) + s.z * 6.2831) + 0.5 * sin(time * (0.47 + s.w * 0.4) + s.x * 12.0),
      sin(time * (0.19 + s.z * 0.33) + s.w * 6.2831) + 0.5 * sin(time * (0.59 + s.x * 0.4) + s.y * 12.0)
    );
  }
  vec3 rotateY(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }
`;

function createCloudMaterial(glowPass) {
  return new ShaderMaterial({
    uniforms: cloudUniforms,
    defines: glowPass ? { GLOW_PASS: 1 } : {},
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uFade;
      uniform float uProgress;
      uniform float uExit;
      uniform float uViewport;
      uniform float uSize;
      uniform vec3 uRayOrigin;
      uniform vec3 uRayDir;
      uniform float uHover;
      uniform vec3 uLight;
      uniform vec3 uFlashPos;
      uniform float uFlash;
      uniform float uFaces;
      uniform vec2 uYRange;
      attribute vec3 aStart;
      attribute vec4 aSeed;
      attribute float aDelay;
      attribute vec3 aColor;
      attribute vec3 aNormal;
      varying vec3 vColor;
      varying float vAlpha;
      ${NOISE}

      void main() {
        // This point's own share of the assembly: it sets off after its
        // delay and takes a while (longer for some) to arrive.
        float span = 0.32 + aSeed.x * 0.18;
        float local = clamp((uProgress - aDelay * (1.0 - span)) / span, 0.0, 1.0);
        float e = local * local * (3.0 - 2.0 * local);
        e = 1.0 - pow(1.0 - e, 2.2);
        float settle = smoothstep(0.6, 0.97, e);
        // Giving way to the model's faces, from the ground up.
        float h = (position.y - uYRange.x) / max(uYRange.y - uYRange.x, 1e-3);
        float gone = smoothstep(h * 0.59 + 0.1, h * 0.59 + 0.38, uFaces);

      #ifdef GLOW_PASS
        if (settle >= 0.999 && uExit <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
      #else
        if (settle <= 0.001 || gone >= 0.999) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
      #endif

        // In the cloud: drifting, the whole swarm slowly turning.
        vec3 chaos = rotateY(aStart, uTime * (0.04 + 0.08 / (1.0 + length(aStart.xz)))) + drift(aSeed, uTime) * 0.3;
        // On the way: a curve - a swirl around the building and a lift.
        vec3 path = mix(chaos, position, e);
        path = rotateY(path, (1.0 - e) * (1.5 + aSeed.z * 2.0) * (aSeed.w > 0.5 ? 1.0 : -1.0));
        path.y += sin(e * 3.14159) * (0.25 + aSeed.w * 0.6);
        // Arrived: a faint thermal tremble, like atoms in a lattice.
        path += drift(aSeed.yzwx, uTime * 3.0) * 0.002 * e;
        // The last point's landing: a wave of light through the building,
        // lifting the points a little as it passes.
        float flashDistance = length(position - uFlashPos);
        float wave = uFlash < 0.0 ? 0.0
          : exp(-pow((flashDistance - uFlash * 2.2) / 0.09, 2.0)) * exp(-uFlash * 0.9) * settle;
        path += aNormal * wave * 0.02;

        // The pointer pushes settled points aside.
        vec3 toPoint = path - uRayOrigin;
        vec3 closest = uRayOrigin + uRayDir * dot(toPoint, uRayDir);
        vec3 away = path - closest;
        float push = (1.0 - smoothstep(0.0, 0.42, length(away))) * uHover * e;
        path += normalize(away + 1e-5) * push * 0.18;

        // Leaving for the viewer: everything flies apart, outward and up.
        path += (normalize(path + vec3(0.0, 0.4, 0.0)) * (1.5 + aSeed.x * 3.0) + drift(aSeed, uTime) * 0.8) * uExit * uExit;

        vec4 mvPosition = modelViewMatrix * vec4(path, 1.0);
        gl_Position = projectionMatrix * mvPosition;

      #ifdef GLOW_PASS
        // Atoms in flight: larger, glowing, flickering; cold electric blue
        // and warm amber.
        float size = uSize * mix(2.2 + aSeed.y * 3.0, 1.4, e);
        vec3 energy = mix(vec3(0.3, 0.6, 1.0), vec3(1.0, 0.72, 0.38), step(0.62, aSeed.z));
        energy = mix(energy, aColor, smoothstep(0.3, 0.9, e));
        float flicker = 0.55 + 0.45 * sin(uTime * (1.2 + aSeed.x * 3.5) + aSeed.y * 40.0);
        vColor = energy * flicker * (0.35 + 0.65 * aSeed.w) * 0.42;
        vAlpha = uFade * (1.0 - settle) * (1.0 - uExit) + uExit * (1.0 - uExit) * 1.5;
      #else
        // In place: lit by a low, warm light, both sides of thin walls.
        float size = uSize * (1.0 + push * 1.5 + wave * 0.35) * (1.0 - gone);
        vec3 n = normalize(mat3(modelMatrix) * aNormal);
        vec3 toCamera = normalize(cameraPosition - path);
        if (dot(n, toCamera) < 0.0) n = -n;
        float diffuse = max(dot(n, uLight), 0.0);
        float rim = pow(1.0 - max(dot(n, toCamera), 0.0), 3.0);
        vec3 lit = aColor * (0.42 + 0.78 * diffuse) * vec3(1.04, 1.0, 0.95)
          + rim * vec3(0.25, 0.4, 0.7) * 0.6;
        vColor = lit + push * vec3(0.3, 0.5, 0.8) + wave * vec3(0.45, 0.65, 1.0) * 0.55;
        vAlpha = settle * (1.0 - uExit);
      #endif
        gl_PointSize = max(1.0, size * uViewport / -mvPosition.z);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r = dot(uv, uv);
        if (r > 1.0) discard;
      #ifdef GLOW_PASS
        float glow = exp(-r * 4.0);
        gl_FragColor = vec4(vColor * glow * vAlpha, 1.0);
      #else
        if (vAlpha < 0.5) discard;
        gl_FragColor = vec4(vColor, 1.0);
      #endif
      }
    `,
    transparent: glowPass,
    depthWrite: !glowPass,
    blending: glowPass ? AdditiveBlending : NormalBlending,
  });
}

// Faint motes around the building, there all the time.
function createDust(random) {
  const count = 2500;
  const position = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const theta = random() * Math.PI * 2;
    const radius = 2 + random() * 7;
    position[i * 3] = Math.cos(theta) * radius;
    position[i * 3 + 1] = (random() - 0.4) * 5;
    position[i * 3 + 2] = Math.sin(theta) * radius;
    for (let k = 0; k < 4; k++) seed[i * 4 + k] = random();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 4));
  const material = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uViewport: { value: 800 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uViewport;
      attribute vec4 aSeed;
      varying float vTwinkle;
      ${NOISE}
      void main() {
        vec3 p = rotateY(position, uTime * 0.012) + drift(aSeed, uTime * 0.4) * 0.4;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = max(1.0, (0.02 + aSeed.x * 0.03) * uViewport / -mvPosition.z);
        vTwinkle = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed.y * 2.0) + aSeed.z * 30.0));
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      varying float vTwinkle;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float glow = exp(-dot(uv, uv) * 4.0);
        gl_FragColor = vec4(vec3(0.55, 0.7, 1.0) * glow * vTwinkle * 0.45 * uFade, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

// --- The last point ------------------------------------------------------------

// A brighter atom with a short trail; on landing a flash and a ring.
function createLastPoint(target, start) {
  // Out at the edge of the cloud, so its way in is long.
  const from = start.clone();
  from.y = Math.min(Math.max(from.y, 0.2), 0.8);
  if (Math.hypot(from.x, from.z) < 4.2) {
    const angle = Math.atan2(from.z, from.x);
    from.x = Math.cos(angle) * 4.6;
    from.z = Math.sin(angle) * 4.6;
  }
  const group = new Group();
  const glowUniforms = { uIntensity: { value: 1 }, uRing: { value: 0 }, uRingAlpha: { value: 0 }, uTime: { value: 0 } };
  const glow = new Mesh(new PlaneGeometry(1, 1), new ShaderMaterial({
    uniforms: glowUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      uniform float uRing;
      uniform float uRingAlpha;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float d = length(vUv);
        float core = exp(-d * d * 260.0);
        float halo = exp(-d * d * 22.0) * 0.2;
        // A soft four-pointed glint, slowly turning.
        float a = uTime * 0.25;
        vec2 r = mat2(cos(a), -sin(a), sin(a), cos(a)) * vUv;
        float glint = (exp(-abs(r.y) * 90.0) * exp(-abs(r.x) * 4.0) + exp(-abs(r.x) * 90.0) * exp(-abs(r.y) * 4.0)) * 0.25;
        float ring = exp(-pow((d - uRing) / 0.018, 2.0)) * uRingAlpha;
        vec3 color = vec3(1.0, 0.93, 0.8) * core * 1.4 + vec3(0.55, 0.75, 1.0) * (halo + glint) + vec3(0.6, 0.8, 1.0) * ring;
        gl_FragColor = vec4(color * uIntensity, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  }));
  glow.renderOrder = 10;
  group.add(glow);

  const TRAIL = 56;
  const trailGeometry = new BufferGeometry();
  trailGeometry.setAttribute('position', new BufferAttribute(new Float32Array(TRAIL * 3), 3));
  const fadeAlong = new Float32Array(TRAIL);
  for (let i = 0; i < TRAIL; i++) fadeAlong[i] = 1 - i / TRAIL;
  trailGeometry.setAttribute('aFade', new BufferAttribute(fadeAlong, 1));
  const trailUniforms = { uViewport: cloudUniforms.uViewport, uAlpha: { value: 0 } };
  const trail = new Points(trailGeometry, new ShaderMaterial({
    uniforms: trailUniforms,
    vertexShader: /* glsl */ `
      uniform float uViewport;
      attribute float aFade;
      varying float vFade;
      void main() {
        vFade = aFade;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = max(1.0, (0.008 + 0.03 * aFade * aFade) * uViewport / -mvPosition.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      varying float vFade;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float glow = exp(-dot(uv, uv) * 4.0);
        gl_FragColor = vec4(mix(vec3(0.3, 0.55, 1.0), vec3(1.0, 0.85, 0.6), vFade) * glow * vFade * uAlpha * 0.45, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  }));
  trail.frustumCulled = false;
  trail.renderOrder = 9;
  group.add(trail);

  // The way in: a wide spiral, slowing down as it comes closer.
  const fromAngle = Math.atan2(from.z, from.x);
  const fromRadius = Math.hypot(from.x, from.z);
  const toAngle = Math.atan2(target.z, target.x);
  const toRadius = Math.hypot(target.x, target.z);
  // One and a quarter turns, in the direction that is the shorter way.
  let turn = toAngle - fromAngle;
  turn = turn - Math.round(turn / (Math.PI * 2)) * Math.PI * 2 + Math.PI * 2 * (turn >= 0 ? 1 : -1);
  const at = (u, out) => {
    const k = 1 - Math.pow(1 - u, 2.6);
    const angle = fromAngle + turn * k;
    const radius = fromRadius + (toRadius - fromRadius) * k;
    out.set(
      Math.cos(angle) * radius,
      from.y + (target.y - from.y) * k + Math.sin(k * Math.PI) * 0.45,
      Math.sin(angle) * radius,
    );
    return out;
  };
  const position = new Vector3();
  const trailPositions = trailGeometry.getAttribute('position');

  return {
    group,
    target,
    position: glow.position,
    // T: the intro's time; time: the clock, for the glint.
    update(T, time, exit) {
      const flight = Math.min(1, Math.max(0, (T - LAST_START) / LAST_FLIGHT));
      const sinceLanding = T - LANDING;
      glowUniforms.uTime.value = time;
      at(flight, position);
      if (flight <= 0) {
        // Waiting at the edge of the cloud, drifting a little.
        position.x += Math.sin(time * 0.37) * 0.12;
        position.y += Math.sin(time * 0.29 + 1.3) * 0.1;
        position.z += Math.cos(time * 0.31) * 0.12;
      }
      glow.position.copy(position);
      glow.quaternion.copy(camera.quaternion);
      const distance = camera.position.distanceTo(position);
      // On landing: a flash that fades; the ring spreads out.
      const flash = sinceLanding >= 0 ? Math.exp(-sinceLanding * 1.6) : 0;
      const breathe = 0.85 + 0.15 * Math.sin(time * 2.4);
      const fadeIn = Math.min(1, Math.max(0, (T - FADE_IN * 0.5) / FADE_IN));
      glowUniforms.uIntensity.value = (sinceLanding >= 0 ? flash * 1.3 : breathe * fadeIn * 0.75) * (1 - exit);
      glow.scale.setScalar(distance * (sinceLanding >= 0 ? 0.2 + (1 - flash) * 0.16 : 0.18));
      const ring = sinceLanding >= 0 ? Math.min(1, sinceLanding / 1.6) : 0;
      glowUniforms.uRing.value = ring * 0.95;
      glowUniforms.uRingAlpha.value = sinceLanding >= 0 ? (1 - ring) * 0.35 : 0;
      glow.visible = glowUniforms.uIntensity.value > 0.003;

      // The trail: where it was a moment ago.
      trailUniforms.uAlpha.value = flight > 0 && flight < 1 ? Math.min(1, flight * 8) : Math.max(0, 1 - sinceLanding * 3);
      trail.visible = trailUniforms.uAlpha.value > 0.003;
      if (trail.visible) {
        for (let i = 0; i < TRAIL; i++) {
          at(Math.max(0, flight - i * 0.0045), position);
          trailPositions.setXYZ(i, position.x, position.y, position.z);
        }
        trailPositions.needsUpdate = true;
      }
    },
  };
}

// --- Animation ---------------------------------------------------------------

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// The gathering: under way at once, slowing at the end.
const easeGather = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.pow(x, 0.8));
const ray = { origin: new Vector3(), dir: new Vector3(), ndc: new Vector3() };
let lastCounter = '';
let rewindStart = -1;
let rewindFrom = 0;
let lastT = 0;
let lastTime = 0;
let lastArrived = 0;
let cameraTurn = 1;
// The camera's angle around the building at the landing: the front (the
// facade with the corner pavilions faces +Z), a little from the side. Before
// it, turning slower and slower to arrive there; the rate at the landing
// matches the turn that goes on after it (autoRotateSpeed 0.4).
const FRONT_THETA = 0.3;
const LANDING_TURN_RATE = (2 * Math.PI / 60) * 0.4;
const LANDING_TURN_EASE = 0.014;
const orbit = new Spherical();
const orbitOffset = new Vector3();

// The intro's time T at the clock's time: running, held (?at=), shown whole
// (reduced motion) or running back ("Assemble again").
function timeline(time) {
  if (isHeld()) return heldAt;
  if (rewindStart >= 0) {
    const r = Math.min(1, (time - rewindStart) / REWIND);
    return rewindFrom + (ASSEMBLY_START - rewindFrom) * easeInOut(r);
  }
  return time - started;
}

const dt0 = (time) => Math.min(0.1, Math.max(0, time - lastTime));

// The x-ray lens over the standing model: it follows the pointer; until it
// has been used it shows itself, wandering over the front with a tip next
// to it (not while the tour's chapters play).
function updateLens(stage, time, dt, exit) {
  const uniforms = meshReveal?.uniforms;
  if (!uniforms) return;
  const standing = meshReveal.faces() >= 1 && exit <= 0 && rewindStart < 0;
  const tourTime = stage - TOUR_START;
  const cast = (x, y) => {
    lensRay.origin.copy(camera.position);
    lensRay.dir.set(x, y, 0.5).unproject(camera).sub(lensRay.origin).normalize();
    return meshReveal.raycast(lensRay.origin, lensRay.dir);
  };
  // The pointer's own lens, when it is over the model.
  let distance = standing && lensPointerOn ? cast(lensPointer.x, lensPointer.y) : -1;
  const user = distance > 0;
  // Otherwise, until used, the lens shows itself - once the pointer has
  // been still a moment, outside the chapters.
  const demo = !user && standing && lensUsedFor <= 0.6 && time - lensMovedAt > 1.2
    && (tourTime < 0 || tourTime > TOUR_LENGTH);
  if (demo) {
    distance = reducedMotion ? cast(0.1, 0.02)
      : cast(0.2 * Math.sin(time * 0.42), 0.02 + 0.12 * Math.sin(time * 0.29 + 1));
  }
  const hit = distance > 0;
  if (hit) {
    const target = lensRay.dir.multiplyScalar(distance + LENS_RADIUS * 0.3).add(lensRay.origin);
    if (lensOn < 0.05) lensCentre.copy(target);
    else lensCentre.lerp(target, Math.min(1, dt * 18));
    if (user) {
      lensUsedFor += dt;
      hideHint();
    }
  }
  lensOn += ((hit ? 1 : 0) - lensOn) * Math.min(1, dt * 7);
  if (lensOn < 0.005) lensOn = 0;
  uniforms.uLens.value.set(lensCentre.x, lensCentre.y, lensCentre.z, LENS_RADIUS);
  uniforms.uLensOn.value = lensOn;
  // The tip, beside the lens while it shows itself.
  const tip = demo && hit && lensUsedFor <= 0.6 ? lensOn : 0;
  ui.lensTip.style.opacity = tip.toFixed(3);
  if (tip > 0) {
    ray.ndc.copy(lensCentre).project(camera);
    const rect = ui.canvas.getBoundingClientRect();
    const x = rect.left + (ray.ndc.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-ray.ndc.y * 0.5 + 0.5) * rect.height;
    ui.lensTip.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
}

function frame() {
  const time = now();
  if (rewindStart >= 0 && time - rewindStart >= REWIND) {
    // Back in the cloud: gather again from the start.
    started = time - ASSEMBLY_START;
    rewindStart = -1;
    if (meshReveal) meshReadyAt = 0;
  }
  const T = timeline(time);
  const fade = Math.min(1, T / FADE_IN);
  const progress = easeGather(Math.min(1, Math.max(0, (T - ASSEMBLY_START) / ASSEMBLY)));
  const exit = exitStarted < 0 ? 0 : Math.min(1, (time - exitStarted) / EXIT);
  // The model's act: from the landing, or from when the model was ready.
  const stage = meshReveal ? T - Math.max(LANDING, meshReadyAt) : 0;
  let tourCue = '';

  const uniforms = cloudUniforms;
  uniforms.uTime.value = time;
  uniforms.uFade.value = fade;
  uniforms.uProgress.value = progress;
  uniforms.uExit.value = exit;
  uniforms.uFlash.value = T >= LANDING ? T - LANDING : -1;
  dust.material.uniforms.uTime.value = time;
  dust.material.uniforms.uFade.value = fade * (1 - exit);
  lastPoint.update(T, time, exit);
  if (meshReveal) {
    meshReveal.update(stage, exit);
    if (tour) tourCue = tour.update(stage - TOUR_START, time, exit);
    uniforms.uFaces.value = meshReveal.faces();
  }

  updateLens(stage, time, dt0(time), exit);

  // The pointer's ray, for pushing points aside.
  hover += (hoverTarget - hover) * 0.08;
  uniforms.uHover.value = hover;
  ray.origin.copy(camera.position);
  ray.ndc.set(pointer.x, pointer.y, 0.5).unproject(camera);
  ray.dir.copy(ray.ndc).sub(ray.origin).normalize();
  uniforms.uRayOrigin.value.copy(ray.origin);
  uniforms.uRayDir.value.copy(ray.dir);

  // The counter: points in place (the shader's own timing; the last one
  // only when it lands), then the model's vertices and faces.
  let counter;
  if (meshReveal && stage > TIMING.vertices[0]) {
    const { vertices, faces } = meshReveal.counts(stage);
    counter = t.mesh(numberFormat.format(vertices), numberFormat.format(faces));
  } else {
    const arrived = T >= LANDING
      ? total
      : Math.min(total - 1, Math.round(total * Math.min(1, Math.max(0, (progress - 0.32) / 0.66))));
    counter = t.points(numberFormat.format(arrived), numberFormat.format(total));
  }
  if (counter !== lastCounter) {
    lastCounter = counter;
    ui.counter.textContent = counter;
  }
  // The sound follows the same moment.
  const arrivedFraction = T >= LANDING ? 1 : Math.min(1, Math.max(0, (progress - 0.32) / 0.66));
  const dt = Math.min(0.1, Math.max(0, time - lastTime));
  const levels = meshReveal && stage > 0 ? meshReveal.levels(stage) : null;
  ray.ndc.copy(lastPoint.position).project(camera);
  sound.update({
    dt,
    forward: T > lastT && T - lastT < 0.5 && !isHeld() && rewindStart < 0,
    fade,
    progress,
    arrivedRate: dt > 0 ? Math.max(0, arrivedFraction - lastArrived) / dt : 0,
    flight: Math.min(1, Math.max(0, (T - LAST_START) / LAST_FLIGHT)),
    pan: ray.ndc.x,
    landed: T >= LANDING,
    vertices: levels?.vertices ?? 0,
    edges: levels?.edges ?? 0,
    faces: levels?.faces ?? 0,
    glowOut: levels?.glowOut ?? 0,
    exit,
  });
  if (tourCue && T > lastT && T - lastT < 0.5 && !isHeld() && rewindStart < 0) sound.cue(tourCue);
  lastT = T;
  lastTime = time;
  lastArrived = arrivedFraction;

  showProgress(T);
  ui.root.classList.toggle('is-assembling', progress > 0.02);
  ui.root.classList.toggle('is-assembled', T >= LANDING - 0.3);

  // While gathering the camera circles faster, slowing as the building
  // forms; it holds still for the sun study (the shadows turn with the sun
  // only), easing out of and back into its turn.
  if (exitStarted < 0 && !userTouched) {
    const holding = tour?.holdsCamera(stage - TOUR_START) ?? false;
    cameraTurn += ((holding ? 0 : 1) - cameraTurn) * Math.min(1, dt * 3);
    controls.autoRotateSpeed = reducedMotion ? 0 : 0.4 * cameraTurn;
    // Up to the landing the camera's angle follows the intro's time, not
    // how far it happened to turn: when the last point lands, the
    // synagogue faces it (also when held, jumped to or run backwards).
    const before = LANDING - T;
    if (before > 0 && !reducedMotion) {
      orbit.setFromVector3(orbitOffset.copy(camera.position).sub(controls.target));
      orbit.theta = FRONT_THETA + LANDING_TURN_RATE * before + LANDING_TURN_EASE * before * before;
      camera.position.setFromSpherical(orbit).add(controls.target);
      controls.autoRotate = false;
    } else {
      controls.autoRotate = !reducedMotion;
    }
  }
  if (exitStarted >= 0) {
    camera.position.lerp(exitTarget, 0.04);
    if (exit >= 1) {
      renderer.setAnimationLoop(null);
      if (embedded) tellViewer('done');
      else window.location.href = nextUrl;
      return;
    }
  }
  controls.update();
  renderer.render(scene, camera);
}

function leave(event) {
  if (embedded) {
    event.preventDefault();
    if (!renderer || !cloud || reducedMotion) {
      tellViewer('done');
      return;
    }
  } else {
    if (!renderer || !cloud || reducedMotion) return; // the plain link
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
  }
  if (exitStarted >= 0) return;
  exitStarted = now();
  exitTarget = camera.position.clone().multiplyScalar(0.55);
  ui.root.classList.add('is-leaving');
  sound.enter(EXIT);
  // Inside the viewer: it starts fading the intro out while it flies apart.
  if (embedded) tellViewer('leaving');
}

ui.enter.addEventListener('click', leave);
ui.skip.addEventListener('click', (event) => {
  if (!embedded) return;
  event.preventDefault();
  sound.setEnabled(false);
  tellViewer('done');
});

ui.replay.addEventListener('click', () => {
  if (!cloud || reducedMotion || exitStarted >= 0 || rewindStart >= 0 || isHeld()) return;
  rewindFrom = timeline(now());
  rewindStart = now();
  sound.rewind();
  userTouched = false;
});

// Prefetch the viewer while the intro plays (inside it, it is there already).
if (!embedded) {
  const prefetch = document.createElement('link');
  prefetch.rel = 'prefetch';
  prefetch.href = nextUrl;
  document.head.appendChild(prefetch);
}
// Inside the viewer, Escape skips the intro.
if (embedded) {
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') ui.skip.click();
  });
  document.documentElement.classList.add('is-embedded');
}

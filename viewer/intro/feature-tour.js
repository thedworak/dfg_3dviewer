// The intro's third act (viewer/intro/intro.js): once the model stands, an
// express tour of what the viewer does with it, each chapter a few seconds
// with its name under the title:
//
//   1. sections      - a plane sweeps in from the front, the cut glows
//   2. annotations   - pins with labels, and a height measurement
//   3. shading       - wipes through textures, PBR (glossy), raking light
//   4. sun study     - the sun's real path over Wołpa on midsummer day, the
//                      sun itself and its track in the sky, a compass on the
//                      ground, shadows; the camera holds still meanwhile
//   5. seasons       - spring petals, summer, autumn leaves, winter snow
//   6. cameras       - the scene's cameras as the viewer draws them
//                      (pyramids, as Blender does); one is chosen and its
//                      view opens in a frame beside the model
//   7. live          - cooperation mode: a phone with a second session of
//                      the scene; a finger turns the model on the phone and
//                      the screen follows, live
//   8. time travel   - the 4D model's stages, 1730 to 1936: back to the
//                      building's raw new timber, then year by year its
//                      ageing and repairs, a warm front sweeping up the walls
//                      at each stage, the year on a timeline of dates
//                      (textures from scripts/build-intro-time.mjs)
//   9. surroundings  - the camera rises and draws back: the viewer's
//                      generated surroundings grow round the model from
//                      1730 to 1936 (intro-surroundings.js), houses rising
//                      year by year, the town rebuilt with its railway in
//                      the industrial age; the building's own stage follows
//                      the year, a timeline shows the periods' dates
//
// Like the rest of the intro, update(tour) is a function of the tour's time
// only (it runs backwards for "Assemble again", ?at= holds it).
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  SRGBColorSpace,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  Vector3,
} from 'three';
import { HORIZON, RAD, formatSunTime, solarPosition, sunTimestamp, sunriseSunset } from '../sun-position.js';
import { createIntroSurroundings } from './intro-surroundings.js';

// Seconds into the tour.
const ALL_CHAPTERS = [
  { key: 'section', from: 0, to: 3.0 },
  { key: 'annotations', from: 3.0, to: 6.4 },
  { key: 'shading', from: 6.4, to: 10.0 },
  { key: 'sun', from: 10.0, to: 14.8 },
  { key: 'seasons', from: 14.8, to: 24.0 },
  { key: 'cameras', from: 24.0, to: 27.8 },
  { key: 'live', from: 27.8, to: 32.6 },
  { key: 'time', from: 32.6, to: 45.3 },
  { key: 'surroundings', from: 45.3, to: 54.3 },
];
const TAIL = 0.6; // after the last chapter, before 'end'

// The chapters for a scene (intro-scene.js): the time travel only with a
// 4D model's stages. { chapters, length } - the length in seconds.
// The surroundings only with the scene's (intro-scene.js `surroundings`).
// A chapter left out leaves no gap: the later ones move up.
export function tourPlan({ time = true, surroundings = true } = {}) {
  const chapters = [];
  let shift = 0;
  for (const chapter of ALL_CHAPTERS) {
    if ((chapter.key === 'time' && !time) || (chapter.key === 'surroundings' && !surroundings)) {
      shift += chapter.to - chapter.from;
      continue;
    }
    chapters.push(shift ? { ...chapter, from: chapter.from - shift, to: chapter.to - shift } : chapter);
  }
  return { chapters, length: chapters.at(-1).to + TAIL };
}
export const { chapters: CHAPTERS, length: TOUR_LENGTH } = tourPlan();

// The camera through the model's act (intro.js), a function of its time
// only - not of how many frames were drawn - so every run looks the same:
//   - it turns on from the landing and comes to the front for the sections
//     (the plane sweeps in from +Z), holding still while it cuts;
//   - it turns slowly on through the annotations and the shading, and holds
//     still again for the sun study (its shadows turn with the sun only);
//   - in cooperation mode it follows the phone's finger: a turn one way, a
//     pause, a shorter turn back (LIVE_SWIPES);
//   - for the time travel it starts at the front's right (seen from the
//     front, +X) and goes round in an arc towards the entrance in the middle
//     of the front, a little closer; then it turns on as before.
// Angles are Spherical.theta around the model (0: from +Z, +X at pi / 2).
const SECTION_THETA = 0;
const TIME_FROM_THETA = 0.95;
const TIME_TO_THETA = 0.08;
// The time travel's distance, of the camera's own.
const TIME_DOLLY = 0.84;
// The surroundings: how far out the camera draws back (of its own
// distance), how long it takes, and how far it turns meanwhile.
const SURROUNDINGS_DOLLY = 4.4;
const SURROUNDINGS_MOVE = 1.8;
const SURROUNDINGS_TURN = 0.5;
// Their chapter, seconds into it: rising out of the ground, the years
// running, then sinking back. The periods' changes go slower.
const SURROUNDINGS_IN = 1.0;
const SURROUNDINGS_RUN = 6.4;
const SURROUNDINGS_OUT = 0.9;
const SURROUNDINGS_SWAP = 1.3;
// The sun study's angle, and cooperation mode's before the finger turns it.
const SUN_THETA = 0.3;
const LIVE_THETA = 0.75;
// Cooperation mode: the finger's swipes on the phone, seconds into the
// chapter, and how far each turns the model (radians).
const LIVE_SWIPES = [
  { from: 0.7, to: 1.9, turn: 0.7 },
  { from: 2.3, to: 3.3, turn: -0.4 },
];

/**
 * @param {object} options
 *   plan       tourPlan()
 *   front      the angle at the landing (the scene's front)
 *   rate       radians a second it turns at the landing (and between holds)
 *   tourStart  seconds from the model's act to the tour's first chapter
 * @returns {(s: number) => { theta: number, dolly: number, tilt: number }}
 *   at s seconds into the model's act: the angle, the distance as a share of
 *   the camera's own, and how far it looks down from above (0-1, the
 *   surroundings' overview).
 */
export function tourCameraPath({ plan = tourPlan(), front = 0, rate, tourStart }) {
  const chapter = (key) => plan.chapters.find((c) => c.key === key);
  const nearest = (angle, to) => angle + Math.round((to - angle) / (2 * Math.PI)) * 2 * Math.PI;
  // [s, theta, slope]: a smooth (Hermite) curve through them.
  const keys = [[0, front, -rate]];
  const section = chapter('section');
  const sun = chapter('sun');
  const time = chapter('time');
  const live = chapter('live');
  const surroundings = chapter('surroundings');
  const last = plan.chapters.at(-1);
  const base = nearest(SECTION_THETA, front - rate * tourStart);
  if (section) {
    keys.push([tourStart + section.from - 0.3, base, 0], [tourStart + section.to - 0.2, base, 0]);
  }
  const moving = keys.at(-1)[0];
  // The sun study's angle: part of the way to the time travel's start.
  if (sun) {
    const sunFrom = tourStart + sun.from - 0.3;
    const sunTo = tourStart + sun.from + SUN_LENGTH;
    const end = time ? tourStart + time.from : tourStart + last.to;
    const share = (sunFrom - moving) / Math.max(1e-3, sunFrom - moving + end - sunTo);
    const sunTheta = base + (live ? SUN_THETA : (time ? TIME_FROM_THETA : 0.6) * share);
    keys.push([sunFrom, sunTheta, 0], [sunTo, sunTheta, 0]);
  }
  // Cooperation mode: still, then turned by the phone's finger.
  if (live) {
    let theta = base + LIVE_THETA;
    keys.push([tourStart + live.from + LIVE_SWIPES[0].from, theta, 0]);
    for (const swipe of LIVE_SWIPES) {
      theta += swipe.turn;
      keys.push([tourStart + live.from + swipe.to, theta, 0]);
    }
  }
  if (time) {
    keys.push([tourStart + time.from, base + TIME_FROM_THETA, 0], [tourStart + time.to, base + TIME_TO_THETA, -rate]);
  }
  if (surroundings) {
    // Turning on slowly while it draws back over the settlement.
    keys.push([tourStart + surroundings.to, keys.at(-1)[1] - SURROUNDINGS_TURN, -rate]);
  } else if (!time) {
    keys.push([tourStart + last.to, keys.at(-1)[1] + 0.6, rate]);
  }
  const timeDolly = (s) => (time ? 1 - (1 - TIME_DOLLY) * window01(s - tourStart, time.from, time.to + 1.5, 1.5) : 1);
  // The surroundings: up and back, and down again at the end.
  const overview = (s) => (surroundings ? window01(s - tourStart, surroundings.from + 0.1, surroundings.to - 0.2, SURROUNDINGS_MOVE) : 0);
  const dollyAt = (s) => {
    const o = overview(s);
    return timeDolly(s) * (1 - o) + SURROUNDINGS_DOLLY * o;
  };
  return (s) => {
    let theta;
    if (s <= keys[0][0]) theta = keys[0][1] + keys[0][2] * (s - keys[0][0]);
    else if (s >= keys.at(-1)[0]) theta = keys.at(-1)[1] + keys.at(-1)[2] * (s - keys.at(-1)[0]);
    else {
      let i = 0;
      while (s > keys[i + 1][0]) i++;
      const [s0, p0, m0] = keys[i];
      const [s1, p1, m1] = keys[i + 1];
      const h = s1 - s0;
      const u = (s - s0) / h;
      const u2 = u * u;
      const u3 = u2 * u;
      theta = (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * h * m1;
    }
    return { theta, dolly: dollyAt(s), tilt: overview(s) };
  };
}

// Shading: [from, to] modes, each step a wipe (see mesh-reveal.js introShade).
const SHADING_STEPS = [[0, 1], [1, 2], [2, 0]];
const SHADING_KEYS = ['textures', 'pbr', 'raking'];
const SHADING_LENGTH = 3.6;
// Seasons: each this long, then back to the textures' own colours.
const SEASON_LENGTH = 2.2;
const SEASONS_END = 4 * SEASON_LENGTH;

// The sun study: Wołpa (Voŭpa, Belarus), midsummer day, local time (UTC+3).
// The model's north is taken to be -Z (the viewer's default, AIM3DViewer
// location.north = 0): the model's files do not say where north is.
const DEFAULT_SITE = { latitude: 53.37, longitude: 24.37, utcOffset: 3, north: 0, month: 6, day: 21 };
const SUN_LENGTH = 4.8;
// The sun's track around the building's middle, this far out (intro units).
const SUN_RADIUS = 2.5;
// The compass ring on the ground.
const COMPASS_RADIUS = 2.15;
const SEASON_KEYS = ['spring', 'summer', 'autumn', 'winter'];

// Time travel: the 4D model's stages (viewer/intro/time/time.json).
const DEFAULT_TIME_URL = 'assets/intro/time/';
// Back from today to the first stage, then each stage in turn: the first
// steps slow, each next one quicker, as on a shrinking time scale; most of
// each step is the change itself.
const TIME_REWIND = 1.4;
const TIME_FIRST_STEP = 1.6;
const TIME_STEP_RATIO = 0.86;
const TIME_SWEEP = 0.75;
// When step i (stage i - 1 to stage i, i >= 1) starts, seconds after the rewind.
const timeStepStart = (i) => TIME_FIRST_STEP * (1 - TIME_STEP_RATIO ** (i - 1)) / (1 - TIME_STEP_RATIO);
const timeStepLength = (i) => TIME_FIRST_STEP * TIME_STEP_RATIO ** (i - 1);

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const window01 = (x, a, b, fade) => smooth((x - a) / fade) * (1 - smooth((x - b + fade) / fade));

/**
 * @param {object} options
 *   reveal      the model (mesh-reveal.js)
 *   camera, renderer
 *   root        the page's #intro element (labels and the chapter title go in)
 *   texts       the page's texts: texts.tour.*
 *   toIntro     (x, y, z) in the model's units -> Vector3 in the intro's space
 *   heightLabel the measured height, formatted
 *   footprint   the model's footprint, its half-diagonal in metres
 */
export function createFeatureTour({ reveal, camera, renderer, root, texts, toIntro, heightLabel, lang, scene = {}, plan = tourPlan(), footprint = 20 }) {
  const u = reveal.uniforms;
  const group = new Group();
  const CHAPTERS = plan.chapters;
  const TOUR_LENGTH = plan.length;
  const START = Object.fromEntries(CHAPTERS.map((chapter) => [chapter.key, chapter.from]));
  // A fixed year: the same sun on every run (stills, recordings).
  const SITE = { ...(scene.site || DEFAULT_SITE), year: 2026 };
  const TIME_URL = scene.time === undefined ? DEFAULT_TIME_URL : scene.time;
  const ground = scene.ground ?? 0;

  // --- Time travel: the stages and their textures, loaded in the background --
  let timeTravel = null; // { stages, parts: { part: { materials, fresh, mid } } }
  (async () => {
    if (!TIME_URL) return;
    const response = await fetch(`${TIME_URL}time.json`);
    if (!response.ok) throw new Error(`${TIME_URL}time.json: HTTP ${response.status}`);
    const data = await response.json();
    const loader = new TextureLoader();
    const parts = {};
    for (const [part, materialName] of Object.entries(data.parts)) {
      const materials = (reveal.timeTargets[materialName] || []).filter((m) => m.userData.originalMap);
      if (!materials.length) continue;
      const original = materials[0].userData.originalMap;
      const load = async (variant) => {
        const texture = await loader.loadAsync(`${TIME_URL}${part}_${variant}.webp`);
        texture.flipY = false; // glTF's convention, as the model's own
        texture.colorSpace = SRGBColorSpace;
        texture.wrapS = original.wrapS;
        texture.wrapT = original.wrapT;
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        return texture;
      };
      const [fresh, mid] = await Promise.all([load('fresh'), load('mid')]);
      parts[part] = { materials, fresh, mid };
    }
    timeTravel = { stages: data.stages, parts };
  })().catch((error) => console.warn('[intro] time travel:', error));

  // A stage's texture for a part ("old": the model's own).
  const textureFor = (part, variant) => (variant === 'fresh' ? part.fresh : variant === 'mid' ? part.mid : null);
  // Today (the model as it is): every part old.
  const TODAY = { year: null, parts: {} };
  function setTime(from, to, front, glow) {
    for (const [name, part] of Object.entries(timeTravel.parts)) {
      const a = from.parts[name] || 'old';
      const b = to.parts[name] || 'old';
      for (const material of part.materials) {
        material.map = textureFor(part, a) || material.userData.originalMap;
        material.userData.time.uMapNext.value = textureFor(part, b) || material.userData.originalMap;
        material.userData.time.uTimeChange.value = a === b ? 0 : 1;
      }
    }
    u.uTimeActive.value = 1;
    u.uTimeFront.value = front;
    u.uTimeGlow.value = glow;
  }
  function resetTime() {
    if (u.uTimeActive.value === 0 || !timeTravel) return;
    for (const part of Object.values(timeTravel.parts)) {
      for (const material of part.materials) {
        material.map = material.userData.originalMap;
        material.userData.time.uTimeChange.value = 0;
      }
    }
    u.uTimeActive.value = 0;
    u.uTimeGlow.value = 0;
  }
  const tx = texts.tour;

  // --- Section plane ----------------------------------------------------------
  const planeMaterial = new ShaderMaterial({
    uniforms: { uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      varying vec2 vUv;
      void main() {
        vec2 g = abs(fract(vUv * vec2(14.0, 10.0)) - 0.5);
        float grid = 1.0 - smoothstep(0.0, 0.03, min(g.x, g.y));
        float edge = 1.0 - smoothstep(0.0, 0.01, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
        vec3 color = vec3(0.35, 0.65, 1.0) * (0.05 + grid * 0.12 + edge * 0.7);
        gl_FragColor = vec4(color * uAlpha, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
  // Facing +z, the front: the camera looks at it nearly head-on.
  const plane = new Mesh(new PlaneGeometry(3.6, 1.95), planeMaterial);
  plane.renderOrder = 5;
  group.add(plane);

  // --- Annotations ------------------------------------------------------------
  // The scene's pins (model units), one after another.
  const pins = (scene.pins || []).map((pin, index) => ({
    key: pin.key,
    kind: pin.kind,
    at: toIntro(...pin.at),
    lift: pin.lift,
    delay: index * 0.45,
  }));
  const measure = scene.measure;
  const measureBottom = toIntro(measure.x, measure.from, measure.z);
  const measureTop = toIntro(measure.x, measure.to, measure.z);
  const lineMaterial = new LineBasicMaterial({ color: 0x9cc8ff, transparent: true, opacity: 0, depthTest: false });
  const linePositions = [];
  for (const pin of pins) {
    pin.top = pin.at.clone().add(new Vector3(0, pin.lift, 0));
    linePositions.push(...pin.at.toArray(), ...pin.top.toArray());
  }
  const tick = 0.07;
  linePositions.push(
    ...measureBottom.toArray(), ...measureTop.toArray(),
    measureBottom.x - tick, measureBottom.y, measureBottom.z, measureBottom.x + tick, measureBottom.y, measureBottom.z,
    measureTop.x - tick, measureTop.y, measureTop.z, measureTop.x + tick, measureTop.y, measureTop.z,
  );
  const lineGeometry = new BufferGeometry();
  lineGeometry.setAttribute('position', new BufferAttribute(new Float32Array(linePositions), 3));
  const lines = new LineSegments(lineGeometry, lineMaterial);
  lines.renderOrder = 6;
  group.add(lines);
  // The pins' heads: soft dots, drawn over everything.
  const dotGeometry = new BufferGeometry();
  dotGeometry.setAttribute('position', new BufferAttribute(new Float32Array(pins.flatMap((pin) => pin.at.toArray())), 3));
  const dotUniforms = { uAlpha: { value: 0 }, uViewport: { value: 800 }, uTime: { value: 0 } };
  const dots = new Points(dotGeometry, new ShaderMaterial({
    uniforms: dotUniforms,
    vertexShader: /* glsl */ `
      uniform float uViewport;
      uniform float uTime;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.07 + 0.015 * sin(uTime * 4.0)) * uViewport / -mv.z;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r = dot(uv, uv);
        float ring = exp(-pow((sqrt(r) - 0.75) / 0.12, 2.0));
        float core = exp(-r * 18.0);
        gl_FragColor = vec4(vec3(1.0, 0.82, 0.5) * (core + ring * 0.8) * uAlpha, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  }));
  dots.frustumCulled = false;
  dots.renderOrder = 7;
  group.add(dots);
  // Labels: HTML, placed at the leaders' tops every frame.
  const makeLabel = (text, extra) => {
    const el = document.createElement('div');
    el.className = `intro-label ${extra || ''}`;
    el.textContent = text;
    root.appendChild(el);
    return el;
  };
  for (const pin of pins) pin.label = makeLabel(tx.labels?.[pin.key] ?? '', pin.kind === 'poi' ? 'is-poi' : 'is-annotation');
  const measureLabel = makeLabel(heightLabel, 'is-measure');

  // --- Chapter title ----------------------------------------------------------
  const chapter = document.createElement('div');
  chapter.className = 'intro-chapter';
  chapter.innerHTML = '<span class="intro-chapter-index"></span><span class="intro-chapter-title"></span><span class="intro-chapter-sub"></span>';
  root.appendChild(chapter);
  const chapterIndex = chapter.children[0];
  const chapterTitle = chapter.children[1];
  const chapterSub = chapter.children[2];

  // --- Weather: petals, pollen, leaves, snow ------------------------------------
  const FLAKES = 2600;
  const flakePositions = new Float32Array(FLAKES * 3);
  const flakeSeeds = new Float32Array(FLAKES * 4);
  for (let i = 0; i < FLAKES; i++) {
    flakePositions[i * 3] = (Math.random() - 0.5) * 4.6;
    flakePositions[i * 3 + 1] = Math.random() * 3.2;
    flakePositions[i * 3 + 2] = (Math.random() - 0.5) * 4.6;
    for (let k = 0; k < 4; k++) flakeSeeds[i * 4 + k] = Math.random();
  }
  const flakeGeometry = new BufferGeometry();
  flakeGeometry.setAttribute('position', new BufferAttribute(flakePositions, 3));
  flakeGeometry.setAttribute('aSeed', new BufferAttribute(flakeSeeds, 4));
  const flakeUniforms = {
    uTime: { value: 0 },
    uAlpha: { value: 0 },
    uViewport: { value: 800 },
    uSpeed: { value: 0.3 },
    uSway: { value: 0.2 },
    uSize: { value: 0.03 },
    uColorA: { value: new Color() },
    uColorB: { value: new Color() },
    uFlat: { value: 0 },
    uBottom: { value: toIntro(0, ground, 0).y },
  };
  const flakes = new Points(flakeGeometry, new ShaderMaterial({
    uniforms: flakeUniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uViewport;
      uniform float uSpeed;
      uniform float uSway;
      uniform float uSize;
      uniform float uBottom;
      attribute vec4 aSeed;
      varying vec4 vSeed;
      void main() {
        vec3 p = position;
        float fall = uTime * uSpeed * (0.7 + aSeed.x * 0.6);
        p.y = uBottom + mod(p.y - fall, 3.2);
        p.x += sin(uTime * (0.8 + aSeed.y) + aSeed.z * 20.0) * uSway;
        p.z += cos(uTime * (0.7 + aSeed.z) + aSeed.y * 20.0) * uSway;
        vSeed = aSeed;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.0, uSize * (0.6 + aSeed.w * 0.8) * uViewport / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      uniform float uTime;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uFlat;
      varying vec4 vSeed;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        // Leaves and petals: a turning ellipse; snow and pollen: round.
        float a = uTime * (1.0 + vSeed.x * 2.0) + vSeed.y * 6.28;
        vec2 r = mat2(cos(a), -sin(a), sin(a), cos(a)) * uv;
        r.y *= mix(1.0, 2.2, uFlat);
        float d = dot(r, r);
        if (d > 1.0) discard;
        float shape = mix(exp(-d * 2.5), 1.0 - smoothstep(0.7, 1.0, d), uFlat);
        vec3 color = mix(uColorA, uColorB, vSeed.z);
        gl_FragColor = vec4(color, shape * uAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
  }));
  flakes.frustumCulled = false;
  flakes.renderOrder = 4;
  group.add(flakes);

  const SEASONS = {
    spring: { grade: [1.0, 1.05, 0.98], speed: 0.16, sway: 0.25, size: 0.035, a: 0xffc6d9, b: 0xfff0f4, flat: 1, alpha: 0.85 },
    summer: { grade: [1.08, 1.03, 0.92], speed: 0.04, sway: 0.15, size: 0.02, a: 0xffe9a8, b: 0xfff6d6, flat: 0, alpha: 0.5 },
    autumn: { grade: [1.08, 0.94, 0.8], speed: 0.3, sway: 0.3, size: 0.045, a: 0xd9662b, b: 0xf0b13c, flat: 1, alpha: 0.95 },
    winter: { grade: [0.9, 0.96, 1.1], speed: 0.22, sway: 0.12, size: 0.03, a: 0xffffff, b: 0xe6f0ff, flat: 0, alpha: 0.9 },
  };

  // --- Sun -------------------------------------------------------------------
  const sun = reveal.sun;
  const hemisphere = reveal.hemisphere;
  const defaultSun = { position: sun.position.clone(), color: sun.color.clone(), intensity: sun.intensity };
  const defaultHemisphere = hemisphere.intensity;
  const horizonColor = new Color(0xffa25e);
  const noonColor = new Color(0xfff4e2);
  const groundY = toIntro(0, ground, 0).y;
  const sunCentre = new Vector3(0, groundY, 0);
  const { sunrise, sunset } = sunriseSunset({ ...SITE });
  const dayStart = (sunrise ?? 240) - 25;
  const dayEnd = (sunset ?? 1320) + 25;
  const solarAt = (minutes) => solarPosition(sunTimestamp({ ...SITE, minutes }), SITE.latitude, SITE.longitude);
  // Towards the sun, in the scene (north = -Z turned by SITE.north).
  const toward = ({ elevation, azimuth }, target = new Vector3()) => {
    const bearing = (azimuth + SITE.north) * RAD;
    const height = elevation * RAD;
    return target.set(Math.cos(height) * Math.sin(bearing), Math.sin(height), -Math.cos(height) * Math.cos(bearing));
  };
  // The minute of solar noon (highest), for the sound's cue.
  let noonMinute = dayStart;
  for (let m = dayStart, best = -90; m <= dayEnd; m += 5) {
    const e = solarAt(m).elevation;
    if (e > best) { best = e; noonMinute = m; }
  }

  // The day's track: a dot every 5 minutes, larger on the hour.
  const trackPositions = [];
  const trackMinutes = [];
  const direction = new Vector3();
  for (let m = dayStart; m <= dayEnd; m += 5) {
    toward(solarAt(m), direction);
    trackPositions.push(...direction.clone().multiplyScalar(SUN_RADIUS).add(sunCentre).toArray());
    trackMinutes.push(m);
  }
  const trackGeometry = new BufferGeometry();
  trackGeometry.setAttribute('position', new BufferAttribute(new Float32Array(trackPositions), 3));
  trackGeometry.setAttribute('aMinute', new BufferAttribute(new Float32Array(trackMinutes), 1));
  const trackUniforms = { uAlpha: { value: 0 }, uNow: { value: 0 }, uViewport: { value: 800 } };
  const track = new Points(trackGeometry, new ShaderMaterial({
    uniforms: trackUniforms,
    vertexShader: /* glsl */ `
      uniform float uViewport;
      uniform float uNow;
      attribute float aMinute;
      varying float vPast;
      varying float vHour;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vHour = step(mod(aMinute + 0.5, 60.0), 5.0);
        vPast = step(aMinute, uNow);
        gl_PointSize = max(1.0, (0.018 + vHour * 0.022) * uViewport / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      varying float vPast;
      varying float vHour;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float d = dot(uv, uv);
        if (d > 1.0) discard;
        vec3 color = mix(vec3(0.55, 0.65, 0.85) * 0.5, vec3(1.0, 0.8, 0.45), vPast);
        gl_FragColor = vec4(color * exp(-d * 2.0) * uAlpha * (0.6 + vHour * 0.6), 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }));
  track.frustumCulled = false;
  track.renderOrder = 6;
  group.add(track);

  // The sun itself: a warm disc with a soft halo, always facing the camera.
  const discUniforms = { uAlpha: { value: 0 }, uWarm: { value: 0 } };
  const disc = new Mesh(new PlaneGeometry(1, 1), new ShaderMaterial({
    uniforms: discUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      uniform float uWarm;
      varying vec2 vUv;
      void main() {
        float d = length(vUv);
        float body = 1.0 - smoothstep(0.16, 0.2, d);
        float halo = exp(-d * d * 9.0) * 0.55;
        vec3 color = mix(vec3(1.0, 0.97, 0.88), vec3(1.0, 0.62, 0.3), uWarm);
        gl_FragColor = vec4(color * (body * 1.4 + halo) * uAlpha, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }));
  disc.renderOrder = 7;
  group.add(disc);

  // The compass: a ring on the ground, ticks every 30°, longer at N, E, S, W.
  const compassPositions = [];
  for (let i = 0; i < 96; i++) {
    const a0 = (i / 96) * Math.PI * 2;
    const a1 = ((i + 1) / 96) * Math.PI * 2;
    compassPositions.push(Math.cos(a0) * COMPASS_RADIUS, groundY + 0.004, Math.sin(a0) * COMPASS_RADIUS);
    compassPositions.push(Math.cos(a1) * COMPASS_RADIUS, groundY + 0.004, Math.sin(a1) * COMPASS_RADIUS);
  }
  for (let deg = 0; deg < 360; deg += 30) {
    toward({ elevation: 0, azimuth: deg }, direction);
    const inner = COMPASS_RADIUS - (deg % 90 === 0 ? 0.16 : 0.07);
    compassPositions.push(direction.x * inner, groundY + 0.004, direction.z * inner);
    compassPositions.push(direction.x * COMPASS_RADIUS, groundY + 0.004, direction.z * COMPASS_RADIUS);
  }
  const compassGeometry = new BufferGeometry();
  compassGeometry.setAttribute('position', new BufferAttribute(new Float32Array(compassPositions), 3));
  const compassMaterial = new LineBasicMaterial({ color: 0xb8d4ff, transparent: true, opacity: 0, depthWrite: false });
  const compass = new LineSegments(compassGeometry, compassMaterial);
  compass.renderOrder = 6;
  group.add(compass);
  const cardinals = ['N', 'E', 'S', 'W'].map((letter, index) => {
    toward({ elevation: 0, azimuth: index * 90 }, direction);
    const at = new Vector3(direction.x * (COMPASS_RADIUS + 0.2), groundY + 0.01, direction.z * (COMPASS_RADIUS + 0.2));
    return { at, label: makeLabel(tx.compass[letter], 'is-compass') };
  });

  // --- Scene cameras ----------------------------------------------------------
  // Drawn as the viewer draws them (editor/camera-markers.js, as Blender
  // does): a pyramid from where the camera stands to the frame it sees, a
  // filled triangle over the frame's top edge for up, and a dashed line to
  // where it looks. They keep their size on screen and show through the
  // model; the chosen one turns gold and its view opens in a frame.
  const CAMERA_GOLD = new Color(0xf5a524);
  const CAMERA_WHITE = new Color(0xffffff);
  const groundLevel = toIntro(0, ground, 0).y;
  // Around the front (+Z, theta 0): its left, low before the entrance (the
  // chosen one), and high over the right, looking down.
  const cameraSpots = [
    { theta: -0.62, radius: 2.45, height: 0.75, look: 0.45 },
    { theta: 0.12, radius: 3.05, height: 0.5, look: 0.42, chosen: true },
    { theta: 1.45, radius: 2.3, height: 2.1, look: 0.2 },
  ];
  const frustumLines = (() => {
    const w = 0.5;
    const h = 0.32;
    const corners = [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => new Vector3(x, y, 1));
    const points = [];
    corners.forEach((corner, index) => points.push(0, 0, 0, ...corner.toArray(), ...corner.toArray(), ...corners[(index + 1) % 4].toArray()));
    return { points, w, h };
  })();
  const sceneCameras = cameraSpots.map((spot, index) => {
    const position = new Vector3(Math.sin(spot.theta) * spot.radius, groundLevel + spot.height, Math.cos(spot.theta) * spot.radius);
    const target = new Vector3(0, groundLevel + spot.look, 0);
    const marker = new Group();
    marker.position.copy(position);
    marker.lookAt(target);
    // Object3D.lookAt turns +Z towards the target for anything but a camera.
    const lineMaterial = new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const frustumGeometry = new BufferGeometry();
    frustumGeometry.setAttribute('position', new BufferAttribute(new Float32Array(frustumLines.points), 3));
    const frustum = new LineSegments(frustumGeometry, lineMaterial);
    const { w, h } = frustumLines;
    const triangleGeometry = new BufferGeometry();
    triangleGeometry.setAttribute('position', new BufferAttribute(new Float32Array([
      -w * 0.6, h * 1.12, 1, w * 0.6, h * 1.12, 1, 0, h * 1.12 + w * 0.5, 1,
    ]), 3));
    const fillMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: DoubleSide });
    const triangle = new Mesh(triangleGeometry, fillMaterial);
    const glyph = new Group();
    glyph.add(frustum, triangle);
    marker.add(glyph);
    // The dashed line to where it looks, in the scene's own units.
    const dashGeometry = new BufferGeometry().setFromPoints([position, target]);
    const dashMaterial = new LineDashedMaterial({ color: 0xffffff, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const dash = new LineSegments(dashGeometry, dashMaterial);
    dash.computeLineDistances();
    for (const object of [frustum, triangle, dash]) object.renderOrder = 8;
    group.add(marker, dash);
    // What it sees: the pyramid's own frame (vertical field of view).
    const view = new PerspectiveCamera(2 * Math.atan(frustumLines.h) / RAD, frustumLines.w / frustumLines.h, 0.01, 100);
    return { ...spot, index, position, target, marker, glyph, frustum, triangle, dash, lineMaterial, fillMaterial, dashMaterial, view, delay: 0.25 + index * 0.3 };
  });
  const chosenCamera = sceneCameras.find((c) => c.chosen);
  for (const camera_ of sceneCameras) {
    camera_.label = makeLabel(tx.cameras?.names?.[camera_.index] ?? '', 'is-camera');
  }
  // The chosen camera's view: a frame beside the model, the scene drawn
  // into it (intro.js draws the views() list after the main picture).
  const inset = document.createElement('div');
  inset.className = 'intro-inset';
  inset.innerHTML = '<span class="intro-inset-name"></span>';
  inset.firstChild.textContent = tx.cameras?.view ?? '';
  root.appendChild(inset);

  // --- Cooperation mode: a phone with a second session ------------------------
  // The phone is HTML (its body and its screen's overlay); the scene is drawn
  // into its screen from the main camera's place - the same view, live. A
  // finger swipes on it and the big picture turns with it.
  const phone = document.createElement('div');
  phone.className = 'intro-phone';
  phone.innerHTML = '<div class="intro-phone-screen"><span class="intro-phone-live"></span><span class="intro-phone-finger"></span></div><span class="intro-phone-signal" aria-hidden="true"><i></i><i></i><i></i></span><span class="intro-phone-name"></span>';
  root.appendChild(phone);
  const phoneScreen = phone.querySelector('.intro-phone-screen');
  const phoneFinger = phone.querySelector('.intro-phone-finger');
  phone.querySelector('.intro-phone-live').textContent = tx.live?.badge ?? 'LIVE';
  phone.querySelector('.intro-phone-name').textContent = tx.live?.phone ?? '';
  const phoneCamera = new PerspectiveCamera(camera.fov, 0.5, camera.near, camera.far);
  // The screen's own badge: two devices, one scene.
  const liveBadge = document.createElement('div');
  liveBadge.className = 'intro-live-badge';
  liveBadge.innerHTML = '<span class="intro-live-dot"></span><span></span>';
  liveBadge.lastChild.textContent = tx.live?.screen ?? '';
  root.appendChild(liveBadge);

  // --- Timelines: dates, a year running along them ----------------------------
  // One for the time travel's stages, one for the surroundings' periods.
  // Dates under the ticks; those too close to a shown one are left out,
  // the first and the last always.
  function createTimeline(extraClass = '') {
    const element = document.createElement('div');
    element.className = `intro-timeline ${extraClass}`;
    element.innerHTML = '<div class="intro-timeline-track"><span class="intro-timeline-fill"></span><span class="intro-timeline-marker"><span class="intro-timeline-year"></span></span></div><p class="intro-timeline-note"></p>';
    root.appendChild(element);
    const track = element.firstChild;
    const fill = element.querySelector('.intro-timeline-fill');
    const marker = element.querySelector('.intro-timeline-marker');
    const yearLabel = element.querySelector('.intro-timeline-year');
    const note = element.querySelector('.intro-timeline-note');
    let span = null;
    let ticks = [];
    return {
      element,
      get built() { return Boolean(span); },
      build(years, noteText = '') {
        const first = years[0];
        const last = years.at(-1);
        span = [first, last];
        note.textContent = noteText;
        element.classList.toggle('has-note', Boolean(noteText));
        let lastShown = -Infinity;
        ticks = years.map((year, index) => {
          const share = (year - first) / Math.max(1, last - first);
          const tick = document.createElement('span');
          tick.className = 'intro-timeline-tick';
          tick.style.left = `${(share * 100).toFixed(2)}%`;
          const isEnd = index === 0 || index === years.length - 1;
          const nextShare = index < years.length - 1 ? (years[index + 1] - first) / Math.max(1, last - first) : 2;
          const roomy = share - lastShown >= 0.11 && (nextShare - share >= 0.04 || index === years.length - 1 || years[index + 1] - year > 1);
          if (isEnd || (roomy && 1 - share >= 0.12)) {
            const date = document.createElement('span');
            date.className = 'intro-timeline-date';
            date.textContent = year;
            tick.append(date);
            lastShown = share;
          }
          track.insertBefore(tick, fill);
          return { tick, year };
        });
      },
      show(year, visible) {
        element.style.opacity = visible.toFixed(3);
        if (!span || visible <= 0) return;
        const [first, last] = span;
        const share = clamp01((year - first) / Math.max(1, last - first));
        fill.style.transform = `scaleX(${share.toFixed(4)})`;
        marker.style.left = `${(share * 100).toFixed(2)}%`;
        yearLabel.textContent = String(Math.round(year));
        for (const { tick, year: at } of ticks) tick.classList.toggle('is-past', at <= Math.round(year));
      },
      hide() { element.style.opacity = 0; },
    };
  }
  const timeline = createTimeline();

  // --- Surroundings through time (intro-surroundings.js) ----------------------
  // In metres round the model's middle, y from its ground -> the intro's
  // space (toIntro is linear: its middle is where it maps x and z to 0).
  const unit = scene.unitInMeters || 1;
  const o = toIntro(0, 0, 0);
  const ex = toIntro(1, 0, 0).x - o.x;
  const ez = toIntro(0, 0, 1).z - o.z;
  const middle = [-o.x / ex, -o.z / ez];
  const metresToIntro = (x, y, z) => toIntro(middle[0] + x / unit, ground + y / unit, middle[1] + z / unit).toArray();
  let surroundings = null;
  const surroundingsTimeline = createTimeline('is-surroundings');
  const SURROUNDINGS = CHAPTERS.find((c) => c.key === 'surroundings');
  if (SURROUNDINGS && scene.surroundings) {
    const { years, ...params } = scene.surroundings;
    try {
      surroundings = createIntroSurroundings({ params, from: years[0], to: years[1], radius: footprint, toIntro: metresToIntro });
      group.add(surroundings.group);
      surroundingsTimeline.build(surroundings.dates, tx.surroundings?.generated ?? '');
    } catch (error) {
      console.warn('[intro] surroundings:', error);
    }
  }
  // The year at s seconds into the chapter: the periods' changes slower.
  const surroundingsYear = (() => {
    if (!surroundings) return () => 0;
    const [from, to] = [surroundings.spans[0].from, surroundings.spans.at(-1).to];
    const changes = surroundings.spans.slice(1).map((span) => span.from);
    const swap = Math.min(SURROUNDINGS_SWAP, SURROUNDINGS_RUN / (2 * Math.max(1, changes.length)));
    const yearsLeft = Math.max(1, to - from - changes.length * 14);
    const perYear = (SURROUNDINGS_RUN - changes.length * swap) / yearsLeft;
    // Keys [seconds, year]: a change's 14 years (7 each side) take `swap`.
    const keys = [[0, from]];
    let t = 0;
    let at = from;
    for (const change of changes) {
      t += Math.max(0, change - 7 - at) * perYear;
      keys.push([t, change - 7]);
      t += swap;
      keys.push([t, change + 7]);
      at = change + 7;
    }
    keys.push([SURROUNDINGS_RUN, to]);
    return (s) => {
      const local = s - SURROUNDINGS_IN;
      if (local <= 0) return from;
      if (local >= SURROUNDINGS_RUN) return to;
      let i = 0;
      while (i < keys.length - 2 && local > keys[i + 1][0]) i++;
      const [t0, y0] = keys[i];
      const [t1, y1] = keys[i + 1];
      const u = clamp01((local - t0) / Math.max(1e-3, t1 - t0));
      // Eased within a change, even between them.
      const eased = y1 - y0 <= 14 ? smooth(u) : u;
      return y0 + (y1 - y0) * eased;
    };
  })();

  const project = new Vector3();
  function place(el, point, visible, offsetY = 0, centred = false) {
    project.copy(point).project(camera);
    const behind = project.z > 1;
    const x = (project.x * 0.5 + 0.5) * root.clientWidth;
    const y = (-project.y * 0.5 + 0.5) * root.clientHeight;
    el.style.transform = `translate(${x.toFixed(1)}px, ${(y + offsetY).toFixed(1)}px) translate(-50%, ${centred ? '-50%' : '-100%'})`;
    el.style.opacity = behind ? 0 : visible.toFixed(3);
  }

  let lastCue = '';
  // A stage's caption: the 4D model's own label (Polish), or the year with
  // the page's translation of it.
  function timeLabel(stage) {
    if (lang === 'pl') return stage.label;
    const note = tx.timeNotes?.[stage.year];
    return note ? `${stage.year} – ${note}` : String(stage.year);
  }
  const size = new Vector2();

  function hideAll() {
    for (const pin of pins) pin.label.style.opacity = 0;
    measureLabel.style.opacity = 0;
    chapter.classList.remove('is-on');
  }

  // The extra views drawn after the main picture (intro.js): the chosen
  // camera's, the phone's. Rectangles in CSS pixels from the top left.
  let views = [];
  const rectOf = (el) => {
    const box = el.getBoundingClientRect();
    const page = root.getBoundingClientRect();
    return { x: box.left - page.left, y: box.top - page.top, width: box.width, height: box.height };
  };

  return {
    group,
    /** The extra views to draw after the main picture: [{ camera, rect, hide }]. */
    views() {
      return views;
    },
    setViewport(viewport) {
      dotUniforms.uViewport.value = viewport;
      flakeUniforms.uViewport.value = viewport;
      trackUniforms.uViewport.value = viewport;
      renderer.getDrawingBufferSize(size);
      u.uResolution.value.set(size.x, size.y);
    },
    /**
     * @param {number} tour  seconds into the tour (negative: not yet)
     * @param {number} time  the clock, for things that only move
     * @param {number} exit  0..1 while leaving for the viewer
     * @returns {string} a cue for the sound when something new starts
     *   ('chapter', 'step'), or 'end' once the tour is over
     */
    update(tour, time, exit) {
      const active = tour > 0 && tour < TOUR_LENGTH && exit <= 0;
      group.visible = tour > 0 && exit < 1;
      u.uTourTime.value = time;
      dotUniforms.uTime.value = time;
      flakeUniforms.uTime.value = time;

      // 1. Section: in from the front (the camera's side, so the cut faces
      // it and the inside shows), through, and back out.
      const sectionOn = window01(tour, 0, 3.0, 0.35);
      const sweep = smooth(tour / 1.6) - smooth((tour - 1.9) / 1.0);
      const cut = 1.75 - sweep * 1.95;
      u.uClip.value.set(0, 0, -1, cut);
      u.uClipActive.value = sectionOn;
      plane.position.set(0, 0.3, cut);
      planeMaterial.uniforms.uAlpha.value = sectionOn;
      plane.visible = sectionOn > 0.001;

      // 2. Annotations: pins one after another, then the measurement.
      const annotationsOn = window01(tour, 3.0, 6.4, 0.3);
      lineMaterial.opacity = annotationsOn * 0.85;
      dotUniforms.uAlpha.value = annotationsOn;
      lines.visible = dots.visible = annotationsOn > 0.001;
      pins.forEach((pin) => {
        const shown = annotationsOn * smooth((tour - 3.2 - pin.delay) / 0.3);
        place(pin.label, pin.top, shown);
      });
      const measureShown = annotationsOn * smooth((tour - 4.2) / 0.3);
      place(measureLabel, measureBottom.clone().lerp(measureTop, 0.5), measureShown, 0);

      // 3. Shading: wipe after wipe.
      let modeA = 0;
      let modeB = 0;
      let wipe = 0;
      let shadingKey = 'textures';
      const shadingTime = tour - START.shading;
      if (shadingTime > 0 && shadingTime < SHADING_LENGTH) {
        const stepLength = SHADING_LENGTH / SHADING_STEPS.length;
        const index = Math.min(SHADING_STEPS.length - 1, Math.floor(shadingTime / stepLength));
        const local = (shadingTime - index * stepLength) / stepLength;
        [modeA, modeB] = SHADING_STEPS[index];
        wipe = smooth(local / 0.55);
        shadingKey = SHADING_KEYS[wipe > 0.5 ? modeB : modeA];
      }
      u.uModeA.value = modeA;
      u.uModeB.value = modeB;
      u.uWipe.value = wipe;

      // 4. Sun: midsummer day at Wołpa, from just before sunrise to just
      // after sunset, then night falls.
      const sunTime = (tour - START.sun) / SUN_LENGTH;
      let sunKey = '';
      let sunSub = '';
      const sunOn = sunTime > 0 && sunTime < 1 ? smooth(sunTime / 0.08) * (1 - smooth((sunTime - 0.9) / 0.1)) : 0;
      if (sunTime > 0 && sunTime < 1) {
        const dayPart = clamp01((sunTime - 0.08) / 0.76);
        const minutes = dayStart + (dayEnd - dayStart) * dayPart;
        const position = solarAt(minutes);
        toward(position, direction);
        const daylight = clamp01((position.elevation - HORIZON) / 12);
        const night = smooth((sunTime - 0.86) / 0.08);
        sun.position.copy(direction).multiplyScalar(7);
        sun.color.copy(horizonColor).lerp(noonColor, clamp01(position.elevation / 30));
        sun.intensity = 3.2 * daylight * (1 - night);
        hemisphere.intensity = defaultHemisphere * (0.3 + 0.7 * daylight) * (1 - night * 0.55);
        disc.position.copy(direction).multiplyScalar(SUN_RADIUS).add(sunCentre);
        disc.quaternion.copy(camera.quaternion);
        disc.scale.setScalar(0.5);
        discUniforms.uAlpha.value = sunOn * clamp01((position.elevation + 3) / 4) * (1 - night);
        discUniforms.uWarm.value = 1 - clamp01(position.elevation / 25);
        trackUniforms.uNow.value = minutes;
        sunSub = night > 0.5 ? tx.sun.night : `${tx.sunDate} · ${formatSunTime(minutes)}`;
        sunKey = night > 0.5 ? 'night' : minutes < (sunrise ?? 0) ? 'before' : minutes < noonMinute ? 'morning'
          : minutes < (sunset ?? 1440) ? 'afternoon' : 'after';
      } else {
        sun.position.copy(defaultSun.position);
        sun.color.copy(defaultSun.color);
        sun.intensity = defaultSun.intensity;
        hemisphere.intensity = defaultHemisphere;
        discUniforms.uAlpha.value = 0;
      }
      trackUniforms.uAlpha.value = sunOn;
      compassMaterial.opacity = sunOn * 0.55;
      track.visible = compass.visible = sunOn > 0.001;
      disc.visible = discUniforms.uAlpha.value > 0.001;
      for (const cardinal of cardinals) place(cardinal.label, cardinal.at, sunOn, 0, true);

      // 5. Seasons: a few seconds each; snow settles in winter.
      const seasonTime = tour - START.seasons;
      let seasonKey = '';
      const grade = [1, 1, 1];
      let snow = 0;
      if (seasonTime > 0 && seasonTime < SEASONS_END + 0.4) {
        const index = Math.min(3, Math.floor(seasonTime / SEASON_LENGTH));
        seasonKey = SEASON_KEYS[index];
        const season = SEASONS[seasonKey];
        const local = seasonTime - index * SEASON_LENGTH;
        const blend = smooth(local / 0.3);
        const previous = index > 0 ? SEASONS[SEASON_KEYS[index - 1]] : { grade: [1, 1, 1] };
        for (let k = 0; k < 3; k++) grade[k] = previous.grade[k] + (season.grade[k] - previous.grade[k]) * blend;
        flakeUniforms.uSpeed.value = season.speed;
        flakeUniforms.uSway.value = season.sway;
        flakeUniforms.uSize.value = season.size;
        flakeUniforms.uColorA.value.setHex(season.a);
        flakeUniforms.uColorB.value.setHex(season.b);
        flakeUniforms.uFlat.value = season.flat;
        // Each season's weather fades in and out with it.
        const inSeason = smooth(local / 0.25) * (1 - smooth((local - SEASON_LENGTH + 0.25) / 0.25));
        flakeUniforms.uAlpha.value = season.alpha * (index === 3 ? smooth(local / 0.25) * (1 - smooth((seasonTime - SEASONS_END) / 0.4)) : inSeason);
        if (index === 3) snow = smooth(local / 1.2) * (1 - smooth((seasonTime - SEASONS_END) / 0.4));
        // Back to the textures' own colours at the end.
        const out = smooth((seasonTime - SEASONS_END) / 0.4);
        for (let k = 0; k < 3; k++) grade[k] += (1 - grade[k]) * out;
      } else {
        flakeUniforms.uAlpha.value = 0;
      }
      flakes.visible = flakeUniforms.uAlpha.value > 0.001;
      u.uGrade.value.set(grade[0], grade[1], grade[2]);
      u.uSnow.value = snow;

      // 6. Time travel: back to the first stage, then forward stage by stage.
      const timeTime = tour - START.time;
      let timeSub = '';
      let timeStep = '';
      let timelineAt = null;
      const TIME_END = CHAPTERS.find((c) => c.key === 'time')?.to;
      if (timeTravel && timeTime > 0 && timeTime < TIME_END - START.time && exit <= 0) {
        const { stages } = timeTravel;
        const glowOf = (f) => Math.sin(Math.PI * clamp01(f)) * 1.4;
        if (timeTime < TIME_REWIND) {
          const f = smooth(timeTime / TIME_REWIND);
          setTime(TODAY, stages[0], f * 1.1 - 0.05, glowOf(f));
          timeSub = `${stages.at(-1).year} → ${stages[0].year}`;
          timeStep = 'rewind';
          timelineAt = stages.at(-1).year + (stages[0].year - stages.at(-1).year) * f;
        } else {
          const after = timeTime - TIME_REWIND;
          let index = 1;
          while (index < stages.length - 1 && after >= timeStepStart(index + 1)) index++;
          const f = smooth((after - timeStepStart(index)) / (timeStepLength(index) * TIME_SWEEP));
          setTime(stages[index - 1], stages[index], f * 1.1 - 0.05, glowOf(f));
          const shown = stages[f > 0.5 ? index : index - 1];
          timeSub = timeLabel(shown);
          timeStep = String(shown.year);
          timelineAt = stages[index - 1].year + (stages[index].year - stages[index - 1].year) * f;
        }
      } else {
        resetTime();
        if (!timeTravel && !scene.custom && timeTime > 0 && timeTime < TIME_END - START.time) timeSub = '1730 → 1936';
      }
      const timeLength = TIME_END - START.time;
      const timelineOn = timelineAt === null ? 0
        : smooth(timeTime / 0.4) * (1 - smooth((timeTime - timeLength + 0.5) / 0.4));
      if (timelineAt !== null) timeline.show(timelineAt, timelineOn);
      else timeline.hide();

      // 9. Surroundings through time: rising round the model as the camera
      // draws back, the years running; the building's stage follows them.
      const surroundingsTime = tour - (START.surroundings ?? Infinity);
      let surroundingsSub = '';
      let surroundingsStep = '';
      const surroundingsLength = SURROUNDINGS ? SURROUNDINGS.to - SURROUNDINGS.from : 0;
      if (surroundings && exit <= 0 && surroundingsTime > 0 && surroundingsTime < surroundingsLength) {
        const year = surroundingsYear(surroundingsTime);
        const show = smooth(surroundingsTime / SURROUNDINGS_IN)
          * (1 - smooth((surroundingsTime - (surroundingsLength - SURROUNDINGS_OUT)) / SURROUNDINGS_OUT));
        surroundings.update(year, show);
        const period = surroundings.periodAt(year);
        surroundingsSub = `${Math.round(year)} · ${tx.surroundings?.periods?.[period] ?? period}`;
        surroundingsStep = period;
        surroundingsTimeline.show(year, Math.min(show * 1.5, 1) * smooth((surroundingsTime - 0.3) / 0.4));
        // The building as it was that year (its last stage by then).
        if (timeTravel) {
          const { stages } = timeTravel;
          const stage = [...stages].reverse().find((st) => st.year <= year) ?? stages[0];
          setTime(stage, stage, 1, 0);
        }
      } else {
        surroundings?.update(SURROUNDINGS ? surroundings.spans[0].from : 0, 0);
        surroundingsTimeline.hide();
      }

      // 6. Scene cameras: one after another, then the chosen one's view.
      views = [];
      const camerasTime = tour - (START.cameras ?? Infinity);
      const camerasLength = CHAPTERS.find((c) => c.key === 'cameras')?.to - START.cameras;
      const camerasOn = exit <= 0 && camerasTime > 0 && camerasTime < camerasLength ? 1 - smooth((camerasTime - camerasLength + 0.35) / 0.35) : 0;
      const chosenOn = camerasOn * smooth((camerasTime - 1.35) / 0.35);
      for (const c of sceneCameras) {
        const shown = camerasOn * smooth((camerasTime - c.delay) / 0.3);
        const color = c.chosen ? CAMERA_WHITE.clone().lerp(CAMERA_GOLD, chosenOn) : CAMERA_WHITE;
        c.lineMaterial.color.copy(color);
        c.fillMaterial.color.copy(color);
        c.dashMaterial.color.copy(color);
        c.lineMaterial.opacity = shown * 0.95;
        c.fillMaterial.opacity = shown * 0.9;
        c.dashMaterial.opacity = shown * 0.55;
        c.marker.visible = c.dash.visible = shown > 0.001;
        // The same size on screen, whatever the distance.
        c.glyph.scale.setScalar(camera.position.distanceTo(c.position) * 0.075 * (1 + (c.chosen ? chosenOn * 0.25 : 0)));
        place(c.label, c.position, shown, -14);
        c.label.classList.toggle('is-chosen', c.chosen && chosenOn > 0.5);
      }
      // The chosen camera's view, opening like a shutter, moving in a little.
      const insetOpen = camerasOn * smooth((camerasTime - 1.5) / 0.45);
      inset.style.opacity = insetOpen.toFixed(3);
      inset.style.setProperty('--open', insetOpen.toFixed(3));
      if (insetOpen > 0.02) {
        const rect = rectOf(inset);
        const view = chosenCamera.view;
        view.aspect = rect.width / Math.max(1, rect.height);
        view.position.copy(chosenCamera.position).lerp(chosenCamera.target, 0.08 * smooth((camerasTime - 1.5) / 2.2));
        view.lookAt(chosenCamera.target);
        view.updateProjectionMatrix();
        // Opening from the middle: the drawn part grows with it.
        const height = rect.height * insetOpen;
        views.push({ camera: view, rect: { ...rect, y: rect.y + (rect.height - height) / 2, height }, hide: [group] });
      }

      // 7. Cooperation mode: the phone comes in, the finger swipes, the
      // picture follows; the phone shows the same view, live.
      const liveTime = tour - (START.live ?? Infinity);
      const liveLength = CHAPTERS.find((c) => c.key === 'live')?.to - START.live;
      const liveOn = exit <= 0 && liveTime > 0 && liveTime < liveLength
        ? smooth(liveTime / 0.4) * (1 - smooth((liveTime - liveLength + 0.4) / 0.4)) : 0;
      phone.style.opacity = liveOn.toFixed(3);
      phone.style.setProperty('--in', liveOn.toFixed(3));
      liveBadge.style.opacity = (liveOn * smooth((liveTime - 0.5) / 0.3)).toFixed(3);
      let fingerX = null;
      let fingerOn = 0;
      for (const swipe of LIVE_SWIPES) {
        const local = (liveTime - swipe.from) / (swipe.to - swipe.from);
        if (local > -0.25 && local < 1.25) {
          const a = swipe.turn > 0 ? 0.25 : 0.72;
          const b = swipe.turn > 0 ? 0.75 : 0.42;
          fingerX = a + (b - a) * smooth(local);
          fingerOn = smooth((local + 0.25) / 0.25) * (1 - smooth((local - 1) / 0.25));
        }
      }
      phoneFinger.style.opacity = (fingerOn * liveOn).toFixed(3);
      if (fingerX !== null) phoneFinger.style.left = `${(fingerX * 100).toFixed(1)}%`;
      phone.classList.toggle('is-touching', fingerOn > 0.5);
      if (liveOn > 0.02) {
        const rect = rectOf(phoneScreen);
        phoneCamera.position.copy(camera.position);
        phoneCamera.quaternion.copy(camera.quaternion);
        phoneCamera.fov = camera.fov;
        phoneCamera.aspect = rect.width / Math.max(1, rect.height);
        // As the page does for a narrow screen: further away, so it fits.
        phoneCamera.zoom = Math.min(1, phoneCamera.aspect / 0.9 + 0.25);
        phoneCamera.updateProjectionMatrix();
        views.push({ camera: phoneCamera, rect, hide: [] });
      }

      // 8. Time travel's timeline (the stages above).
      if (timeTravel && !timeline.built) timeline.build(timeTravel.stages.map((stage) => stage.year));

      // The chapter's title.
      const current = active ? CHAPTERS.find((c) => tour >= c.from && tour < c.to) : null;
      if (!current) {
        hideAll();
        if (!active) {
          for (const pin of pins) pin.label.style.opacity = 0;
          measureLabel.style.opacity = 0;
          for (const cardinal of cardinals) cardinal.label.style.opacity = 0;
          for (const c of sceneCameras) c.label.style.opacity = 0;
          inset.style.opacity = phone.style.opacity = liveBadge.style.opacity = 0;
          timeline.hide();
          surroundingsTimeline.hide();
          views = [];
        }
        // Everything done: once, right after the last chapter.
        const finished = exit <= 0 && tour >= CHAPTERS.at(-1).to && tour < TOUR_LENGTH + 1;
        if (finished && lastCue.startsWith(`${CHAPTERS.at(-1).key}:`)) {
          lastCue = 'end';
          return 'end';
        }
        if (!finished) lastCue = '';
        return '';
      }
      const number = CHAPTERS.indexOf(current) + 1;
      let sub = '';
      let step = '';
      if (current.key === 'shading') { sub = tx.shading[shadingKey]; step = shadingKey; }
      else if (current.key === 'sun') { sub = sunSub; step = sunKey; }
      else if (current.key === 'seasons' && seasonKey) { sub = tx.seasons[seasonKey]; step = seasonKey; }
      else if (current.key === 'time') { sub = timeSub; step = timeStep; }
      else if (current.key === 'cameras') { sub = chosenOn > 0.5 ? tx.cameras?.chosen ?? '' : ''; step = chosenOn > 0.5 ? 'chosen' : ''; }
      else if (current.key === 'live') { sub = tx.live?.sub ?? ''; step = fingerOn > 0.5 ? 'swipe' : ''; }
      else if (current.key === 'surroundings') { sub = surroundingsSub; step = surroundingsStep; }
      chapterIndex.textContent = `${number} / ${CHAPTERS.length}`;
      chapterTitle.textContent = tx.chapters[current.key];
      chapterSub.textContent = sub;
      chapter.classList.toggle('has-sub', Boolean(sub));
      chapter.classList.toggle('is-on', tour < current.to - 0.2);
      const cue = `${current.key}:${step}`;
      if (cue !== lastCue) {
        const kind = lastCue.split(':')[0] === current.key ? 'step' : 'chapter';
        lastCue = cue;
        // Time travel's stages go by quietly.
        return kind === 'step' && current.key === 'time' ? '' : kind;
      }
      return '';
    },
  };
}

// Builds the ExPlora4D showcase manifests (viewer/manifesto/examples/
// showcase-aim3d-*.json) and lists them in the example list
// (viewer/manifesto/examples/index.json).
//
//   node scripts/build-showcase-examples.mjs
//
// One model, read in as many ways as the viewer has: lighting (studio,
// golden hour, overcast, night), weather (rain, morning fog, a storm),
// shading modes, a custom GLSL shader, raking light and a section. The model is a test scene in the repository
// (explora4d.eu/viewer): PBR spheres from smooth to rough, dielectric and
// metal, the material extensions (clearcoat, sheen, iridescence,
// anisotropy, transmission, dispersion), colour charts lit and unlit,
// relief as geometry and as a normal map, 18% grey and 90% white
// references, flat and smooth spheres, a hollow pedestal hiding a sphere,
// transparency (cutout, blend, glass), emitters, 1 m scale bars and an
// animated Rubik's cube. Metres, +Y up; the stations stand on a 10 x 5 m
// ground, the map rack along its back (z = -2.2).
//
// The model is not in the app (online only): its entries carry
// excludeFromMobile, so the app opens them from the site (example-manifests.js).
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = 'viewer/manifesto/examples';
const LIST = path.join(OUT, 'index.json');
const REPOSITORY = 'https://explora4d.eu/viewer/files/1c15a19aef5e4c5a9a74057061401002';
const MODEL = `${REPOSITORY}/gltf/ExPlora4D_showCase.glb`;
const VIEWS = `${REPOSITORY}/views/ExPlora4D_showCase`;
const DATE = '2026-10-12T00:00:00.000Z';

// The whole scene from the front, a little from the right.
const OVERVIEW = { position: [1.3, 2.6, 6.0], target: [-0.2, 0.6, -0.6] };

const ambient = (color, intensity) => ({ type: 'AmbientLight', position: [0, 0, 0], color, intensity });
const directional = (position, color, intensity, target = [0, 0.5, 0]) => ({ type: 'DirectionalLight', position, target, color, intensity });
const hemisphere = (color, groundColor, intensity) => ({ type: 'HemisphereLight', position: [0, 10, 0], color, groundColor, intensity });
const spot = (position, target, color, intensity, angle = 0.5, penumbra = 0.6) => (
  { type: 'SpotLight', position, target, color, intensity, distance: 0, decay: 0, angle, penumbra }
);

// Daylight shared by the shading modes: a key light high in front, a cooler
// fill, the sky.
const DAYLIGHT = [
  ambient('#ffffff', 0.5),
  directional([6, 10, 8], '#ffffff', 2.2),
  hemisphere('#ffffff', '#7a8a90', 0.4),
];
const environment = (preset, intensity) => (
  intensity > 0 ? { intensity, preset, enabled: true } : { intensity: 0, preset: 'neutral', enabled: false }
);
const rendering = (toneMapping, exposure, postprocessing = {}) => (
  { toneMapping, exposure, postprocessing: { enabled: false, antialias: 'msaa', ...postprocessing } }
);

// Height bands with a contour line every 10 cm (world Y, metres).
const CONTOUR_SHADER = {
  vertexShader: `#include <clipping_planes_pars_vertex>
varying vec3 vNormal;
varying float vHeight;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vHeight = worldPosition.y;
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}
`,
  fragmentShader: `#include <clipping_planes_pars_fragment>
varying vec3 vNormal;
varying float vHeight;

void main() {
  #include <clipping_planes_fragment>
  float t = clamp(vHeight / 2.4, 0.0, 1.0);
  vec3 low = vec3(0.16, 0.34, 0.62);
  vec3 mid = vec3(0.93, 0.86, 0.62);
  vec3 high = vec3(0.78, 0.25, 0.18);
  vec3 band = t < 0.5 ? mix(low, mid, t * 2.0) : mix(mid, high, t * 2.0 - 1.0);
  // A dark line every 10 cm, as wide on screen at any distance.
  float d = abs(fract(vHeight / 0.1 + 0.5) - 0.5) / fwidth(vHeight / 0.1);
  float line = 1.0 - clamp(d - 0.5, 0.0, 1.0);
  float light = 0.55 + 0.45 * max(dot(normalize(vNormal), normalize(vec3(0.3, 0.8, 0.5))), 0.0);
  gl_FragColor = vec4(mix(band * light, vec3(0.08), line * 0.8), 1.0);
}
`,
};

// Weather (editor/weather.js) over a plain daylight: the weather darkens it
// and sets the sky.
const WEATHER_LIGHT = [ambient('#ffffff', 0.5), directional([6, 10, 8], '#ffffff', 1.8), hemisphere('#dfe6ee', '#5c5a55', 0.6)];
// Somewhere in Germany, for a sun at a given hour.
const LOCATION = { latitude: 51.34, longitude: 12.37, north: 0, utcOffset: 1 };

const LOOKS = [
  {
    key: 'studio',
    name: { en: 'Showcase - PBR materials in the studio, AgX', pl: 'Showcase - materiały PBR w studiu, AgX', de: 'Showcase - PBR-Materialien im Studio, AgX' },
    camera: OVERVIEW,
    environmentMap: environment('studio', 0.9),
    rendering: rendering('agx', 1, { enabled: true, antialias: 'smaa', ao: true, aoIntensity: 0.8 }),
    lights: [ambient('#ffffff', 0.3), directional([6, 10, 8], '#ffffff', 1.8), directional([-8, 4, -6], '#cfe0ff', 0.8), hemisphere('#ffffff', '#b0b0b0', 0.5)],
  },
  {
    key: 'golden-hour',
    name: { en: 'Showcase - golden hour, low sun, ACES', pl: 'Showcase - złota godzina, niskie słońce, ACES', de: 'Showcase - goldene Stunde, tiefe Sonne, ACES' },
    camera: OVERVIEW,
    // The goldenHour map tints the grey ground violet under ACES: a plain sky,
    // the warmth comes from the sun.
    environmentMap: environment('sunny', 0.5),
    rendering: rendering('aces', 1.0),
    lights: [ambient('#5a3a24', 0.3), directional([-10, 2.2, 6], '#ff9a3c', 4.5), hemisphere('#ffd9a8', '#3b2414', 0.5)],
  },
  {
    key: 'overcast',
    name: { en: 'Showcase - overcast sky, Lambert, Cineon', pl: 'Showcase - zachmurzone niebo, Lambert, Cineon', de: 'Showcase - bedeckter Himmel, Lambert, Cineon' },
    camera: OVERVIEW,
    environmentMap: environment('sunny', 0.6),
    rendering: rendering('cineon', 0.8),
    lights: [ambient('#c8ccd2', 0.9), directional([0, 12, 0], '#e8edf2', 0.7), hemisphere('#dfe6ee', '#5c5a55', 0.8)],
    shadingMode: 'lambert',
  },
  {
    key: 'night',
    name: { en: 'Showcase - night: spotlights and emitters, Reinhard', pl: 'Showcase - noc: reflektory i emitery, Reinhard', de: 'Showcase - Nacht: Strahler und Leuchtkörper, Reinhard' },
    camera: OVERVIEW,
    theme: 'dark',
    backgroundColor: '#05070d',
    environmentMap: environment('neutral', 0),
    rendering: rendering('reinhard', 1.6, { enabled: true, antialias: 'msaa' }),
    lights: [
      ambient('#1a2440', 0.25),
      directional([-6, 10, -8], '#8fa8ff', 0.35),
      hemisphere('#22304f', '#050608', 0.2),
      // On the material spheres, the Rubik's cube and the glass sphere.
      spot([-2.7, 3.2, 2.6], [-2.7, 0.3, -0.6], '#ffd7a0', 5, 0.42),
      spot([0.5, 3.2, 2.2], [0.5, 0.8, -0.6], '#ffffff', 5, 0.35),
      spot([3.3, 3.6, 2.8], [3.3, 0.8, -0.6], '#a8c8ff', 5, 0.45),
    ],
  },
  {
    key: 'clay-ao',
    name: { en: 'Showcase - clay and ambient occlusion', pl: 'Showcase - glina i okluzja otoczenia', de: 'Showcase - Ton und Umgebungsverdeckung' },
    camera: OVERVIEW,
    environmentMap: environment('studio', 0.15),
    rendering: rendering('neutral', 1, { ao: true, aoIntensity: 1.6 }),
    lights: [ambient('#ffffff', 0.25), directional([6, 10, 4], '#ffffff', 1.6), hemisphere('#ffffff', '#7aa0b0', 0.25)],
    shadingMode: 'clay',
  },
  {
    key: 'matcap',
    name: { en: 'Showcase - matcap clay', pl: 'Showcase - matcap (glina)', de: 'Showcase - Matcap-Ton' },
    camera: OVERVIEW,
    environmentMap: environment('neutral', 0),
    rendering: rendering('neutral', 1, { enabled: true, ao: true, aoIntensity: 0.8 }),
    lights: DAYLIGHT,
    shadingMode: 'matcap',
  },
  {
    key: 'toon',
    name: { en: 'Showcase - toon shading', pl: 'Showcase - cieniowanie toon', de: 'Showcase - Toon-Shading' },
    camera: OVERVIEW,
    environmentMap: environment('neutral', 0),
    rendering: rendering('none', 1, { enabled: true, antialias: 'fxaa' }),
    lights: DAYLIGHT,
    shadingMode: 'toon',
  },
  {
    key: 'flat-faces',
    name: { en: 'Showcase - flat faces: flat and smooth spheres', pl: 'Showcase - płaskie ściany: sfera płaska i gładka', de: 'Showcase - flache Facetten: flache und glatte Kugel' },
    // The two spheres of the Normals station.
    camera: { position: [1.9, 1.0, 1.0], target: [1.58, 0.25, -0.6] },
    environmentMap: environment('neutral', 0.5),
    rendering: rendering('neutral', 1),
    lights: DAYLIGHT,
    shadingMode: 'flat',
  },
  {
    key: 'normals',
    name: { en: 'Showcase - surface normals as colours', pl: 'Showcase - normalne powierzchni jako kolory', de: 'Showcase - Flächennormalen als Farben' },
    camera: OVERVIEW,
    environmentMap: environment('neutral', 0),
    rendering: rendering('none', 1),
    lights: DAYLIGHT,
    shadingMode: 'normals',
  },
  {
    key: 'contours',
    name: { en: 'Showcase - custom shader: height bands, contour every 10 cm', pl: 'Showcase - własny shader: pasy wysokości, warstwica co 10 cm', de: 'Showcase - eigener Shader: Höhenbänder, Höhenlinie alle 10 cm' },
    camera: OVERVIEW,
    environmentMap: environment('neutral', 0),
    rendering: rendering('none', 1, { enabled: true }),
    lights: DAYLIGHT,
    shadingMode: 'custom',
    customShader: CONTOUR_SHADER,
  },
  {
    key: 'raking-light',
    name: { en: 'Showcase - raking light on relief and a normal map', pl: 'Showcase - światło skośne na reliefie i mapie normalnych', de: 'Showcase - Streiflicht auf Relief und Normal Map' },
    // The two relief panels at the right end of the map rack.
    camera: { position: [1.9, 1.5, -0.4], target: [1.9, 1.5, -2.2] },
    environmentMap: environment('neutral', 0.3),
    rendering: rendering('agx', 1.1, { enabled: true }),
    lights: DAYLIGHT,
    rakingLight: { enabled: true, direction: 150, height: 10, sweep: true },
  },
  {
    key: 'section',
    name: { en: 'Showcase - section through the hollow pedestal', pl: 'Showcase - przekrój przez pusty postument', de: 'Showcase - Schnitt durch den hohlen Sockel' },
    // The pedestal hides a red sphere; a plane across it at x = 0.5 shows it.
    camera: { position: [1.6, 0.9, 0.2], target: [0.5, 0.25, -0.6] },
    environmentMap: environment('studio', 0.6),
    rendering: rendering('neutral', 1),
    lights: DAYLIGHT,
    clipping: { mode: { x: true, y: false, z: false }, constants: [0.5, 0, 0], outlineVisible: false },
  },
];

LOOKS.push(
  {
    key: 'rain',
    name: { en: 'Showcase - downpour: wet materials, splashes', pl: 'Showcase - ulewa: mokre materiały, rozbryzgi', de: 'Showcase - Platzregen: nasse Materialien, Spritzer' },
    camera: OVERVIEW,
    environmentMap: environment('sunny', 0.6),
    rendering: rendering('neutral', 1),
    lights: WEATHER_LIGHT,
    weather: { type: 'rain', intensity: 0.9, wind: 0.15, windDirection: 230 },
  },
  {
    key: 'fog',
    name: { en: 'Showcase - morning fog at sunrise', pl: 'Showcase - poranna mgła o wschodzie słońca', de: 'Showcase - Morgennebel bei Sonnenaufgang' },
    camera: OVERVIEW,
    environmentMap: environment('sunny', 0.5),
    rendering: rendering('neutral', 1),
    lights: WEATHER_LIGHT,
    location: LOCATION,
    sun: { enabled: true, date: '2026-09-20', time: '07:40', followTimeline: false },
    weather: { type: 'fog', intensity: 0.8, wind: 0.05, windDirection: 90, mistHeight: 0.25, mistDensity: 0.55, mistSpread: 0.75 },
  },
  {
    key: 'storm',
    name: { en: 'Showcase - thunderstorm', pl: 'Showcase - burza', de: 'Showcase - Gewitter' },
    camera: OVERVIEW,
    environmentMap: environment('sunny', 0.5),
    rendering: rendering('neutral', 1),
    lights: WEATHER_LIGHT,
    weather: { type: 'storm', intensity: 0.85, wind: 0.6, windDirection: 250 },
  },
);

const THUMBNAILS = [
  { src: `${VIEWS}_side0.png`, label: { en: ['Front'], pl: ['Przód'], de: ['Vorderseite'] } },
  `${VIEWS}_side45.png`,
  `${VIEWS}_side90.png`,
  `${VIEWS}_side135.png`,
  { src: `${VIEWS}_side180.png`, label: { en: ['Back'], pl: ['Tył'], de: ['Rückseite'] } },
  `${VIEWS}_side225.png`,
  `${VIEWS}_side270.png`,
  `${VIEWS}_side315.png`,
  { src: `${VIEWS}_top.png`, label: { en: ['Top view'], pl: ['Widok z góry'], de: ['Draufsicht'] } },
];

const languageMap = (name) => Object.fromEntries(Object.entries(name).map(([lang, text]) => [lang, [text]]));

function camera({ position, target }) {
  const distance = Math.hypot(...position.map((v, i) => v - target[i]));
  return { position, target, up: [0, 1, 0], fov: 45, zoom: 1, distance: Math.round(distance * 100) / 100, perspectiveMode: 'perspective' };
}

function manifest(look) {
  const id = `${MODEL}/manifest-${look.key}.json`;
  const scene = `${MODEL}/scene`;
  return {
    '@context': 'http://iiif.io/api/presentation/4/context.json',
    id,
    type: 'Manifest',
    label: languageMap(look.name),
    summary: {
      en: ['A test scene for lighting, materials and shading: PBR spheres, material extensions, colour charts, relief, transparency, emitters and 1 m scale bars.'],
      pl: ['Scena testowa oświetlenia, materiałów i cieniowania: sfery PBR, rozszerzenia materiałów, wzorniki kolorów, relief, przezroczystość, emitery i podziałki 1 m.'],
      de: ['Eine Testszene für Licht, Materialien und Schattierung: PBR-Kugeln, Materialerweiterungen, Farbtafeln, Relief, Transparenz, Leuchtkörper und 1-m-Maßstäbe.'],
    },
    items: [
      {
        id: scene,
        type: 'Scene',
        spatialScale: { type: 'Quantity', quantityValue: 1, unit: 'm' },
        label: { en: ['ExPlora4D showcase'] },
        items: [
          {
            id: `${scene}/page/model`,
            type: 'AnnotationPage',
            items: [
              {
                id: `${scene}/annotation/model`,
                type: 'Annotation',
                motivation: ['painting'],
                body: { id: MODEL, type: 'Model', format: 'model/gltf-binary' },
                target: { id: scene, type: 'Scene' },
              },
            ],
          },
        ],
        annotations: [{ id: `${scene}/page/annotations`, type: 'AnnotationPage', items: [] }],
      },
    ],
    AIM3DViewer: {
      version: '1.0',
      generatedAt: DATE,
      camera: camera(look.camera),
      viewer: {
        container: 'DFG_3DViewer',
        theme: look.theme ?? 'dark',
        language: 'en',
        environmentMap: look.environmentMap,
        performance: 'high-performance',
        rendering: look.rendering,
        ...(look.backgroundColor ? { backgroundColor: look.backgroundColor } : {}),
        ...(look.clipping ? { clipping: look.clipping } : {}),
      },
      lights: look.lights,
      ...(look.rakingLight ? { rakingLight: look.rakingLight } : {}),
      ...(look.location ? { location: look.location } : {}),
      ...(look.sun ? { sun: look.sun } : {}),
      ...(look.weather ? { weather: look.weather } : {}),
      thumbnails: THUMBNAILS,
      modelTransform: {
        position: [0, 0, 0],
        rotation: { x: 0, y: 0, z: 0, order: 'XYZ' },
        scale: [1, 1, 1],
        wireframe: false,
        ...(look.shadingMode ? { shadingMode: look.shadingMode } : {}),
        ...(look.customShader ? { customShader: look.customShader } : {}),
      },
    },
    modified: DATE,
  };
}

const file = (look) => `showcase-aim3d-${look.key}.json`;
await Promise.all(LOOKS.map((look) => writeFile(path.join(OUT, file(look)), `${JSON.stringify(manifest(look), null, 2)}\n`)));

// The list: the showcase entries replace any earlier ones, after the Wolpa
// ones, in the "showcase" group, each named by what it changes (the variant,
// the name without "Showcase - "; the full name is for viewers released
// before groups existed).
const GROUP = { name: { en: 'ExPlora4D showcase', pl: 'ExPlora4D showcase', de: 'ExPlora4D-Showcase' } };
const variant = (name) => Object.fromEntries(Object.entries(name).map(([lang, text]) => {
  const rest = text.replace(/^Showcase - /, '');
  return [lang, rest.charAt(0).toUpperCase() + rest.slice(1)];
}));
const list = JSON.parse(await readFile(LIST, 'utf8'));
const isShowcase = (entry) => entry.url.startsWith('./manifests/showcase-aim3d-');
list.groups = { ...list.groups, showcase: GROUP };
list.aim3d = list.aim3d.filter((entry) => !isShowcase(entry));
list.aim3d.push(...LOOKS.map((look) => ({
  url: `./manifests/${file(look)}`, name: look.name, group: 'showcase', variant: variant(look.name), excludeFromMobile: true,
})));
// One entry per line, spaced as the file is written by hand too.
const inline = (value) => (value && typeof value === 'object' && !Array.isArray(value)
  ? `{ ${Object.entries(value).map(([key, v]) => `${JSON.stringify(key)}: ${inline(v)}`).join(', ')} }`
  : JSON.stringify(value));
const lines = (entries) => entries.map((entry) => `    ${inline(entry)}`).join(',\n');
const { version, groups, iiif, aim3d } = list;
const groupLines = Object.entries(groups).map(([id, group]) => `    ${JSON.stringify(id)}: ${inline(group)}`).join(',\n');
await writeFile(LIST, `{\n  "version": ${JSON.stringify(version)},\n  "groups": {\n${groupLines}\n  },\n  "iiif": [\n${lines(iiif)}\n  ],\n  "aim3d": [\n${lines(aim3d)}\n  ]\n}\n`);
console.log(`${LOOKS.length} manifests in ${OUT}, listed in ${LIST}`);

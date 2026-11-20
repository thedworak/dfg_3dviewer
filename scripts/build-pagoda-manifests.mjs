#!/usr/bin/env node
// Derive the Pagoda feature manifests from their Wolpa counterparts.  The two
// hand-authored starting manifests (default and 4D) deliberately stay intact.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'viewer/manifesto/examples';
const WOLPA = 'wolpa-synagogue-aim3d-local';
const PAGODA = 'pagoda-aim3d-local';
const MODEL = './examples/pagoda/Pagoda-progressive.glb';
const MODEL_4D = './examples/pagoda/4D/Pagoda_4D.glb';

const camera = {
  position: [24, 9, 30], target: [0, 9.5, 0], up: [0, 1, 0], fov: 45,
  zoom: 1, distance: 38.4, perspectiveMode: 'perspective', aspect: 1.7277,
  orientation: 'landscape',
};
const lights = [
  { type: 'AmbientLight', position: [0, 0, 0], color: '#404040', intensity: 1 },
  { type: 'DirectionalLight', position: [15, 30, 20], target: [0, 9.5, 0], color: '#ffffff', intensity: 1 },
];

function replaceText(value) {
  if (typeof value === 'string') return value
    .replaceAll('./examples/4D/WolpaSynagogue_4D.glb', MODEL_4D)
    .replaceAll('./examples/WolpaSynagogue.glb', MODEL)
    .replaceAll('wolpa-synagogue-aim3d-local', PAGODA)
    .replaceAll('Wolpa Synagogue', 'Pagoda')
    .replaceAll('Volpa Synagogue', 'Pagoda')
    .replaceAll('Synagoga w Wołpie', 'Pagoda')
    .replaceAll('Synagoge Wolpa', 'Pagode');
  if (Array.isArray(value)) return value.map(replaceText);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, replaceText(item)]),
  );
  return value;
}

function languageMap(en, pl, de) {
  return { en: [en], pl: [pl], de: [de] };
}

const PAGODA_VARIANTS = {
  '-ceiling': ['View from above', 'Widok z góry', 'Ansicht von oben'],
  '-measured': ['Measurements: height, roof and footprint', 'Pomiary: wysokość, dach i obrys', 'Messungen: Höhe, Dach und Grundriss'],
  '-section-measured': ['Section with measurements', 'Przekrój z pomiarami', 'Schnitt mit Messungen'],
  '-night-tour': ['Night, annotations and guided tour', 'Noc, adnotacje i wycieczka', 'Nacht, Anmerkungen und Führung'],
  '-surroundings': ['Japanese temple precinct', 'Japoński zespół świątynny', 'Japanischer Tempelbezirk'],
  '-scene-place': ['Suggested scene: Japanese temple precinct', 'Sugerowana scena: japoński zespół świątynny', 'Vorgeschlagene Szene: japanischer Tempelbezirk'],
  '-scene-interior': ['Suggested scene: Pagoda interior', 'Sugerowana scena: wnętrze pagody', 'Vorgeschlagene Szene: Pagodeninneres'],
  '-scene-documentation': ['Suggested scene: documentation', 'Sugerowana scena: dokumentacja', 'Vorgeschlagene Szene: Dokumentation'],
  '-acoustics': ['Model acoustics', 'Akustyka modelu', 'Modellakustik'],
};

function variantFor(suffix, fallback) {
  const value = PAGODA_VARIANTS[suffix];
  return value ? { en: value[0], pl: value[1], de: value[2] } : fallback;
}

function genericSummary(suffix) {
  const feature = suffix === '-ceiling' ? 'a view of the roofs from above'
    : suffix.includes('measured') ? 'measurements of the building'
      : suffix === '-certainty' ? 'Level of Certainty assessments'
        : suffix === '-night-tour' ? 'a guided tour with annotations'
          : suffix === '-surroundings' ? 'a generated Japanese temple precinct'
            : suffix.startsWith('-scene-') ? 'a suggested scene around the model'
              : suffix === '-acoustics' ? 'room acoustics from the model'
                : 'this viewer feature';
  return languageMap(
    `The Pagoda shown with ${feature}.`,
    `Pagoda pokazana z użyciem funkcji: ${feature}.`,
    `Die Pagode mit der Funktion „${feature}“.`,
  );
}

function page(manifest) {
  return manifest.items?.[0]?.annotations?.[0];
}

function annotation(manifest, id, label, point, certainty, view) {
  const scene = `${MODEL}/scene`;
  return {
    id: `${scene}/annotation/${id}`,
    type: 'Annotation', motivation: certainty ? ['commenting', 'assessing'] : ['commenting'],
    label: languageMap(label, label, label),
    body: { type: 'TextualBody', value: 'Example annotation for the project’s own Pagoda model.', format: 'text/plain', language: ['en'] },
    target: {
      type: 'SpecificResource', source: { id: scene, type: 'Scene' },
      selector: [{ type: 'PointSelector', x: point[0], y: point[1], z: point[2] }],
    },
    AIM3DViewer: certainty ? {
      groupId: '', key: '', object: 'm0:0', targetId: 'm0:0', point,
      certainty: { value: 7, code: 'C', scope: 'object', targetId: 'm0:0' },
    } : {
      groupId: '', key: '', object: '', targetId: 'm0:root', point,
      view: view || { position: [20, 14, 24], target: [0, 10, 0], fov: 45 },
    },
  };
}

function tailor(manifest, suffix) {
  manifest.rights = 'https://creativecommons.org/publicdomain/zero/1.0/';
  delete manifest.requiredStatement;
  manifest.summary = genericSummary(suffix);
  const variant = variantFor(suffix, { en: 'Viewer feature', pl: 'Funkcja przeglądarki', de: 'Viewer-Funktion' });
  manifest.label = languageMap(
    `Pagoda — ${variant.en} (AIM3D, localhost)`,
    `Pagoda — ${variant.pl} (AIM3D, localhost)`,
    `Pagode — ${variant.de} (AIM3D, localhost)`,
  );
  manifest.items[0].spatialScale = { type: 'Quantity', quantityValue: 1, unit: 'm' };
  manifest.items[0].label = { en: ['Pagoda'] };
  manifest.AIM3DViewer.camera = structuredClone(camera);
  manifest.AIM3DViewer.lights = structuredClone(lights);
  manifest.AIM3DViewer.generatedAt = '2026-11-20T00:00:00.000Z';
  manifest.modified = '2026-11-20T00:00:00.000Z';

  if (manifest.AIM3DViewer.location) {
    manifest.AIM3DViewer.location = { latitude: 34.68, longitude: 135.83, north: 0, utcOffset: 9 };
  }
  if (manifest.AIM3DViewer.surroundings) {
    Object.assign(manifest.AIM3DViewer.surroundings, {
      kind: 'monastery', region: 'japanese', masonry: 'stone', seed: 7,
    });
  }
  if (manifest.AIM3DViewer.sceneSuggest) {
    // The suggested-scene rules derive place and region from `location`;
    // sceneSuggest itself only controls the window and its purpose.
    if (!manifest.AIM3DViewer.location) {
      manifest.AIM3DViewer.location = { latitude: 34.68, longitude: 135.83, north: 0, utcOffset: 9 };
    }
  }
  if (suffix === '-ceiling') {
    manifest.AIM3DViewer.camera = { ...camera, position: [0, 34, 0.01], target: [0, 9, 0], up: [0, 0, -1], distance: 25 };
  }
  if (suffix === '-night-spotlights' || suffix === '-night-tour') {
    manifest.AIM3DViewer.lights = [
      { type: 'AmbientLight', position: [0, 0, 0], color: '#1a2440', intensity: 0.18 },
      { type: 'DirectionalLight', position: [-18, 32, -24], target: [0, 10, 0], color: '#8fa8ff', intensity: 0.35 },
      { type: 'HemisphereLight', position: [0, 26, 0], color: '#22304f', groundColor: '#050608', intensity: 0.2 },
      { type: 'SpotLight', position: [18, 2, 18], target: [0, 11, 0], color: '#ffc27a', intensity: 4, distance: 0, decay: 0, angle: 0.48, penumbra: 0.6 },
      { type: 'SpotLight', position: [-18, 2, 18], target: [0, 11, 0], color: '#ffc27a', intensity: 4, distance: 0, decay: 0, angle: 0.48, penumbra: 0.6 },
      { type: 'SpotLight', position: [0, 4, -18], target: [0, 12, 0], color: '#ffb45c', intensity: 3, distance: 0, decay: 0, angle: 0.42, penumbra: 0.55 },
      { type: 'PointLight', position: [0, 8, 0], color: '#ff9b4a', intensity: 2, distance: 18, decay: 0 },
    ];
  }
  if (suffix === '-measured' || suffix === '-section-measured') {
    manifest.AIM3DViewer.measurements = [
      { mode: 'distance', points: [[7, 0, 0], [7, 20.5, 0]] },
      { mode: 'distance', points: [[-6.5, 1, 0], [6.5, 1, 0]] },
      { mode: 'distance', points: [[0, 1, -6.5], [0, 1, 6.5]] },
      { mode: 'angle', points: [[-7, 12, 0], [0, 15, 0], [7, 12, 0]] },
      { mode: 'area', points: [[-6.5, 0, -6.5], [6.5, 0, -6.5], [6.5, 0, 6.5], [-6.5, 0, 6.5]] },
    ];
  }
  const annotations = page(manifest);
  if (annotations && suffix === '-certainty') annotations.items = [annotation(manifest, 'certainty-roof', 'Roof', [0, 17, 0], true)];
  if (annotations && suffix === '-night-tour') annotations.items = [
    annotation(manifest, 'tour-platform', 'Stone platform', [0, 0.5, 6], false, { position: [18, 8, 23], target: [0, 2, 0], fov: 45 }),
    annotation(manifest, 'tour-entrance', 'Entrance', [0, 2, 6], false, { position: [14, 5, 19], target: [0, 3, 2], fov: 42 }),
    annotation(manifest, 'tour-brackets', 'Bracket sets', [0, 4.5, 3.4], false, { position: [13, 8, 16], target: [0, 5, 2], fov: 40 }),
    annotation(manifest, 'tour-roof', 'Tiered roofs', [0, 12, 0], false, { position: [22, 15, 22], target: [0, 11, 0], fov: 45 }),
    annotation(manifest, 'tour-finial', 'Finial', [0, 20, 0], false, { position: [14, 22, 18], target: [0, 18, 0], fov: 38 }),
  ];
}

const wolpaFiles = fs.readdirSync(ROOT).filter((file) => file.startsWith(WOLPA) && file.endsWith('.json'));
for (const file of wolpaFiles) {
  const suffix = file.slice(WOLPA.length, -'.json'.length);
  if (suffix === '' || suffix === '-4d') continue;
  const source = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const manifest = replaceText(source);
  tailor(manifest, suffix);
  fs.writeFileSync(path.join(ROOT, `${PAGODA}${suffix}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
}

const indexPath = path.join(ROOT, 'index.json');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const existing = new Set(index.aim3d.map(({ url }) => url));
const wolpaEntries = index.aim3d.filter(({ url }) => url.startsWith(`./manifests/${WOLPA}`));
const pagodaEntries = wolpaEntries
  .filter(({ url }) => !url.endsWith(`${WOLPA}.json`) && !url.endsWith(`${WOLPA}-4d.json`))
  .map((entry) => {
    const suffix = entry.url.slice(`./manifests/${WOLPA}`.length, -'.json'.length);
    const variant = variantFor(suffix, replaceText(entry.variant));
    const name = Object.fromEntries(Object.entries(variant).map(([lang, [value]]) => [lang, `Pagoda — ${value} (localhost)`]));
    const { i18n, fallback, ...rest } = entry;
    return { ...rest, url: entry.url.replace(WOLPA, PAGODA), name, group: 'pagoda', variant };
  });
for (const entry of pagodaEntries) {
  const at = index.aim3d.findIndex(({ url }) => url === entry.url);
  if (at >= 0) index.aim3d[at] = entry;
}
const newPagodaEntries = pagodaEntries.filter(({ url }) => !existing.has(url));
const afterPagoda4d = index.aim3d.findIndex(({ url }) => url.endsWith(`${PAGODA}-4d.json`));
index.aim3d.splice(afterPagoda4d + 1, 0, ...newPagodaEntries);
fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);

console.log(`Generated ${wolpaFiles.length - 2} Pagoda manifests and added ${newPagodaEntries.length} example-list entries.`);

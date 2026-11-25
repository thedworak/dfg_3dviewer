#!/usr/bin/env node
// Derive the Pagoda feature manifests from their Wolpa counterparts. The two
// hand-authored starting manifests (default and 4D) deliberately stay intact.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'viewer/manifesto/examples';
const WOLPA = 'wolpa-synagogue-aim3d-local';
const PAGODA = 'pagoda-aim3d-local';
const MODEL = './examples/pagoda/Pagoda-progressive.glb';
const MODEL_4D = './examples/pagoda/4D/Pagoda_4D.glb';
// The pagoda's metadata manifest (synthetic data), shared by every Pagoda
// manifest - the two hand-authored ones too (AIM3DViewer.metadata).
const METADATA = './examples/pagoda/metadata.json';

const camera = {
  position: [24, 9, 30], target: [0, 9.5, 0], up: [0, 1, 0], fov: 45,
  zoom: 1, distance: 38.4, perspectiveMode: 'perspective', aspect: 1.7277,
  orientation: 'landscape',
};
const defaultLights = [
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
    .replaceAll('Synagoge Wolpa', 'Pagode')
    // The contours' shader counts in model units: the synagogue's are
    // centimetres (a line every metre), the pagoda's metres.
    .replaceAll('A dark line every 100 units', 'A dark line every metre')
    .replaceAll('vHeight / 100.0', 'vHeight / 1.0')
    // The colour from the foot to the top: the synagogue's 15 m, the pagoda's 20.5.
    .replaceAll('vHeight / 1500.0', 'vHeight / 20.5');
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
  '-golden-hour': ['Golden hour, ACES', 'Złota godzina, ACES', 'Goldene Stunde, ACES'],
  '-studio-agx': ['Studio, AgX', 'Studio, AgX', 'Studio, AgX'],
  '-night-spotlights': ['Night spotlights, Reinhard', 'Nocne reflektory, Reinhard', 'Nächtliche Strahler, Reinhard'],
  '-night-tour': ['Night, annotations and guided tour', 'Noc, adnotacje i wycieczka', 'Nacht, Anmerkungen und Führung'],
  '-certainty': ['Level of Certainty', 'Poziom pewności', 'Grad der Gewissheit'],
  '-toon': ['Toon shading', 'Cieniowanie toon', 'Toon-Shading'],
  '-overcast-lambert': ['Overcast, Lambert, Cineon', 'Pochmurno, Lambert, Cineon', 'Bewölkt, Lambert, Cineon'],
  '-clay-ao': ['Clay, ambient occlusion', 'Glina, okluzja otoczenia', 'Ton, Umgebungsverdeckung'],
  '-raking-light': ['Raking light, sweeping, clay', 'Światło skośne, obracające się, glina', 'Streiflicht, umlaufend, Ton'],
  '-raking-light-texture': ['Raking light on the textures', 'Światło skośne na teksturach', 'Streiflicht auf den Texturen'],
  '-matcap': ['Matcap studio clay', 'Matcap, glina studyjna', 'Matcap, Studio-Ton'],
  '-flat-faces': ['Flat shading, faces shown', 'Płaskie cieniowanie, widoczne ściany', 'Flache Schattierung, Flächen sichtbar'],
  '-normals': ['Surface normals', 'Normalne powierzchni', 'Oberflächennormalen'],
  '-contours': ['Custom shader: contour lines', 'Własny shader: warstwice', 'Eigener Shader: Höhenlinien'],
  '-winter': ['Winter, snow on the roofs', 'Zima, śnieg na dachach', 'Winter, Schnee auf den Dächern'],
  '-mist': ['Autumn morning mist', 'Jesienna poranna mgła', 'Herbstlicher Morgennebel'],
  '-downpour': ['Downpour on the tiled roofs', 'Ulewa na dachówkach', 'Platzregen auf den Ziegeldächern'],
  '-surroundings': ['Japanese temple precinct', 'Japoński zespół świątynny', 'Japanischer Tempelbezirk'],
  '-scene-place': ['Suggested scene: Japanese temple precinct', 'Sugerowana scena: japoński zespół świątynny', 'Vorgeschlagene Szene: japanischer Tempelbezirk'],
  '-scene-interior': ['Suggested scene: Pagoda interior', 'Sugerowana scena: wnętrze pagody', 'Vorgeschlagene Szene: Pagodeninneres'],
  '-scene-documentation': ['Suggested scene: documentation', 'Sugerowana scena: dokumentacja', 'Vorgeschlagene Szene: Dokumentation'],
  '-acoustics': ['Model acoustics', 'Akustyka modelu', 'Modellakustik'],
};

const PAGODA_SUMMARIES = {
  '-ceiling': {
    en: 'The Pagoda shown with a view of the roofs from above.',
    pl: 'Pagoda pokazana w widoku z góry na dachy.',
    de: 'Die Pagode in einer Ansicht der Dächer von oben.',
  },
  '-measured': {
    en: 'The Pagoda shown with measurements of its height, roof span and footprint.',
    pl: 'Pagoda pokazana z pomiarami wysokości, rozpiętości dachu i obrysu cokołu.',
    de: 'Die Pagode mit Messungen von Höhe, Dachtraufe und Grundriss.',
  },
  '-section-measured': {
    en: 'A section through the Pagoda with architectural measurements.',
    pl: 'Przekrój przez pagodę wraz z pomiarami architektonicznymi.',
    de: 'Ein Schnitt durch die Pagode mit architektonischen Messungen.',
  },
  '-golden-hour': {
    en: 'The Pagoda bathed in low-angle golden hour sunlight with ACES tone mapping.',
    pl: 'Pagoda w niskim świetle złotej godziny z mapowaniem tonów ACES.',
    de: 'Die Pagode im tiefstehenden Licht der goldenen Stunde mit ACES-Tonemapping.',
  },
  '-studio-agx': {
    en: 'Studio three-point lighting with AgX tone mapping.',
    pl: 'Oświetlenie studyjne trzypunktowe z mapowaniem tonów AgX.',
    de: 'Dreipunkt-Studiobeleuchtung mit AgX-Tonemapping.',
  },
  '-night-spotlights': {
    en: 'Night architectural illumination with spotlights and Reinhard tone mapping.',
    pl: 'Nocna iluminacja architektoniczna reflektorami z mapowaniem tonów Reinhard.',
    de: 'Nächtliche Architekturbeleuchtung mit Scheinwerfern und Reinhard-Tonemapping.',
  },
  '-night-tour': {
    en: 'A guided night tour of the Pagoda with architectural annotations.',
    pl: 'Nocna wycieczka z przewodnikiem po pagodzie z adnotacjami architektonicznymi.',
    de: 'Eine geführte nächtliche Tour um die Pagode mit Architektur-Anmerkungen.',
  },
  '-certainty': {
    en: 'The Pagoda shown with Level of Certainty (LoC) assessments on its architectural elements.',
    pl: 'Pagoda z oceną poziomu pewności (LoC) poszczególnych elementów architektonicznych.',
    de: 'Die Pagode mit Bewertungen des Gewissheitsgrades (LoC) ihrer Bauteile.',
  },
  '-toon': {
    en: 'Non-photorealistic cel-shaded rendering with dark contours.',
    pl: 'Komiksowe cieniowanie cel-shading z ciemnymi konturami.',
    de: 'Nicht-fotorealistisches Cel-Shading-Rendering mit dunklen Konturen.',
  },
  '-overcast-lambert': {
    en: 'Diffuse daylight under an overcast sky, Lambert shading and Cineon tone mapping.',
    pl: 'Rozproszone światło dzienne pod pochmurnym niebem, cieniowanie Lamberta i mapowanie Cineon.',
    de: 'Diffuses Tageslicht bei bedecktem Himmel, Lambert-Schattierung und Cineon-Tonemapping.',
  },
  '-clay-ao': {
    en: 'Monochrome clay material with ambient occlusion highlighting the structure.',
    pl: 'Monochromatyczny materiał gliny z okluzją otoczenia podkreślający strukturę.',
    de: 'Einfarbiges Tonmaterial mit Umgebungsverdeckung zur Hervorhebung der Struktur.',
  },
  '-raking-light': {
    en: 'Sweeping raking light revealing surface relief on clay shading.',
    pl: 'Obracające się światło skośne uwypuklające relief powierzchni na glinie.',
    de: 'Umlaufendes Streiflicht zur Hervorhebung des Oberflächenreliefs auf Ton.',
  },
  '-raking-light-texture': {
    en: 'Sweeping raking light across the Pagoda’s original textures.',
    pl: 'Obracające się światło skośne na oryginalnych teksturach pagody.',
    de: 'Umlaufendes Streiflicht auf den Originaltexturen der Pagode.',
  },
  '-matcap': {
    en: 'Matcap studio clay rendering for form inspection.',
    pl: 'Cieniowanie matcap gliny studyjnej do analizy bryły.',
    de: 'Matcap-Studio-Ton-Rendering zur Formanalyse.',
  },
  '-flat-faces': {
    en: 'Faceted flat shading revealing the polygonal mesh faces.',
    pl: 'Płaskie cieniowanie uwidaczniające ścianki siatki wielokątów.',
    de: 'Flache Schattierung, die die Facetten des Polygonnetzes sichtbar macht.',
  },
  '-normals': {
    en: 'Color-coded surface normals displaying face orientations in space.',
    pl: 'Wektorowe normalne powierzchni kodowane kolorami w przestrzeni.',
    de: 'Farbcodierte Oberflächennormalen zur Darstellung der Ausrichtung im Raum.',
  },
  '-contours': {
    en: 'Custom shader projecting elevation contour lines across the building.',
    pl: 'Własny shader rzutujący poziomice wysokościowe na budowlę.',
    de: 'Eigener Shader, der Höhenlinien über das Bauwerk projiziert.',
  },
  '-winter': {
    en: 'Winter scene with falling snow and snow accumulation on the roofs.',
    pl: 'Scena zimowa z padającym śniegiem i ośnieżeniem dachów.',
    de: 'Winterszene mit Schneefall und Schneebelag auf den Dächern.',
  },
  '-mist': {
    en: 'Morning autumn mist softening the pagoda silhouette.',
    pl: 'Jesienna poranna mgła otulająca sylwetkę pagody.',
    de: 'Morgendlicher Herbstnebel, der die Silhouette der Pagode einhüllt.',
  },
  '-downpour': {
    en: 'Heavy downpour and wet surfaces on the pagoda’s tiled roofs.',
    pl: 'Ulewny deszcz i mokre powierzchnie ceramicznych dachów pagody.',
    de: 'Starker Platzregen und nasse Oberflächen auf den Ziegeldächern der Pagode.',
  },
  '-surroundings': {
    en: 'A procedural Japanese temple precinct generated around the Pagoda.',
    pl: 'Generowany proceduralnie japoński zespół świątynny wokół pagody.',
    de: 'Ein prozedural generierter japanischer Tempelbezirk um die Pagode.',
  },
  '-scene-place': {
    en: 'Suggested scene: a Japanese Buddhist temple precinct fitted to the model.',
    pl: 'Sugerowana scena: japoński buddyjski zespół świątynny dopasowany do modelu.',
    de: 'Vorgeschlagene Szene: ein an das Modell angepasster japanischer Tempelbezirk.',
  },
  '-scene-interior': {
    en: 'Suggested scene: interior view of the ground storey with its altar, pillars and coffered ceiling.',
    pl: 'Sugerowana scena: wnętrze parteru z ołtarzem, filarami i kasetonowym sufitem.',
    de: 'Vorgeschlagene Szene: Innenansicht des Erdgeschosses mit Altar, Pfeilern und Kassettendecke.',
  },
  '-scene-documentation': {
    en: 'Suggested scene: neutral documentation lighting and environment for archival study.',
    pl: 'Sugerowana scena: neutralne oświetlenie dokumentacyjne do celów archiwalnych.',
    de: 'Vorgeschlagene Szene: neutrale Dokumentationsbeleuchtung für wissenschaftliche Studien.',
  },
  '-acoustics': {
    en: 'Model room acoustics: a temple bell toll reverberating in the timber structure.',
    pl: 'Akustyka modelu: uderzenie dzwonu świątynnego z pogłosem drewnianej konstrukcji.',
    de: 'Modellakustik: Klang einer Tempelglocke mit Nachhall in der Holzkonstruktion.',
  },
};

function variantFor(suffix, fallback) {
  const value = PAGODA_VARIANTS[suffix];
  return value ? { en: value[0], pl: value[1], de: value[2] } : fallback;
}

function summaryFor(suffix) {
  const s = PAGODA_SUMMARIES[suffix];
  if (s) return languageMap(s.en, s.pl, s.de);
  return languageMap(
    'The Pagoda shown with this viewer feature.',
    'Pagoda pokazana z użyciem wybranej funkcji przeglądarki.',
    'Die Pagode mit dieser Viewer-Funktion.',
  );
}

function page(manifest) {
  return manifest.items?.[0]?.annotations?.[0];
}

function tourAnnotation(id, labels, bodyTexts, point, view) {
  const scene = `${MODEL}/scene`;
  return {
    id: `${scene}/annotation/${id}`,
    type: 'Annotation',
    motivation: ['commenting'],
    label: languageMap(labels.en, labels.pl, labels.de),
    body: {
      type: 'Choice',
      items: [
        { type: 'TextualBody', value: bodyTexts.en, format: 'text/plain', language: ['en'] },
        { type: 'TextualBody', value: bodyTexts.pl, format: 'text/plain', language: ['pl'] },
        { type: 'TextualBody', value: bodyTexts.de, format: 'text/plain', language: ['de'] },
      ],
    },
    target: {
      type: 'SpecificResource',
      source: { id: scene, type: 'Scene' },
      selector: [{ type: 'PointSelector', x: point[0], y: point[1], z: point[2] }],
    },
    AIM3DViewer: {
      groupId: '',
      key: '',
      object: '',
      targetId: 'm0:root',
      point,
      view: view || { position: [20, 14, 24], target: [0, 10, 0], fov: 45 },
    },
  };
}

// An assessment as the viewer reads one (as the synagogue's): pinned to a
// face of a mesh (faceTarget, its face 0: where the badge sits) and painting
// paintTarget - the mesh, or the part (a group) it belongs to. A point
// annotation (PointSelector) carries no assessment.
function certaintyAnnotation(id, labels, bodyTexts, faceTarget, paintTarget, certaintyValue, certaintyCode) {
  const scene = `${MODEL}/scene`;
  return {
    id: `${scene}/annotation/${id}`,
    type: 'Annotation',
    motivation: ['commenting', 'assessing'],
    label: languageMap(labels.en, labels.pl, labels.de),
    body: {
      type: 'Choice',
      items: [
        { type: 'TextualBody', value: bodyTexts.en, format: 'text/plain', language: ['en'] },
        { type: 'TextualBody', value: bodyTexts.pl, format: 'text/plain', language: ['pl'] },
        { type: 'TextualBody', value: bodyTexts.de, format: 'text/plain', language: ['de'] },
      ],
    },
    target: { id: scene, type: 'Scene' },
    AIM3DViewer: {
      groupId: '',
      key: `${faceTarget}:0`,
      object: faceTarget,
      targetId: faceTarget,
      faceIndex: 0,
      faceNumbers: [0],
      certainty: { value: certaintyValue, code: certaintyCode, scope: 'object', targetId: paintTarget },
    },
  };
}

function getLights(suffix) {
  if (suffix === '-night-spotlights' || suffix === '-night-tour') {
    return [
      { type: 'AmbientLight', position: [0, 0, 0], color: '#1a2440', intensity: 0.18 },
      { type: 'DirectionalLight', position: [-18, 32, -24], target: [0, 10, 0], color: '#8fa8ff', intensity: 0.35 },
      { type: 'HemisphereLight', position: [0, 26, 0], color: '#22304f', groundColor: '#050608', intensity: 0.2 },
      { type: 'SpotLight', position: [18, 2, 18], target: [0, 11, 0], color: '#ffc27a', intensity: 4, distance: 0, decay: 0, angle: 0.48, penumbra: 0.6 },
      { type: 'SpotLight', position: [-18, 2, 18], target: [0, 11, 0], color: '#ffc27a', intensity: 4, distance: 0, decay: 0, angle: 0.48, penumbra: 0.6 },
      { type: 'SpotLight', position: [0, 4, -18], target: [0, 12, 0], color: '#ffb45c', intensity: 3, distance: 0, decay: 0, angle: 0.42, penumbra: 0.55 },
      { type: 'PointLight', position: [0, 8, 0], color: '#ff9b4a', intensity: 2, distance: 18, decay: 0 },
    ];
  }
  if (suffix === '-golden-hour') {
    return [
      { type: 'AmbientLight', position: [0, 0, 0], color: '#5a3a24', intensity: 0.5 },
      { type: 'DirectionalLight', position: [-25, 10, 20], target: [0, 9.5, 0], color: '#ffb36b', intensity: 2.8 },
      { type: 'HemisphereLight', position: [0, 25, 0], color: '#ffd9a8', groundColor: '#3b2414', intensity: 0.6 },
    ];
  }
  if (suffix === '-studio-agx') {
    return [
      { type: 'AmbientLight', position: [0, 0, 0], color: '#333333', intensity: 0.8 },
      { type: 'DirectionalLight', position: [25, 30, 25], target: [0, 9.5, 0], color: '#ffffff', intensity: 1.5 },
      { type: 'DirectionalLight', position: [-25, 20, 20], target: [0, 9.5, 0], color: '#90b0e0', intensity: 0.8 },
      { type: 'DirectionalLight', position: [0, 25, -30], target: [0, 9.5, 0], color: '#ffd0a0', intensity: 1.0 },
      { type: 'HemisphereLight', position: [0, 30, 0], color: '#e0e8f0', groundColor: '#404040', intensity: 0.5 },
    ];
  }
  if (suffix === '-overcast-lambert') {
    return [
      { type: 'AmbientLight', position: [0, 0, 0], color: '#708090', intensity: 1.1 },
      { type: 'DirectionalLight', position: [5, 35, 10], target: [0, 9.5, 0], color: '#d0d8e0', intensity: 0.9 },
      { type: 'HemisphereLight', position: [0, 30, 0], color: '#b0c0d0', groundColor: '#505860', intensity: 0.7 },
    ];
  }
  if (suffix === '-winter') {
    return [
      { type: 'AmbientLight', position: [0, 0, 0], color: '#455565', intensity: 0.9 },
      { type: 'DirectionalLight', position: [-20, 25, 20], target: [0, 9.5, 0], color: '#e0ecff', intensity: 1.4 },
      { type: 'HemisphereLight', position: [0, 25, 0], color: '#d0e0f8', groundColor: '#303848', intensity: 0.5 },
    ];
  }
  if (suffix === '-mist') {
    return [
      { type: 'AmbientLight', position: [0, 0, 0], color: '#555555', intensity: 1.0 },
      { type: 'DirectionalLight', position: [10, 25, 15], target: [0, 9.5, 0], color: '#eeddcc', intensity: 1.0 },
      { type: 'HemisphereLight', position: [0, 25, 0], color: '#ccddee', groundColor: '#444444', intensity: 0.6 },
    ];
  }
  return structuredClone(defaultLights);
}

function tailor(manifest, suffix) {
  manifest.id = `./examples/pagoda/Pagoda-progressive.glb/manifest${suffix}.json`;
  manifest.rights = 'https://creativecommons.org/publicdomain/zero/1.0/';
  delete manifest.requiredStatement;
  manifest.summary = summaryFor(suffix);
  const variant = variantFor(suffix, { en: 'Viewer feature', pl: 'Funkcja przeglądarki', de: 'Viewer-Funktion' });
  manifest.label = languageMap(
    `Pagoda — ${variant.en} (AIM3D, localhost)`,
    `Pagoda — ${variant.pl} (AIM3D, localhost)`,
    `Pagode — ${variant.de} (AIM3D, localhost)`,
  );
  manifest.items[0].spatialScale = { type: 'Quantity', quantityValue: 1, unit: 'm' };
  manifest.items[0].label = { en: ['Pagoda'] };
  manifest.AIM3DViewer.camera = structuredClone(camera);
  manifest.AIM3DViewer.lights = getLights(suffix);
  manifest.AIM3DViewer.generatedAt = '2026-11-20T00:00:00.000Z';
  manifest.AIM3DViewer.metadata = METADATA;
  manifest.modified = '2026-11-20T00:00:00.000Z';

  if (manifest.AIM3DViewer.location) {
    manifest.AIM3DViewer.location = { latitude: 34.68, longitude: 135.83, north: 0, utcOffset: 9 };
  }
  if (manifest.AIM3DViewer.surroundings) {
    Object.assign(manifest.AIM3DViewer.surroundings, {
      kind: 'monastery', region: 'japanese', masonry: 'stone', seed: 7,
      latitude: 34.68, longitude: 135.83,
    });
  }
  if (manifest.AIM3DViewer.sceneSuggest) {
    if (!manifest.AIM3DViewer.location) {
      manifest.AIM3DViewer.location = { latitude: 34.68, longitude: 135.83, north: 0, utcOffset: 9 };
    }
  }
  if (suffix === '-scene-interior') {
    manifest.AIM3DViewer.camera = {
      position: [0, 2.0, 2.2], target: [0, 2.1, 0], up: [0, 1, 0], fov: 60,
      zoom: 1, distance: 2.2, perspectiveMode: 'perspective', aspect: 1.7277,
      orientation: 'landscape',
    };
    manifest.AIM3DViewer.sceneSuggest = { open: true, purpose: 'presentation' };
  }
  if (suffix === '-scene-documentation') {
    manifest.AIM3DViewer.sceneSuggest = { open: true, purpose: 'documentation' };
  }
  if (suffix === '-scene-place') {
    manifest.AIM3DViewer.sceneSuggest = { open: true, purpose: 'presentation' };
  }
  if (suffix === '-ceiling') {
    manifest.AIM3DViewer.camera = { ...camera, position: [0, 34, 0.01], target: [0, 9, 0], up: [0, 0, -1], distance: 25 };
  }
  if (suffix === '-measured') {
    manifest.AIM3DViewer.measurements = [
      { mode: 'distance', points: [[7, 0, 0], [7, 20.5, 0]] },
      { mode: 'distance', points: [[-5.4, 1.1, 0], [5.4, 1.1, 0]] },
      { mode: 'distance', points: [[0, 1.1, -5.4], [0, 1.1, 5.4]] },
      { mode: 'angle', points: [[-6.1, 4.5, 0], [0, 6.0, 0], [6.1, 4.5, 0]] },
      { mode: 'area', points: [[-5.4, 0, -5.4], [5.4, 0, -5.4], [5.4, 0, 5.4], [-5.4, 0, 5.4]] },
    ];
  }
  if (suffix === '-section-measured') {
    manifest.AIM3DViewer.camera = { ...camera, position: [26, 9.5, 0], target: [0, 9.5, 0], fov: 45 };
    manifest.AIM3DViewer.viewer.clipping = {
      mode: { x: true, y: false, z: false },
      negated: { x: false, y: false, z: false },
      constants: [0, 0, 0],
      outlineVisible: true,
    };
    manifest.AIM3DViewer.measurements = [
      { mode: 'distance', points: [[0, 0, 0], [0, 20.5, 0]] },
      { mode: 'distance', points: [[0, 1.1, -5.4], [0, 1.1, 5.4]] },
      { mode: 'distance', points: [[0, 4.3, -3.2], [0, 4.3, 3.2]] },
      { mode: 'distance', points: [[0, 5.8, -6.1], [0, 5.8, 6.1]] },
      { mode: 'angle', points: [[0, 13.5, 6.0], [0, 15.5, 0], [0, 13.5, -6.0]] },
    ];
  }
  if (suffix === '-acoustics') {
    if (manifest.AIM3DViewer.viewer) {
      delete manifest.AIM3DViewer.viewer.clipping;
    }
    manifest.AIM3DViewer.sounds = {
      autoplay: true,
      sources: [
        {
          id: 'bell',
          type: 'point',
          src: './examples/tempietto/sound/bell.ogg',
          label: 'Temple bell toll in the pagoda precinct',
          position: [0, 4.0, 0],
          distance: 35,
          volume: 0.9,
        },
      ],
      acoustics: {
        on: true,
        position: [0, 2.0, 0],
        material: 'wood',
        // The floors as the walls, wood (FLOOR_COVERS in room-acoustics.js).
        floor: 'material',
      },
    };
  }

  const annotations = page(manifest);
  // Targets: the model's scene, its root node (0), then the part's index
  // under it - 0 Platform, 1 Storey 1, 2 Roof 1 ... 6 Roof 3, 7 Interior,
  // 8 Finial (the order scripts/pagoda/pagoda.mjs builds them in).
  if (annotations && suffix === '-certainty') {
    annotations.items = [
      certaintyAnnotation(
        'certainty-platform',
        { en: 'Stone platform', pl: 'Kamienny podest', de: 'Steinplattform' },
        {
          en: 'High certainty (A): the platform dimensions follow the square plan layout.',
          pl: 'Wysoki poziom pewności (A): wymiary podestu wynikają z regularnego rzutu kwadratowego.',
          de: 'Hohe Gewissheit (A): Die Maße der Plattform folgen dem quadratischen Grundriss.',
        },
        'm0:0.0', 'm0:0.0', 10, 'A',
      ),
      certaintyAnnotation(
        'certainty-structure',
        { en: 'Storey structure', pl: 'Konstrukcja kondygnacji', de: 'Geschosskonstruktion' },
        {
          en: 'Firm certainty (B): pillar layout and bracket spacing (tokyō) correspond to classical proportions.',
          pl: 'Pewna ocena (B): układ słupów i rozstaw wsporników (tokyō) odpowiadają klasycznym proporcjom.',
          de: 'Gute Gewissheit (B): Pfeileranordnung und Kragträgerabstände (Tokyō) entsprechen klassischen Proportionen.',
        },
        'm0:0.1.0', 'm0:0.1', 8, 'B',
      ),
      certaintyAnnotation(
        'certainty-roof',
        { en: 'Upper roof', pl: 'Górny dach', de: 'Oberes Dach' },
        {
          en: 'Interpretative certainty (C): hip roof curvature and tile course rhythm.',
          pl: 'Ocena interpretacyjna (C): krzywizna połaci dachu czterospadowego i rytm ceramicznych dachówek.',
          de: 'Interpretierende Gewissheit (C): Krümmung des Walmdachs und Rhythmus der Ziegelreihen.',
        },
        'm0:0.6.0', 'm0:0.6', 6, 'C',
      ),
      certaintyAnnotation(
        'certainty-finial',
        { en: 'Finial (sōrin)', pl: 'Zwieńczenie sōrin', de: 'Bekrönung (Sōrin)' },
        {
          en: 'Conjectural (D): bronze finial decorative details and sacred jewel form.',
          pl: 'Ocena hipotetyczna (D): detale dekoracyjne brązowej iglicy i forma świętego klejnotu.',
          de: 'Hypothetisch (D): Dekorative Details der Bronze-Spitze und Form des heiligen Juwels.',
        },
        'm0:0.8', 'm0:0.8', 4, 'D',
      ),
    ];
  }
  if (annotations && suffix === '-night-tour') {
    annotations.items = [
      tourAnnotation(
        'tour-platform',
        { en: 'Stone platform', pl: 'Kamienny podest', de: 'Steinplattform' },
        {
          en: 'Stone platform with steps on four sides, elevating the wooden pagoda above the temple precinct.',
          pl: 'Kamienny podest ze schodami z czterech stron, unoszący drewnianą pagodę ponad dziedziniec świątynny.',
          de: 'Steinplattform mit Stufen auf vier Seiten, die die Holzpagode über den Tempelbezirk anhebt.',
        },
        [0, 0.5, 6], { position: [18, 8, 23], target: [0, 2, 0], fov: 45 },
      ),
      tourAnnotation(
        'tour-entrance',
        { en: 'Entrance', pl: 'Wejście', de: 'Eingang' },
        {
          en: 'Studded double doors with bronze hardware in the middle bay of the ground storey.',
          pl: 'Dwuskrzydłowe drzwi z ćwiekami i okuciami z brązu w środkowym przęśle parteru.',
          de: 'Beschlagene zweiflügelige Holztüren mit Bronzebeschlägen im mittleren Joch des Erdgeschosses.',
        },
        [0, 2, 6], { position: [14, 5, 19], target: [0, 3, 2], fov: 42 },
      ),
      tourAnnotation(
        'tour-brackets',
        { en: 'Bracket sets (tokyō)', pl: 'Zespoły wsporników (tokyō)', de: 'Kragträgersätze (Tokyō)' },
        {
          en: 'Three-step bracket complexes (mutesaki tokyō) transferring the weight of the deep tiled eaves to the pillars.',
          pl: 'Trzystopniowe zespoły wspornikowe (mutesaki tokyō) przenoszące ciężar wysuniętych dachów na słupy nośne.',
          de: 'Dreistufige Kragträgergefüge (Mutesaki Tokyō), die die Last der weit ausladenden Ziegeldächer auf die Pfeiler leiten.',
        },
        [0, 4.5, 3.4], { position: [13, 8, 16], target: [0, 5, 2], fov: 40 },
      ),
      tourAnnotation(
        'tour-roof',
        { en: 'Tiered roofs', pl: 'Dachy kondygnacji', de: 'Geschossdächer' },
        {
          en: 'Three tiers of curved hip roofs covered with traditional round and flat ceramic tiles (kawara).',
          pl: 'Trzy kondygnacje wygiętych dachów krytych tradycyjną ceramiczną dachówką (kawara).',
          de: 'Drei Geschosse geschwungener Walmdächer, gedeckt mit traditionellen Ziegeln (Kawara).',
        },
        [0, 12, 0], { position: [22, 15, 22], target: [0, 11, 0], fov: 45 },
      ),
      tourAnnotation(
        'tour-finial',
        { en: 'Finial (sōrin)', pl: 'Zwieńczenie sōrin', de: 'Bekrönung (Sōrin)' },
        {
          en: 'Bronze spire with dew basin, inverted bowl, nine sacred rings, water flames and jewel (hōju).',
          pl: 'Brązowa iglica z misą rosy, odwróconą czarą, dziewięcioma pierścieniami, płomieniem wody i klejnotem hōju.',
          de: 'Bronzene Spitze mit Tauschale, umgedrehter Schale, neun Ringen, Wasserflammen und Juwel (Hōju).',
        },
        [0, 20, 0], { position: [14, 22, 18], target: [0, 18, 0], fov: 38 },
      ),
    ];
  }
}

// The metadata manifest every Pagoda manifest links to
// (viewer/manifesto/manifest-metadata.js). All of it is invented - the
// pagoda is the project's own model - and says so (synthetic).
const L = languageMap;
const pair = (label, value) => ({ label: L(...label), value: L(...value) });
const metadataManifest = {
  '@context': 'http://iiif.io/api/presentation/4/context.json',
  id: './examples/pagoda/metadata.json',
  type: 'AIM3DMetadata',
  version: '1.0',
  synthetic: {
    note: L(
      'Synthetic example data: the pagoda, its history, place and dates are invented to show what the viewer can display. Nothing here describes a real building.',
      'Dane syntetyczne: pagoda, jej historia, miejsce i daty są wymyślone, aby pokazać możliwości przeglądarki. Nic tu nie opisuje rzeczywistego budynku.',
      'Synthetische Beispieldaten: Die Pagode, ihre Geschichte, ihr Ort und ihre Daten sind erfunden, um zu zeigen, was der Viewer darstellen kann. Nichts davon beschreibt ein reales Gebäude.',
    ),
  },
  label: L('Pagoda (synthetic example)', 'Pagoda (przykład syntetyczny)', 'Pagode (synthetisches Beispiel)'),
  summary: L(
    'A three-storey timber pagoda in the Japanese manner on a stone platform, crowned by a bronze finial. A procedurally generated model, the project\'s own showcase.',
    'Trzykondygnacyjna drewniana pagoda w stylu japońskim na kamiennym podeście, zwieńczona brązową iglicą. Model wygenerowany proceduralnie, własny model pokazowy projektu.',
    'Eine dreigeschossige Holzpagode im japanischen Stil auf einer Steinplattform, bekrönt von einer Bronzespitze. Ein prozedural erzeugtes Modell, das eigene Vorzeigemodell des Projekts.',
  ),
  metadata: [
    pair(['Data status', 'Status danych', 'Datenstatus'],
      ['Synthetic - invented for demonstration', 'Syntetyczne - wymyślone do celów pokazowych', 'Synthetisch - zu Demonstrationszwecken erfunden']),
    pair(['Object type', 'Typ obiektu', 'Objekttyp'],
      ['Building: three-storey pagoda (sanjū-no-tō)', 'Budynek: pagoda trzykondygnacyjna (sanjū-no-tō)', 'Gebäude: dreigeschossige Pagode (Sanjū-no-tō)']),
    pair(['Style', 'Styl', 'Stil'],
      ['Japanese Buddhist temple architecture, early Edo manner', 'Japońska buddyjska architektura świątynna, styl wczesnego okresu Edo', 'Japanische buddhistische Tempelarchitektur, frühe Edo-Zeit']),
    pair(['Place (fictional)', 'Miejsce (fikcyjne)', 'Ort (fiktiv)'],
      ['A temple precinct, placed at 34.68° N, 135.83° E for the sun and surroundings', 'Zespół świątynny, umieszczony na 34,68° N, 135,83° E dla słońca i otoczenia', 'Ein Tempelbezirk, für Sonne und Umgebung bei 34,68° N, 135,83° O verortet']),
    pair(['Dating (fictional)', 'Datowanie (fikcyjne)', 'Datierung (fiktiv)'],
      ['Built c. 1615; repaired 1702 and 1830; restored 1897 and 1952', 'Zbudowana ok. 1615; remonty 1702 i 1830; restauracje 1897 i 1952', 'Erbaut um 1615; instandgesetzt 1702 und 1830; restauriert 1897 und 1952']),
    pair(['Dimensions', 'Wymiary', 'Abmessungen'],
      ['Height 20.5 m; platform 10.8 × 10.8 × 1.1 m; ground storey 6.4 × 6.4 m', 'Wysokość 20,5 m; podest 10,8 × 10,8 × 1,1 m; parter 6,4 × 6,4 m', 'Höhe 20,5 m; Plattform 10,8 × 10,8 × 1,1 m; Erdgeschoss 6,4 × 6,4 m']),
    pair(['Structure', 'Konstrukcja', 'Konstruktion'],
      ['Three storeys, each with a curved hip roof on three-step bracket sets (mitesaki tokyō); central pillar (shinbashira)', 'Trzy kondygnacje, każda z wygiętym dachem czterospadowym na trzystopniowych wspornikach (mitesaki tokyō); słup centralny (shinbashira)', 'Drei Geschosse, jedes mit geschwungenem Walmdach auf dreistufigen Kragträgern (Mitesaki Tokyō); Mittelpfeiler (Shinbashira)']),
    pair(['Materials', 'Materiały', 'Materialien'],
      ['Hinoki timber with vermilion paint, lime plaster, ceramic roof tiles (kawara), granite platform, bronze finial; lacquered, gilded and painted interior', 'Drewno hinoki malowane cynobrem, tynk wapienny, dachówka ceramiczna (kawara), granitowy podest, brązowa iglica; wnętrze lakierowane, złocone i malowane', 'Hinoki-Holz mit Zinnoberanstrich, Kalkputz, Keramikziegel (Kawara), Granitplattform, Bronzespitze; lackiertes, vergoldetes und bemaltes Inneres']),
    pair(['Creator', 'Twórca', 'Urheber'],
      ['ExPlora4D project (synthetic author)', 'Projekt ExPlora4D (autor syntetyczny)', 'Projekt ExPlora4D (synthetischer Urheber)']),
    pair(['Creation method', 'Metoda wykonania', 'Erstellungsmethode'],
      ['Procedural modelling of geometry and textures; no survey, scan or photographs', 'Proceduralne modelowanie geometrii i tekstur; bez pomiarów, skanów i zdjęć', 'Prozedurale Modellierung von Geometrie und Texturen; ohne Aufmaß, Scan oder Fotos']),
    pair(['Software', 'Oprogramowanie', 'Software'],
      ['Node.js, glTF Transform, meshoptimizer (gltfpack), sharp', 'Node.js, glTF Transform, meshoptimizer (gltfpack), sharp', 'Node.js, glTF Transform, meshoptimizer (gltfpack), sharp']),
    pair(['File format', 'Format pliku', 'Dateiformat'],
      ['glTF 2.0 binary (GLB), Meshopt compression, KTX2 textures, low-detail preview', 'glTF 2.0 binarny (GLB), kompresja Meshopt, tekstury KTX2, podgląd o niskiej szczegółowości', 'glTF 2.0 binär (GLB), Meshopt-Kompression, KTX2-Texturen, Vorschau mit geringer Detailstufe']),
    pair(['Model unit', 'Jednostka modelu', 'Modelleinheit'],
      ['metre (1 unit = 1 m), Y up', 'metr (1 jednostka = 1 m), oś Y w górę', 'Meter (1 Einheit = 1 m), Y nach oben']),
    pair(['Textures', 'Tekstury', 'Texturen'],
      ['11 materials, 2048 px, generated; weathering stages for 4D', '11 materiałów, 2048 px, generowane; etapy starzenia dla 4D', '11 Materialien, 2048 px, generiert; Alterungsstufen für 4D']),
    pair(['4D stages', 'Etapy 4D', '4D-Stadien'],
      ['1615-2025: construction, weathering, repairs and restorations', '1615-2025: budowa, starzenie, remonty i restauracje', '1615-2025: Bau, Verwitterung, Instandsetzungen und Restaurierungen']),
    pair(['Certainty (paradata)', 'Pewność (paradane)', 'Gewissheit (Paradaten)'],
      ['Level of Certainty A-D: platform A, storey structure B, upper roof C, finial D', 'Poziom pewności A-D: podest A, konstrukcja kondygnacji B, górny dach C, iglica D', 'Grad der Gewissheit A-D: Plattform A, Geschosskonstruktion B, oberes Dach C, Spitze D']),
    pair(['Sources', 'Źródła', 'Quellen'],
      ['None - general knowledge of the building type only', 'Brak - wyłącznie ogólna wiedza o typie budowli', 'Keine - nur allgemeines Wissen über den Bautyp']),
    pair(['Keywords', 'Słowa kluczowe', 'Schlagwörter'],
      ['pagoda; Buddhist architecture; timber construction; Japan; 3D reconstruction; synthetic data', 'pagoda; architektura buddyjska; konstrukcja drewniana; Japonia; rekonstrukcja 3D; dane syntetyczne', 'Pagode; buddhistische Architektur; Holzbau; Japan; 3D-Rekonstruktion; synthetische Daten']),
    pair(['Identifier', 'Identyfikator', 'Kennung'],
      ['urn:explora4d:example:pagoda', 'urn:explora4d:example:pagoda', 'urn:explora4d:example:pagoda']),
    pair(['Model created', 'Model utworzony', 'Modell erstellt'],
      ['2026-11-19', '2026-11-19', '2026-11-19']),
  ],
  requiredStatement: pair(
    ['Attribution', 'Uznanie autorstwa', 'Namensnennung'],
    ['Pagoda - synthetic example model of the ExPlora4D viewer (CC0)', 'Pagoda - syntetyczny model przykładowy przeglądarki ExPlora4D (CC0)', 'Pagode - synthetisches Beispielmodell des ExPlora4D-Viewers (CC0)'],
  ),
  rights: 'https://creativecommons.org/publicdomain/zero/1.0/',
  provider: [
    {
      id: 'https://explora4d.eu/',
      type: 'Agent',
      label: L('ExPlora4D', 'ExPlora4D', 'ExPlora4D'),
      homepage: [{ id: 'https://explora4d.eu/', type: 'Text', format: 'text/html', label: L('ExPlora4D', 'ExPlora4D', 'ExPlora4D') }],
    },
  ],
  navDate: '1615-01-01T00:00:00Z',
};
fs.writeFileSync(path.join('viewer', METADATA.replace(/^\.\//, '')), `${JSON.stringify(metadataManifest, null, 2)}\n`);

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
    const name = Object.fromEntries(
      Object.entries(variant).map(([lang, value]) => {
        const str = Array.isArray(value) ? value[0] : value;
        return [lang, `Pagoda — ${str} (localhost)`];
      }),
    );
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

console.log(`Generated ${wolpaFiles.length - 2} Pagoda manifests and updated example-list entries.`);

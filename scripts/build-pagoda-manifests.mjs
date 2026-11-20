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

function certaintyAnnotation(id, labels, bodyTexts, point, targetId, certaintyValue, certaintyCode) {
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
    target: {
      type: 'SpecificResource',
      source: { id: scene, type: 'Scene' },
      selector: [{ type: 'PointSelector', x: point[0], y: point[1], z: point[2] }],
    },
    AIM3DViewer: {
      groupId: '',
      key: '',
      object: targetId,
      targetId,
      point,
      certainty: { value: certaintyValue, code: certaintyCode, scope: 'object', targetId },
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
        floor: 'wood',
      },
    };
  }

  const annotations = page(manifest);
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
        [0, 0.5, 5.5], 'm0:0', 9, 'A',
      ),
      certaintyAnnotation(
        'certainty-structure',
        { en: 'Storey structure', pl: 'Konstrukcja kondygnacji', de: 'Geschosskonstruktion' },
        {
          en: 'Firm certainty (B): pillar layout and bracket spacing (tokyō) correspond to classical proportions.',
          pl: 'Pewna ocena (B): układ słupów i rozstaw wsporników (tokyō) odpowiadają klasycznym proporcjom.',
          de: 'Gute Gewissheit (B): Pfeileranordnung und Kragträgerabstände (Tokyō) entsprechen klassischen Proportionen.',
        },
        [0, 4.5, 3.4], 'm0:1', 8, 'B',
      ),
      certaintyAnnotation(
        'certainty-roof',
        { en: 'Upper roof', pl: 'Górny dach', de: 'Oberes Dach' },
        {
          en: 'Interpretative certainty (C): hip roof curvature and tile course rhythm.',
          pl: 'Ocena interpretacyjna (C): krzywizna połaci dachu czterospadowego i rytm ceramicznych dachówek.',
          de: 'Interpretierende Gewissheit (C): Krümmung des Walmdachs und Rhythmus der Ziegelreihen.',
        },
        [0, 17.0, 0], 'm0:6', 7, 'C',
      ),
      certaintyAnnotation(
        'certainty-finial',
        { en: 'Finial (sōrin)', pl: 'Zwieńczenie sōrin', de: 'Bekrönung (Sōrin)' },
        {
          en: 'Conjectural (D): bronze finial decorative details and sacred jewel form.',
          pl: 'Ocena hipotetyczna (D): detale dekoracyjne brązowej iglicy i forma świętego klejnotu.',
          de: 'Hypothetisch (D): Dekorative Details der Bronze-Spitze und Form des heiligen Juwels.',
        },
        [0, 19.5, 0], 'm0:8', 6, 'D',
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

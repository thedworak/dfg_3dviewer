// Suggested scene (Look > Suggested scene): the rules that pick a lighting,
// a weather and a rendering for a model from what is known of it. Pure: no
// three.js, no viewer; editor/scene-suggest.js gathers the facts from the
// loaded model and applies what the user accepts.
//
// The facts (all optional):
//   kind          "mesh" | "pointcloud" | "splats"
//   ifc           a building model (IFC)
//   size          { x, y, z } of the model's bounding box, in metres
//   unitSource    where the unit came from ("user", "manifest", "file",
//                 "config", "default": unknown)
//   textured, vertexColors, normals, unlit, triangles, materials
//   phone         a phone (coarse pointer): lighter settings
//   location      { latitude, longitude, source }: "manifest" (set
//                 already), or "geonames" (a place named in the texts,
//                 with name, country and confidence; worker/geonames.py)
//   timelineYear  the year the 4D timeline shows (the sun follows it)
//   text          file name, metadata, manifest texts (one string)
//   shape         the geometry's measures (editor/scene-shape.js): { up,
//                 down, sideways (shares of the surface), groundCover (of
//                 the footprint, by upward faces near the bottom),
//                 enclosure (share of rays from inside meeting walls
//                 turned towards them), shell, rays }
//   cameraInside  whether the camera stands inside the model's box: true,
//                 false (a manifest's camera outside it) or unknown
//   semantic      what a language model read in the texts (editor/
//                 scene-semantic.js): { model, setting: { outdoor, indoor,
//                 studio }, purpose: { documentation, presentation },
//                 relief } as probabilities; it weighs less than words
//                 found, and fills in where there are none
//   current       { sun, weather, rakingLight, toneMapping, ao }: what is on
//
// The rules decide first what the scene is for - documentation (neutral,
// even light that hides nothing; raking light for relief) or presentation
// (the sun where and when the object stood, the sky, a weather) - then
// where it is: outdoors, indoors or an object on its own ("studio"). Each
// suggestion has a confidence and the reasons it rests on; the viewer
// preselects only the confident ones that change something.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Lower case, without diacritics (ß as ss), so "Wnętrze" matches "wnetrz".
export function normalizeSceneText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Stems (English, Polish, German), matched at the start of a word; `=word`
// only as a whole word (short ones that are parts of other words).
const KEYWORDS = {
  indoor: ["interior", "indoor", "inside", "crypt", "krypt", "wnetrz", "komnat", "innenraum", "innenansicht", "gruft", "=room", "=pokoj", "=sala", "=nave"],
  object: [
    "coin", "monet", "munze", "statue", "statu", "rzezb", "skulptur", "sculpt", "vase", "wazon", "=waza", "figurin", "figurk", "bust", "popiersi",
    "pottery", "ceramic", "ceramik", "amphor", "amfor", "skull", "czaszk", "schadel", "artefact", "artifact", "artefakt", "sarcophag", "sarkofag",
    "jewel", "bizuteri", "schmuck", "fibul", "brooch", "zabytek ruchomy", "find", "znalezisk", "fundstuck", "tablet", "tabliczk", "stele", "stela",
    "seal", "pieczec", "siegel", "sword", "miecz", "schwert", "helmet", "helm", "vessel", "naczyni", "gefass", "urn",
  ],
  building: [
    "building", "budyn", "gebaude", "castle", "zamek", "zamk", "=burg", "church", "kosciol", "kosciel", "kirche", "cathedral", "katedr", "kathedral",
    "=dom", "tower", "wieza", "wiez", "=turm", "palace", "palac", "palast", "schloss", "=house", "=haus", "villa", "monaster", "klasztor", "kloster",
    "bridge", "brucke", "ruin", "fortress", "fortyfik", "twierdz", "festung", "=mury", "stadtmauer", "gate", "brama", "temple", "swiatyni", "tempel",
    "settlement", "osad", "siedlung", "street", "ulic", "strasse", "square", "rynek", "marktplatz", "=town", "=city", "miasto", "miast", "=stadt",
    "village", "=dorf", "excavation", "wykopalisk", "grabung", "landscape", "krajobraz", "landschaft", "terrain", "=teren", "gelande", "garden",
    "ogrod", "garten", "mill", "mlyn", "muhle", "synagog", "mosque", "meczet", "moschee", "chapel", "kaplic", "kapelle", "manor", "dwor", "gutshaus",
    "barn", "stodol", "scheune", "lighthouse", "latarni", "leuchtturm", "amphithea", "amfitea", "facade", "fasad", "fassade", "roof", "=dach", "dachu",
  ],
  relief: [
    "inscription", "inskrypc", "napis", "inschrift", "relief", "plaskorzezb", "petroglyph", "graffit", "carving", "engrav", "grawer", "gravur",
    "tool mark", "slady obrobki", "bearbeitungsspur", "epigraph", "cuneiform", "keilschrift", "pismo klinowe", "ornament", "coin", "monet", "munze",
    "seal", "pieczec", "siegel", "stele", "stela", "tablet", "tabliczk",
  ],
  documentation: [
    "documentation", "dokumentac", "dokumentation", "=scan", "scanned", "skan", "photogrammetr", "fotogrametr", "photogrammetrie", "survey",
    "inwentaryzac", "pomiar", "bauaufnahme", "aufmass", "laser", "lidar", "=record",
  ],
  presentation: [
    "reconstruction", "rekonstrukc", "rekonstruktion", "visualis", "visualiz", "wizualizac", "visualisierung", "presentation", "prezentac",
    "prasentation", "exhibition", "wystaw", "ausstellung", "hypothes", "hipotez", "hypothese",
  ],
  fog: ["=fog", "foggy", "mist", "=mgla", "=mgle", "mglist", "nebel", "neblig", "dunst"],
  rain: ["=rain", "rainy", "deszcz", "=regen", "regnerisch"],
  snow: ["=snow", "snowy", "snieg", "sniez", "schnee", "verschneit"],
  storm: ["storm", "thunder", "=burza", "=burzy", "burzow", "gewitter", "=sturm"],
  winter: ["winter", "=zima", "=zimie", "zimow"],
  spring: ["spring", "wiosn", "fruhling", "fruhjahr"],
  summer: ["summer", "=latem", "letni", "sommer"],
  autumn: ["autumn", "jesien", "herbst"],
  dawn: ["dawn", "sunrise", "=swit", "o swicie", "wschod slonca", "sonnenaufgang", "morning", "=rano", "=morgen"],
  dusk: ["sunset", "dusk", "evening", "zachod slonca", "zmierzch", "wieczor", "sonnenuntergang", "=abend", "dammerung"],
  noon: ["=noon", "midday", "poludni", "=mittag"],
};

function keywordPattern(entry) {
  const whole = entry.startsWith("=");
  const word = (whole ? entry.slice(1) : entry).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${word}${whole ? "(?![a-z0-9])" : ""}`);
}

const PATTERNS = Object.fromEntries(Object.entries(KEYWORDS).map(([group, words]) => [
  group,
  words.map((word) => ({ word: word.replace(/^=/, ""), pattern: keywordPattern(word) })),
]));

// The words of each group found in the text.
export function findSceneKeywords(text) {
  const normalized = normalizeSceneText(text);
  const found = {};
  Object.entries(PATTERNS).forEach(([group, entries]) => {
    const words = entries.filter(({ pattern }) => pattern.test(normalized)).map(({ word }) => word);
    if (words.length) found[group] = words;
  });
  return found;
}

const ROMAN = { i: 1, v: 5, x: 10, l: 50, c: 100 };

function romanToNumber(roman) {
  let total = 0;
  const letters = roman.toLowerCase().split("");
  letters.forEach((letter, index) => {
    const value = ROMAN[letter];
    const next = ROMAN[letters[index + 1]] || 0;
    total += value < next ? -value : value;
  });
  return total;
}

// Years after this are taken as when the model was made or scanned (a
// record's dates), not as the object's own.
const RECORD_YEARS_FROM = 1990;

// The object's year from the text: the earliest year (1000-1989) or the
// middle of the earliest century ("XIV w.", "14th century", "14. Jh.").
export function findSceneYear(text) {
  const normalized = normalizeSceneText(text);
  const candidates = [];
  for (const match of normalized.matchAll(/(^|[^0-9.,:/x×-])(1[0-9]{3})(?![0-9])(?!\s*(?:x|×|mm|cm|m\b|px|kb|mb))/g)) {
    const year = Number(match[2]);
    if (year < RECORD_YEARS_FROM) candidates.push({ year, kind: "year" });
  }
  const century = (number) => (number >= 1 && number <= 21 ? (number - 1) * 100 + 50 : null);
  for (const match of normalized.matchAll(/(^|[^a-z])([ivxlc]{1,6})\s*(?:w\.|wiek|wieku|century|jh\.?|jahrhundert)/g)) {
    const year = century(romanToNumber(match[2]));
    if (year != null) candidates.push({ year, kind: "century" });
  }
  for (const match of normalized.matchAll(/(^|[^0-9])([0-9]{1,2})(?:st|nd|rd|th|\.)?\s*(?:w\.|wiek|wieku|century|jh\.?|jahrhundert)/g)) {
    const year = century(Number(match[2]));
    if (year != null) candidates.push({ year, kind: "century" });
  }
  if (!candidates.length) return null;
  return candidates.reduce((earliest, candidate) => (candidate.year < earliest.year ? candidate : earliest));
}

// Coordinates written in the text: "50.0614, 19.9366", "50.06° N 19.93° E".
// Without degrees or N/E, both need 3 decimals (not a version or a size).
export function findSceneCoordinates(text) {
  const pattern = /(^|[^\w.])(-?\d{1,2}\.(\d{2,}))\s*(°)?\s*([ns])?\s*[,; ]\s*(-?\d{1,3}\.(\d{2,}))\s*(°)?\s*([ew])?(?![\w.])/gi;
  for (const match of String(text || "").matchAll(pattern)) {
    const marked = match[4] || match[5] || match[8] || match[9];
    if (!marked && (match[3].length < 3 || match[7].length < 3)) continue;
    let latitude = Number(match[2]);
    let longitude = Number(match[6]);
    if (match[5]?.toLowerCase() === "s") latitude = -Math.abs(latitude);
    if (match[9]?.toLowerCase() === "w") longitude = -Math.abs(longitude);
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && !(latitude === 0 && longitude === 0)) {
      return { latitude, longitude };
    }
  }
  return null;
}

// The size class of the largest side, in metres.
export function sizeClass(size) {
  const largest = size ? Math.max(Number(size.x) || 0, Number(size.y) || 0, Number(size.z) || 0) : 0;
  if (!(largest > 0)) return null;
  if (largest < 0.6) return "object";
  if (largest < 4) return "large-object";
  if (largest < 600) return "building";
  return "site";
}

// Shading in the textures or colours already (photogrammetry, scans): the
// light baked in, which a strong sun and ambient occlusion only double.
function isScanLike(facts) {
  if (facts.kind === "splats") return true;
  if (facts.kind !== "mesh") return false;
  const triangles = Number(facts.triangles) || 0;
  return triangles > 100000 && (facts.textured === true || facts.vertexColors === true) && (Number(facts.materials) || 0) <= 4;
}

// The proportions of the box (x, z across, y up): flat (a terrain, an
// excavation), and thin (a plate, a tablet, a coin - lying or standing).
export function sceneProportions(size) {
  const x = Number(size?.x) || 0;
  const y = Number(size?.y) || 0;
  const z = Number(size?.z) || 0;
  const across = Math.max(x, z);
  const sides = [x, y, z].sort((a, b) => a - b);
  if (!(across > 0) || !(sides[2] > 0)) return null;
  return {
    flatness: y / across,
    thinness: sides[0] / sides[2],
  };
}

// Where the model is: outdoors, indoors or an object on its own.
function decideSetting(facts, keywords, size) {
  const unitKnown = facts.unitSource && facts.unitSource !== "default";
  const scores = { outdoor: 0, indoor: 0, studio: 0 };
  const reasons = { outdoor: [], indoor: [], studio: [] };
  const add = (setting, score, reason) => {
    scores[setting] += score;
    reasons[setting].push(reason);
  };
  // The inside of a building: the building's words and size count for it
  // when the texts say so, or when there are walls all round and the camera
  // stands among them. Walls all round seen from outside are a building
  // with its interior modelled (the camera of a manifest outside the box);
  // with the camera unknown (the viewer's own framing) they count, but not
  // against a building's name.
  const shape = facts.shape;
  const walls = Number.isFinite(shape?.enclosure) && shape.enclosure >= 0.7;
  const enclosed = walls && facts.cameraInside !== false;
  const built = keywords.indoor || (enclosed && (facts.cameraInside === true || !keywords.building)) ? "indoor" : "outdoor";
  if (keywords.indoor) add("indoor", 0.9, { key: "keywords", words: keywords.indoor });
  if (keywords.building) add(built, 0.5, { key: "keywords", words: keywords.building });
  if (keywords.object) add("studio", 0.5, { key: "keywords", words: keywords.object });
  if (facts.ifc) add(built, 0.3, { key: "ifc" });
  if (size === "object" || size === "large-object") add("studio", unitKnown ? 0.35 : 0.2, { key: "size", size });
  if (size === "building" || size === "site") add(built, unitKnown ? 0.35 : 0.2, { key: "size", size });
  // The geometry: walls around the inside, a ceiling over a floor, an open
  // ground, a flat site.
  if (shape) {
    const percent = (value) => Math.round(value * 100);
    if (enclosed) {
      add("indoor", 0.55, { key: "enclosed", percent: percent(shape.enclosure) });
    } else if (shape.down >= 0.12 && shape.groundCover >= 0.4 && facts.cameraInside !== false) {
      add("indoor", 0.2, { key: "ceiling", percent: percent(shape.down) });
    } else if (shape.groundCover >= 0.5 && shape.down < 0.05 && !(shape.enclosure >= 0.5)) {
      add("outdoor", 0.25, { key: "ground", percent: percent(shape.groundCover) });
    }
  }
  const proportions = sceneProportions(facts.size);
  if (proportions && proportions.flatness < 0.15 && (size === "building" || size === "site")) {
    add("outdoor", 0.2, { key: "flat" });
  }
  // What the language model read: its most likely setting, when it is
  // fairly sure.
  const semantic = topClass(facts.semantic?.setting);
  if (semantic && semantic.p >= 0.5) add(semantic.key, 0.6 * semantic.p, { key: "semantic", setting: semantic.key, percent: Math.round(semantic.p * 100) });
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [[setting, best], [, second]] = ranked;
  if (best === 0) return { setting: "studio", confidence: 0.2, reasons: [{ key: "noEvidence" }] };
  return { setting, confidence: clamp(best - second * 0.5, 0.2, 0.95), reasons: reasons[setting] };
}

// The most likely class of { class: probability }, or null.
function topClass(probabilities) {
  if (!probabilities || typeof probabilities !== "object") return null;
  const ranked = Object.entries(probabilities).filter(([, p]) => Number.isFinite(p)).sort((a, b) => b[1] - a[1]);
  return ranked.length ? { key: ranked[0][0], p: ranked[0][1] } : null;
}

function decidePurpose(facts, keywords, setting) {
  if (keywords.presentation && !keywords.documentation) return { purpose: "presentation", reasons: [{ key: "keywords", words: keywords.presentation }] };
  if (keywords.documentation && !keywords.presentation) return { purpose: "documentation", reasons: [{ key: "keywords", words: keywords.documentation }] };
  const semantic = topClass(facts.semantic?.purpose);
  if (semantic && semantic.p >= 0.65) {
    return { purpose: semantic.key, reasons: [{ key: "semanticPurpose", purpose: semantic.key, percent: Math.round(semantic.p * 100) }] };
  }
  if (facts.kind === "pointcloud") return { purpose: "documentation", reasons: [{ key: "pointcloud" }] };
  if (setting.setting === "outdoor") return { purpose: "presentation", reasons: [{ key: "outdoor" }] };
  return { purpose: "documentation", reasons: [{ key: "notOutdoor", setting: setting.setting }] };
}

const SEASON_DAYS = { winter: [1, 20], spring: [4, 20], summer: [7, 15], autumn: [10, 15] };

const WEATHER_INTENSITY = { clear: 0, fog: 0.5, rain: 0.4, snow: 0.35, storm: 0.7 };

/**
 * The suggested scene: { purpose, autoPurpose, setting, basis, items,
 * uncertain }. `purpose` ("documentation" | "presentation") overrides the
 * one the rules pick. Each item: { key, value, confidence, reasons,
 * changes, preselected }.
 */
export function suggestScene(input = {}, purpose = null) {
  const facts = { ...input, kind: input.kind || "mesh" };
  const text = facts.text || "";
  const keywords = findSceneKeywords(text);
  const size = sizeClass(facts.size);
  const setting = decideSetting(facts, keywords, size);
  const auto = decidePurpose(facts, keywords, setting);
  const chosen = purpose === "documentation" || purpose === "presentation" ? purpose : auto.purpose;
  const scanLike = isScanLike(facts);
  const current = facts.current || {};
  const uncertain = [];

  const year = Number.isFinite(facts.timelineYear)
    ? { year: Math.round(facts.timelineYear), source: "timeline" }
    : (() => {
      const found = findSceneYear(text);
      return found ? { year: found.year, source: found.kind } : null;
    })();
  const textCoordinates = findSceneCoordinates(text);
  // The manifest's place, else coordinates written in the texts, else a
  // place they name.
  const location = facts.location?.source === "manifest" ? { ...facts.location }
    : textCoordinates ? { ...textCoordinates, source: "text" }
      : facts.location ? { ...facts.location } : null;

  const basis = [];
  basis.push({ key: "kind", kind: facts.kind || "mesh", ifc: facts.ifc === true });
  if (facts.size) basis.push({ key: "size", size: facts.size, sizeClass: size, unitSource: facts.unitSource || "default" });
  if (scanLike) basis.push({ key: "baked" });
  if (location) {
    basis.push({ key: "location", latitude: location.latitude, longitude: location.longitude, source: location.source, name: location.name, country: location.country });
  }
  if (year) basis.push({ key: "year", year: year.year, source: year.source });
  const shownKeywords = ["indoor", "object", "building", "relief", "fog", "rain", "snow", "storm", "winter", "spring", "summer", "autumn", "dawn", "dusk", "noon"]
    .flatMap((group) => keywords[group] || []);
  if (shownKeywords.length) basis.push({ key: "keywords", words: [...new Set(shownKeywords)].slice(0, 8) });
  if (facts.shape) basis.push({ key: "shape", ...facts.shape });
  if (facts.semantic?.model) basis.push({ key: "semantic", model: facts.semantic.model });
  basis.push({ key: "setting", setting: setting.setting, confidence: setting.confidence });

  const items = [];
  const push = (key, value, confidence, reasons, changes) => {
    const rounded = Math.round(clamp(confidence, 0, 1) * 100) / 100;
    items.push({ key, value, confidence: rounded, reasons, changes, preselected: changes && rounded >= 0.5 });
  };

  const outdoor = setting.setting === "outdoor";
  const presentation = chosen === "presentation";
  const lightable = facts.kind !== "splats" && !(facts.kind === "pointcloud" && facts.normals !== true);

  // The sun: outdoors, for a presentation, on models that take light.
  {
    const reasons = [];
    let enabled = false;
    let confidence = setting.confidence;
    if (!lightable) reasons.push({ key: facts.kind === "splats" ? "splatsBaked" : "pointsNoNormals" });
    else if (!outdoor) reasons.push({ key: "notOutdoor", setting: setting.setting });
    else if (!presentation) reasons.push({ key: "documentationNeutral" });
    else {
      enabled = true;
      reasons.push({ key: "outdoorPresentation" });
      if (scanLike) {
        confidence *= 0.75;
        reasons.push({ key: "bakedSun" });
      }
    }
    if (!lightable) confidence = 0.9;
    const value = { enabled };
    if (enabled) {
      if (location) {
        // A place from the manifest is set already.
        if (location.source !== "manifest") {
          value.latitude = location.latitude;
          value.longitude = location.longitude;
        }
        if (location.source === "geonames") {
          const sure = Number.isFinite(location.confidence) ? location.confidence : 0.5;
          confidence *= 0.6 + 0.4 * sure;
          reasons.push({ key: "placeNamed", name: location.name, country: location.country });
          if (sure < 0.6) uncertain.push({ key: "placeGuess", name: location.name, country: location.country });
        } else {
          reasons.push({ key: "place", source: location.source });
        }
      } else {
        confidence *= 0.8;
        uncertain.push({ key: "place" });
      }
      if (year?.source === "timeline") {
        value.followTimeline = true;
        reasons.push({ key: "yearTimeline" });
      } else if (year) {
        value.year = year.year;
        value.followTimeline = false;
        reasons.push({ key: "year", year: year.year, source: year.source });
      }
      const season = ["winter", "spring", "summer", "autumn"].find((name) => keywords[name])
        || (keywords.snow ? "winter" : null);
      const [month, day] = SEASON_DAYS[season || "summer"];
      value.month = month;
      value.day = day;
      if (season) reasons.push({ key: "season", season });
      // Late afternoon by default: a low, warm sun with long shadows reads
      // the shape best and looks most natural.
      value.time = keywords.dawn ? { anchor: "sunrise", offset: 60 }
        : keywords.noon ? { anchor: "clock", minutes: 750 }
          : { anchor: "sunset", offset: -150 };
      reasons.push({ key: keywords.dawn ? "timeDawn" : keywords.noon ? "timeNoon" : keywords.dusk ? "timeDusk" : "timeAfternoon" });
      if (keywords.dusk) value.time = { anchor: "sunset", offset: -45 };
    }
    push("sun", value, confidence, reasons, enabled !== (current.sun === true));
  }

  // The weather: outdoors, for a presentation; clear unless the text says.
  {
    const reasons = [];
    let value = { enabled: false };
    let confidence = 0.7;
    if (facts.kind === "splats") reasons.push({ key: "splatsBaked" });
    else if (!outdoor) {
      reasons.push({ key: "notOutdoor", setting: setting.setting });
      confidence = setting.confidence;
    } else if (!presentation) reasons.push({ key: "hidesGeometry" });
    else {
      const named = ["storm", "snow", "rain", "fog"].find((type) => keywords[type]);
      const type = named || (keywords.winter ? "snow" : "clear");
      const intensity = WEATHER_INTENSITY[type] * (facts.phone ? 0.6 : 1);
      value = { enabled: true, type, intensity: Math.round(intensity * 100) / 100, sky: true, surfaces: type !== "clear" };
      confidence = named ? 0.75 : keywords.winter ? 0.5 : setting.confidence * 0.8;
      reasons.push(named ? { key: "weatherNamed", words: keywords[named] } : keywords.winter ? { key: "season", season: "winter" } : { key: "clearSky" });
      if (facts.phone && type !== "clear") reasons.push({ key: "phoneLighter" });
    }
    const currentType = current.weather || null;
    const changes = value.enabled ? currentType !== value.type : currentType != null;
    push("weather", value, confidence, reasons, changes);
  }

  // Raking light: for documenting relief (inscriptions, tool marks, coins).
  {
    const proportions = sceneProportions(facts.size);
    const thinPlate = Boolean(proportions && proportions.thinness < 0.12 && (size === "object" || size === "large-object"));
    const reasons = [];
    let enabled = false;
    let confidence = 0.6;
    if (!lightable) {
      reasons.push({ key: facts.kind === "splats" ? "splatsBaked" : "pointsNoNormals" });
      confidence = 0.9;
    } else if (presentation) reasons.push({ key: "presentationNoRaking" });
    else if (keywords.relief) {
      enabled = true;
      confidence = 0.85;
      reasons.push({ key: "relief", words: keywords.relief });
    } else if (Number.isFinite(facts.semantic?.relief) && facts.semantic.relief >= 0.6) {
      enabled = true;
      confidence = 0.5 + 0.3 * facts.semantic.relief;
      reasons.push({ key: "semanticRelief", percent: Math.round(facts.semantic.relief * 100) });
    } else if (setting.setting === "studio" && thinPlate) {
      enabled = true;
      confidence = 0.7;
      reasons.push({ key: "thinPlate" });
    } else if (setting.setting === "studio") {
      enabled = true;
      confidence = 0.55 * Math.max(setting.confidence, 0.6);
      reasons.push({ key: "studioRelief" });
    } else reasons.push({ key: "noRelief" });
    if (enabled && facts.normals === false) {
      confidence *= 0.6;
      reasons.push({ key: "noNormals" });
    }
    push("rakingLight", { enabled }, confidence, reasons, enabled !== (current.rakingLight === true));
  }

  // Tone mapping: AgX keeps the sun's highlights; neutral the true colours.
  {
    const sunOn = items.find((item) => item.key === "sun").value.enabled;
    const toneMapping = sunOn ? "agx" : "neutral";
    const reasons = [{ key: sunOn ? "agxSun" : "neutralColours" }];
    push("toneMapping", { toneMapping }, sunOn ? 0.6 : 0.65, reasons, current.toneMapping !== toneMapping);
  }

  // Ambient occlusion: contact shadows for meshes that do not have them
  // baked in, where the device can afford it.
  {
    const reasons = [];
    let ao = false;
    let confidence = 0.6;
    if (facts.kind !== "mesh") {
      reasons.push({ key: facts.kind === "splats" ? "splatsBaked" : "aoPoints" });
      confidence = 0.8;
    } else if (facts.phone) reasons.push({ key: "phonePerformance" });
    else if (scanLike) reasons.push({ key: "bakedAo" });
    else if ((Number(facts.triangles) || 0) > 8000000) reasons.push({ key: "aoHeavy" });
    else {
      ao = true;
      confidence = facts.unlit ? 0.4 : 0.65;
      reasons.push({ key: "aoShape" });
      if (facts.unlit) reasons.push({ key: "unlit" });
    }
    push("ao", { ao }, confidence, reasons, ao !== (current.ao === true));
  }

  return {
    purpose: chosen,
    autoPurpose: auto.purpose,
    purposeReasons: auto.reasons,
    setting,
    basis,
    items,
    uncertain,
  };
}

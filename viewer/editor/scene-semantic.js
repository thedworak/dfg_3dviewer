// The suggested scene's second level (editor/scene-suggest.js): a small
// multilingual language model, run in the browser, reads the model's texts
// where the keywords of scene-rules.js find nothing - "nawa główna",
// "Kreuzgang", "the altar seen from the choir" - and says how much they
// sound like a building seen from outside, an interior or an object on its
// own; like documentation or a reconstruction; and whether they describe
// relief to read.
//
// It compares sentence embeddings: the texts, cut into short passages, and
// a few descriptions of each class in English, Polish and German
// (PROTOTYPES). A class scores the best match of any passage with any of its
// descriptions; the scores become probabilities (a softmax). The rules take
// them as weaker evidence than words found (scene-rules.js).
//
// Nothing is sent anywhere: transformers.js (ONNX Runtime in WebAssembly)
// and the model's weights are downloaded once, when the user asks for it
// (about 120 MB, kept in the browser's cache), from the hosts set in
// viewer-settings.json viewer.sceneSuggest.semantic - by default jsDelivr
// and the Hugging Face hub; a deployment can serve both itself. No viewer
// imports: pure but for the download, so it is tested in Node too.

export const SEMANTIC_DEFAULTS = Object.freeze({
  enabled: true,
  // transformers.js as an ES module (its dist/transformers.min.js).
  library: "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js",
  // A sentence-embedding model on the hub, or under `modelHost`.
  model: "Xenova/multilingual-e5-small",
  dtype: "q8",
  // What the model expects before each text (E5: "query: ").
  prefix: "query: ",
  // Shown on the button.
  sizeMb: 120,
  // Another host of the models (transformers.js env.remoteHost), e.g. the
  // deployment's own "/models/"; null: the Hugging Face hub.
  modelHost: null,
  // Where ONNX Runtime's .wasm files are (env.backends.onnx.wasm.wasmPaths);
  // null: transformers.js's default (jsDelivr).
  wasmPaths: null,
});

// viewer.sceneSuggest.semantic of viewer-settings.json over the defaults;
// false turns it off.
export function getSemanticSettings(config) {
  if (config === false) return { ...SEMANTIC_DEFAULTS, enabled: false };
  const settings = { ...SEMANTIC_DEFAULTS };
  if (config && typeof config === "object") {
    Object.keys(SEMANTIC_DEFAULTS).forEach((key) => {
      if (config[key] !== undefined && config[key] !== "") settings[key] = config[key];
    });
  }
  settings.enabled = settings.enabled !== false;
  return settings;
}

// Short descriptions of each class. The model is multilingual, so a Polish
// text matches an English description too; a few in each language still
// help a small model.
export const PROTOTYPES = {
  setting: {
    outdoor: [
      "the exterior of a historic building seen from outside",
      "a castle, church or palace standing in the open air",
      "ruins and walls in the landscape",
      "an archaeological site, an excavation in the field",
      "a town square, a street and the facades of houses",
      "zewnętrze zabytkowego budynku, elewacja i dach",
      "ruiny zamku w krajobrazie",
      "Außenansicht eines historischen Gebäudes mit Fassade und Dach",
    ],
    indoor: [
      "the interior of a church, the nave and the altar",
      "inside a room, a hall or a chamber",
      "a crypt, a cellar or a vault seen from inside",
      "wnętrze kościoła, nawa główna i ołtarz",
      "wnętrze komnaty, sali lub piwnicy",
      "Innenraum einer Kirche mit Gewölbe und Altar",
    ],
    studio: [
      "a small museum object on its own",
      "a coin, a vase, a figurine or a sculpture",
      "an artefact found during an excavation, a pottery fragment",
      "zabytek ruchomy: moneta, naczynie, rzeźba",
      "ein Fundstück, eine Münze oder eine Skulptur im Museum",
    ],
  },
  purpose: {
    documentation: [
      "a 3D scan documenting the present state",
      "a photogrammetric survey of the object as it is today",
      "inwentaryzacja i dokumentacja stanu zachowania",
      "Bauaufnahme und Dokumentation des heutigen Bestands",
    ],
    presentation: [
      "a hypothetical reconstruction of how it looked in the past",
      "a visualisation of the building in its historical period",
      "rekonstrukcja dawnego wyglądu, wizualizacja",
      "Rekonstruktion des historischen Zustands, Visualisierung",
    ],
  },
  relief: {
    yes: [
      "an inscription carved in stone",
      "relief decoration, engraved ornament, tool marks on the surface",
      "napis wyryty w kamieniu, płaskorzeźba, ornament",
      "eine Inschrift, ein Relief, eingeritzte Ornamente",
    ],
    no: [
      "a plain building or object without carved decoration",
      "the overall shape and volume, smooth surfaces",
      "ogólna bryła, gładkie powierzchnie",
      "die gesamte Form, glatte Oberflächen",
    ],
  },
};

// Passages of the texts: lines and sentences of 12-240 characters, without
// links and numbers alone; at most 24, the first ones (titles and
// descriptions come first).
export function splitSemanticText(text, max = 24) {
  const passages = [];
  const seen = new Set();
  String(text || "")
    .split(/\n+|(?<=[.!?;])\s+/)
    .forEach((part) => {
      let passage = part.replace(/https?:\/\/\S+/g, " ").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
      if (passage.length > 240) passage = passage.slice(0, 240);
      if (passage.length < 12 || !/\p{L}{3}/u.test(passage)) return;
      const key = passage.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      passages.push(passage);
    });
  return passages.slice(0, max);
}

const dot = (a, b) => {
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) sum += a[index] * b[index];
  return sum;
};

// Cosine similarities of normalized embeddings are crowded (0.7-0.9 for
// E5): a low temperature spreads them into probabilities.
const TEMPERATURE = 0.02;

function softmax(scores) {
  const entries = Object.entries(scores);
  const top = Math.max(...entries.map(([, score]) => score));
  const weights = entries.map(([key, score]) => [key, Math.exp((score - top) / TEMPERATURE)]);
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  return Object.fromEntries(weights.map(([key, weight]) => [key, Math.round((weight / total) * 1000) / 1000]));
}

/**
 * Probabilities of each class from the passages' embeddings and the
 * prototypes' ({ group: { class: [vector] } }), all normalized.
 */
export function scoreSemantic(passageVectors, prototypeVectors) {
  const result = {};
  Object.entries(prototypeVectors).forEach(([group, classes]) => {
    const scores = {};
    Object.entries(classes).forEach(([name, vectors]) => {
      let best = -1;
      passageVectors.forEach((passage) => vectors.forEach((vector) => {
        best = Math.max(best, dot(passage, vector));
      }));
      scores[name] = best;
    });
    result[group] = softmax(scores);
  });
  return {
    setting: result.setting,
    purpose: result.purpose,
    relief: result.relief?.yes ?? null,
  };
}

let embedderOverride = null;
let embedderPromise = null;
let embedderKey = "";
const prototypeCache = new Map();

// For tests (and other embedders): (texts) => Promise of normalized vectors.
export function setSceneEmbedder(embed) {
  embedderOverride = typeof embed === "function" ? embed : null;
  prototypeCache.clear();
}

// transformers.js and the model, loaded once per settings. `onProgress`
// gets 0..1 while the weights download.
function loadEmbedder(settings, onProgress) {
  if (embedderOverride) return Promise.resolve(embedderOverride);
  const key = [settings.library, settings.model, settings.dtype, settings.modelHost, settings.wasmPaths].join("|");
  if (embedderPromise && embedderKey === key) return embedderPromise;
  embedderKey = key;
  embedderPromise = (async () => {
    const library = settings.library;
    const transformers = await import(/* webpackIgnore: true */ /* @vite-ignore */ library);
    const { env, pipeline } = transformers;
    env.allowLocalModels = false;
    if (settings.modelHost) env.remoteHost = settings.modelHost;
    if (settings.wasmPaths && env.backends?.onnx?.wasm) env.backends.onnx.wasm.wasmPaths = settings.wasmPaths;
    const files = new Map();
    const extractor = await pipeline("feature-extraction", settings.model, {
      dtype: settings.dtype,
      progress_callback: (event) => {
        if (!onProgress || !event?.file || !Number.isFinite(event.total) || event.total <= 0) return;
        files.set(event.file, { loaded: event.loaded || 0, total: event.total });
        let loaded = 0;
        let total = 0;
        files.forEach((file) => {
          loaded += file.loaded;
          total += file.total;
        });
        onProgress(total > 0 ? loaded / total : 0);
      },
    });
    return async (texts) => {
      const output = await extractor(texts.map((text) => `${settings.prefix || ""}${text}`), { pooling: "mean", normalize: true });
      return output.tolist();
    };
  })();
  embedderPromise.catch(() => {
    embedderPromise = null;
  });
  return embedderPromise;
}

async function prototypeVectors(embed, settings) {
  const key = embedderOverride ? "override" : embedderKey;
  if (prototypeCache.has(key)) return prototypeCache.get(key);
  const texts = [];
  const places = [];
  Object.entries(PROTOTYPES).forEach(([group, classes]) => Object.entries(classes).forEach(([name, list]) => list.forEach((text) => {
    texts.push(text);
    places.push([group, name]);
  })));
  const vectors = await embed(texts, settings);
  const result = {};
  places.forEach(([group, name], index) => {
    result[group] ??= {};
    result[group][name] ??= [];
    result[group][name].push(vectors[index]);
  });
  prototypeCache.set(key, result);
  return result;
}

/**
 * What the language model reads in `text`: { model, passages, setting,
 * purpose, relief }, or null without passages to read. Throws when the
 * library or the model cannot be loaded.
 */
export async function analyzeSceneText(text, { settings = SEMANTIC_DEFAULTS, onProgress } = {}) {
  const passages = splitSemanticText(text);
  if (!passages.length) return null;
  const embed = await loadEmbedder(settings, onProgress);
  const prototypes = await prototypeVectors(embed, settings);
  const vectors = await embed(passages, settings);
  return {
    model: String(settings.model).split("/").pop(),
    passages: passages.length,
    ...scoreSemantic(vectors, prototypes),
  };
}

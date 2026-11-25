// A manifest's descriptive metadata, kept once for many manifests.
//
// AIM3DViewer.metadata holds a metadata manifest (type "AIM3DMetadata"):
// - embedded, as an object: the metadata manifest itself;
// - referenced, as a string: its URL, or a path ("./...") resolved like the
//   manifest's model URLs. Every view of one object (its lighting, shading,
//   4D, certainty... manifests) can point at the same file.
//
// A metadata manifest holds the IIIF descriptive and rights properties
// (label, summary, metadata, requiredStatement, rights, provider, homepage,
// navDate, thumbnail, seeAlso) about the object, and `synthetic`: true, or
// { "note": <language map> }, for invented example data. The manifest's own
// label and summary describe its view; the metadata manifest describes the
// object. Without AIM3DViewer.metadata the manifest's own descriptive
// properties are the metadata (older manifests, IIIF manifests).
//
// No DOM and no three.js here: this also runs in Node (the tests, scripts/).

export const METADATA_MANIFEST_TYPE = "AIM3DMetadata";

// The keys a metadata manifest carries, in the order the metadata window
// shows them.
export const METADATA_DESCRIPTIVE_KEYS = [
  "label", "summary", "metadata", "requiredStatement", "rights", "provider", "homepage", "navDate", "thumbnail", "seeAlso",
];

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isString(value) {
  return typeof value === "string";
}

function languageMapErrors(value, path) {
  if (isString(value)) return [];
  if (!isPlainObject(value)) return [[path, "must be a string or a language map"]];
  return Object.entries(value)
    .filter(([, texts]) => !(Array.isArray(texts) && texts.every(isString)) && !isString(texts))
    .map(([lang]) => [`${path}.${lang}`, "must be an array of strings"]);
}

function labelValueErrors(value, path) {
  if (!isPlainObject(value)) return [[path, "must be an object with label and value"]];
  const errors = [];
  if (value.label === undefined) errors.push([`${path}.label`, "is required"]);
  else errors.push(...languageMapErrors(value.label, `${path}.label`));
  if (value.value === undefined) errors.push([`${path}.value`, "is required"]);
  else errors.push(...languageMapErrors(value.value, `${path}.value`));
  return errors;
}

// [[path, message], ...] for a metadata manifest (embedded or fetched).
export function metadataManifestErrors(record, path = "$") {
  if (!isPlainObject(record)) return [[path, "must be a metadata manifest object"]];
  const errors = [];
  if (record.type !== undefined && record.type !== METADATA_MANIFEST_TYPE) {
    errors.push([`${path}.type`, `must equal "${METADATA_MANIFEST_TYPE}"`]);
  }
  ["id", "version"].forEach((key) => {
    if (record[key] !== undefined && !isString(record[key])) errors.push([`${path}.${key}`, "must be a string"]);
  });
  ["label", "summary"].forEach((key) => {
    if (record[key] !== undefined) errors.push(...languageMapErrors(record[key], `${path}.${key}`));
  });
  if (record.metadata !== undefined) {
    if (!Array.isArray(record.metadata)) errors.push([`${path}.metadata`, "must be an array"]);
    else record.metadata.forEach((entry, index) => errors.push(...labelValueErrors(entry, `${path}.metadata[${index}]`)));
  }
  if (record.requiredStatement !== undefined) errors.push(...labelValueErrors(record.requiredStatement, `${path}.requiredStatement`));
  if (record.rights !== undefined && !isString(record.rights)) errors.push([`${path}.rights`, "must be a string"]);
  if (record.navDate !== undefined && !isString(record.navDate)) errors.push([`${path}.navDate`, "must be a string"]);
  if (record.synthetic !== undefined && typeof record.synthetic !== "boolean") {
    if (!isPlainObject(record.synthetic)) errors.push([`${path}.synthetic`, "must be a boolean or an object"]);
    else if (record.synthetic.note !== undefined) errors.push(...languageMapErrors(record.synthetic.note, `${path}.synthetic.note`));
  }
  return errors;
}

// Errors of AIM3DViewer.metadata as written in a manifest: a reference is
// checked when it is fetched.
export function metadataFieldErrors(value, path = "$.AIM3DViewer.metadata") {
  if (isString(value)) return value.trim() ? [] : [[path, "must not be empty"]];
  if (isPlainObject(value)) return metadataManifestErrors(value, path);
  return [[path, "must be a metadata manifest object or its URL"]];
}

// What a manifest's metadata is: { kind: "reference", url } |
// { kind: "embedded", record } | { kind: "manifest", record } (its own
// descriptive properties) | null (none at all).
export function metadataSource(manifest) {
  if (!isPlainObject(manifest)) return null;
  const field = manifest.AIM3DViewer?.metadata;
  if (isString(field) && field.trim()) return { kind: "reference", url: field.trim() };
  if (isPlainObject(field)) return { kind: "embedded", record: field };
  const own = Object.fromEntries(METADATA_DESCRIPTIVE_KEYS.filter((key) => manifest[key] !== undefined).map((key) => [key, manifest[key]]));
  return Object.keys(own).length ? { kind: "manifest", record: own } : null;
}

// Fetched metadata manifests by URL: the views of one object share one.
const referenceCache = new Map();

export function clearMetadataCache() {
  referenceCache.clear();
}

async function defaultFetchJson(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// The manifest's metadata: { kind, record, url?, error? }, or null.
// `baseUrl`: what a relative reference resolves against (by default the
// page, as the manifest's model URLs). A reference that cannot be read or
// is not a metadata manifest: `record` null and `error` says why - the
// manifest itself still opens.
export async function resolveManifestMetadata(manifest, { baseUrl, fetchJson = defaultFetchJson } = {}) {
  const source = metadataSource(manifest);
  if (!source) return null;
  if (source.kind !== "reference") {
    const errors = metadataManifestErrors(source.record);
    return errors.length ? { kind: source.kind, record: null, error: errors.map((e) => e.join(" ")).join("; ") } : source;
  }
  let url = source.url;
  try {
    const base = baseUrl || (typeof window !== "undefined" ? window.location?.href : undefined);
    if (base) url = new URL(url, base).href;
  } catch {
    // Kept as written: fetch() reports it.
  }
  if (!referenceCache.has(url)) {
    referenceCache.set(url, Promise.resolve().then(() => fetchJson(url)));
  }
  try {
    const record = await referenceCache.get(url);
    const errors = metadataManifestErrors(record);
    if (errors.length) return { kind: "reference", url, record: null, error: errors.map((e) => e.join(" ")).join("; ") };
    return { kind: "reference", url, record };
  } catch (error) {
    referenceCache.delete(url);
    return { kind: "reference", url, record: null, error: error?.message || String(error) };
  }
}

// ---- shown in a language ---------------------------------------------------

// A language map's text in `language` (else English, "none", the first).
export function languageText(value, language = "en") {
  if (value == null) return "";
  if (isString(value)) return value;
  if (Array.isArray(value)) return value.filter(isString).join("; ");
  if (!isPlainObject(value)) return String(value);
  const keys = Object.keys(value);
  if (!keys.length) return "";
  const wanted = String(language || "en").toLowerCase();
  const key = keys.find((k) => k.toLowerCase() === wanted)
    || keys.find((k) => k.toLowerCase().split("-")[0] === wanted.split("-")[0])
    || (keys.includes("en") ? "en" : null)
    || (keys.includes("none") ? "none" : null)
    || keys[0];
  return languageText(value[key], language);
}

// A rights URI by its usual name: "CC0 1.0", "CC BY-SA 4.0"...
export function rightsLabel(uri) {
  if (!isString(uri)) return "";
  const cc = uri.match(/creativecommons\.org\/licenses\/([a-z-]+)\/([\d.]+)/i);
  if (cc) return `CC ${cc[1].toUpperCase()} ${cc[2]}`;
  const zero = uri.match(/creativecommons\.org\/publicdomain\/zero\/([\d.]+)/i);
  if (zero) return `CC0 ${zero[1]}`;
  if (/creativecommons\.org\/publicdomain\/mark\//i.test(uri)) return "Public Domain Mark";
  const statement = uri.match(/rightsstatements\.org\/vocab\/([A-Za-z-]+)\//);
  if (statement) return statement[1];
  return uri;
}

function linkOf(value, language) {
  const first = Array.isArray(value) ? value[0] : value;
  if (isString(first)) return { href: first, text: first };
  if (!isPlainObject(first) || !isString(first.id)) return null;
  return { href: first.id, text: languageText(first.label, language) || first.id };
}

// The metadata as rows of the metadata window, in `language`:
// [{ key, label, value, href? }]. `key`: the property ("metadata" for each
// label/value pair); `label` is a translation key's fallback for the
// properties and the pair's own label for "metadata".
export function metadataRows(record, language = "en") {
  if (!isPlainObject(record)) return [];
  const rows = [];
  const add = (row) => { if (row.value) rows.push(row); };
  add({ key: "label", label: "Title", value: languageText(record.label, language) });
  add({ key: "summary", label: "Summary", value: languageText(record.summary, language) });
  (Array.isArray(record.metadata) ? record.metadata : []).forEach((entry) => {
    const label = languageText(entry?.label, language);
    if (label) add({ key: "metadata", label, value: languageText(entry?.value, language) });
  });
  if (isPlainObject(record.requiredStatement)) {
    add({
      key: "requiredStatement",
      label: languageText(record.requiredStatement.label, language) || "Attribution",
      value: languageText(record.requiredStatement.value, language),
    });
  }
  if (isString(record.rights)) add({ key: "rights", label: "Licence", value: rightsLabel(record.rights), href: record.rights });
  const providers = (Array.isArray(record.provider) ? record.provider : [record.provider]).filter(isPlainObject);
  providers.forEach((provider) => {
    const home = linkOf(provider.homepage, language);
    add({ key: "provider", label: "Provider", value: languageText(provider.label, language), href: home?.href });
  });
  const home = linkOf(record.homepage, language);
  if (home) add({ key: "homepage", label: "Homepage", value: home.text, href: home.href });
  if (isString(record.navDate)) add({ key: "navDate", label: "Date", value: record.navDate.slice(0, 10) });
  return rows;
}

// Invented example data (synthetic: true or { note }).
export function isSynthetic(record) {
  return isPlainObject(record) && Boolean(record.synthetic);
}

// The synthetic data's own note, or "".
export function syntheticNote(record, language = "en") {
  return isSynthetic(record) ? languageText(record.synthetic?.note, language) : "";
}

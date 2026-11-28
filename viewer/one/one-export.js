// "Save as .one4d": the model shown, with everything the viewer knows about
// it, in one The One container (docs/one-format.md):
// - the model file as it was opened (a GLB, with its lighter
//   <name>.preview.glb as a coarser level when the server has one; a point
//   cloud or splats as they are; other formats as the GLB three.js exports
//   from the scene) - or, for a .one4d, its parts as they are;
// - the scene as an AIM3D manifest (Viewer.build3IFManifest: annotations,
//   cameras, lights, looks, timeline, certainty...), meta/scene.json;
// - the files that manifest links to (sounds, photos, data tables, maps,
//   thumbnails, the environment map, shared metadata), fetched and put
//   under res/, the links rewritten to them; what cannot be fetched stays
//   a link and is reported;
// - a building's properties (<name>_ifc.json) and a picture of the view.

import { core } from "../core.js";
import { isSplatPly } from "../loaders.js";
import { ifcPropertiesUrlForModel } from "../ifc-properties.js";
import { captureViewPng } from "../editor/thumbnail-capture.js";
import { modelBasename } from "../model-extension.js";
import { ONE_FORMAT, ONE_MANIFEST, ONE_VERSION, partLods, platformDeflate, writeOneContainer } from "./one-container.js";

const SCENE_PATH = "meta/scene.json";
const PREVIEW_PATH = "meta/preview.webp";
// Keys whose value is a file the scene uses (AIM3DViewer schema), and file
// extensions that make any other string value one.
const RESOURCE_KEYS = new Set(["src", "layoutUrl", "waterUrl", "environmentMap", "metadataUrl", "thumbnail", "audio", "image"]);
const RESOURCE_EXTENSIONS = /\.(mp3|wav|wave|bwf|ogg|oga|opus|flac|m4a|aac|weba|png|jpe?g|webp|avif|gif|csv|tsv|geojson|json|jsonld|hdr|exr|ktx2|vtt|srt)(?=$|[?#])/i;
// Never fetched: IIIF identifiers, contexts, map tile templates.
const SKIPPED_KEYS = new Set(["id", "@id", "@context", "type", "format", "rights", "mainUrl", "mailUrl", "exportViewerUrl"]);
const MAX_RESOURCE_BYTES = 512 * 1024 * 1024;

const SPLAT_EXTENSIONS = ["spz", "splat", "ksplat", "sog", "rad"];
const POINT_EXTENSIONS = ["las", "laz"];
const MESH_EXPORTED = ["gltf", "obj", "fbx", "dae", "stl", "ply", "3ds", "usd", "usda", "usdc", "usdz", "3mf", "amf", "wrl", "kmz", "vox", "lwo", "ifc", "xyz", "pcd"];

const safeName = (name) => String(name || "file").split(/[?#]/)[0].split("/").pop().replace(/[^A-Za-z0-9._-]+/g, "_") || "file";

async function fetchBytes(url) {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get("content-type") || "";
  // Single-page hosts answer missing files with index.html.
  if (type.includes("text/html")) throw new Error("not found (an HTML page came back)");
  return new Uint8Array(await response.arrayBuffer());
}

function shownRoot() {
  const slots = Array.isArray(core.mainObject) ? core.mainObject : [core.mainObject];
  for (const slot of slots) {
    const root = Array.isArray(slot) ? slot.find((item) => item?.isObject3D) : slot;
    if (root?.isObject3D) return root;
  }
  return null;
}

async function exportSceneAsGlb(root) {
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  const result = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: false });
  return new Uint8Array(result);
}

// The model's own files: { parts, files, sourceUrl }.
async function modelParts(problems) {
  const { fileObject } = core;
  const ext = String(fileObject.extension || "").toLowerCase();
  const base = safeName(fileObject.basename || "model");
  const isLocal = String(fileObject.filename || "").startsWith("blob:");
  const sourceUrl = isLocal ? null : new URL(fileObject.originalPath || fileObject.filename, window.location.href).href;
  const original = async () => {
    const file = core.localFiles?.get(fileObject.filename);
    if (file) return new Uint8Array(await file.arrayBuffer());
    return fetchBytes(sourceUrl);
  };

  // A .one4d: its parts and files as they are, its scene written anew.
  if (["one4d", "one"].includes(ext) && core.oneContainer) {
    const one = core.oneContainer;
    const files = {};
    for (const name of one.entries.keys()) {
      if (name === ONE_MANIFEST || name === one.manifest.scene || name === one.manifest.preview) continue;
      files[name] = await one.readFile(name);
    }
    const { parts, timeline, certainty, metadata, units, upAxis, title } = one.manifest;
    return { parts, files, sourceUrl, carried: { timeline, certainty, metadata, units, upAxis, title } };
  }

  if (ext === "glb") {
    const full = await original();
    const lods = [];
    const files = {};
    if (sourceUrl) {
      const previewUrl = sourceUrl.replace(/\.glb(?=$|[?#])/i, ".preview.glb");
      try {
        files[`mesh/${base}.preview.glb`] = await fetchBytes(previewUrl);
        lods.push({ path: `mesh/${base}.preview.glb` });
      } catch (_error) {
        // No lighter level on the server: one level.
      }
    }
    files[`mesh/${base}.glb`] = full;
    lods.push({ path: `mesh/${base}.glb` });
    return { parts: [{ id: "model", kind: "mesh", role: "primary", lods }], files, sourceUrl };
  }
  if (POINT_EXTENSIONS.includes(ext)) {
    const path = `points/${base}.${ext}`;
    return { parts: [{ id: "model", kind: "points", role: "primary", path }], files: { [path]: await original() }, sourceUrl };
  }
  if (SPLAT_EXTENSIONS.includes(ext) || (ext === "ply" && isSplatPly((await original()).buffer))) {
    const path = `splats/${base}.${ext}`;
    const files = { [path]: await original() };
    const part = { id: "model", kind: "splats", role: "primary", path };
    if (sourceUrl) {
      try {
        files[`splats/${base}.${ext}.light`] = await fetchBytes(`${sourceUrl}.light`);
        part.lighting = `splats/${base}.${ext}.light`;
      } catch (_error) {
        // No lighting volume.
      }
    }
    return { parts: [part], files, sourceUrl };
  }
  if (MESH_EXPORTED.includes(ext)) {
    const root = shownRoot();
    if (!root) throw new OneExportUnsupported(ext);
    problems.push(`${ext.toUpperCase()} saved as the GLB of the scene shown (three.js GLTFExporter), not as the original file`);
    const path = `mesh/${base}.glb`;
    return { parts: [{ id: "model", kind: "mesh", role: "primary", path }], files: { [path]: await exportSceneAsGlb(root) }, sourceUrl };
  }
  throw new OneExportUnsupported(ext);
}

export class OneExportUnsupported extends Error {
  constructor(ext) {
    super(`A .${ext} model cannot be saved as .one4d yet`);
    this.extension = ext;
  }
}

// Every string of the scene that names a file it uses: [{ holder, key, url }].
// The viewer's own settings (AIM3DViewer.viewer: credits' logos, links,
// the metadata service) belong to the deployment, not to the model: only
// its environment map is taken.
function findResources(value, found = [], holder = null, key = null, path = "") {
  if (typeof value === "string") {
    if (!holder || SKIPPED_KEYS.has(key) || value.startsWith("data:") || /\{[xyzs]\}/.test(value)) return found;
    if (path.startsWith(".AIM3DViewer.viewer.") && key !== "environmentMap") return found;
    if (RESOURCE_KEYS.has(key) || RESOURCE_EXTENSIONS.test(value)) found.push({ holder, key, url: value });
    return found;
  }
  if (Array.isArray(value)) value.forEach((item, index) => findResources(item, found, value, index, `${path}[${index}]`));
  else if (value && typeof value === "object") Object.entries(value).forEach(([name, item]) => findResources(item, found, value, name, `${path}.${name}`));
  return found;
}

// Replaces the model's URL (and the ids built on it) with its path in the
// container, so the scene does not point at a blob: URL or the server.
function retarget(value, from, to) {
  if (!from) return value;
  const text = JSON.stringify(value);
  return JSON.parse(text.split(JSON.stringify(from).slice(1, -1)).join(to));
}

// The view, at most PREVIEW_WIDTH wide, as WebP (PNG where the browser
// cannot write WebP).
const PREVIEW_WIDTH = 1024;
async function previewImage(png) {
  const bitmap = await createImageBitmap(png);
  const scale = Math.min(1, PREVIEW_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  return new Uint8Array(await (blob?.type === "image/webp" ? blob : png).arrayBuffer());
}

export async function buildOneExport(Viewer) {
  const problems = [];
  const { parts, files, sourceUrl, carried = {} } = await modelParts(problems);

  // The scene as the viewer would export it now.
  let scene = Viewer.build3IFManifest?.();
  if (!scene) throw new Error("The scene could not be exported as a manifest");
  const primary = parts.find((part) => part.role === "primary") || parts[0];
  const finest = partLods(primary).at(-1).path;
  scene = retarget(scene, core.fileObject.originalPath, `./${finest}`);
  if (sourceUrl && sourceUrl !== core.fileObject.originalPath) scene = retarget(scene, sourceUrl, `./${finest}`);

  // The files the scene links to, into res/.
  const embedded = [];
  const linked = [];
  const byUrl = new Map();
  let total = Object.values(files).reduce((sum, data) => sum + data.byteLength, 0);
  for (const resource of findResources(scene)) {
    const { holder, key, url } = resource;
    if (url.startsWith("./") && files[url.slice(2)]) continue;
    let absolute;
    try {
      absolute = new URL(url, window.location.href).href;
    } catch (_error) {
      continue;
    }
    if (!/^(https?:|blob:)/.test(absolute)) continue;
    if (!byUrl.has(absolute)) {
      try {
        const data = await fetchBytes(absolute);
        if (total + data.byteLength > MAX_RESOURCE_BYTES) throw new Error("over the size limit");
        total += data.byteLength;
        let path = `res/${safeName(url)}`;
        for (let n = 2; files[path]; n += 1) path = `res/${n}-${safeName(url)}`;
        files[path] = data;
        byUrl.set(absolute, `./${path}`);
        embedded.push({ url, path });
      } catch (error) {
        byUrl.set(absolute, null);
        linked.push({ url, reason: error.message });
        problems.push(`${url}: kept as a link (${error.message})`);
      }
    }
    if (byUrl.get(absolute)) holder[key] = byUrl.get(absolute);
  }
  files[SCENE_PATH] = new TextEncoder().encode(JSON.stringify(scene, null, 2));

  // A building's properties, for the BIM tools.
  const ifcUrl = sourceUrl ? ifcPropertiesUrlForModel(sourceUrl) : null;
  if (ifcUrl && !primary.properties) {
    try {
      const path = `meta/${safeName(core.fileObject.basename)}_ifc.json`;
      files[path] = await fetchBytes(ifcUrl);
      primary.properties = path;
    } catch (_error) {
      // Not a converted IFC model.
    }
  }

  let preview = null;
  try {
    files[PREVIEW_PATH] = await previewImage(await captureViewPng(Viewer));
    preview = PREVIEW_PATH;
  } catch (error) {
    problems.push(`no preview image (${error.message})`);
  }

  const label = scene.label && typeof scene.label === "object" ? Object.values(scene.label)[0]?.[0] : null;
  const manifest = {
    format: ONE_FORMAT,
    version: ONE_VERSION,
    generator: "ExPlora4D viewer",
    created: new Date().toISOString(),
    title: carried.title || label || core.fileObject.basename || "Model",
    units: carried.units || "m",
    upAxis: carried.upAxis || "Y",
    ...(preview ? { preview } : {}),
    scene: SCENE_PATH,
    parts,
    ...(carried.timeline ? { timeline: carried.timeline } : {}),
    ...(carried.certainty ? { certainty: carried.certainty } : {}),
    metadata: {
      ...(carried.metadata || {}),
      ...(scene.rights ? { rights: scene.rights } : {}),
      provenance: [
        ...(carried.metadata?.provenance || []),
        {
          activity: "export",
          software: "ExPlora4D viewer",
          date: new Date().toISOString(),
          ...(sourceUrl ? { source: sourceUrl } : {}),
        },
      ],
    },
  };
  const { bytes, manifest: written } = await writeOneContainer(manifest, files, { deflate: platformDeflate });
  return { bytes, manifest: written, embedded, linked, problems };
}

function download(bytes, fileName) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportOneContainer(Viewer, { save = true } = {}) {
  const result = await buildOneExport(Viewer);
  const fileName = `${safeName(modelBasename(core.fileObject.basename || "model")) || "model"}.one4d`;
  if (save) download(result.bytes, fileName);
  result.problems.forEach((problem) => console.warn(`[one export] ${problem}`));
  return { ...result, fileName };
}

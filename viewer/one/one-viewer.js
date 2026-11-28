// The One (.one4d) in the viewer: the container opened (from a File, or by
// URL with Range requests), its parts built into three.js objects and its
// timeline, Level of Certainty scale and scene manifest handed to the
// viewer's own tools. Loaded with the first .one4d (loaders.js).
//
// Shown: one object per part, named "one-<part id>" (the names the
// container's timeline stages refer to, one-container.js
// timelineForViewer), under one root - or the part's object itself when
// the container has one part. Each part is shown at its coarsest level of
// detail first; then every part gets the level its size on screen calls
// for (createOneLod), and again whenever the camera moves enough to change
// it: nearer, finer; further, coarser.

import THREE from "../init.js";
import { loadIfcProperties } from "../ifc-properties.js";
import {
  blobSource,
  openOneContainer,
  partLods,
  primaryPart,
  timelineForViewer,
  urlSource,
  ONE_PART_KINDS,
} from "./one-container.js";
import { chooseLevel, screenMeasure } from "./one-lod.js";

// Object URLs of the files of the container shown (parts read by URL,
// files its scene manifest names), released with the next container.
let containerUrls = [];

function releaseContainerUrls() {
  containerUrls.forEach((url) => URL.revokeObjectURL(url));
  containerUrls = [];
}

async function containerUrl(one, path, type = "") {
  one.objectUrls ??= new Map();
  if (!one.objectUrls.has(path)) {
    const url = URL.createObjectURL(new Blob([await one.readFile(path)], { type: type || one.manifest.files?.[path]?.mediaType || "" }));
    one.objectUrls.set(path, url);
    containerUrls.push(url);
  }
  return one.objectUrls.get(path);
}

export async function openOneForViewer(modelPath, file = null) {
  releaseContainerUrls();
  const source = file
    ? blobSource(file)
    : await urlSource(new URL(modelPath, window.location.href).href);
  return openOneContainer(source);
}

// A level's bytes are kept once read (up to BYTE_CACHE_LIMIT for the
// container): going back to a level read before reads nothing again.
const BYTE_CACHE_LIMIT = 512 * 1024 * 1024;
async function readCached(one, path) {
  one.byteCache ??= new Map();
  if (one.byteCache.has(path)) return one.byteCache.get(path);
  const data = await one.readFile(path);
  const used = [...one.byteCache.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0);
  if (used + data.byteLength <= BYTE_CACHE_LIMIT) one.byteCache.set(path, data);
  return data;
}

// The parts drawn by this version (others are kept in the file, skipped).
export function shownParts(manifest) {
  const primary = primaryPart(manifest);
  const parts = (manifest.parts || []).filter((part) => ONE_PART_KINDS.includes(part.kind)
    && ["mesh", "points", "splats"].includes(part.kind) && part.hidden !== true);
  return [primary, ...parts.filter((part) => part !== primary)].filter(Boolean);
}

export const needsWebGL = (manifest) => shownParts(manifest).some((part) => part.kind !== "mesh");

const extensionOf = (path) => String(path).split(".").pop().toLowerCase();

// The object of one level of a part. `loaders`: the viewer's loaders
// ({ gltf(url), las(url, options), splats(buffer, options) }).
async function buildLevel(one, part, level, loaders) {
  const lod = partLods(part)[level];
  const data = await readCached(one, lod.path);
  const ext = extensionOf(lod.path);
  const name = `one-${part.id}`;
  let object;
  if (part.kind === "mesh") {
    if (!["glb", "gltf"].includes(ext)) throw new Error(`${lod.path}: a mesh part is glTF (.glb) in this version`);
    const url = URL.createObjectURL(new Blob([data], { type: "model/gltf-binary" }));
    try {
      object = await loaders.gltf(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  } else if (part.kind === "points") {
    if (!["las", "laz"].includes(ext)) throw new Error(`${lod.path}: a point cloud part is LAS/LAZ (COPC) in this version`);
    // The worker reads the cloud by URL; the URL lives as long as the page
    // (it streams in batches after this returns).
    const url = await containerUrl(one, lod.path);
    ({ object } = await loaders.las(url, { name: part.label || part.id, compressed: ext === "laz" }));
  } else if (part.kind === "splats") {
    // `lighting`: the splats' lighting volume (worker/splat_volume.py).
    const volumeUrl = part.lighting && one.has(part.lighting) ? await containerUrl(one, part.lighting) : null;
    object = await loaders.splats(data.slice().buffer, { fileName: lod.path, name: part.label || part.id, volumeUrl });
  }
  // The part's place in the file's space (4x4, column-major as in glTF).
  if (Array.isArray(part.transform) && part.transform.length === 16) {
    const placed = new THREE.Group();
    new THREE.Matrix4().fromArray(part.transform).decompose(placed.position, placed.quaternion, placed.scale);
    placed.add(object);
    placed.animations = object.animations || [];
    object = placed;
  }
  object.name = name;
  object.userData.onePart = { id: part.id, kind: part.kind, level, path: lod.path };
  if (part.certainty != null) object.userData.certainty = part.certainty;
  if (part.metadata) object.userData.oneMetadata = part.metadata;
  return object;
}

function assemble(objects, manifest) {
  if (objects.length === 1) return objects[0];
  const root = new THREE.Group();
  root.name = manifest.title || "one";
  objects.forEach((object) => root.add(object));
  root.animations = objects.flatMap((object) => object.animations || []);
  return root;
}

// ---------------------------------------------------------------------------
// Levels of detail chosen by the camera

// The parts and the levels they show, and roots built for other levels.
// `loaders` as for buildLevel.
export function createOneLod(one, loaders) {
  const parts = shownParts(one.manifest);
  if (!parts.length) throw new Error("The .one4d file has no part this viewer shows (mesh, points, splats)");
  // part id -> { level, object } of the root shown.
  const shown = new Map();
  const sphereOf = new Map();

  function assembleRoot(objects) {
    return assemble(objects, one.manifest);
  }

  return {
    parts,
    refinable: parts.some((part) => partLods(part).length > 1),
    levels: () => parts.map((part) => shown.get(part.id)?.level ?? 0),
    differs(levels) {
      return parts.some((part, index) => (shown.get(part.id)?.level ?? -1) !== levels[index]);
    },
    // A root with each part at `levels`: a part already at its level is
    // moved over, not built again (it leaves the old root).
    async rootFor(levels) {
      const objects = await Promise.all(parts.map((part, index) => {
        const current = shown.get(part.id);
        return current && current.level === levels[index] && parts.length > 1
          ? current.object
          : buildLevel(one, part, levels[index], loaders);
      }));
      return assembleRoot(objects);
    },
    // After `root` went on screen.
    commit(root) {
      parts.forEach((part) => {
        const object = parts.length === 1 ? root : root.getObjectByName(`one-${part.id}`);
        if (!object) return;
        shown.set(part.id, { level: object.userData.onePart?.level ?? 0, object });
        sphereOf.set(part.id, new THREE.Box3().setFromObject(object).getBoundingSphere(new THREE.Sphere()));
      });
    },
    // The levels the camera calls for now.
    wanted(camera, viewHeight) {
      return parts.map((part) => {
        const lods = partLods(part);
        const current = shown.get(part.id);
        const sphere = sphereOf.get(part.id);
        if (!current || !sphere || sphere.isEmpty() || !Number.isFinite(sphere.radius)) return current?.level ?? 0;
        const worldScale = current.object.getWorldScale(new THREE.Vector3()).x;
        return chooseLevel(lods, screenMeasure(camera, sphere, viewHeight), current.level, Math.abs(worldScale) || 1);
      });
    },
  };
}

// The container's scene manifest (an AIM3D manifest: annotations, camera,
// looks...), else its own timeline and certainty scale, applied over the
// model now shown.
export async function applyOneScene(one, Viewer) {
  const { manifest } = one;
  // A building's properties (`properties`: the <name>_ifc.json the
  // conversion writes, ifc-properties.js), for the primary part.
  const withProperties = shownParts(manifest).find((part) => part.properties && one.has(part.properties));
  if (withProperties) loadIfcProperties(await containerUrl(one, withProperties.properties, "application/json"));
  if (manifest.scene) {
    try {
      const scene = await embedContainerUrls(await one.readJSON(manifest.scene), one, manifest.scene);
      if (Viewer.import3IFManifest?.(scene, { quiet: true })) return;
      console.warn(`[one] ${manifest.scene}: not imported (invalid or newer AIM3D manifest)`);
    } catch (error) {
      console.warn(`[one] ${manifest.scene}: ${error.message}`);
    }
  }
  if (manifest.certainty) Viewer.setCertaintyScale?.(manifest.certainty);
  const timeline = timelineForViewer(manifest);
  if (timeline) Viewer.apply3IFManifestTimeline?.(timeline);
}

// The scene manifest with every string naming a file of the container
// ("res/bell.mp3", "./res/bell.mp3") turned into that file's object URL:
// sounds, photos, data tables, maps, thumbnails, the environment map...
// are read from the container like from a server.
export async function embedContainerUrls(value, one, scenePath = null) {
  if (typeof value === "string") {
    const path = value.replace(/^\.\//, "");
    if (path && path !== scenePath && path !== "one.json" && one.has(path)) return containerUrl(one, path);
    return value;
  }
  if (Array.isArray(value)) return Promise.all(value.map((item) => embedContainerUrls(item, one, scenePath)));
  if (value && typeof value === "object") {
    const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await embedContainerUrls(item, one, scenePath)]));
    return Object.fromEntries(entries);
  }
  return value;
}

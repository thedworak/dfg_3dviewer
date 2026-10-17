import THREE from "./init.js";
import { core } from "./core.js";

// Streamed, level-of-detail models through 3d-tiles-renderer (NASA-AMMOS):
//
//   3D Tiles  - a "tileset.json" (b3dm, i3dm, pnts, glb and composite tiles),
//               e.g. photogrammetry meshes or point clouds from py3dtiles
//   Potree 2  - a "metadata.json" from PotreeConverter 2 (octree.bin,
//               hierarchy.bin), for very large point clouds
//
// Only the tiles the camera needs are downloaded; closer views refine them.
// Point clouds get adaptive point sizes and Eye-Dome Lighting. The model's
// group behaves like any other model root (transform, clipping, metadata),
// but its meshes come and go with the level of detail, so face-based
// features (annotations, area selection) are not available for it.

const loadTilesModule = () => import("3d-tiles-renderer/three");
const loadTilesPlugins = () => import("3d-tiles-renderer/three/plugins");

let activeTiles = null;
let disposeDecoders = null;
let boundsProxy = null;
let pointCloudPlugin = null;

// The first tiles (the root level) often cover less than the whole tileset,
// so centring and camera framing would be off. This stands in for the full
// extent: Box3.setFromObject() counts any object with a geometry, while a
// plain Object3D is never rendered, picked or listed as a mesh.
function addTilesetBounds(tiles) {
  const box = new THREE.Box3();
  const matrix = new THREE.Matrix4();
  if (!tiles.getOrientedBoundingBox(box, matrix) || box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  boundsProxy = new THREE.Object3D();
  boundsProxy.name = "tileset-bounds";
  boundsProxy.geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  boundsProxy.applyMatrix4(new THREE.Matrix4().makeTranslation(center.x, center.y, center.z).premultiply(matrix));
  boundsProxy.userData.isTilesetBounds = true;
  tiles.group.add(boundsProxy);
}

// "3dtiles" | "potree" | null for a model URL / file name. ?format= wins.
export function detectTiledFormat(fileName) {
  const forced = new URLSearchParams(window.location.search).get("format");
  if (forced === "3dtiles" || forced === "potree") return forced;
  const name = String(fileName || "").split(/[?#]/)[0].split("/").pop().toLowerCase();
  if (name === "tileset.json" || name.endsWith(".tileset.json")) return "3dtiles";
  if (name === "metadata.json" || name.endsWith(".potree.json")) return "potree";
  return null;
}

function hasTileContent(group) {
  let found = false;
  group.traverse((child) => {
    if (!found && (child.isPoints || child.isMesh) && child.geometry?.getAttribute?.("position")?.count) {
      found = true;
    }
  });
  return found;
}

// Point shape / EDL / debug colours of the streamed cloud (point cloud panel).
export function getPointCloudPlugin() {
  return pointCloudPlugin;
}

export function getActiveTiles() {
  return activeTiles;
}

// Called from the render loop.
export function updateTiles() {
  if (!activeTiles || !core.camera || !core.renderer) return;
  activeTiles.setResolutionFromRenderer(core.camera, core.renderer);
  activeTiles.update();
}

export function disposeTiles() {
  if (!activeTiles) return;
  boundsProxy?.geometry.dispose();
  boundsProxy = null;
  pointCloudPlugin = null;
  activeTiles.group.removeFromParent();
  activeTiles.dispose();
  activeTiles = null;
  disposeDecoders?.();
  disposeDecoders = null;
  core.tiledModel = null;
}

// Settings (viewer-settings.json -> viewer.tiles): errorTarget (screen-space
// error in px, default 6; lower = more detail), pointShape (square | round |
// sphere), edlStrength (Eye-Dome Lighting, default 0.4; 0 disables it),
// pointScale (Potree point size factor, default 1), georeferenced (true:
// Earth-centred, laid flat on the globe; false: local / projected, Z up;
// unset: guessed - see isGeocentric).
function getTilesOptions() {
  const config = core.CONFIG?.viewer?.tiles || {};
  const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
  return {
    errorTarget: number(config.errorTarget, 6),
    pointShape: ["square", "round", "sphere"].includes(config.pointShape) ? config.pointShape : "round",
    edlStrength: number(config.edlStrength, 0.4),
    pointScale: number(config.pointScale, 1),
    georeferenced: typeof config.georeferenced === "boolean" ? config.georeferenced : null,
  };
}

// PotreeLoader decodes position, colour and intensity; classification is
// added here from the same point records, for the point cloud panel's
// "Classification" colours. Positions are untouched, so it stays in step
// with the loader whatever its version.
function decodePotreeClassification(loader) {
  if (!loader?.parsePointData) return;
  const parse = loader.parsePointData.bind(loader);
  loader.parsePointData = (buffer, ...args) => {
    const result = parse(buffer, ...args);
    let stride = 0;
    let offset = -1;
    (loader.metadata?.attributes || []).forEach((attribute) => {
      if (attribute.name === "classification" && attribute.size === 1) offset = stride;
      stride += attribute.size;
    });
    if (offset < 0 || !stride) return result;
    const count = Math.floor(buffer.byteLength / stride);
    const bytes = new Uint8Array(buffer);
    const classes = new Uint8Array(count);
    for (let i = 0; i < count; i += 1) classes[i] = bytes[i * stride + offset];
    result.geometry.setAttribute("classification", new THREE.BufferAttribute(classes, 1));
    return result;
  };
}

// Attributes a Potree cloud carries, from its metadata.json: name -> { min, max }.
export function getPotreeAttributes() {
  const metadata = core.tiledModel?.format === "potree" ? pointCloudPlugin?.loader?.metadata : null;
  const result = {};
  (metadata?.attributes || []).forEach((attribute) => {
    result[attribute.name] = { min: attribute.min, max: attribute.max };
  });
  return result;
}

// The whole tileset's box in world space (not only the tiles loaded now).
export function getTiledModelBox() {
  if (!boundsProxy) return null;
  boundsProxy.updateWorldMatrix(true, false);
  const box = new THREE.Box3().setFromBufferAttribute(boundsProxy.geometry.getAttribute("position"));
  return box.applyMatrix4(boundsProxy.matrixWorld);
}

// Whether a tileset is in Earth-centred coordinates (ECEF, e.g. photogrammetry
// from Cesium ion), to be laid flat at its place on the globe. 3d-tiles-renderer's
// ReorientationPlugin assumes so for any centre farther than half the Earth's
// radius from the origin - which projected coordinates are too: UTM or
// Gauss-Krüger scans (point clouds from PotreeConverter or py3dtiles) have
// northings of millions of metres, and were tilted by the Earth's curvature
// at the wrong place. A point on the globe has |z| = R sin(latitude), so z
// near 0 only within ~10 km of the equator; in a projected system z is the
// height. viewer.tiles.georeferenced: true / false overrides the guess.
function isGeocentric(tiles, setting) {
  if (setting === true || setting === false) return setting;
  const sphere = new THREE.Sphere();
  if (!tiles.getBoundingSphere(sphere)) return false;
  const minRadius = Math.min(...tiles.ellipsoid.radius);
  return sphere.center.length() > minRadius * 0.5 && Math.abs(sphere.center.z) >= 10_000;
}

// What ReorientationPlugin does for a local tileset: Z up (3D Tiles, Potree)
// turned to three.js' Y up, and the centre moved to the origin.
function orientLocalTileset(tiles) {
  const sphere = new THREE.Sphere();
  tiles.getBoundingSphere(sphere);
  const group = tiles.group;
  group.rotation.set(-Math.PI / 2, 0, 0);
  group.position.copy(sphere.center).applyEuler(group.rotation).multiplyScalar(-1);
}

// Creates the renderer for a tileset or Potree cloud, waits for the first
// batch of tiles and resolves with its group (the model root). onModel is
// called for every tile model loaded now or later (material setup).
export async function loadTiledModel({ url, format, configureGLTFLoader, onModel, onProgress }) {
  disposeTiles();
  const [{ TilesRenderer }, plugins] = await Promise.all([loadTilesModule(), loadTilesPlugins()]);
  const options = getTilesOptions();

  // Potree has no tileset.json: the plugin turns metadata.json into one.
  const tiles = new TilesRenderer(format === "potree" ? null : url);
  tiles.errorTarget = options.errorTarget;
  tiles.setCamera(core.camera);
  tiles.setResolutionFromRenderer(core.camera, core.renderer);

  // Draco / Meshopt / KTX2 like standalone GLBs (loaders.js).
  const gltfDecoders = await configureGLTFLoader();
  disposeDecoders = gltfDecoders.dispose;
  tiles.registerPlugin(new plugins.GLTFExtensionsPlugin({
    dracoLoader: gltfDecoders.dracoLoader,
    ktxLoader: gltfDecoders.ktx2Loader,
    meshoptDecoder: gltfDecoders.meshoptDecoder,
    autoDispose: false,
  }));
  pointCloudPlugin = format === "potree"
    ? new plugins.PotreePlugin({
      url,
      pointScale: options.pointScale,
      pointShape: options.pointShape,
      edlStrength: options.edlStrength,
    })
    : new plugins.PointCloudEffectsPlugin({
      pointShape: options.pointShape,
      edlStrength: options.edlStrength,
    });
  tiles.registerPlugin(pointCloudPlugin);
  if (format === "potree") decodePotreeClassification(pointCloudPlugin.loader);

  tiles.addEventListener("load-model", ({ scene, tile }) => {
    // Level in the tile tree, for the point cloud panel's "detail levels" colours.
    const depth = tile?.internal?.depth;
    if (Number.isFinite(depth)) scene.traverse((child) => { child.userData.tileDepth = depth; });
    onModel?.(scene);
  });

  activeTiles = tiles;
  core.tiledModel = { format, tiles };
  core.scene.add(tiles.group);

  // Oriented as soon as the root (with its bounding volume) is in, before any
  // content is requested: tiles are only loaded when the camera sees them,
  // and a cloud left where its coordinates put it (UTM, millions of metres
  // from the origin) is out of sight of the camera of the previous model -
  // nothing would ever load. ReorientationPlugin, registered only now, orients
  // the group right away (its init runs immediately once the root is loaded)
  // and never later, after afterLoad has centred the model: georeferenced
  // tilesets (ECEF, thousands of km from the origin) are moved to the origin
  // with local "up" along +Y; local ones are turned from the Z-up convention
  // of 3D Tiles and Potree to three.js' Y-up. afterLoad keeps this transform
  // for tiled models.
  let oriented = false;
  const orient = () => {
    oriented = true;
    if (isGeocentric(tiles, options.georeferenced)) {
      tiles.registerPlugin(new plugins.ReorientationPlugin({ up: "+z", recenter: true }));
    } else {
      orientLocalTileset(tiles);
    }
    tiles.group.updateMatrixWorld(true);
  };

  // Wait - checking state every frame rather than relying on the order of
  // the renderer's events, which varies with machine speed - until the root
  // tileset (with its bounding volume) and a first batch of content are in.
  await new Promise((resolve, reject) => {
    let settled = false;
    let firstBatchDone = false;
    const onLoadEnd = () => {
      if (tiles.root) firstBatchDone = true;
    };
    const onError = ({ error, url: failedUrl }) => {
      // A missing root is fatal; a single broken tile is not.
      if (!tiles.root) finish(error || new Error(`Failed to load ${failedUrl || url}`));
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      tiles.removeEventListener("tiles-load-end", onLoadEnd);
      tiles.removeEventListener("load-error", onError);
      if (error) reject(error);
      else resolve();
    };
    tiles.addEventListener("tiles-load-end", onLoadEnd);
    tiles.addEventListener("load-error", onError);
    // Nothing loads until the renderer is updated with a camera.
    const pump = () => {
      if (settled || activeTiles !== tiles) return;
      if (tiles.root?.engineData?.boundingVolume && !oriented) {
        orient();
        onProgress?.(50);
      }
      updateTiles();
      const ready = tiles.root?.engineData?.boundingVolume
        && (firstBatchDone || tiles.loadProgress === 1)
        && hasTileContent(tiles.group);
      if (ready) finish();
      else requestAnimationFrame(pump);
    };
    pump();
  });

  addTilesetBounds(tiles);
  tiles.group.updateMatrixWorld(true);
  tiles.group.name = tiles.group.name || (format === "potree" ? "Potree point cloud" : "3D Tiles");
  tiles.group.userData.isTiledModel = true;
  return tiles.group;
}

export function getTiledModelBoundingSphere() {
  const sphere = new THREE.Sphere();
  return activeTiles?.getBoundingSphere(sphere) ? sphere : null;
}

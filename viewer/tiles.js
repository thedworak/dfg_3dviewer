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
// pointScale (Potree point size factor, default 1).
function getTilesOptions() {
  const config = core.CONFIG?.viewer?.tiles || {};
  const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
  return {
    errorTarget: number(config.errorTarget, 6),
    pointShape: ["square", "round", "sphere"].includes(config.pointShape) ? config.pointShape : "round",
    edlStrength: number(config.edlStrength, 0.4),
    pointScale: number(config.pointScale, 1),
  };
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
  // Georeferenced tilesets sit thousands of km from the origin (ECEF): move
  // them to the origin, local "up" along +Y. Local ones are just centred and
  // turned from the Z-up convention of 3D Tiles and Potree to three.js' Y-up.
  // This sets the group's transform, which afterLoad keeps for tiled models.
  tiles.registerPlugin(new plugins.ReorientationPlugin({ up: "+z", recenter: true }));
  if (format === "potree") {
    tiles.registerPlugin(new plugins.PotreePlugin({
      url,
      pointScale: options.pointScale,
      pointShape: options.pointShape,
      edlStrength: options.edlStrength,
    }));
  } else {
    tiles.registerPlugin(new plugins.PointCloudEffectsPlugin({
      pointShape: options.pointShape,
      edlStrength: options.edlStrength,
    }));
  }

  tiles.addEventListener("load-model", ({ scene }) => onModel?.(scene));

  activeTiles = tiles;
  core.tiledModel = { format, tiles };
  core.scene.add(tiles.group);

  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      tiles.removeEventListener("tiles-load-end", onLoadEnd);
      tiles.removeEventListener("load-error", onError);
      if (error) reject(error);
      else resolve();
    };
    // The first "tiles-load-end" after the root tileset means the coarse
    // level is on screen - enough to frame the camera.
    const onLoadEnd = () => {
      if (tiles.root) finish();
    };
    const onError = ({ error, url: failedUrl }) => {
      // A missing root is fatal; a single broken tile is not.
      if (!tiles.root) finish(error || new Error(`Failed to load ${failedUrl || url}`));
    };
    tiles.addEventListener("tiles-load-end", onLoadEnd);
    tiles.addEventListener("load-error", onError);
    tiles.addEventListener("load-root-tileset", () => onProgress?.(50));
    // Nothing loads until the renderer is updated with a camera.
    const pump = () => {
      if (settled || activeTiles !== tiles) return;
      updateTiles();
      requestAnimationFrame(pump);
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

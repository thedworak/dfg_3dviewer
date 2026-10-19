import THREE from "./init.js";
import { core } from "./core.js";
import { SparkRenderer, SplatMesh, isMobile } from "@sparkjsdev/spark";

// Gaussian splats (3D Gaussian Splatting captures: .ply, .spz, .splat,
// .ksplat, .sog, .rad), drawn with Spark (sparkjs.dev) together with the meshes of
// the scene. Loaded dynamically by loaders.js, so Spark (with its WebAssembly
// and workers, embedded in the bundle) is only downloaded with the first
// splat file.
//
// The splats come in a group: afterLoad() resets the root's transform, and
// the captures are usually stored with Y down (COLMAP / INRIA), so the splat
// mesh under it is turned upright. A splat mesh is no three.js Mesh and has
// no geometry; it is given one holding the corners of its bounds, so the
// viewer's framing, grid and measurements (Box3.setFromObject) find it.
//
// Captures of a million splats and more (typical for .spz exports, with
// spherical harmonics of degree 3) are too much to draw whole every frame.
// From LOD_ABOVE splats on, Spark builds a level-of-detail tree in its worker
// while loading, and the renderer draws a budget of them each frame: merged
// splats far away, behind the camera and below LOD_RENDER_SCALE pixels.
// nonLod keeps the full set too, for the bounds, raycasts and forEachSplat.
// Phones also leave out the higher spherical harmonics (view-dependent
// colour), which cost texture reads on every splat.
//
// A .rad file (Spark's own format, written by its build-lod tool - the
// worker turns uploaded splats into one) holds that tree already built, so
// nothing is computed on loading. It decodes to the tree alone: the bounds
// and the count come from the tree's splats, the merged inner ones included.

const LOD_ABOVE = 300_000;
// Share of Spark's default per-platform budget (2.5M splats on desktop,
// 1-1.5M on phones, 0.5-0.75M in WebXR).
const LOD_SPLAT_SCALE = 0.5;
// Smallest LoD splat, in pixels; up to ~5 hardly shows.
const LOD_RENDER_SCALE = 2;
const MOBILE_MAX_SH = 1;

function ensureSparkRenderer() {
  const renderer = core.renderer;
  if (!renderer || !core.scene) return null;
  let spark = core.sparkRenderer;
  if (!spark || spark.renderer !== renderer) {
    spark?.parent?.remove(spark);
    spark = new SparkRenderer({ renderer, lodSplatScale: LOD_SPLAT_SCALE, lodRenderScale: LOD_RENDER_SCALE });
    spark.name = "spark-renderer";
    spark.userData.isSparkRenderer = true;
    core.sparkRenderer = spark;
  }
  if (spark.parent !== core.scene) core.scene.add(spark);
  return spark;
}

function boundsGeometry(box) {
  const geometry = new THREE.BufferGeometry();
  const { min, max } = box;
  const corners = [];
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) corners.push(x, y, z);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(corners, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function centersBox(splats) {
  const box = new THREE.Box3();
  splats.forEachSplat((_index, center) => box.expandByPoint(center));
  return box;
}

// Builds the splat model from the file's bytes. Resolves once the splats
// are decoded.
export async function buildSplatModel(buffer, { fileName = "splats", name = "Gaussian splats", upright = true } = {}) {
  ensureSparkRenderer();
  const mesh = new SplatMesh({
    fileBytes: new Uint8Array(buffer),
    fileName,
    lod: true,
    lodAbove: LOD_ABOVE,
    nonLod: true,
  });
  await mesh.initialized;
  if (isMobile()) mesh.maxSh = MOBILE_MAX_SH;
  mesh.name = name;
  if (upright) mesh.quaternion.set(1, 0, 0, 0);
  const splats = mesh.packedSplats ?? mesh.extSplats;
  const lodOnly = !splats?.numSplats && splats?.lodSplats ? splats.lodSplats : null;
  const box = lodOnly ? centersBox(lodOnly) : mesh.getBoundingBox(true);
  if (!box.isEmpty()) mesh.geometry = boundsGeometry(box);
  const count = (lodOnly ?? splats)?.numSplats ?? null;
  mesh.userData.gaussianSplats = { count, format: fileName.split(".").pop().toLowerCase() };
  mesh.userData.isGaussianSplats = true;

  const root = new THREE.Group();
  root.name = name;
  root.userData.isGaussianSplats = true;
  root.add(mesh);
  root.updateMatrixWorld(true);
  return root;
}

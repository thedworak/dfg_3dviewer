import THREE from "./init.js";
import { core } from "./core.js";
import { PackedSplats, SparkRenderer, SplatFileType, SplatMesh, isMobile } from "@sparkjsdev/spark";
import { attachSplatLighting } from "./splat-lighting.js";

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
//
// A .rad on a server is not downloaded whole: buildPagedSplatModel() reads
// its header and Spark then fetches the tree in chunks of 64K splats by HTTP
// range requests, the coarse root first and finer chunks where the camera
// looks - the capture shows after a few hundred kB and sharpens while it is
// viewed, and only what is seen takes GPU memory. Its bounds come from the
// root chunk (the coarse splats spread over the whole capture), its count
// from the header. Without range support (a proxy answering 200) the file
// is loaded whole, as above.
//
// Both are lit by the scene's lights when Lights > Splat lighting is on
// (splat-lighting.js).

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
  attachSplatLighting(mesh);

  const root = new THREE.Group();
  root.name = name;
  root.userData.isGaussianSplats = true;
  root.add(mesh);
  root.updateMatrixWorld(true);
  return root;
}

const RAD_PROBE_BYTES = 65536;

// Whether url answers range requests; the probe is the start of the file,
// where Spark reads the header from next.
async function supportsRanges(url) {
  try {
    const response = await fetch(url, { headers: { Range: `bytes=0-${RAD_PROBE_BYTES - 1}` } });
    const partial = response.status === 206;
    if (partial) await response.arrayBuffer();
    else response.body?.cancel().catch(() => {});
    return partial;
  } catch {
    return false;
  }
}

async function fetchBytes(url, offset, bytes) {
  const response = await fetch(url, { headers: { Range: `bytes=${offset}-${offset + bytes - 1}` } });
  if (response.status !== 206) throw new Error(`Range request for ${url} answered ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

// The root chunk of a paged .rad, decoded on its own for the bounds: the
// first chunk of the tree, its coarsest splats.
async function rootChunkBox(url, meta, chunksStart) {
  const chunk = meta.chunks[0];
  if (!chunk) return new THREE.Box3();
  const bytes = chunk.filename
    ? new Uint8Array(await (await fetch(new URL(chunk.filename, new URL(url, window.location.href)))).arrayBuffer())
    : await fetchBytes(url, chunksStart + chunk.offset, chunk.bytes);
  const root = new PackedSplats({ fileBytes: bytes, fileType: SplatFileType.RAD });
  await root.initialized;
  const box = centersBox(root.lodSplats ?? root);
  root.dispose();
  return box;
}

// Builds the splat model of a .rad at url, paged (see above). Resolves to
// null when the server does not answer range requests.
export async function buildPagedSplatModel(url, { fileName = "splats.rad", name = "Gaussian splats", upright = true } = {}) {
  if (!(await supportsRanges(url))) return null;
  ensureSparkRenderer();
  const mesh = new SplatMesh({ url, paged: true, fileType: SplatFileType.RAD });
  await mesh.initialized;
  const { meta, chunksStart } = await mesh.paged.getRadMeta();
  const box = await rootChunkBox(url, meta, chunksStart);
  if (isMobile()) mesh.maxSh = MOBILE_MAX_SH;
  mesh.name = name;
  if (upright) mesh.quaternion.set(1, 0, 0, 0);
  if (!box.isEmpty()) mesh.geometry = boundsGeometry(box);
  mesh.userData.gaussianSplats = { count: meta.count ?? null, format: fileName.split(".").pop().toLowerCase(), paged: true };
  mesh.userData.isGaussianSplats = true;
  attachSplatLighting(mesh);

  const root = new THREE.Group();
  root.name = name;
  root.userData.isGaussianSplats = true;
  root.add(mesh);
  root.updateMatrixWorld(true);
  return root;
}

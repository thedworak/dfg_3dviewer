import THREE from "./init.js";
import { core } from "./core.js";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";

// Gaussian splats (3D Gaussian Splatting captures: .ply, .spz, .splat,
// .ksplat, .sog), drawn with Spark (sparkjs.dev) together with the meshes of
// the scene. Loaded dynamically by loaders.js, so Spark (with its WebAssembly
// and workers, embedded in the bundle) is only downloaded with the first
// splat file.
//
// The splats come in a group: afterLoad() resets the root's transform, and
// the captures are usually stored with Y down (COLMAP / INRIA), so the splat
// mesh under it is turned upright. A splat mesh is no three.js Mesh and has
// no geometry; it is given one holding the corners of its bounds, so the
// viewer's framing, grid and measurements (Box3.setFromObject) find it.

function ensureSparkRenderer() {
  const renderer = core.renderer;
  if (!renderer || !core.scene) return null;
  let spark = core.sparkRenderer;
  if (!spark || spark.renderer !== renderer) {
    spark?.parent?.remove(spark);
    spark = new SparkRenderer({ renderer });
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

// Builds the splat model from the file's bytes. Resolves once the splats
// are decoded.
export async function buildSplatModel(buffer, { fileName = "splats", name = "Gaussian splats", upright = true } = {}) {
  ensureSparkRenderer();
  const mesh = new SplatMesh({ fileBytes: new Uint8Array(buffer), fileName });
  await mesh.initialized;
  mesh.name = name;
  if (upright) mesh.quaternion.set(1, 0, 0, 0);
  const box = mesh.getBoundingBox(true);
  if (!box.isEmpty()) mesh.geometry = boundsGeometry(box);
  const count = mesh.packedSplats?.numSplats ?? mesh.extSplats?.numSplats ?? null;
  mesh.userData.gaussianSplats = { count, format: fileName.split(".").pop().toLowerCase() };
  mesh.userData.isGaussianSplats = true;

  const root = new THREE.Group();
  root.name = name;
  root.userData.isGaussianSplats = true;
  root.add(mesh);
  root.updateMatrixWorld(true);
  return root;
}

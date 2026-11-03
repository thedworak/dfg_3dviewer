import { core } from "./core.js";
import { hasIfcProperties } from "./ifc-properties.js";

// What kind of model is shown - one answer for the whole viewer: the
// toolbar's tools for the format (editor-toolbar.js FORMAT_TOOL_PROFILES),
// the checks before publishing (editor/publish-check.js) and the scene
// suggestions (editor/scene-suggest.js).
//
// - "mesh": surfaces (glb, obj, fbx, stl, usd...).
// - "bim": a building model with IFC properties (an .ifc, or the model
//   converted from one with its <name>_ifc.json).
// - "pointcloud": points (las, laz, xyz, pcd, a ply without faces).
// - "splats": Gaussian splats (spz, splat, ksplat, sog, rad).
// - "volume": voxels (CT, microscopy and medical image stacks).
// - null: nothing loaded yet.
export const MODEL_KINDS = ["mesh", "bim", "pointcloud", "splats", "volume"];

// A guess from the file's extension, for the moments before the model is in
// the scene (the toolbar shows while it loads).
const EXTENSION_KINDS = {
  ifc: "bim",
  las: "pointcloud",
  laz: "pointcloud",
  xyz: "pointcloud",
  pcd: "pointcloud",
  spz: "splats",
  splat: "splats",
  ksplat: "splats",
  sog: "splats",
  rad: "splats",
  dfgvol: "volume",
  lif: "volume",
  tif: "volume",
  tiff: "volume",
  nrrd: "volume",
  nhdr: "volume",
  nii: "volume",
  mha: "volume",
  mhd: "volume",
  mrc: "volume",
  rec: "volume",
  ccp4: "volume",
  vgi: "volume",
  xtekct: "volume",
  lsm: "volume",
  dcm: "volume",
  dicom: "volume",
};

export function modelKindFromExtension(extension) {
  const ext = String(extension || "").toLowerCase().replace(/^\./, "");
  if (!ext) return null;
  return EXTENSION_KINDS[ext] || "mesh";
}

// The model's objects (as editor/sun-study.js getSunModelRoots).
function modelRoots(viewer) {
  if (typeof viewer?.getSunModelRoots === "function") return viewer.getSunModelRoots();
  const slots = Array.isArray(core.mainObject) ? core.mainObject : [core.mainObject];
  return slots.flat().filter((item) => item?.isObject3D);
}

// What the scene holds: "mesh", "pointcloud", "splats", or null without a
// model. Splats win over points, points over surfaces; a point cloud with
// its settings window (editor/point-cloud-panel.js) and no surfaces is a
// point cloud even where its points are drawn by a mesh.
export function sceneContentKind(viewer, roots = modelRoots(viewer)) {
  if (!roots.length) return null;
  let kind = "mesh";
  let meshes = 0;
  roots.forEach((root) => root.traverse((object) => {
    if (object.userData?.isGaussianSplats) kind = "splats";
    if (object.isPoints && kind !== "splats") kind = "pointcloud";
    if (object.isMesh && object.geometry?.attributes?.position) meshes += 1;
  }));
  if (viewer?.isPointCloudActive?.() && kind === "mesh" && meshes === 0) kind = "pointcloud";
  return kind;
}

function currentExtension() {
  const file = core.fileObject || {};
  return String(file.orgExtension || file.extension || "").toLowerCase();
}

// The kind, worked out again only when the model changed (the scene is
// walked once per model, not on every toolbar update).
let cache = { key: null, kind: null };

export function getModelKind(viewer) {
  const roots = modelRoots(viewer);
  const extension = currentExtension();
  const volume = viewer?.isVolumeActive?.() === true;
  const pointCloud = viewer?.isPointCloudActive?.() === true;
  const ifc = hasIfcProperties();
  const key = [
    extension,
    roots.map((root) => root.uuid).join(","),
    window.viewer?.fullModelLoaded === true,
    volume,
    pointCloud,
    ifc,
  ].join("|");
  if (key === cache.key) return cache.kind;

  let kind;
  if (volume) {
    kind = "volume";
  } else {
    const content = sceneContentKind(viewer, roots);
    const guess = modelKindFromExtension(extension);
    if (content === "splats" || content === "pointcloud") kind = content;
    // A volume's box or a scan still being set up: the file says what it is.
    else if (content === "mesh" && ["volume", "pointcloud", "splats"].includes(guess)) kind = guess;
    else if (ifc || guess === "bim") kind = content || guess ? "bim" : null;
    else kind = content || guess;
  }
  cache = { key, kind };
  return kind;
}

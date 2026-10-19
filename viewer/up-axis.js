import THREE from "./init.js";

// Models whose "up" is not three.js' +Y: Z-up exports (CAD, scans,
// photogrammetry) and models upside down. `upAxis` names the axis of the
// file that points up; the fix turns it to +Y.
//
// The fix never touches the model root's own transform: the root keeps what
// afterLoad() resets and what metadata / config / manifests set (position,
// rotation, scale, and what the editor saves), so both compose and a saved
// rotation never carries the fix twice. A group root gets an inner pivot
// holding its children; a mesh or point root (STL, PLY, XYZ, ...) has its
// geometry turned instead.
export const UP_AXES = ["Y+", "Y-", "Z+", "Z-", "X+", "X-"];
export const DEFAULT_UP_AXIS = "Y+";

const UP_AXIS_EULERS = {
  "Y+": new THREE.Euler(0, 0, 0),
  "Y-": new THREE.Euler(Math.PI, 0, 0),
  "Z+": new THREE.Euler(-Math.PI / 2, 0, 0),
  "Z-": new THREE.Euler(Math.PI / 2, 0, 0),
  "X+": new THREE.Euler(0, 0, Math.PI / 2),
  "X-": new THREE.Euler(0, 0, -Math.PI / 2),
};

// "Z", "z+", "+Z", "z-up" -> "Z+"; "-z", "Z-" -> "Z-". Anything else: null.
export function normalizeUpAxis(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().toUpperCase().replace(/[-_ ]?UP$/, "").match(/^([+-]?)([XYZ])([+-]?)$/);
  if (!match || (match[1] && match[3])) return null;
  return `${match[2]}${match[1] || match[3] || "+"}`;
}

export function upAxisQuaternion(upAxis) {
  return new THREE.Quaternion().setFromEuler(UP_AXIS_EULERS[normalizeUpAxis(upAxis) ?? DEFAULT_UP_AXIS]);
}

export function getUpAxis(object) {
  const root = Array.isArray(object) ? object[0] : object;
  return normalizeUpAxis(root?.userData?.appliedUpAxis) ?? DEFAULT_UP_AXIS;
}

export function getUpAxisPivot(root) {
  return root?.children?.find((child) => child.userData?.isUpAxisPivot) ?? null;
}

// The model's first own node, past the pivot (config entries are matched
// by its name).
export function getFirstModelChild(root) {
  return (getUpAxisPivot(root) ?? root)?.children?.[0];
}

function ensurePivot(root) {
  let pivot = getUpAxisPivot(root);
  if (pivot) return pivot;
  pivot = new THREE.Group();
  pivot.name = "UpAxis";
  pivot.userData.isUpAxisPivot = true;
  [...root.children].forEach((child) => pivot.add(child));
  root.add(pivot);
  return pivot;
}

function bakeIntoGeometry(root, delta) {
  const geometry = root.geometry;
  geometry.applyMatrix4(delta);
  // A BVH (IFC) is built from the old positions.
  if (geometry.boundsTree) {
    geometry.disposeBoundsTree?.();
    geometry.computeBoundsTree?.();
  }
  root.children.forEach((child) => {
    child.applyMatrix4(delta);
  });
}

// Turns `object` (a model root, or an array of them) so that its `upAxis`
// points up. Repeated calls replace the previous fix. `bakeGeometry: false`
// is for copies sharing the model's geometry (the section outline), whose
// geometry has turned with the model already.
// Returns true when the model's orientation changed.
export function applyUpAxis(object, upAxis, { bakeGeometry = true } = {}) {
  if (Array.isArray(object)) {
    return object.map((item) => applyUpAxis(item, upAxis, { bakeGeometry })).some(Boolean);
  }
  if (!object?.isObject3D) return false;
  const next = normalizeUpAxis(upAxis) ?? DEFAULT_UP_AXIS;
  // A streamed tileset is oriented by tiles.js, and its tiles come and go
  // under its group.
  if (object.userData?.isTiledModel) {
    if (next !== DEFAULT_UP_AXIS) console.warn(`upAxis "${next}" is not applied to tiled models`);
    return false;
  }
  const previous = getUpAxis(object);
  if (previous === next) return false;

  if (object.geometry && !getUpAxisPivot(object)) {
    if (bakeGeometry) {
      const delta = new THREE.Matrix4().makeRotationFromQuaternion(
        upAxisQuaternion(next).multiply(upAxisQuaternion(previous).invert())
      );
      bakeIntoGeometry(object, delta);
    }
  } else {
    ensurePivot(object).quaternion.copy(upAxisQuaternion(next));
  }

  object.userData.appliedUpAxis = next;
  object.updateMatrixWorld(true);
  return true;
}

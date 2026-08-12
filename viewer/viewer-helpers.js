import THREE from "./init.js";
import { core } from "./core.js";
import { normalizeColor } from "./utils.js";
import { buildThumbnailGallery } from "./ui/thumbnail-gallery.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";

export function normalizeDrupalFilesPath(path) {
  if (!path || typeof path !== "string") {
    return "";
  }

  return path
    .replace(/^https?:\/\/{1,2}[^/]+\/?/, "")
    .replace(/^public:\/\//, "")
    .replace(/^\/?sites\/default\/files\/?/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

export function normalizeArchiveModelPath(path) {
  if (!path || typeof path !== "string") {
    return "";
  }

  const injectGltfSegment = (pathname) => {
    if (!/\/[^/]+_(ZIP|RAR|TAR|XZ|GZ)\//i.test(pathname) || /\/gltf\//i.test(pathname)) {
      return pathname;
    }
    return pathname.replace(
      /^(.*\/[^/]+_(ZIP|RAR|TAR|XZ|GZ))(\/?)(.*)$/i,
      "$1/gltf/$4"
    );
  };

  if (/^[a-zA-Z][\w+-.]*:\/\//.test(path)) {
    try {
      const url = new URL(path);
      url.pathname = injectGltfSegment(url.pathname);
      return url.href;
    } catch (_err) {
      return injectGltfSegment(path);
    }
  }

  return injectGltfSegment(path);
}

export function setModelPaths(viewer) {
  if (!core.fileObject.originalPath) {
    core.fileObject.filename = "";
    core.fileObject.basename = "";
    core.fileObject.extension = "";
    core.fileObject.path = "";
    core.fileObject.uri = "";
    core.fileObject.relativePath = "";
    return;
  }

  core.fileObject.filename = core.fileObject.originalPath.split("/").pop();
  core.fileObject.basename = core.fileObject.filename.substring(0, core.fileObject.filename.lastIndexOf("."));
  core.fileObject.extension = core.fileObject.filename.substring(core.fileObject.filename.lastIndexOf(".") + 1);
  core.fileObject.path = core.fileObject.originalPath.substring(0, core.fileObject.originalPath.lastIndexOf(core.fileObject.filename)) || "/";
  core.fileObject.uri = core.fileObject.path.replace(core.CONFIG.mainUrl + "/", "");
  core.fileObject.relativePath = normalizeDrupalFilesPath(core.fileObject.uri);
  viewer.fileObject = core.fileObject;
}

export function disableInteractionHint(viewer) {
  if (core.PRESENTATION_MODE) return;
  core.handHint.hidden = true;
  viewer.stopGesture();

  if (core.cameraTween && typeof core.cameraTween.stop === "function") {
    core.cameraTween.stop();
    core.cameraTween = null;
  }
  if (core.targetTween && typeof core.targetTween.stop === "function") {
    core.targetTween.stop();
    core.targetTween = null;
  }

  localStorage.setItem("viewerHintSeen", "1");
}

export function addTextWatermark(viewer, _text, _scale) {
  const materials = [
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.4,
    }),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.4,
    }),
  ];
  const loader = new FontLoader();

  loader.load(
    `${core.DFG_ASSETS}/fonts/helvetiker_regular.typeface.json`,
    function (font) {
      const textGeo = new TextGeometry(_text, {
        font,
        size: _scale * 3,
        height: _scale / 10,
        curveSegments: 5,
        bevelEnabled: true,
        bevelThickness: _scale / 8,
        bevelSize: _scale / 10,
        bevelOffset: 0,
        bevelSegments: 1,
      });
      textGeo.computeBoundingBox();

      viewer.textMesh = new THREE.Mesh(textGeo, materials);
      viewer.textMesh.rotation.z = Math.PI;
      viewer.textMesh.rotation.y = Math.PI;
      viewer.textMesh.position.set(0, 0, 0);
      viewer.textMesh.renderOrder = 1;
      core.scene.add(viewer.textMesh);
    }
  );
}

export function addTextPoint(viewer, _text, _scale, _point) {
  const loader = new FontLoader();
  const bevelSize = _scale / 10;

  loader.load(`${core.DFG_ASSETS}/fonts/helvetiker_regular.typeface.json`, (font) => {
    const baseOptions = {
      font,
      size: _scale * 3,
      height: _scale,
      curveSegments: 4,
      bevelEnabled: true,
      bevelThickness: bevelSize,
      bevelSize: bevelSize / 10,
      bevelOffset: 0,
      bevelSegments: 1,
      depth: _scale / 10,
    };

    const textGeo = new TextGeometry(_text, baseOptions);
    textGeo.computeBoundingBox();

    const centerOffset = new THREE.Vector3();
    textGeo.boundingBox.getCenter(centerOffset).negate();
    textGeo.translate(centerOffset.x, centerOffset.y, centerOffset.z);

    const outlineGeo = textGeo.clone();
    outlineGeo.scale(1.05, 1.08, 1.05);

    const outlineMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
    });

    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
    });

    const outlineMesh = new THREE.Mesh(outlineGeo, outlineMat);
    outlineMesh.position.z = -_scale * 0.02;
    const fillMesh = new THREE.Mesh(textGeo, fillMat);

    const group = new THREE.Group();
    group.add(outlineMesh);
    group.add(fillMesh);
    group.position.set(_point.x, _point.y, _point.z);
    group.renderOrder = 999;
    group.userData.isDistanceLabel = true;

    viewer.rulerObject.add(group);
  });
}

export function selectObjectHierarchy(viewer, _id) {
  let search = true;
  for (let i = 0; i < core.selectedObjects.length && search === true; i++) {
    if (core.selectedObjects[i].id === _id) {
      search = false;
      if (core.selectedObjects[i].selected === true) {
        core.scene.getObjectById(_id).material = core.selectedObjects[i].originalMaterial;
        core.scene.getObjectById(_id).material.needsUpdate = true;
        core.selectedObjects[i].selected = false;
        core.selectedObjects.splice(core.selectedObjects.indexOf(core.selectedObjects[i]), 1);
      }
    }
  }
  if (search) {
    core.selectedObjects.push({
      id: _id,
      selected: true,
      originalMaterial: core.scene.getObjectById(_id).material.clone(),
    });
    const tempMaterial = core.scene.getObjectById(_id).material.clone();
    const selectedColor = toThreeColor("0x00FF00");
    if (selectedColor) {
      tempMaterial.color = selectedColor;
    }
    core.scene.getObjectById(_id).material = tempMaterial;
    core.scene.getObjectById(_id).material.needsUpdate = true;
  }
  viewer.updateHierarchySubmenuState();
}

export function recreateBoundingBox(object) {
  const _min = new THREE.Vector3();
  const _max = new THREE.Vector3();
  if (object instanceof THREE.Object3D) {
    object.traverse(function (mesh) {
      if (mesh instanceof THREE.Mesh) {
        mesh.geometry.computeBoundingBox();
        const bBox = mesh.geometry.boundingBox;

        _min.x = Math.min(_min.x, bBox.min.x + mesh.position.x);
        _min.y = Math.min(_min.y, bBox.min.y + mesh.position.y);
        _min.z = Math.min(_min.z, bBox.min.z + mesh.position.z);
        _max.x = Math.max(_max.x, bBox.max.x + mesh.position.x);
        _max.y = Math.max(_max.y, bBox.max.y + mesh.position.y);
        _max.z = Math.max(_max.z, bBox.max.z + mesh.position.z);
      }
    });

    const bBox_min = new THREE.Vector3(_min.x, _min.y, _min.z);
    const bBox_max = new THREE.Vector3(_max.x, _max.y, _max.z);
    const bBox_new = new THREE.Box3(bBox_min, bBox_max);
    object.position.set(
      (bBox_new.min.x + bBox_new.max.x) / 2,
      bBox_new.min.y,
      (bBox_new.min.z + bBox_new.max.z) / 2
    );
  }
  return object;
}

export function normalizeFileUrl(viewer, rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return "";
  }

  let url = rawUrl.trim();
  if (url === "") {
    return "";
  }

  if (/^\/[a-z][\w+.-]*:\/\//i.test(url)) {
    url = url.replace(/^\/+/, "");
  }

  if (url.startsWith("public://")) {
    url = "/sites/default/files/" + url.substring("public://".length);
  } else if (url.startsWith("sites/default/files/")) {
    url = "/" + url;
  }

  const base = (core.CONFIG?.mainUrl || window.location.origin || "").replace(/\/+$/, "");

  try {
    const parsed = new URL(url, window.location.origin);
    const host = (parsed.host || "").toLowerCase();
    const path = parsed.pathname || "";
    const hasBadHost = host === "default" || host === "dfg_3dviewer" || host.includes("_");

    if (path.startsWith("/sites/default/files/")) {
      if (hasBadHost) {
        return `${base}${path}`;
      }
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.href;
      }
      return `${base}${path}`;
    }

    return parsed.href;
  } catch (_err) {
    if (url.startsWith("/sites/default/files/")) {
      return `${base}${url}`;
    }
    return url;
  }
}

export function shouldIgnoreLegacyEmbedDefaultModel(viewer) {
  if (!viewer.isEmbedMode()) return false;
  if (viewer.urlOptions?.model || viewer.urlOptions?.id) return false;

  const sourceType = String(core.CONFIG?.entity?.metadata?.sourceType || "").toLowerCase();
  if (!sourceType.startsWith("drupal")) return false;

  const currentModelAttr = String(viewer.container?.getAttribute("3d") || "").trim();
  if (!currentModelAttr) return false;

  return /^(?:\.{1,2}\/)?examples\/box\.stl(?:\?.*)?$/i.test(currentModelAttr);
}

export function buildGallery(viewer) {
  return buildThumbnailGallery(viewer);
}

export function toHexColor(input) {
  if (!input) return null;

  if (typeof input.getHex === "function") {
    return input.getHex();
  }

  if (typeof input === "number") {
    return input >>> 0;
  }

  if (typeof input === "string") {
    const s = input.replace("#", "");
    if (/^[0-9a-fA-F]{6}$/.test(s)) return parseInt(s, 16);
    return null;
  }

  if (Array.isArray(input)) {
    const [r, g, b] = input;
    if ([r, g, b].every((v) => typeof v === "number")) {
      const rr = r <= 1 ? Math.round(r * 255) : r;
      const gg = g <= 1 ? Math.round(g * 255) : g;
      const bb = b <= 1 ? Math.round(b * 255) : b;
      return ((rr & 255) << 16) | ((gg & 255) << 8) | (bb & 255);
    }
    return null;
  }

  if (typeof input === "object" && "r" in input && "g" in input && "b" in input) {
    const rr = input.r <= 1 ? Math.round(input.r * 255) : input.r;
    const gg = input.g <= 1 ? Math.round(input.g * 255) : input.g;
    const bb = input.b <= 1 ? Math.round(input.b * 255) : input.b;
    return ((rr & 255) << 16) | ((gg & 255) << 8) | (bb & 255);
  }

  return null;
}

export function toThreeColor(input) {
  const normalized = normalizeColor(input);
  if (!normalized) return null;
  return new THREE.Color(
    normalized.r / 255,
    normalized.g / 255,
    normalized.b / 255
  );
}

export function getWrapperSize(viewer) {
  const wrapper = core.viewerWrapper || core.container;
  if (!wrapper) return { width: 0, height: 0 };
  const rect = wrapper.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

export function attachViewerHelpers(viewer) {
  return Object.assign(viewer, {
    normalizeDrupalFilesPath,
    normalizeArchiveModelPath,
    setModelPaths() {
      return setModelPaths(viewer);
    },
    disableInteractionHint() {
      return disableInteractionHint(viewer);
    },
    addTextWatermark(_text, _scale) {
      return addTextWatermark(viewer, _text, _scale);
    },
    addTextPoint(_text, _scale, _point) {
      return addTextPoint(viewer, _text, _scale, _point);
    },
    selectObjectHierarchy(_id) {
      return selectObjectHierarchy(viewer, _id);
    },
    recreateBoundingBox(object) {
      return recreateBoundingBox(object);
    },
    normalizeFileUrl(rawUrl) {
      return normalizeFileUrl(viewer, rawUrl);
    },
    shouldIgnoreLegacyEmbedDefaultModel() {
      return shouldIgnoreLegacyEmbedDefaultModel(viewer);
    },
    buildGallery() {
      return buildGallery(viewer);
    },
    toHexColor,
    toThreeColor,
    getWrapperSize() {
      return getWrapperSize(viewer);
    },
  });
}

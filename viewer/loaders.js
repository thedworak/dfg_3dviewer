import THREE from "./init.js";
export const loadDDSLoader = async () => (await import("three/examples/jsm/loaders/DDSLoader.js")).DDSLoader;
export const loadMTLLoader = async () => (await import("three/examples/jsm/loaders/MTLLoader.js")).MTLLoader;
export const loadOBJLoader = async () => (await import("three/examples/jsm/loaders/OBJLoader.js")).OBJLoader;
export const loadFBXLoader = async () => (await import("three/examples/jsm/loaders/FBXLoader.js")).FBXLoader;
export const loadPLYLoader = async () => (await import("three/examples/jsm/loaders/PLYLoader.js")).PLYLoader;
export const loadColladaLoader = async () => (await import("three/examples/jsm/loaders/ColladaLoader.js")).ColladaLoader;
export const loadSTLLoader = async () => (await import("three/examples/jsm/loaders/STLLoader.js")).STLLoader;
export const loadXYZLoader = async () => (await import("three/examples/jsm/loaders/XYZLoader.js")).XYZLoader;
export const loadTDSLoader = async () => (await import("three/examples/jsm/loaders/TDSLoader.js")).TDSLoader;
export const loadPCDLoader = async () => (await import("three/examples/jsm/loaders/PCDLoader.js")).PCDLoader;
export const loadGLTFLoader = async () => (await import("three/examples/jsm/loaders/GLTFLoader.js")).GLTFLoader;
export const loadDRACOLoader = async () => (await import("three/examples/jsm/loaders/DRACOLoader.js")).DRACOLoader;
export const loadKTX2Loader = async () => (await import("three/examples/jsm/loaders/KTX2Loader.js")).KTX2Loader;
export const loadMeshoptDecoder = async () => (await import("three/examples/jsm/libs/meshopt_decoder.module.js")).MeshoptDecoder;
export const loadUSDLoader = async () => (await import("three/examples/jsm/loaders/USDLoader.js")).USDLoader;
export const loadThreeMFLoader = async () => (await import("three/examples/jsm/loaders/3MFLoader.js")).ThreeMFLoader;
export const loadAMFLoader = async () => (await import("three/examples/jsm/loaders/AMFLoader.js")).AMFLoader;
export const loadVRMLLoader = async () => (await import("three/examples/jsm/loaders/VRMLLoader.js")).VRMLLoader;
export const loadKMZLoader = async () => (await import("three/examples/jsm/loaders/KMZLoader.js")).KMZLoader;
export const loadVOXLoader = async () => (await import("three/examples/jsm/loaders/VOXLoader.js")).VOXLoader;
export const loadVOXBuildMesh = async () => (await import("three/examples/jsm/loaders/VOXLoader.js")).buildMesh;
export const loadLWOLoader = async () => (await import("three/examples/jsm/loaders/LWOLoader.js")).LWOLoader;
export const loadIFCLoader = async () => (await import("./js/loaders/IFCLoader.js")).IFCLoader;
export const loadRoomEnvironment = async () => (await import("three/examples/jsm/environments/RoomEnvironment.js")).RoomEnvironment;
// LAS/LAZ parsing (loaders.gl + laz-perf) only downloads with the first such file.
export const loadLasPointCloud = async () => (await import("./pointcloud-las.js")).buildLasPointCloud;
export const loadHDRLoader = async () => (await import("three/examples/jsm/loaders/HDRLoader.js")).HDRLoader;

import { core } from './core.js';
import {
  fetchSettings,
  presentationMode,
  refreshModelHierarchyAndStats,
  replaceModelSettingsResetObject,
} from "./metadata.js";
import { loadIfcProperties, ifcPropertiesUrlForModel, setIfcModel } from "./ifc-properties.js";
import { reportViewerError, showToast, toastHelper } from "./viewer-utils.js";
import { t } from "./i18n-utils.js";
import { detectTiledFormat, loadTiledModel } from "./tiles.js";

export var outlineClipping;
let environmentTextureCache = {};
// One KTX2 (Basis Universal) transcoder for the page - it owns a worker pool.
let ktx2LoaderPromise = null;

// Decoders for compressed glTF: Draco (KHR_draco_mesh_compression, what
// Blender exports), Meshopt (EXT_meshopt_compression) and KTX2/Basis
// textures (KHR_texture_basisu) - the latter two are what the worker's
// gltfpack step produces (see worker/optimize.py). The KTX2 loader is shared;
// dispose() releases the Draco decoder made for this caller.
async function createGLTFDecoders() {
  const dracoBase = normalizeWasmPath(`${getModuleAssetBasePath()}/draco/gltf/`);
  const DRACOLoader = await loadDRACOLoader();
  const dracoLoader = new DRACOLoader();
  if (ENV_BUILD === 'drupal') {
    dracoLoader.setDecoderConfig({ type: 'js' });
  }
  dracoLoader.setDecoderPath(dracoBase);

  if (!ktx2LoaderPromise) {
    ktx2LoaderPromise = (async () => {
      const KTX2Loader = await loadKTX2Loader();
      return new KTX2Loader()
        .setTranscoderPath(normalizeWasmPath(`${getModuleAssetBasePath()}/basis/`))
        .detectSupport(core.renderer);
    })();
  }
  return {
    dracoLoader,
    ktx2Loader: await ktx2LoaderPromise,
    meshoptDecoder: await loadMeshoptDecoder(),
    dispose: () => dracoLoader.dispose(),
  };
}

async function configureGLTFDecoders(loader) {
  const decoders = await createGLTFDecoders();
  loader.setDRACOLoader(decoders.dracoLoader);
  loader.setKTX2Loader(decoders.ktx2Loader);
  loader.setMeshoptDecoder(decoders.meshoptDecoder);
  return decoders.dispose;
}

// Progressive loading: a lightweight "<name>.preview.glb" next to the model
// (simplified geometry, small textures - written by the worker, see
// worker/optimize.py) is shown first and swapped for the full model once
// that has downloaded. Settings: viewer.progressive.enabled (default true,
// except in the Drupal build, whose pipeline writes no previews - there the
// probe would only add a 404 per model); URL: ?preview=<url> to name the
// preview, ?preview=0 to skip it.
async function resolvePreviewModelUrl(rawModelPath) {
  if (core.PRESENTATION_MODE || core.fileObject.filename.startsWith('blob:')) return null;
  const params = new URLSearchParams(window.location.search);
  const explicit = params.get('preview');
  if (explicit === '0' || explicit === 'false') return null;
  const configured = core.CONFIG?.viewer?.progressive?.enabled;
  const probeByDefault = ENV_BUILD !== 'drupal';
  if (!explicit && (configured === false || (configured !== true && !probeByDefault))) return null;

  let candidate = explicit && explicit !== '1' && explicit !== 'true'
    ? explicit
    : rawModelPath.replace(/\.(glb|gltf)(?=($|[?#]))/i, '.preview.glb');
  if (!candidate || candidate === rawModelPath || /\.preview\.glb/i.test(rawModelPath)) return null;
  if (core.CONFIG.entity?.proxyPath !== undefined) candidate = core.getProxyPath(candidate);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(candidate, { method: 'HEAD', cache: 'no-cache', signal: controller.signal });
    const type = response.headers.get('content-type') || '';
    // Single-page hosts answer unknown paths with index.html.
    return response.ok && !type.includes('text/html') ? candidate : null;
  } catch (_error) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function showProgressiveBadge(percent) {
  if (!core.container) return;
  let badge = core.container.querySelector(':scope > .viewer-progressive-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'viewer-progressive-badge';
    badge.setAttribute('role', 'status');
    core.container.appendChild(badge);
  }
  badge.textContent = Number.isFinite(percent)
    ? t('loadingLog.fullQualityProgress', { percent }, 'Preview · loading full quality {percent}%')
    : t('loadingLog.fullQuality', 'Preview · loading full quality...');
}

function hideProgressiveBadge() {
  core.container?.querySelector(':scope > .viewer-progressive-badge')?.remove();
}

// Replaces the preview root with the full model: same root transform (which
// fetchSettings/metadata applied to the preview), fresh materials setup,
// clipping, animations, hierarchy and annotation markers. The camera is left
// where it is.
async function swapInFullModel(previewRoot, fullRoot) {
  const slot = core.mainObject.indexOf(previewRoot);
  if (slot < 0) return false; // another model was loaded meanwhile

  window.Viewer?.clearSelectedFaces?.();
  window.Viewer?.clearHierarchySelection?.();
  window.Viewer?.endFaceAreaSelection?.();

  fullRoot.position.copy(previewRoot.position);
  fullRoot.quaternion.copy(previewRoot.quaternion);
  fullRoot.scale.copy(previewRoot.scale);
  fullRoot.updateMatrixWorld(true);
  traverseMesh(fullRoot);

  core.scene.remove(previewRoot);
  core.scene.add(fullRoot);
  core.mainObject[slot] = fullRoot;
  const helperIndex = core.helperObjects.indexOf(previewRoot);
  if (helperIndex >= 0) core.helperObjects[helperIndex] = fullRoot;
  if (core.transformControl?.object === previewRoot) core.transformControl.attach(fullRoot);
  replaceModelSettingsResetObject(previewRoot, fullRoot);

  if (core.outlineClipping) {
    const wasVisible = core.outlineClipping.visible;
    core.scene.remove(core.outlineClipping);
    core.outlineClipping = prepareOutlineClipping(fullRoot);
    core.outlineClipping.visible = wasVisible;
    core.scene.add(core.outlineClipping);
  }

  window.Viewer?.setupModelAnimations?.(fullRoot);
  window.Viewer?.setupPointCloudControls?.(fullRoot);
  window.Viewer?.refreshClippingForModel?.(fullRoot);
  refreshModelHierarchyAndStats(fullRoot);
  window.Viewer?.disposeFacePickCache?.();
  window.Viewer?.disposeObjectResources?.(previewRoot);
  // Face indices of annotations refer to the full model's triangles.
  window.Viewer?.refreshAnnotationPOIs?.();
  markEnvironmentMaterialsDirty(fullRoot);
  return true;
}

const loaderMap = {
  gltf: loadGLTFLoader,
  glb: loadGLTFLoader,
  obj: loadOBJLoader,
  fbx: loadFBXLoader,
  ply: loadPLYLoader,
  stl: loadSTLLoader,
  dae: loadColladaLoader,
  xyz: loadXYZLoader,
  '3ds': loadTDSLoader,
  pcd: loadPCDLoader,
  usd: loadUSDLoader,
  usda: loadUSDLoader,
  usdc: loadUSDLoader,
  usdz: loadUSDLoader,
  '3mf': loadThreeMFLoader,
  amf: loadAMFLoader,
  wrl: loadVRMLLoader,
  kmz: loadKMZLoader,
  vox: loadVOXLoader,
  lwo: loadLWOLoader,
  ifc: loadIFCLoader
};

async function createLoader(ext) {

  const loadLoader = loaderMap[ext];

  if (!loadLoader) {
    throw new Error(`Unsupported format: ${ext}`);
  }

  const LoaderClass = await loadLoader();
  return new LoaderClass();
}

const ENV_BUILD = __BUILD__;
const MODULES_PATH = __MODULES_PATH__;
const ENV_SUBDIR = __ENV_SUBDIR__;
console.log('[loaders] ENV_BUILD:', ENV_BUILD);
console.log('[loaders] MODULES_PATH:', MODULES_PATH);
console.log('[loaders] ENV_SUBDIR:', ENV_SUBDIR);

function normalizeWasmPath(path) {
  if (typeof window === 'undefined' || !path) return path;
  let normalized = path.trim();

  // Force secure scheme for explicit http resources
  if (normalized.startsWith('http://')) {
    normalized = 'https://' + normalized.slice('http://'.length);
  } else if (normalized.startsWith('//')) {
    normalized = `${window.location.protocol}${normalized}`;
  } else if (normalized.startsWith('/')) {
    normalized = `${window.location.protocol}//${window.location.host}${normalized}`;
  } else if (!/^[a-zA-Z][\w+-.]*:/.test(normalized)) {
    normalized = new URL(normalized, window.location.href).href;
  }

  // Normalize duplicate slashes while keeping protocol separator intact
  try {
    const url = new URL(normalized);
    url.pathname = url.pathname.replace(/\/\/{2,}/g, '/');
    normalized = url.href;
  } catch (err) {
    normalized = normalized.replace(/\/\/{2,}/g, '/');
  }

  return normalized;
}

function sanitizeModuleAssetBasePath(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let basePath = input.trim().replace(/\/$/, '');

  if (!basePath) {
    return '';
  }

  if (/^[a-zA-Z][\w+-.]*:\/\//.test(basePath)) {
    try {
      const url = new URL(basePath);
      const hostSegment = `/${url.host}`;

      if (url.pathname.startsWith(hostSegment)) {
        url.pathname = url.pathname.slice(hostSegment.length) || '/';
      }

      url.pathname = url.pathname.replace(/\/\/{2,}/g, '/');
      return url.href.replace(/\/$/, '');
    } catch (_err) {
      return basePath;
    }
  }

  if (/^[^\/]+\.[^\/]+\/.+/.test(basePath)) {
    const parts = basePath.split('/');
    const host = parts.shift();
    const remainder = `/${parts.join('/')}`.replace(/\/\/{2,}/g, '/');

    if (
      host &&
      typeof window !== 'undefined' &&
      (host === window.location.host || /^\w[\w.-]*\.[a-z]{2,}$/i.test(host))
    ) {
      return remainder.replace(/\/$/, '');
    }
  }

  if (/^\/[^\/]+\.[^\/]+\/.+/.test(basePath)) {
    const parts = basePath.split('/').filter(Boolean);
    const host = parts.shift();
    const remainder = `/${parts.join('/')}`.replace(/\/\/{2,}/g, '/');

    if (
      host &&
      typeof window !== 'undefined' &&
      (host === window.location.host || /^\w[\w.-]*\.[a-z]{2,}$/i.test(host))
    ) {
      return remainder.replace(/\/$/, '');
    }
  }

  return basePath.replace(/\/\/{2,}/g, '/');
}

function prepareOutlineClipping(_object) {
  core.outlineClipping = _object.clone(true);
  // Only the geometry: a model's own lights and cameras (glTF) would light
  // the scene twice once the section outline is shown.
  const extras = [];
  core.outlineClipping.traverse((child) => {
    if (child.isLight || child.isCamera) extras.push(child);
  });
  extras.forEach((child) => child.removeFromParent());
  var gutsMaterial = new THREE.MeshBasicMaterial({
    color: "crimson",
    side: THREE.BackSide,
    clippingPlanes: core.PRESENTATION_MODE ? [] : (core.activeClippingPlanes || []),
    clipShadows: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  core.outlineClipping.traverse(function (child) {
    if (child.type == "Mesh" || child.type == "Object3D") {
      child.material = gutsMaterial;
    }
  });
  core.outlineClipping.visible = false;
  return core.outlineClipping;
}

function setupSingleMaterial(materials, material) {
  if (material.map) {
    material.map.anisotropy = 16;
    material.map.colorSpace = THREE.SRGBColorSpace;
  }
  material.envMapIntensity = 0.76;
  material.roughness = Math.min(material.roughness * 1.35, 1);
  material.clipShadows = true;
  material.side = core.PRESENTATION_MODE ? THREE.DoubleSide : THREE.FrontSide;
  material.clippingPlanes = core.PRESENTATION_MODE ? [] : (core.activeClippingPlanes || []);
  //material.clipIntersection = false;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      'reflectedLight.directSpecular += directSpecular;',
      `
        reflectedLight.directSpecular += directSpecular * 0.15;
      `
    );
  };

  material.needsUpdate = true;
  if (material.name === "") material.name = material.uuid;
  var newMaterial = { name: material.name, uuid: material.uuid };
  if (!materials.some((item) => item.uuid === newMaterial.uuid)) materials.push(newMaterial);
}

function setupMaterials(_object) {
  var materials = [];
  if (_object.isMesh) {
    _object.castShadow = true;
    _object.receiveShadow = true;
    if (
      _object.geometry &&
      typeof _object.geometry.computeVertexNormals === "function" &&
      !_object.geometry.getAttribute?.("normal")
    ) {
      _object.geometry.computeVertexNormals();
    }
    if (_object.material.isMaterial) {
      setupSingleMaterial(materials, _object.material);
    } else if (Array.isArray(_object.material)) {
      _object.material.forEach((material) =>
        setupSingleMaterial(materials, material)
      );
    }
  }
  return materials;
}

function getMaterialByID(_object, _uuid) {
  var _material;
  _object.traverse(function (child) {
    if (
      child.isMesh &&
      child.material.isMaterial &&
      child.material.uuid === _uuid
    ) {
      _material = child.material;
    }
  });
  return _material;
}

function traverseMesh(object) {
  setupMaterials(object);

  object.traverse(function (child) {
    setupMaterials(child);
  });

  if (window.Viewer?.initializeMaterialsEditor && core.PRESENTATION_MODE !== true) {
    window.Viewer.initializeMaterialsEditor(object);
  }
}

function getEnvironmentTextureForPreset(renderer, preset = "neutral") {
  if (!renderer) return Promise.resolve(null);

  core.scene.environmentIntensity = core.environmentMapIntensity || 0.5;
  
  // Initialize cache for this preset if not exists
  if (!environmentTextureCache[preset]) {
    environmentTextureCache[preset] = (async () => {
      const pmrem = new THREE.PMREMGenerator(renderer);
      try {
        if (preset === "studio") {
          // Studio uses RoomEnvironment
          const TempRoomEnvironment = await loadRoomEnvironment();
          return pmrem.fromScene(new TempRoomEnvironment()).texture;
        } else if (preset === "neutral" || preset === "sunny" || preset === "goldenHour") {
          // Load HDR map for other presets
          const HDRLoader = await loadHDRLoader();
          const loader = new HDRLoader();
          const baseModulePath = getModuleAssetBasePath() || '/assets';
          const mapFilename = preset === "goldenHour" ? "golden_hour.hdr" : `${preset}.hdr`;
          const mapUrl = `${baseModulePath.replace(/\/$/, '')}/maps/${mapFilename}`;
          
          const texture = await new Promise((resolve, reject) => {
            loader.load(mapUrl, resolve, undefined, reject);
          });
          texture.mapping = THREE.EquirectangularReflectionMapping;
          return pmrem.fromEquirectangular(texture).texture;
        }
        return null;
      } finally {
        pmrem.dispose();
      }
    })();
  }
  
  return environmentTextureCache[preset];
}

function getEnvironmentTexture(renderer) {
  // Legacy function for backwards compatibility
  return getEnvironmentTextureForPreset(renderer, "neutral");
}

function markEnvironmentMaterialsDirty(root) {
  root?.traverse?.((child) => {
    const materials = child?.material
      ? (Array.isArray(child.material) ? child.material : [child.material])
      : [];
    materials.forEach((material) => {
      if (material?.isMeshStandardMaterial || material?.isMeshPhysicalMaterial) {
        material.needsUpdate = true;
      }
    });
  });
}

export async function syncSceneEnvironment(enabled = true, preset = null) {
  if (!core.scene) return;
  
  // Use provided preset or fall back to viewer's preset, then neutral
  const effectivePreset = preset || window.viewer?.environmentMapPreset || "neutral";
  
  if (enabled) {
    core.scene.environment = await getEnvironmentTextureForPreset(core.renderer, effectivePreset);
    if (core.scene.environmentIntensity === 0) {
      core.scene.environmentIntensity = 0.5;
    }
  } else {
    core.scene.environment = null;
    core.scene.environmentIntensity = 0;
  }
  
  markEnvironmentMaterialsDirty(core.scene);
}

function reportLoadError(error, context = "") {
  const message = reportViewerError(error, {
    context,
    consoleLabel: "Viewer load error:",
  });
  core.circle?.complete?.(1200);
  if (typeof core.EXIT_CODE !== "undefined") core.EXIT_CODE = 1;
  return message;
}

export async function loadModel() {
  core.loadingLog?.start?.();
  let modelPath = core.fileObject.filename.startsWith('blob:') ? core.fileObject.filename : core.fileObject.path + core.fileObject.filename;
  if (core.CONFIG.entity.proxyPath !== undefined && !core.fileObject.filename.startsWith('blob:')) {
    modelPath = core.getProxyPath(modelPath, core.CONFIG, core.fileObject);
  }

  function loadAsync(loader, url, progressHandler = onProgress) {
    return new Promise((resolve, reject) => {
      loader.load(url, resolve, progressHandler, reject);
    });
  }

  function updateLoadingStage(stageKey, progressValue = null) {
    core.circle?.setStage?.(stageKey, progressValue);
    core.loadingLog?.setStage?.(stageKey, progressValue);
  }

  async function afterLoad({ object }) {
    if (object === null || typeof object === "undefined") {
      throw new Error("Loaded object is null or undefined.");
    }
    updateLoadingStage("loadingLog.loadingTextures", 99);

    // Keep authoring transforms in presentation mode to avoid collapsing model parts.
    // Tiled models keep the transform that centres/orients them (tiles.js).
    if (!core.PRESENTATION_MODE && !object.userData?.isTiledModel) {
      // Reset transform to ensure consistent positioning
      if (Array.isArray(object)) {
        object.forEach(obj => {
          obj.position.set(0, 0, 0);
          obj.rotation.set(0, 0, 0);
          obj.scale.set(1, 1, 1);
          obj.updateMatrixWorld(true);
        });
      } else {
        object.position.set(0, 0, 0);
        object.rotation.set(0, 0, 0);
        object.scale.set(1, 1, 1);
        object.updateMatrixWorld(true);
      }
      core.handHint.hidden = true;
    }

    window.viewer.modelLoaded = true;
    updateLoadingStage("loadingLog.preparingGeometry", 99);
    traverseMesh(object);

    if (!core.PRESENTATION_MODE) {
      const isArchiveDerivedPath = /\/[^/]+_(ZIP|RAR|TAR|XZ|GZ)\/gltf\/$/i.test(core.fileObject.path);
      if (!isArchiveDerivedPath) {
        if (core.fileObject.extension.toLowerCase() === "gltf" || core.fileObject.extension.toLowerCase() === "glb") {
          core.fileObject.path = core.fileObject.path.replace("/gltf/", "/");
        } else {
          core.fileObject.path = core.fileObject.path.replace("gltf/", "");
        }
      }
      updateLoadingStage("loadingLog.fetchingMetadata", 99);
      await fetchSettings(object);
      loadIfcProperties(ifcPropertiesUrlForModel(modelPath));

      updateLoadingStage("loadingLog.settingUpMaterials", 99);
      // A streamed (tiled) model's meshes change with the level of detail;
      // a cloned section outline would only show the tiles loaded now.
      core.outlineClipping = object.userData?.isTiledModel
        ? new THREE.Group()
        : prepareOutlineClipping(object);
      if (Array.isArray(object)) {
        core.helperObjects.push(object[0]);
      } else {
        core.helperObjects.push(object);
      }
      core.scene.add(core.outlineClipping);
    } else {
      updateLoadingStage("loadingLog.settingUpMaterials", 99);
      presentationMode(object, null).catch(error => {
        reportLoadError(error, "Presentation mode setup failed");
        showToast("toasts.presentationModeError", "error");
      });
    }

    updateLoadingStage("loadingLog.settingUpLighting", 99);
    if (Array.isArray(object)) {
      object.forEach(o => core.scene.add(o));
    } else {
      core.scene.add(object);
    }
    core.mainObject.push(object);
    window.Viewer?.setupModelAnimations?.(object);
    window.Viewer?.setupPointCloudControls?.(object);
    window.Viewer?.refreshClippingForModel?.(object);

    updateLoadingStage("loadingLog.compilingShaders", 99);
    await syncSceneEnvironment(core.environmentMapEnabled !== false);
  }

  async function loadOBJWithMTL() {
    const DDSLoader = await loadDDSLoader();
    const MTLLoader = await loadMTLLoader();
    const OBJLoader = await loadOBJLoader();
    const manager = new THREE.LoadingManager();
    manager.onLoad = () => toastHelper("objLoaded", "success");
    manager.addHandler(/\.dds$/i, new DDSLoader());

    const basename = core.fileObject.filename.replace(/\.[^/.]+$/, "");
    const filename = core.fileObject.filename;

    if (!core.CONFIG.noMTL) {
      try {
        const materials = await new Promise((resolve, reject) => {
          new MTLLoader(manager)
          .setPath(core.fileObject.path)
          .load(basename + ".mtl", resolve, undefined, reject);
        });
        materials.preload();

        const obj = await new Promise((resolve, reject) => {
          new OBJLoader(manager)
          .setMaterials(materials)
          .setPath(core.fileObject.path)
          .load(filename, resolve, onProgress, reject);
        });

        obj.position.set(0, 0, 0);
        return obj;
      } catch (error) {
        core.CONFIG.noMTL = true;
        toastHelper("mtlLoadError", "error");
        console.warn("MTL load failed, falling back to OBJ-only load.", error);
      }
    }

  const obj = await new Promise((resolve, reject) => {
      new OBJLoader()
      .setPath(core.fileObject.path)
      .load(filename, resolve, onProgress, reject);
    });

    obj.position.set(0, 0, 0);
    return obj;
  }

  function normalizePath(path) {
    if (!path || typeof path !== 'string') {
      return path;
    }

    if (/^[a-zA-Z][\w+-.]*:\/\//.test(path)) {
      try {
        const url = new URL(path);
        url.pathname = url.pathname.replace(/\/{2,}/g, '/');
        return url.href;
      } catch (_err) {
        return path;
      }
    }

    return path.replace(/\/{2,}/g, '/');
  }

  async function resolveIfcWasmPath(basePath) {
    const candidates = [
      normalizePath(basePath.replace(/\/$/, '') + '/ifc/'),
      normalizePath(basePath.replace(/\/$/, '') + '/ifc'),
    ];

    for (const candidate of candidates) {
      const wasmUrl = candidate.replace(/\/$/, '') + '/web-ifc.wasm';
      try {
        const res = await fetch(wasmUrl, { method: 'HEAD', cache: 'no-store' });
        if (res.ok) {
          return candidate;
        }
      } catch (err) {
        // ignored, try next candidate
      }
    }
    return null;
  }

  function getGLTFModelPath() {
    const rawPath = core.fileObject.filename.startsWith('blob:')
      ? core.fileObject.filename
      : core.fileObject.path + core.fileObject.basename + "." + core.fileObject.extension;
    const proxied = core.CONFIG.entity.proxyPath !== undefined && !core.fileObject.filename.startsWith('blob:')
      ? core.getProxyPath(rawPath)
      : rawPath;
    return { rawPath, url: proxied };
  }

  async function loadGLTFModel(url, progressHandler = progressLoaderHandler) {
    const loader = await createLoader("glb");
    const disposeDecoders = await configureGLTFDecoders(loader);
    try {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(url, resolve, progressHandler, reject);
      });
      // Loaders for other formats already keep clips on the returned root.
      gltf.scene.animations = gltf.animations || [];
      return gltf.scene;
    } finally {
      disposeDecoders();
    }
  }

  // Background half of progressive loading: fetch the full model while the
  // preview is on screen, then swap it in.
  async function loadFullModelBehindPreview(previewRoot, url) {
    showProgressiveBadge(0);
    try {
      const fullRoot = await loadGLTFModel(url, (xhr) => {
        if (xhr?.lengthComputable && xhr.total > 0) {
          showProgressiveBadge(Math.round((xhr.loaded / xhr.total) * 100));
        }
      });
      const swapped = await swapInFullModel(previewRoot, fullRoot);
      if (!swapped) {
        window.Viewer?.disposeObjectResources?.(fullRoot);
        return;
      }
      toastHelper("fullModelLoaded", "success");
    } catch (error) {
      reportLoadError(error, `Failed to load the full model ${core.fileObject.filename}; keeping the preview`);
      toastHelper("fullModelLoadError", "warning");
    } finally {
      if (core.progressiveLoad?.preview === previewRoot) {
        core.progressiveLoad = null;
        hideProgressiveBadge();
        window.viewer.fullModelLoaded = true;
      }
    }
  }

  try {
    switch (core.fileObject.extension.toLowerCase()) {
      case "obj": {
        const object = await loadOBJWithMTL();
        await afterLoad({ object });
        break;
      }

      case "fbx": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const object = await loadAsync(loader, modelPath, onProgress);
        object.position.set(0, 0, 0);
        await afterLoad({ object });
        break;
      }

      case "ply": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const geometry = await loadAsync(loader, modelPath, onProgress);
        if (!geometry.getAttribute?.("normal")) {
          geometry.computeVertexNormals();
        }
        const material = new THREE.MeshStandardMaterial({ color: 0x0055ff, flatShading: true });
        const object = new THREE.Mesh(geometry, material);
        object.position.set(0, 0, 0);
        object.castShadow = true;
        object.receiveShadow = true;
        await afterLoad({ object });
        break;
      }

      case "dae": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const collada = await loadAsync(loader, modelPath, onProgress);
        const object = collada.scene;
        object.position.set(0, 0, 0);
        await afterLoad({ object });
        break;
      }

      case "ifc": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const basePath = getModuleAssetBasePath();

        let ifcWasmPath = await resolveIfcWasmPath(basePath);

        if (!ifcWasmPath && ENV_BUILD === 'drupal') {
          const fallback = basePath.includes('/drupal/main')
            ? basePath.replace('/drupal/main', '/drupal/custom')
            : basePath.replace('/drupal/custom', '/drupal/main');
          ifcWasmPath = await resolveIfcWasmPath(fallback);
        }

        if (!ifcWasmPath) {
          const errorMsg = `[loadModel] IFC WASM not found in ${basePath}/ifc or fallback; please verify path and permissions`;
          console.error(errorMsg);
          throw new Error(errorMsg);
        }

        const normalizedIfcWasmPath = normalizeWasmPath(ifcWasmPath);
        console.log('[loadModel] IFC WASM path:', normalizedIfcWasmPath);
        loader.ifcManager.setWasmPath(normalizedIfcWasmPath, true);
        const object = await loadAsync(loader, modelPath, onProgress);
        await afterLoad({ object });
        setIfcModel(object);
        break;
      }

      case "stl": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const geometry = await loadAsync(loader, modelPath, onProgress);
        let meshMaterial = new THREE.MeshPhongMaterial({ color: 0xff5533, specular: 0x111111, shininess: 200 });
        if (geometry.hasColors) {
          meshMaterial = new THREE.MeshPhongMaterial({ opacity: geometry.alpha, vertexColors: true });
        }
        const object = new THREE.Mesh(geometry, meshMaterial);
        object.position.set(0, 0, 0);
        object.castShadow = true;
        object.receiveShadow = true;
        await afterLoad({ object });
        break;
      }

      case "las":
      case "laz": {
        const loader = new THREE.FileLoader().setResponseType("arraybuffer");
        const buffer = await loadAsync(loader, modelPath, onProgress);
        updateLoadingStage("loadingLog.preparingGeometry", 99);
        const buildLasPointCloud = await loadLasPointCloud();
        const object = buildLasPointCloud(buffer, core.fileObject.basename || "Point cloud");
        const info = object.children[0]?.userData?.pointCloud;
        if (info && info.skip > 1) {
          toastHelper("pointCloudThinned", "info", {
            loaded: info.loadedPoints.toLocaleString(),
            total: info.totalPoints.toLocaleString(),
          });
        }
        await afterLoad({ object });
        break;
      }

      case "xyz": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const geometry = await loadAsync(loader, modelPath, onProgress);
        geometry.center();
        const material = new THREE.PointsMaterial({ size: 0.1, vertexColors: geometry.hasAttribute("color") === true });
        const object = new THREE.Points(geometry, material);
        object.position.set(0, 0, 0);
        await afterLoad({ object });
        break;
      }

      case "pcd": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const mesh = await loadAsync(loader, modelPath, onProgress);
        mesh.geometry?.center?.();
        if (mesh.material) {
          mesh.material.size = Math.max(mesh.material.size ?? 0, 0.1);
        }
        await afterLoad({ object: mesh });
        break;
      }

      case "json": {
        const tiledFormat = detectTiledFormat(core.fileObject.filename);
        if (tiledFormat) {
          updateLoadingStage("loadingLog.loadingModel", 10);
          const object = await loadTiledModel({
            url: modelPath,
            format: tiledFormat,
            configureGLTFLoader: createGLTFDecoders,
            // Tiles loaded later get the same material setup (clipping planes, shadows).
            onModel: (scene) => {
              scene.traverse((child) => {
                if (child.isMesh) setupMaterials(child);
              });
              window.Viewer?.applyPointCloudSettingsToTile?.(scene);
            },
            onProgress: (value) => updateLoadingStage("loadingLog.loadingModel", value),
          });
          await afterLoad({ object });
          window.viewer.fullModelLoaded = true;
          break;
        }
        const loader = new THREE.ObjectLoader();
        const object = await loadAsync(loader, modelPath, onProgress);
        object.position.set(0, 0, 0);
        await afterLoad({ object });
        break;
      }

      case "3ds": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        loader.setResourcePath(core.fileObject.path);
        let mp = core.fileObject.path;
        if (core.CONFIG.entity.proxyPath !== undefined) mp = core.getProxyPath(mp);
        const object = await loadAsync(loader, mp + core.fileObject.basename + "." + core.fileObject.extension, onProgress);
        await afterLoad({ object });
        break;
      }

      // Formats whose three.js loader returns a ready-to-add object/group.
      case "usd":
      case "usda":
      case "usdc":
      case "usdz":
      case "3mf":
      case "amf":
      case "wrl": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const object = await loadAsync(loader, modelPath, onProgress);
        object.position.set(0, 0, 0);
        await afterLoad({ object });
        break;
      }

      case "kmz": {
        const loader = await createLoader("kmz");
        const kmz = await loadAsync(loader, modelPath, onProgress);
        await afterLoad({ object: kmz.scene });
        break;
      }

      case "vox": {
        const loader = await createLoader("vox");
        const buildMesh = await loadVOXBuildMesh();
        const vox = await loadAsync(loader, modelPath, onProgress);
        // Files with a scene graph come back assembled in vox.scene; plain
        // ones only carry their chunks.
        const object = vox.scene ?? new THREE.Group();
        if (!vox.scene) {
          vox.chunks.forEach((chunk) => object.add(buildMesh(chunk)));
        }
        await afterLoad({ object });
        break;
      }

      case "lwo": {
        const loader = await createLoader("lwo");
        const lwo = await loadAsync(loader, modelPath, onProgress);
        const object = new THREE.Group();
        (lwo.meshes || []).forEach((mesh) => object.add(mesh));
        await afterLoad({ object });
        break;
      }

      case "glb":
      case "gltf": {
        const { rawPath, url } = getGLTFModelPath();
        const previewUrl = await resolvePreviewModelUrl(rawPath);
        if (previewUrl) {
          const preview = await loadGLTFModel(previewUrl);
          preview.userData.isPreviewModel = true;
          window.viewer.fullModelLoaded = false;
          core.progressiveLoad = { preview };
          await afterLoad({ object: preview });
          // Not awaited: the viewer is usable on the preview meanwhile.
          loadFullModelBehindPreview(preview, url);
        } else {
          const object = await loadGLTFModel(url);
          await afterLoad({ object });
          window.viewer.fullModelLoaded = true;
        }
        break;
      }
      default:
        toastHelper("unsupportedExtension", "warning");
        core.loadingLog?.fail?.();
        return;
    }

    updateLoadingStage("loadingLog.modelLoaded", 100);
    // afterLoad (settings, camera intro) is done. A progressive preview
    // keeps this false until the full model is swapped in.
    if (!core.progressiveLoad) window.viewer.fullModelLoaded = true;
    core.circle?.complete?.(2600);
    core.editorToolbar?.classList.remove('editorToolbar-hidden');
    core.editorToolbar?.classList.add('editorToolbar-visible');
    core.loadingLog?.finish?.();
    if (!core.PRESENTATION_MODE) {
      toastHelper("modelLoaded", "success", {
        filename: core.fileObject.filename
      });
    } else {
      toastHelper("presentationModeReady", "success");
    }
    if (typeof core.EXIT_CODE !== "undefined") core.EXIT_CODE = 0;
    core.UltraLoader?.finish();
    core.poller?.updateSteps(2);
  } catch (error) {
    core.loadingLog?.fail?.();
    reportLoadError(error, `Failed to load ${core.fileObject.filename}`);
    throw error;
  }
}

export const getModuleAssetBasePath = function() {
  let basePath = sanitizeModuleAssetBasePath(core.CONFIG?.baseModulePath);
  const scriptBasePath = core.DFG_ASSETS ? core.DFG_ASSETS.replace(/\/$/, '') : '';
  const scriptLooksLikeDrupalAssets = (
    ENV_BUILD === 'drupal' &&
    scriptBasePath.includes(`/dist/${ENV_BUILD}/`) &&
    /\/assets$/.test(scriptBasePath)
  );

  if (!basePath) {
    basePath = ENV_BUILD === 'drupal'
      ? `/modules/${MODULES_PATH ? `${MODULES_PATH}/` : ''}dfg_3dviewer/dist/${ENV_BUILD}/${ENV_SUBDIR}/assets`
      : '/assets';
  }

  // Override for localhost
  if (core.isLocalPreview) {
    basePath = '/assets';
  }

  // Standalone dev builds used to inherit /modules/.../viewer from the Drupal
  // settings template. Assets are emitted beside the loaded bundle instead.
  if (
    scriptBasePath &&
    /\/viewer$/.test(basePath)
  ) {
    const bundleAssetPath = /\/assets$/.test(scriptBasePath)
      ? scriptBasePath
      : `${scriptBasePath}/assets`;
    console.warn('[loaders] legacy baseModulePath points to viewer source; using bundle asset path instead.', {
      configuredBasePath: basePath,
      scriptBasePath: bundleAssetPath,
    });
    basePath = bundleAssetPath;
  }

  // Drupal legacy configs may still point to /modules/.../viewer instead of the built dist assets.
  if (
    ENV_BUILD === 'drupal' &&
    scriptBasePath &&
    (/\/viewer$/.test(basePath) || !basePath.includes(`/dist/${ENV_BUILD}/`))
  ) {
    basePath = scriptBasePath;
  }

  // When the loaded Drupal bundle lives in a different module root than config
  // (for example /modules/custom/... vs /modules/...), trust the bundle path.
  if (
    scriptLooksLikeDrupalAssets &&
    basePath &&
    basePath !== scriptBasePath &&
    /\/modules\//.test(basePath)
  ) {
    console.warn('[loaders] baseModulePath differs from loaded script path; using script path instead.', {
      configuredBasePath: basePath,
      scriptBasePath,
    });
    basePath = scriptBasePath;
  }

  basePath = sanitizeModuleAssetBasePath(basePath);

  // Rising path mismatch: if we are in drupal custom and config path still has /drupal/main, try custom fallback.
  if (ENV_BUILD === 'drupal' && ENV_SUBDIR === 'custom' && basePath.includes('/drupal/main')) {
    basePath = basePath.replace('/drupal/main', '/drupal/custom');
  }

  console.log('[loaders] resolved ModuleAssetBasePath:', basePath);
  core.CONFIG.baseModulePath = basePath; // Cache for future use
  core.DFG_ASSETS = basePath;
  return basePath;
};

export const onError = function (_event) {
  reportLoadError(_event, "Loader error");
};

export const onErrorMTL = async function (_event) {
  core.CONFIG.noMTL = true;
  toastHelper("mtlLoadError", "error");
  await loadModel();
};

export const onErrorGLB = async function (_event, params, loadedTimes) {
  console.log("Loader error: " + _event);
  if (window.__E2E__ && window.viewer) {
    window.viewer.errors ??= [];
    window.viewer.errors.push(String(_event));
  }
  core.loadedFile = params.path + params.basename + core.loadedFile + "gltf/";
  if (typeof _event !== undefined && loadedTimes <= 1 && window.viewer.modelLoaded === false) {
    await loadModel();
    loadedTimes++;
  } else {
    toastHelper("glbLoadError", "error");
  }
};

export const onProgress = function (xhr) {
  progressLoaderHandler(xhr);
};

const progressLoaderHandler = function (xhr) {
  if (!core.circle) return;
  const total = xhr.total || xhr.loaded || 1;
  const percentComplete = Math.min((xhr.loaded / total) * 100, 99);
  if (!Number.isFinite(percentComplete)) return;
  core.circle.show();
  core.circle.set(percentComplete, 100);
  core.editorToolbar?.classList.remove('editorToolbar-hidden');
  core.editorToolbar?.classList.add('editorToolbar-visible');
  core.loadingLog?.update?.(percentComplete);
  core.UltraLoader?.set(percentComplete);
}

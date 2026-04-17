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
export const loadIFCLoader = async () => (await import("./js/loaders/IFCLoader.js")).IFCLoader;
export const loadRoomEnvironment = async () => (await import("three/examples/jsm/environments/RoomEnvironment.js")).RoomEnvironment;

import { core } from './core.js';
import { fetchSettings, presentationMode } from "./metadata.js";
import { reportViewerError, showToast, toastHelper } from "./viewer-utils.js";

export var outlineClipping;
let environmentTexturePromise = null;

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
  var gutsMaterial = new THREE.MeshBasicMaterial({
    color: "crimson",
    side: THREE.BackSide,
    clippingPlanes: core.clippingPlanes,
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
  material.envMapIntensity = 0.6;
  material.roughness = Math.max(material.roughness * 0.85, 0.05);
  material.clipShadows = true;
  material.side = core.PRESENTATION_MODE ? THREE.DoubleSide : THREE.FrontSide;
  material.clippingPlanes = core.PRESENTATION_MODE ? [] : core.clippingPlanes;
  //material.clipIntersection = false;
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
  var _objectMaterials = [];
  _objectMaterials.push(setupMaterials(object));

  object.traverse(function (child) {
    _objectMaterials.push(setupMaterials(child));
    _objectMaterials.side = THREE.DoubleSide;
  });
  var objectMaterials = ["select by material"];
  _objectMaterials.forEach(function (item, index, array) {
    if (item.length > 1) {
      item.forEach(function (_item, _index, _array) {
        objectMaterials.push(_item.uuid);
      });
    } else if (item.length == 1) {
      objectMaterials.push(item[0].uuid);
    }
  });
  var _material = null;
  var _materialGui = null;
  var _uuid = null;
  if (!core.materialsFolder) return;
  core.i18nGui.editMaterialsController =core.materialsFolder
    .add(core.materialsPropertiesText, "Edit material", objectMaterials)
    .name(window.Viewer?.t?.("gui.editMaterial", "Edit material") ?? "Edit material")
    .onChange(function (value) {
      if (
        (value === "select by material" || value !== _uuid) &&
        _material !== null
      ) {
        _materialGui.color.destroy();
        _materialGui.emissiveColor.destroy();
        _materialGui.emissive.destroy();
        _materialGui.metalness.destroy();
        _materialGui = null;
        _material = null;
      }
      if (_material === null) {
        _materialGui = {};
        _material = getMaterialByID(object, value);
        //console.log(_material);
        core.materialProperties.color = _material.color;
        core.materialProperties.emissiveColor = _material.emissive;
        core.materialProperties.emissive = _material.emissiveIntensity;
        core.materialProperties.metalness = _material.metalness;
        _materialGui.color = core.materialsFolder
          .addColor(core.materialProperties, "color")
          .onChange(function (value) {
            _material.color = new THREE.Color(value);
          })
          .listen();
        _materialGui.emissiveColor = core.materialsFolder
          .addColor(core.materialProperties, "emissiveColor")
          .onChange(function (value) {
            _material.emissive = new THREE.Color(value);
          })
          .listen();
        _materialGui.emissive = core.materialsFolder
          .add(core.materialProperties, "emissive", 0, 1)
          .onChange(function (value) {
            _material.emissiveIntensity = value;
          })
          .listen();
        _materialGui.metalness = core.materialsFolder
          .add(core.materialProperties, "metalness", 0, 1)
          .onChange(function (value) {
            _material.metalness = value;
          })
          .listen();
      }
      if (_uuid === null || _uuid !== value) {
        _uuid = value;
      }
    });
}

function getEnvironmentTexture(renderer) {
  if (!renderer) return Promise.resolve(null);
  if (!environmentTexturePromise) {
    environmentTexturePromise = (async () => {
      const pmrem = new THREE.PMREMGenerator(renderer);
      try {
        const TempRoomEnvironment = await loadRoomEnvironment();
        return pmrem.fromScene(new TempRoomEnvironment()).texture;
      } finally {
        pmrem.dispose();
      }
    })();
  }
  return environmentTexturePromise;
}

function reportLoadError(error, context = "") {
  const message = reportViewerError(error, {
    context,
    consoleLabel: "Viewer load error:",
  });
  core.circle?.hide();
  if (typeof core.EXIT_CODE !== "undefined") core.EXIT_CODE = 1;
  return message;
}

export async function loadModel() {
  let modelPath = core.fileObject.filename.startsWith('blob:') ? core.fileObject.filename : core.fileObject.path + core.fileObject.filename;
  if (core.CONFIG.entity.proxyPath !== undefined && !core.fileObject.filename.startsWith('blob:')) {
    modelPath = core.getProxyPath(modelPath, core.CONFIG, core.fileObject);
  }

  function loadAsync(loader, url, progressHandler = onProgress) {
    return new Promise((resolve, reject) => {
      loader.load(url, resolve, progressHandler, reject);
    });
  }

  async function afterLoad({ object }) {
    if (object === null || typeof object === "undefined") {
      throw new Error("Loaded object is null or undefined.");
    }
    // Keep authoring transforms in presentation mode to avoid collapsing model parts.
    if (!core.PRESENTATION_MODE) {
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
      await fetchSettings(object);
      core.outlineClipping = prepareOutlineClipping(object);
      if (Array.isArray(object)) {
        core.helperObjects.push(object[0]);
      } else {
        core.helperObjects.push(object);
      }
      core.scene.add(core.outlineClipping);
    } else {
      presentationMode(object, null).catch(error => {
        reportLoadError(error, "Presentation mode setup failed");
        showToast("toasts.presentationModeError", "error");
      });
    }
    if (Array.isArray(object)) {
      object.forEach(o => core.scene.add(o));
    } else {
      core.scene.add(object);
    }
    core.mainObject.push(object);
    core.scene.environment = await getEnvironmentTexture(core.renderer);
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

  async function loadGLTFModel() {
    let gltfModelPath = core.fileObject.filename.startsWith('blob:') ? core.fileObject.filename : core.fileObject.path + core.fileObject.basename + "." + core.fileObject.extension;
    if (core.CONFIG.entity.proxyPath !== undefined && !core.fileObject.filename.startsWith('blob:')) {
      gltfModelPath = core.getProxyPath(gltfModelPath);
    }

    const dracoBase = normalizePath(normalizeWasmPath(`${getModuleAssetBasePath()}/draco/gltf/`));

    const loader = await createLoader(core.fileObject.extension.toLowerCase());
    const DRACOLoader = await loadDRACOLoader();
    const draco = new DRACOLoader();
    if (ENV_BUILD === 'drupal') {
      draco.setDecoderConfig({ type: 'js' });
    }
    draco.setDecoderPath(dracoBase);
    loader.setDRACOLoader(draco);

    try {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(
          gltfModelPath,
          resolve,
          (xhr) => {
            progressLoaderHandler(xhr);
          },
          reject
        );
      });
      return gltf.scene;
    } finally {
      draco.dispose();
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

      case "glb":
      case "gltf": {
        const object = await loadGLTFModel();
        await afterLoad({ object });
        break;
      }
      default:
        toastHelper("unsupportedExtension", "warning");
        return;
    }
  } catch (error) {
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
  const percentComplete = Math.min((xhr.loaded / total) * 100, 100);
  if (!Number.isFinite(percentComplete)) return;
  core.circle.show();
  core.circle.set(percentComplete, 100);
  core.UltraLoader?.set(percentComplete);
  if (percentComplete >= 100) {
    core.circle.hide();
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
  }
}

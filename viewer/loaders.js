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
import { fetchSettings } from "./metadata.js";
import { showToast } from "./viewer-utils.js";

export var outlineClipping;

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
  pcd: loadPCDLoader
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
console.log('[loaders] ENV_BUILD:', ENV_BUILD);
console.log('[loaders] MODULES_PATH:', MODULES_PATH);

function prepareOutlineClipping(_object) {
  core.outlineClipping = _object.clone(true);
  var gutsMaterial = new THREE.MeshBasicMaterial({
    color: "crimson",
    side: THREE.BackSide,
    clippingPlanes: core.clippingPlanes,
    clipShadows: true,
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
  //material.side = THREE.DoubleSide;
  material.clipShadows = true;
  material.side = THREE.FrontSide;
  material.clippingPlanes = core.clippingPlanes;
  //material.clipIntersection = false;
  if (material.name === "") material.name = material.uuid;
  var newMaterial = { name: material.name, uuid: material.uuid };
  if (!materials.includes(newMaterial)) materials.push(newMaterial);
}

function setupMaterials(_object) {
  var materials = [];
  if (_object.isMesh) {
    _object.castShadow = true;
    _object.receiveShadow = true;
    _object.geometry.computeVertexNormals();
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
  var objectMaterials = ["select by name"];
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
  core.materialsFolder
    .add(core.materialsPropertiesText, "Edit material", objectMaterials)
    .onChange(function (value) {
      if (
        (value === "select by name" || value !== _uuid) &&
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

  export async function loadModel() {

    let modelPath = core.fileObject.path + core.fileObject.filename;
    if (core.CONFIG.entity.proxyPath !== undefined) {
      modelPath = core.getProxyPath(modelPath, core.CONFIG, core.fileObject);
    }

    // Helper: promisify THREE loader.load
    function loadAsync(loader, url, onProgress) {
      return new Promise((resolve, reject) => {
        loader.load(url, resolve, onProgress, reject);
      });
    }

    // Helper: common post-load pipeline
    async function afterLoad({ object }) {
      if (object === null || typeof object === "undefined") {
        showToast("Loaded object is null or undefined.");
        return;
      }
      core.handHint.hidden = true;
      window.viewer.modelLoaded = true;
      if (window.__E2E__) {
        window.viewer.camera = core.camera;
        window.viewer.scene = core.scene;
      }
      traverseMesh(object);
      if (core.fileObject.extension.toLowerCase() === "gltf" || core.fileObject.extension.toLowerCase() === "glb") core.fileObject.path = core.fileObject.path.replace("/gltf/", "/");
      else core.fileObject.path = core.fileObject.path.replace("gltf/", "");
      fetchSettings(object);
      core.outlineClipping = prepareOutlineClipping(object);
      if (Array.isArray(object)) {
        object.forEach(o => core.scene.add(o));
        core.helperObjects.push(object[0]);
      } else {
        core.scene.add(object);
        core.helperObjects.push(object);
      }
      core.scene.add(core.outlineClipping);
      core.mainObject.push(object);

      const pmrem = new THREE.PMREMGenerator(core.renderer);
      const TempRoomEnvironment = await loadRoomEnvironment();
      core.scene.environment = pmrem.fromScene(new TempRoomEnvironment()).texture;
      pmrem.dispose();
      /*const rgbeLoader = new RGBELoader();
      rgbeLoader.load('env.hdr', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        core.scene.environment = texture;
      });*/
    }

    async function loadOBJWithMTL() {
      const manager = new THREE.LoadingManager();
      manager.onLoad = () => showToast("OBJ model has been loaded");
      manager.addHandler(/\.dds$/i, new DDSLoader());

      const basename = core.fileObject.filename.replace(/\.[^/.]+$/, "");
      const filename = core.fileObject.filename;

      if (!core.CONFIG.noMTL) {
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
      return path.replace(/\/{2,}/g, '/');
    }

    async function loadGLTFModel() {
      let modelPath = core.fileObject.path + core.fileObject.basename + "." + core.fileObject.extension;
      if (core.CONFIG.entity.proxyPath !== undefined) {
        modelPath = core.getProxyPath(modelPath);
      }

      const dracoBase = normalizePath(
      ENV_BUILD === 'drupal'
        //? `/sites/default/files/draco/` //remember to copy draco files to this public location in drupal build
        ? `/modules/${MODULES_PATH}/dfg_3dviewer/dist/${ENV_BUILD}/assets/draco/`
        : `/assets/draco/`
      );

      const loader = await createLoader(core.fileObject.extension.toLowerCase());
      const DRACOLoader = await loadDRACOLoader();
      const draco = new DRACOLoader();
      draco.setDecoderPath("assets/draco/");
      loader.setDRACOLoader(draco);
    
      const gltf = await new Promise((resolve, reject) => {
        loader.load(
          modelPath,
          resolve,
          (xhr) => {
            if (!core.circle) return;
            const total = xhr.total || xhr.loaded || 1;
            const percentComplete = Math.min((xhr.loaded / total) * 100, 100);
            if (!Number.isFinite(percentComplete)) return;
            core.circle.show();
            core.circle.set(percentComplete, 100);
            if (percentComplete >= 100) {
              core.circle.hide();
              showToast("Model " + core.fileObject.filename + " has been loaded.");
            }
          },
        reject
        );
      });

      //gltf.scene.position.set(0, 0, 0);
      return gltf.scene;
    }

    switch (core.fileObject.extension.toLowerCase()) {
      case "obj": {
        const object = await loadOBJWithMTL();
        afterLoad({ object });
        break;
      }

      case "fbx": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const object = await loadAsync(loader, modelPath, onProgress);
        //object.position.set(0, 0, 0);
        afterLoad({ object });
        break;
      }

      case "ply": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const geometry = await loadAsync(loader, modelPath, onProgress);
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({ color: 0x0055ff, flatShading: true });
        const object = new THREE.Mesh(geometry, material);
        object.position.set(0, 0, 0);
        object.castShadow = true;
        object.receiveShadow = true;
        afterLoad({ object });
        break;
      }

      case "dae": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const collada = await loadAsync(loader, modelPath, onProgress);
        const object = collada.scene;
        object.position.set(0, 0, 0);
        afterLoad({ object });
        break;
      }

      case "ifc": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const ifcWasmPath =
          ENV_BUILD === 'drupal'
            ? `/modules/${MODULES_PATH}/dfg_3dviewer/dist/assets/ifc/`
            : `/assets/ifc/`;
        ifcLoader.ifcManager.setWasmPath(ifcWasmPath, true);
        const object = await loadAsync(ifcLoader, modelPath, onProgress);
        afterLoad({ object });
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
        core.mainObject.push(object);
        afterLoad({ object });
        break;
      }

      case "xyz": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const geometry = await loadAsync(loader, modelPath, onProgress);
        geometry.center();
        const material = new THREE.PointsMaterial({ size: 0.1, vertexColors: geometry.hasAttribute("color") === true });
        const object = new THREE.Points(geometry, material);
        object.position.set(0, 0, 0);
        afterLoad({ object });
        break;
      }

      case "pcd": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        const mesh = await loadAsync(loader, modelPath, onProgress);
        afterLoad({ object: mesh });
        break;
      }

      case "json": {
        const loader = new THREE.ObjectLoader();
        const object = await loadAsync(loader, modelPath, onProgress);
        object.position.set(0, 0, 0);
        core.mainObject.push(object);
        afterLoad({ object });
        break;
      }

      case "3ds": {
        const loader = await createLoader(core.fileObject.extension.toLowerCase());
        loader.setResourcePath(core.fileObject.path);
        let mp = path;
        if (core.CONFIG.entity.proxyPath !== undefined) mp = core.getProxyPath(mp);
        const object = await loadAsync(loader, mp + core.fileObject.basename + "." + core.fileObject.extension, onProgress);
        core.mainObject.push(object);
        afterLoad({ object });
        break;
      }

      case "glb":
      case "gltf": {
        const object = await loadGLTFModel();
        afterLoad({ object });
        break;
      }
      default:
        showToast("Extension not supported yet");
        break;
    }
}

export const onError = function (_event) {
  //circle.set(100, 100);
  console.log("Loader error: " + _event);
  if (typeof core.circle !== "undefined") core.circle.hide();
  if (typeof core.EXIT_CODE !== "undefined") core.EXIT_CODE = 1;
};

export const onErrorMTL = async function (_event) {
  //circle.set(100, 100);
  core.CONFIG.noMTL = true;
  showToast("Error occured while loading attached MTL file.");
  await loadModel();
};

export const onErrorGLB = async function (_event, params, loadedTimes) {
  console.log("Loader error: " + _event);
  core.loadedFile = params.path + params.basename + core.loadedFile + "gltf/";
  if (typeof _event !== undefined && loadedTimes <= 1 && window.viewer.modelLoaded === false) {
    await loadModel();
    loadedTimes++;
  } else {
    showToast("Error occured while loading attached GLB file.");
  }
};

export const onProgress = function (xhr) {
  if (!core.circle) return;
  const total = xhr.total || xhr.loaded || 1;
  const percentComplete = Math.min((xhr.loaded / total) * 100, 100);

  if (!Number.isFinite(percentComplete)) return;

  core.circle.show();
  core.circle.set(percentComplete, 100);
  if (percentComplete >= 100) {
    core.circle.hide();
    showToast("Model has been loaded.");
    if (typeof core.EXIT_CODE !== "undefined") core.EXIT_CODE = 0;
  }
};

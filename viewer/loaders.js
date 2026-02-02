import THREE from "./init.js";
import { DDSLoader } from "three/examples/jsm/loaders/DDSLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { XYZLoader } from "three/examples/jsm/loaders/XYZLoader.js";
import { TDSLoader } from "three/examples/jsm/loaders/TDSLoader.js";
import { PCDLoader } from "three/examples/jsm/loaders/PCDLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { IFCLoader } from "./js/loaders/IFCLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Remove main.js import
import { core, setCore } from './core.js';
import { fetchSettings } from "./metadata.js";
import { showToast } from "./viewer-utils.js";

export var outlineClipping;

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
        console.log(_material);
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

  export async function loadModel(params) {
    var {
      fileObject,
      config,
      getProxyPath,
      camera,
      lightObjects,
      controls,
      scene,
      mainObject,
      gui,
      stats,
      entityID,
      container,
      metadataContainer,
      canvasText,
      bottomLineGUI,
      compressedFile,
      viewEntity
    } = params;

    let modelPath = params.fileObject.path + params.fileObject.filename;
    if (config.entity.proxyPath !== undefined) {
      modelPath = getProxyPath(modelPath, config, params.fileObject);
    }

    // Helper: promisify THREE loader.load
    function loadAsync(loader, url, onProgress) {
      return new Promise((resolve, reject) => {
        loader.load(url, resolve, onProgress, reject);
      });
    }

    // Helper: common post-load pipeline
    async function afterLoad({ object, params, camera, lightObjects, controls, gui, config, getProxyPath, stats, guiContainer, entityID, container, metadataContainer, canvasText, bottomLineGUI, compressedFile, viewEntity, scene, mainObject, core }) {
      if (object === null || typeof object === "undefined") {
        showToast("Loaded object is null or undefined.");
        return;
      }
      core.handHint.hidden = true;
      window.viewer.modelLoaded = true;
      if (window.__E2E__) {
        window.viewer.camera = camera;
        window.viewer.scene = scene;
      }
      traverseMesh(object);
      if (params.fileObject.extension.toLowerCase() === "gltf" || params.fileObject.extension.toLowerCase() === "glb") params.fileObject.path = params.fileObject.path.replace("/gltf/", "/");
      else params.fileObject.path = params.fileObject.path.replace("gltf/", "");
      fetchSettings( params.fileObject, object, camera, lightObjects[0], controls, gui, config, getProxyPath, stats, guiContainer, entityID, container, metadataContainer, canvasText, bottomLineGUI, compressedFile, viewEntity);
      core.outlineClipping = prepareOutlineClipping(object);
      scene.add(object, core.outlineClipping);
      scene.add(object);
      mainObject.push(object);

      const pmrem = new THREE.PMREMGenerator(core.renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
      pmrem.dispose();
    }

    async function loadOBJWithMTL(fileObject, config) {
      const manager = new THREE.LoadingManager();
      manager.onLoad = () => showToast("OBJ model has been loaded");
      manager.addHandler(/\.dds$/i, new DDSLoader());

      const basename = fileObject.filename.replace(/\.[^/.]+$/, "");
      const filename = fileObject.filename;

      if (!config.noMTL) {
        const materials = await new Promise((resolve, reject) => {
          new MTLLoader(manager)
          .setPath(fileObject.path)
          .load(basename + ".mtl", resolve, undefined, reject);
        });
        materials.preload();

        const obj = await new Promise((resolve, reject) => {
          new OBJLoader(manager)
          .setMaterials(materials)
          .setPath(fileObject.path)
          .load(filename, resolve, onProgress, reject);
        });

        obj.position.set(0, 0, 0);
        return obj;
      }

      const obj = await new Promise((resolve, reject) => {
        new OBJLoader()
        .setPath(fileObject.path)
        .load(filename, resolve, onProgress, reject);
      });

      obj.position.set(0, 0, 0);
      return obj;
    }


    function normalizePath(path) {
      return path.replace(/\/{2,}/g, '/');
    }

    async function loadGLTFModel(fileObject, config) {
      let modelPath = fileObject.path + fileObject.basename + "." + fileObject.extension;
      if (config.entity.proxyPath !== undefined) {
        modelPath = getProxyPath(modelPath);
      }

      const dracoBase = normalizePath(
      ENV_BUILD === 'drupal'
        ? `/modules/${MODULES_PATH}/dfg_3dviewer/dist/assets/draco/`
        : `/assets/draco/`
      );
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath(dracoBase);
      dracoLoader.preload();

      const loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoader);
    
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
              showToast("Model " + fileObject.filename + " has been loaded.");
            }
          },
        reject
        );
      });

      //gltf.scene.position.set(0, 0, 0);
      return gltf.scene;
    }

    switch (fileObject.extension.toLowerCase()) {
      case "obj": {
        const object = await loadOBJWithMTL(params.fileObject, config, scene, mainObject, params);
        afterLoad({ object, params, camera, lightObjects, controls, gui, config, getProxyPath, stats, guiContainer, entityID, container, metadataContainer, canvasText, bottomLineGUI, compressedFile, viewEntity, scene, mainObject, core });
        break;
      }

      case "fbx": {
        const loader = new FBXLoader();
        const object = await loadAsync(loader, modelPath, onProgress);
        //object.position.set(0, 0, 0);
        afterLoad({ object, params, camera, lightObjects, controls, gui, config, getProxyPath, stats, guiContainer, entityID, container, metadataContainer, canvasText, bottomLineGUI, compressedFile, viewEntity, scene, mainObject, core });
        break;
      }

      case "ply": {
        const loader = new PLYLoader();
        const geometry = await loadAsync(loader, modelPath, onProgress);
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({ color: 0x0055ff, flatShading: true });
        const object = new THREE.Mesh(geometry, material);
        object.position.set(0, 0, 0);
        object.castShadow = true;
        object.receiveShadow = true;
        afterLoad({ object, params, camera, lightObjects, controls, gui, config, getProxyPath, stats, guiContainer, entityID, container, metadataContainer, canvasText, bottomLineGUI, compressedFile, viewEntity, scene, mainObject, core });
        break;
      }

      case "dae": {
        const loader = new ColladaLoader();
        const collada = await loadAsync(loader, modelPath, onProgress);
        const object = collada.scene;
        object.position.set(0, 0, 0);
        afterLoad({ object, params, camera, lightObjects, controls, gui, config, getProxyPath, stats, guiContainer, entityID, container, metadataContainer, canvasText, bottomLineGUI, compressedFile, viewEntity, scene, mainObject, core });
        break;
      }

      case "ifc": {
        const ifcLoader = new IFCLoader();
        ifcLoader.ifcManager.setWasmPath("./dist/ifc/", true);
        const object = await loadAsync(ifcLoader, modelPath, onProgress);
        afterLoad({ object, params, camera, lightObjects, controls, gui, config, getProxyPath, stats, guiContainer, entityID, container, metadataContainer, canvasText, bottomLineGUI, compressedFile, viewEntity, scene, mainObject, core });
        break;
      }

      case "stl": {
        const loader = new STLLoader();
        const geometry = await loadAsync(loader, modelPath, onProgress);
        let meshMaterial = new THREE.MeshPhongMaterial({ color: 0xff5533, specular: 0x111111, shininess: 200 });
        if (geometry.hasColors) {
          meshMaterial = new THREE.MeshPhongMaterial({ opacity: geometry.alpha, vertexColors: true });
        }
        const object = new THREE.Mesh(geometry, meshMaterial);
        object.position.set(0, 0, 0);
        object.castShadow = true;
        object.receiveShadow = true;
        afterLoad({ object, params, camera, lightObjects, controls, gui, config, getProxyPath, stats, guiContainer, entityID, container, metadataContainer, canvasText, bottomLineGUI, compressedFile, viewEntity, scene, mainObject, core });
        break;
      }

      case "xyz": {
        const loader = new XYZLoader();
        const geometry = await loadAsync(loader, modelPath, onProgress);
        geometry.center();
        const material = new THREE.PointsMaterial({ size: 0.1, vertexColors: geometry.hasAttribute("color") === true });
        const object = new THREE.Points(geometry, material);
        object.position.set(0, 0, 0);
        afterLoad({ object, params, camera, lightObjects, controls, gui, config, getProxyPath, stats, guiContainer, entityID, container, metadataContainer, canvasText, bottomLineGUI, compressedFile, viewEntity, scene, mainObject, core });
        break;
      }

      case "pcd": {
        const loader = new PCDLoader();
        const mesh = await loadAsync(loader, modelPath, onProgress);
        afterLoad({ object: mesh, params, camera, lightObjects, controls, gui, config, getProxyPath, stats, guiContainer, entityID, container, metadataContainer, canvasText, bottomLineGUI, compressedFile, viewEntity, scene, mainObject, core });
        break;
      }

      case "json": {
        const loader = new THREE.ObjectLoader();
        const object = await loadAsync(loader, modelPath, onProgress);
        object.position.set(0, 0, 0);
        afterLoad({ object, params, camera, lightObjects, controls, gui, config, getProxyPath, stats, guiContainer, entityID, container, metadataContainer, canvasText, bottomLineGUI, compressedFile, viewEntity, scene, mainObject, core });
        break;
      }

      case "3ds": {
        const loader = new TDSLoader();
        loader.setResourcePath(params.fileObject.path);
        let mp = path;
        if (config.entity.proxyPath !== undefined) mp = getProxyPath(mp);
        const object = await loadAsync(loader, mp + params.fileObject.basename + "." + params.fileObject.extension, onProgress);
        afterLoad({ object, params, camera, lightObjects, controls, gui, config, getProxyPath, stats, guiContainer, entityID, container, metadataContainer, canvasText, bottomLineGUI, compressedFile, viewEntity, scene, mainObject, core });
        break;
      }

      case "glb":
      case "gltf": {
        const object = await loadGLTFModel(params.fileObject, config, scene, mainObject);
        afterLoad({ object, params, camera, lightObjects, controls, gui, config, getProxyPath, stats, guiContainer, entityID, container, metadataContainer, canvasText, bottomLineGUI, compressedFile, viewEntity, scene, mainObject, core });
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

export const onErrorMTL = async function (_event, params) {
  //circle.set(100, 100);
  if (typeof params !== "undefined") params.noMTL = true;
  showToast("Error occured while loading attached MTL file.");
  await loadModel(params);
};

export const onErrorGLB = async function (_event, params, loadedTimes) {
  console.log("Loader error: " + _event);
  if (typeof _event !== undefined && loadedTimes <= 1 && window.viewer.modelLoaded === false) {
    await loadModel({
      ...params,
      path: params.path + params.basename + params.compressedFile + "gltf/",
      extension: "glb"
    });
    loadedTimes++;
  } else {
    showToast("Error occured while loading attached GLB file.");
  }
};

export const onProgress = function (xhr, params) {
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

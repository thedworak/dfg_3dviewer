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
import { IFCLoader } from "web-ifc-three";

// Remove main.js import
import { core, setCore } from './core.js';
import { fetchSettings } from "./metadata.js";
import { showToast, initClippingPlanes } from "./viewer-utils.js";

export var outlineClipping;

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
  }
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
    viewEntity,
    helperObjects
  } = params;

  // Example usage:
  // Instead of fileObject.originalPath, use params.fileObject.originalPath
  let modelPath = fileObject.path + fileObject.filename;
  if (config.entity.proxyPath !== undefined) {
    modelPath = getProxyPath(modelPath, config, params.fileObject);
  }

  switch (fileObject.extension.toLowerCase()) {
    case "obj":
      if (!config.noMTL) {
        const manager = new THREE.LoadingManager();
        manager.onLoad = function () {
          showToast("OBJ model has been loaded");
        };
        manager.addHandler(/\.dds$/i, new DDSLoader());
        new MTLLoader(manager).setPath(fileObject.path).load(
          basename + ".mtl",
          function (materials) {
            materials.preload();
            new OBJLoader(manager)
              .setMaterials(materials)
              .setPath(fileObject.path)
              .load(
                filename,
                function (object) {
                  object.position.set(0, 0, 0);
                  traverseMesh(object);
                  fileObject.path = fileObject.path.replace("gltf/", "");
                  fetchSettings(
                    fileObject,
                    object,
                    camera,
                    lightObjects[0],
                    controls,
                    gui,
                    config,
                    getProxyPath,
                    stats,
                    guiContainer,
                    entityID,
                    container,
                    metadataContainer,
                    canvasText,
                    bottomLineGUI,
                    compressedFile,
                    viewEntity,
                    helperObjects
                  );
                  core.outlineClipping = prepareOutlineClipping(object);
                  scene.add(object, core.outlineClipping);
                  scene.add(object);
                  mainObject.push(object);
                },
                onProgress,
                onError
              );
          },
          function () {},
          onErrorMTL
        );
      } else {
        const loader = new OBJLoader();
        loader.setPath(path).load(
          filename,
          function (object) {
            object.position.set(0, 0, 0);
            traverseMesh(object);
            fileObject.path = fileObject.path.replace("gltf/", "");
              fetchSettings(
                fileObject,
                object,
                camera,
                lightObjects[0],
                controls,
                gui,
                config,
                getProxyPath,
                stats,
                guiContainer,
                entityID,
                container,
                metadataContainer,
                canvasText,
                bottomLineGUI,
                compressedFile,
                viewEntity,
                helperObjects
              );
            core.outlineClipping = prepareOutlineClipping(object);
            scene.add(object, core.outlineClipping);
            scene.add(object);
            mainObject.push(object);
          },
          onProgress,
          onError
        );
      }
      break;

    case "fbx":
      loader = new FBXLoader();
      loader.load(
        modelPath,
        function (object) {
          traverseMesh(object);
          object.position.set(0, 0, 0);
          fileObject.path = fileObject.path.replace("gltf/", "");
            fetchSettings(
              fileObject,
              object.children,
              camera,
              lightObjects[0],
              controls,
              gui,
              config,
              getProxyPath,
              stats,
              guiContainer,
              entityID,
              container,
              metadataContainer,
              canvasText,
              bottomLineGUI,
              compressedFile,
              viewEntity,
              helperObjects
            );
          core.outlineClipping = prepareOutlineClipping(object);
          scene.add(object, core.outlineClipping);
          scene.add(object);
          mainObject.push(object);
        },
        onProgress,
        onError
      );
      break;

    case "ply":
      loader = new PLYLoader();
      loader.load(
        modelPath,
        function (geometry) {
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: 0x0055ff,
            flatShading: true,
          });
          const object = new THREE.Mesh(geometry, material);
          object.position.set(0, 0, 0);
          object.castShadow = true;
          object.receiveShadow = true;
          traverseMesh(object);
          fileObject.path = fileObject.path.replace("gltf/", "");
            fetchSettings(
              fileObject,
              object,
              camera,
              lightObjects[0],
              controls,
              gui,
              config,
              getProxyPath,
              stats,
              guiContainer,
              entityID,
              container,
              metadataContainer,
              canvasText,
              bottomLineGUI,
              compressedFile,
              viewEntity,
              helperObjects
            );
          mainObject.push(object);
          core.outlineClipping = prepareOutlineClipping(object);
          scene.add(object, core.outlineClipping);
          scene.add(object);
        },
        onProgress,
        onError
      );
      break;

    case "dae":
      const loadingManager = new THREE.LoadingManager(function () {
        scene.add(object);
      });
      loader = new ColladaLoader(loadingManager);
      loader.load(
        modelPath,
        function (object) {
          object = object.scene;
          object.position.set(0, 0, 0);
          traverseMesh(object);
          fileObject.path = fileObject.path.replace("gltf/", "");
          fetchSettings(
            fileObject,
            object,
            camera,
            lightObjects[0],
            controls,
            gui,
            config,
            getProxyPath,
            stats,
            guiContainer,
            entityID,
            container,
            metadataContainer,
            canvasText,
            bottomLineGUI,
            compressedFile,
            viewEntity,
            helperObjects
          );
          mainObject.push(object);
          core.outlineClipping = prepareOutlineClipping(object);
          scene.add(object, core.outlineClipping);
          scene.add(object);
        },
        onProgress,
        onError
      );
      break;

    case "ifc":
      const ifcLoader = new IFCLoader();
      // Use relative path to ifc files in dist folder
      const ifcPath = "./dist/ifc/";
      ifcLoader.ifcManager.setWasmPath(ifcPath, true);
      ifcLoader.load(
        modelPath,
        function (object) {
          traverseMesh(object);
          fileObject.path = fileObject.path.replace("gltf/", "");
          fetchSettings(
            fileObject,
            object,
            camera,
            lightObjects[0],
            controls,
            gui,
            config,
            getProxyPath,
            stats,
            guiContainer,
            entityID,
            container,
            metadataContainer,
            canvasText,
            bottomLineGUI,
            compressedFile,
            viewEntity,
            helperObjects
          );
          core.outlineClipping = prepareOutlineClipping(object);
          scene.add(object, core.outlineClipping);
          scene.add(object);
          mainObject.push(object);
        },
        onProgress,
        onError
      );
      break;

    case "stl":
      loader = new STLLoader();
      loader.load(
        modelPath,
        function (geometry) {
          let meshMaterial = new THREE.MeshPhongMaterial({
            color: 0xff5533,
            specular: 0x111111,
            shininess: 200,
          });
          if (geometry.hasColors) {
            meshMaterial = new THREE.MeshPhongMaterial({
              opacity: geometry.alpha,
              vertexColors: true,
            });
          }
          const object = new THREE.Mesh(geometry, meshMaterial);
          object.position.set(0, 0, 0);
          traverseMesh(object);
          object.castShadow = true;
          object.receiveShadow = true;
          fileObject.path = fileObject.path.replace("gltf/", "");
          fetchSettings(
            fileObject,
            object,
            camera,
            lightObjects[0],
            controls,
            gui,
            config,
            getProxyPath,
            stats,
            guiContainer,
            entityID,
            container,
            metadataContainer,
            canvasText,
            bottomLineGUI,
            compressedFile,
            viewEntity,
            helperObjects
          );
          core.outlineClipping = prepareOutlineClipping(object);
          scene.add(object, core.outlineClipping);
          scene.add(object);
          mainObject.push(object);
        },
        onProgress,
        onError
      );
      break;

    case "xyz":
      loader = new XYZLoader();
      loader.load(
        modelPath,
        function (geometry) {
          geometry.center();
          const vertexColors = geometry.hasAttribute("color") === true;
          const material = new THREE.PointsMaterial({
            size: 0.1,
            vertexColors: vertexColors,
          });
          const object = new THREE.Points(geometry, material);
          traverseMesh(object);
          object.position.set(0, 0, 0);
          fileObject.path = fileObject.path.replace("gltf/", "");
          fetchSettings(
            fileObject,
            object,
            camera,
            lightObjects[0],
            controls,
            gui,
            config,
            getProxyPath,
            stats,
            guiContainer,
            entityID,
            container,
            metadataContainer,
            canvasText,
            bottomLineGUI,
            compressedFile,
            viewEntity,
            helperObjects
          );
          core.outlineClipping = prepareOutlineClipping(object);
          scene.add(object, core.outlineClipping);
          scene.add(object);
          mainObject.push(object);
        },
        onProgress,
        onError
      );
      break;

    case "pcd":
      loader = new PCDLoader();
      loader.load(
        modelPath,
        function (mesh) {
          traverseMesh(mesh);
          fileObject.path = fileObject.path.replace("gltf/", "");
          fetchSettings(
            fileObject,
            mesh,
            camera,
            lightObjects[0],
            controls,
            gui,
            config,
            getProxyPath,
            stats,
            guiContainer,
            entityID,
            container,
            metadataContainer,
            canvasText,
            bottomLineGUI,
            compressedFile,
            viewEntity,
            helperObjects
          );
          mainObject.push(mesh);
          core.outlineClipping = prepareOutlineClipping(mesh);
          scene.add(mesh, core.outlineClipping);
          scene.add(mesh);
        },
        onProgress,
        onError
      );
      break;

    case "json":
      loader = new THREE.ObjectLoader();
      loader.load(
        modelPath,
        function (object) {
          object.position.set(0, 0, 0);
          traverseMesh(object);
          fileObject.path = fileObject.path.replace("gltf/", "");
          fetchSettings(
            fileObject,
            object,
            camera,
            lightObjects[0],
            controls,
            gui,
            config,
            getProxyPath,
            stats,
            guiContainer,
            entityID,
            container,
            metadataContainer,
            canvasText,
            bottomLineGUI,
            compressedFile,
            viewEntity,
            helperObjects
          );
          core.outlineClipping = prepareOutlineClipping(object);
          scene.add(object, core.outlineClipping);
          scene.add(object);
          mainObject.push(object);
        },
        onProgress,
        onError
      );
      break;

    case "3ds":
      loader = new TDSLoader();
      loader.setResourcePath(fileObject.path);
      modelPath = path;
      if (config.entity.proxyPath !== undefined) {
        modelPath = getProxyPath(modelPath);
      }
      loader.load(
        modelPath + fileObject.basename + "." + fileObject.extension,
        function (object) {
          traverseMesh(object);
          fileObject.path = fileObject.path.replace("gltf/", "");
          fetchSettings(
            fileObject,
            object,
            camera,
            lightObjects[0],
            controls,
            gui,
            config,
            getProxyPath,
            stats,
            guiContainer,
            entityID,
            container,
            metadataContainer,
            canvasText,
            bottomLineGUI,
            compressedFile,
            viewEntity,
            helperObjects
          );
          mainObject.push(object);
          core.outlineClipping = prepareOutlineClipping(object);
          scene.add(object, core.outlineClipping);
          scene.add(object);
        },
        onProgress,
        onError
      );
      break;

    case "glb":
    case "gltf":
      const dracoLoader = new DRACOLoader();
      // Use relative path to draco files in dist folder
      dracoLoader.setDecoderPath("assets/draco/");
      dracoLoader.preload();
      const gltf = new GLTFLoader();
      gltf.setDRACOLoader(dracoLoader);
      showToast(
        "Model has being loaded from " + fileObject.extension + " representation."
      );
      modelPath = fileObject.path + fileObject.basename + "." + fileObject.extension;
      if (config.entity.proxyPath !== undefined) {
        modelPath = getProxyPath(modelPath);
      }
      gltf.load(
        modelPath,
        function (gltf) {
          traverseMesh(gltf.scene);
          fileObject.path = fileObject.path.replace("gltf/", "");
          fetchSettings(
            fileObject,
            gltf.scene,
            camera,
            params.lightObjects[0],
            controls,
            gui,
            config,
            getProxyPath,
            stats,
            guiContainer,
            entityID,
            container,
            metadataContainer,
            canvasText,
            bottomLineGUI,
            compressedFile,
            viewEntity,
            helperObjects
          );
          core.outlineClipping = prepareOutlineClipping(gltf.scene);
          core.outlineClipping.position.set(
            gltf.scene.position.x,
            gltf.scene.position.y,
            gltf.scene.position.z
          );
          scene.add(gltf.scene, core.outlineClipping);
          scene.add(gltf.scene);
          mainObject.push(gltf.scene);
        },
        function (xhr) {
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
        onErrorGLB
      );
      break;

    default:
      showToast("Extension not supported yet");
  }
}

export const onError = function (_event) {
  //circle.set(100, 100);
  console.log("Loader error: " + _event);
  if (typeof core.circle !== "undefined") core.circle.hide();
  if (typeof EXIT_CODE !== "undefined") EXIT_CODE = 1;
};

export const onErrorMTL = async function (_event, params) {
  //circle.set(100, 100);
  if (typeof params !== "undefined") params.noMTL = true;
  showToast("Error occured while loading attached MTL file.");
  await loadModel(params);
};

export const onErrorGLB = async function (_event, params, loadedTimes) {
  console.log(_event);
  if (typeof _event !== undefined && loadedTimes <= 1) {
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
    if (typeof params.EXIT_CODE !== "undefined") params.EXIT_CODE = 0;
  }
};

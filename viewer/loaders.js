import * as THREE from "./build/three.module.js";
import { DDSLoader } from "./js/jsm/loaders/DDSLoader.js";
import { MTLLoader } from "./js/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "./js/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "./js/jsm/loaders/FBXLoader.js";
import { PLYLoader } from "./js/jsm/loaders/PLYLoader.js";
import { ColladaLoader } from "./js/jsm/loaders/ColladaLoader.js";
import { IFCLoader } from "./js/external_libs/loaders/IFCLoader.js";
import { STLLoader } from "./js/jsm/loaders/STLLoader.js";
import { XYZLoader } from "./js/jsm/loaders/XYZLoader.js";
import { TDSLoader } from "./js/jsm/loaders/TDSLoader.js";
import { PCDLoader } from "./js/jsm/loaders/PCDLoader.js";
import { GLTFLoader } from "./js/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "./js/jsm/loaders/DRACOLoader.js";
import Toastify from "./toastify.js";

export async function loadModel(params) {
  var {
    path,
    basename,
    filename,
    extension,
    orgExtension,
    fileObject, // <-- now available here
    config,
    getProxyPath,
    traverseMesh,
    prepareOutlineClipping,
    fetchSettings,
    camera,
    lightObjects,
    controls,
    scene,
    mainObject,
    outlineClipping,
    circle
  } = params;

  // Example usage:
  // Instead of fileObject.originalPath, use params.fileObject.originalPath
  let modelPath = path + filename;
  if (config.entity.proxyPath !== undefined) {
    modelPath = getProxyPath(modelPath, config, fileObject);
  }

  switch (extension.toLowerCase()) {
    case "obj":
      if (!config.noMTL) {
        const manager = new THREE.LoadingManager();
        manager.onLoad = function () {
          showToast("OBJ model has been loaded");
        };
        manager.addHandler(/\.dds$/i, new DDSLoader());
        new MTLLoader(manager).setPath(path).load(
          basename + ".mtl",
          function (materials) {
            materials.preload();
            new OBJLoader(manager)
              .setMaterials(materials)
              .setPath(path)
              .load(
                filename,
                function (object) {
                  object.position.set(0, 0, 0);
                  traverseMesh(object);
                  fetchSettings(
                    path.replace("gltf/", ""),
                    basename,
                    filename,
                    object,
                    camera,
                    lightObjects[0],
                    controls,
                    orgExtension,
                    extension
                  );
                  outlineClipping = prepareOutlineClipping(object);
                  scene.add(object, outlineClipping);
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
            fetchSettings(
              path.replace("gltf/", ""),
              basename,
              filename,
              object,
              camera,
              lightObjects[0],
              controls,
              orgExtension,
              extension
            );
            outlineClipping = prepareOutlineClipping(object);
            scene.add(object, outlineClipping);
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
          fetchSettings(
            path.replace("gltf/", ""),
            basename,
            filename,
            object.children,
            camera,
            lightObjects[0],
            controls,
            orgExtension,
            extension
          );
          outlineClipping = prepareOutlineClipping(object);
          scene.add(object, outlineClipping);
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
          fetchSettings(
            path.replace("gltf/", ""),
            basename,
            filename,
            object,
            camera,
            lightObjects[0],
            controls,
            orgExtension,
            extension
          );
          mainObject.push(object);
          outlineClipping = prepareOutlineClipping(object);
          scene.add(object, outlineClipping);
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
          fetchSettings(
            path.replace("gltf/", ""),
            basename,
            filename,
            object,
            camera,
            lightObjects[0],
            controls,
            orgExtension,
            extension
          );
          mainObject.push(object);
          outlineClipping = prepareOutlineClipping(object);
          scene.add(object, outlineClipping);
          scene.add(object);
        },
        onProgress,
        onError
      );
      break;

    case "ifc":
      const ifcLoader = new IFCLoader();
      const ifcPath = config.baseModulePath + "/js/external_libs/loaders/ifc/";
      ifcLoader.ifcManager.setWasmPath(ifcPath, true);
      ifcLoader.load(
        modelPath,
        function (object) {
          traverseMesh(object);
          fetchSettings(
            path.replace("gltf/", ""),
            basename,
            filename,
            object,
            camera,
            lightObjects[0],
            controls,
            orgExtension,
            extension
          );
          outlineClipping = prepareOutlineClipping(object);
          scene.add(object, outlineClipping);
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
          fetchSettings(
            path.replace("gltf/", ""),
            basename,
            filename,
            object,
            camera,
            lightObjects[0],
            controls,
            orgExtension,
            extension
          );
          outlineClipping = prepareOutlineClipping(object);
          scene.add(object, outlineClipping);
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
          fetchSettings(
            path.replace("gltf/", ""),
            basename,
            filename,
            object,
            camera,
            lightObjects[0],
            controls,
            orgExtension,
            extension
          );
          outlineClipping = prepareOutlineClipping(object);
          scene.add(object, outlineClipping);
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
          fetchSettings(
            path.replace("gltf/", ""),
            basename,
            filename,
            mesh,
            camera,
            lightObjects[0],
            controls,
            orgExtension,
            extension
          );
          mainObject.push(mesh);
          outlineClipping = prepareOutlineClipping(mesh);
          scene.add(mesh, outlineClipping);
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
          fetchSettings(
            path.replace("gltf/", ""),
            basename,
            filename,
            object,
            camera,
            lightObjects[0],
            controls,
            orgExtension,
            extension
          );
          outlineClipping = prepareOutlineClipping(object);
          scene.add(object, outlineClipping);
          scene.add(object);
          mainObject.push(object);
        },
        onProgress,
        onError
      );
      break;

    case "3ds":
      loader = new TDSLoader();
      loader.setResourcePath(path);
      modelPath = path;
      if (config.entity.proxyPath !== undefined) {
        modelPath = getProxyPath(modelPath);
      }
      loader.load(
        modelPath + basename + "." + extension,
        function (object) {
          traverseMesh(object);
          fetchSettings(
            path.replace("gltf/", ""),
            basename,
            filename,
            object,
            camera,
            lightObjects[0],
            controls,
            orgExtension,
            extension
          );
          mainObject.push(object);
          outlineClipping = prepareOutlineClipping(object);
          scene.add(object, outlineClipping);
          scene.add(object);
        },
        onProgress,
        onError
      );
      break;

    case "glb":
    case "gltf":
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath(
        config.baseModulePath + "/js/jsm/libs/draco/"
      );
      dracoLoader.preload();
      const gltf = new GLTFLoader();
      gltf.setDRACOLoader(dracoLoader);
      showToast(
        "Model has being loaded from " + extension + " representation."
      );
      modelPath = path + basename + "." + extension;
      if (config.entity.proxyPath !== undefined) {
        modelPath = getProxyPath(modelPath);
      }
      gltf.load(
        modelPath,
        function (gltf) {
          traverseMesh(gltf.scene);
          fetchSettings(
            path.replace("/gltf/", "/"),
            basename,
            filename,
            gltf.scene,
            camera,
            lightObjects[0],
            controls,
            orgExtension,
            extension
          );
          outlineClipping = prepareOutlineClipping(gltf.scene);
          outlineClipping.position.set(
            gltf.scene.position.x,
            gltf.scene.position.y,
            gltf.scene.position.z
          );
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = box.getSize(new THREE.Vector3()).length();
          const center = box.getCenter(new THREE.Vector3());
          const scaleFactor = 10 / size;
          gltf.scene.scale.setScalar(scaleFactor);
          scene.add(gltf.scene, outlineClipping);
          scene.add(gltf.scene);
          mainObject.push(gltf.scene);
        },
        function (xhr) {
          var percentComplete = (xhr.loaded / xhr.total) * 100;
          if (percentComplete !== Infinity) {
            circle.show();
            circle.set(percentComplete, 100);
            if (percentComplete >= 100) {
              circle.hide();
              showToast("Model " + filename + " has been loaded.");
            }
          }
        },
        onErrorGLB
      );
      break;

    default:
      showToast("Extension not supported yet");
  }
}

export var toastifyOptions = {
  duration: 6500,
  gravity: "bottom",
  close: true,
  callback() {
    Toastify.reposition();
  },
};

export function showToast(_str) {
  var myToast = Toastify(toastifyOptions);
  myToast.options.text = _str;
  myToast.showToast();
}

export const onError = function (_event) {
  //circle.set(100, 100);
  console.log("Loader error: " + _event);
  if (typeof circle !== "undefined") circle.hide();
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
  var percentComplete = (xhr.loaded / xhr.total) * 100;
  if (typeof params.circle !== "undefined") {
    params.circle.show();
    params.circle.set(percentComplete, 100);
    if (percentComplete >= 100) {
      params.circle.hide();
      showToast("Model has been loaded.");
      if (typeof params.EXIT_CODE !== "undefined") params.EXIT_CODE = 0;
    }
  }
};
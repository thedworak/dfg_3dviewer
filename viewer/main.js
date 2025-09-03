/*
DFG 3D-Viewer
Copyright (C) 2025 - Daniel Dworak

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details at 
https://www.gnu.org/licenses/.
*/

//Supported file formats: OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, PCD, glTF

import {
  distanceBetweenPoints,
  distanceBetweenPointsVector,
  vectorBetweenPoints,
  halfwayBetweenPoints,
  interpolateDistanceBetweenPoints,
  invertHexColor,
  detectColorFormat,
  hexToRgb,
  isValidUrl,
  truncateString,
  getProxyPath
} from "./utils.js";

import { loadModel, showToast } from "./loaders.js";
import { createIIIFDropdown } from "./metadata.js";

//three.js core
import * as THREE from "./build/three.module.js";

//three.js components
import { Tween } from "./js/jsm/libs/tween.module.js";
import { OrbitControls } from "./js/jsm/controls/OrbitControls.js";
import { TransformControls } from "./js/jsm/controls/TransformControls.js";
import { FontLoader } from "./js/jsm/loaders/FontLoader.js";
import { TextGeometry } from "./js/jsm/geometries/TextGeometry.js";

//custom libraries
import Stats from "./js/jsm/libs/stats.module.js";
import { GUI } from "./js/external_libs/lil-gui.esm.min.js";
import ViewerSettings from "./viewer-settings.json" with { type: "json" };
import { objectsConfig } from "./object-settings.js";
import Toastify from "./toastify.js";
import { lv } from "./spinner/main.js";

import { loadIIIFManifest, getAnnotations } from "./IIIF/iiif-api.js";

let CONFIG = {};
if (ViewerSettings !== undefined) {
  CONFIG = ViewerSettings;
} else {
  CONFIG = {
    mainUrl: "https://dfg-repository.wisski.cloud",
    baseNamespace: "https://dfg-repository.wisski.cloud",
    metadataUrl: "https://dfg-repository.wisski.cloud",
    baseModulePath: "/modules/dfg_3dviewer-main/viewer",
    entity: {
      bundle: "bd3d7baa74856d141bcff7b4193fa128",
      fieldDf: "field_df",
      idUri: "/wisski/navigate/(.*)/view",
      viewEntityPath: "/wisski/navigate/",
      attributeId: "wisski_id",
      metadata: {
        source: "",
      },
    },
    viewer: {
      container: "DFG_3DViewer",
      fileUpload: "fbf95bddee5160d515b982b3fd2e05f7",
      fileName: "faa602a0be629324806aef22892cdbe5",
      imageGeneration: "f605dc6b727a1099b9e52b3ccbdf5673",
      lightweight: 1,
      salt: "Z7FYJMmTiEzcGp4lTpuk4LiA",
      scaleContainer: {
        x: 1,
        y: 1.4,
      },
      gallery: {
        container: "block-bootstrap5-content",
        imageClass: "field--name-fd6a974b7120d422c7b21b5f1f2315d9",
        imageId: "",
      },
      background:
        "radial-gradient(circle, rgb(255, 255, 255) 0%, rgb(210, 210, 210) 100%)",
      performanceMode: {
        Performance: "high-performance",
      }
    },
  };
}

CONFIG.entity.metadata.source = "IIIF";

let camera,
  scene,
  renderer,
  stats,
  controls,
  loader,
  ambientLight,
  dirLight,
  dirLightTarget,
  cameraLight,
  cameraLightTarget;
let dirLights = [];
let imported;
var mainObject = [];
var metadataContentTech;
var mainCanvas;
var distanceGeometry = new THREE.Vector3();
let entityID = "";
var metadataUrl;

let iiifConfigURL =
  "https://raw.githubusercontent.com/IIIF/3d/main/manifests/4_transform_and_position/model_transform_scale_position.json";

var canvasDimensions, CANVASDIMENSIONS;

const clock = new THREE.Clock();
const editor = true;
var FULLSCREEN = false;

let mixer;
let tween = new Tween();

const container = document.getElementById(CONFIG.viewer.container);
const scrollTop = window.scrollY || document.documentElement.scrollTop;

canvasDimensions = CANVASDIMENSIONS = {
  x: container.getBoundingClientRect().width * Number(CONFIG.viewer.scaleContainer.x),
  y:
    (container.getBoundingClientRect().height + scrollTop) * Number(CONFIG.viewer.scaleContainer.y),
};

var fileObject = { originalPath: '', filename: '', basename: '', extension: '', path: '', uri: '', newExtension: '' };

container.setAttribute("display", "block");
fileObject.originalPath = container.getAttribute("3d");
const bottomLineGUI = canvasDimensions.y - 70;

if (CONFIG.viewer.lightweight === true) {
  CONFIG.viewer.lightweight = container.getAttribute("proxy");
}
if (CONFIG.viewer.lightweight === null || CONFIG.viewer.lightweight === false) {
  var elementsURL = window.location.pathname;
  elementsURL = elementsURL.match(CONFIG.entity.idUri);
  if (elementsURL !== null) {
    entityID = elementsURL[1];
    container.setAttribute(CONFIG.entity.attributeId, entityID);
  }
}

if (container.hasAttribute("basePath")) {
  CONFIG.baseModulePath = container.getAttribute("basePath");
}

function setModelPaths() {
  console.log(fileObject);
  fileObject.filename = fileObject.originalPath.split("/").pop();
  fileObject.basename = fileObject.filename.substring(0, fileObject.filename.lastIndexOf("."));
  fileObject.extension = fileObject.filename.substring(fileObject.filename.lastIndexOf(".") + 1);
  fileObject.path = fileObject.originalPath.substring(0, fileObject.originalPath.lastIndexOf(fileObject.filename));
  fileObject.uri = fileObject.path.replace(CONFIG.mainUrl + "/", "");
}

setModelPaths();

CONFIG.viewer.exportPath = "/export_xml_single/";
const loadedFile = fileObject.basename + "." + fileObject.extension;
var fileElement;
var COPYRIGHTS = false;
var EXIT_CODE = 1;
var gridSize;
var noMTL = false;

var canvasText;
var downloadModel, viewEntity, fullscreenMode;
var originalMetadata = [];

var spinnerContainer = document.createElement("div");
spinnerContainer.id = "spinnerContainer";

var spinnerElement = document.createElement("div");
spinnerElement.id = "spinner";
spinnerElement.className = "lv-determinate_circle lv-mid md";
spinnerElement.setAttribute("data-label", "Loading...");
spinnerElement.setAttribute("data-percentage", "true");
spinnerContainer.appendChild(spinnerElement);
container.appendChild(spinnerContainer);
spinnerContainer.style.left =
  "50%" - spinnerContainer.getBoundingClientRect().width + "px";

var guiContainer = document.createElement("div");
guiContainer.id = "guiContainer";
guiContainer.className = "guiContainer";
container.appendChild(guiContainer);

var metadataContainer = document.createElement("div");
metadataContainer.setAttribute("id", "metadata-container");

let spinner = new lv();
spinner.initLoaderAll();
spinner.startObserving();
let circle = lv.create(spinnerElement);

var lilGui;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const onUpPosition = new THREE.Vector2();
const onDownPosition = new THREE.Vector2();

const geometry = new THREE.BoxGeometry(20, 20, 20);
let transformControl,
  transformControlLight,
  transformControlLightTarget,
  transformControlClippingPlaneX,
  transformControlClippingPlaneY,
  transformControlClippingPlaneZ,
  outlineClipping;
var cameraCoords;

let helperObjects = [];

const lightObjects = [];
var lightHelper, lightHelperTarget;

var selectedObject = false;
var selectedObjects = [];
var selectedFaces = [];
let pickingTexture;

var windowHalfX, windowHalfY;

var transformType = "";

var transformText = {
  "Transform 3D Object": "select type",
  "Transform Light": "select type",
  "Transform Mode": "Local",
};

export var materialsPropertiesText = {
  "Edit material": "select by name",
};

const colors = {
  DirectionalLight: "0xFFFFFF",
  AmbientLight: "0x404040",
  CameraLight: "0xFFFFFF",
  BackgroundColor: "#FFFFFF",
  BackgroundColorOuter: "#D2D2D2",
};

const materialProperties = {
  color: "0xFFFFFF",
  emissiveColor: "0x404040",
  emissive: 1,
  metalness: 0,
};

const intensity = {
  startIntensityDir: 1,
  startIntensityAmbient: 1,
  startIntensityCamera: 1,
};

const saveProperties = {
  Position: true,
  Rotation: true,
  Scale: true,
  Camera: true,
  DirectionalLight: true,
  AmbientLight: true,
  CameraLight: true,
  BackgroundColor: true,
  BackgroundColorOuter: true,
};

const backgroundType = { "Background Type": "gradient" };
let backgroundOuterFolder;

var EDITOR = false;
var RULER_MODE = false;
const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
var linePoints = [];

const gui = new GUI({ container: guiContainer });

var hierarchyFolder;
const GUILength = 35;

let zoomImage = 1;
const ZOOM_SPEED_IMAGE = 0.1;

var compressedFile = "";
var archiveType = "";

const planeParams = {
  planeX: {
    constant: 0,
    negated: false,
    displayHelperX: false,
  },
  planeY: {
    constant: 0,
    negated: false,
    displayHelperY: false,
  },
  planeZ: {
    constant: 0,
    negated: false,
    displayHelperZ: false,
  },
  outline: {
    visible: false,
  },
  clippingMode: {
    x: false,
    y: false,
    z: false,
  },
};

export var clippingPlanes = [
  new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
  new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
  new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
];
var planeHelpers, clippingFolder;
var propertiesFolder;
var planeObjects = [];
export var materialsFolder;

var textMesh,
  textMeshDistance,
  ruler = [],
  rulerObject;
var lastPickedFace = { id: "", color: "", object: "" };

var loadedTimes = 0;

function addTextWatermark(_text, _scale) {
  var textGeo;
  var materials = [
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.4,
    }), // front
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.4,
    }), // side
  ];
  const loader = new FontLoader();

  loader.load(
    CONFIG.baseModulePath + "/fonts/helvetiker_regular.typeface.json",
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

      //const centerOffset = - 0.5 * (textGeo.boundingBox.max.x - textGeo.boundingBox.min.x);

      textMesh = new THREE.Mesh(textGeo, materials);

      textMesh.rotation.z = Math.PI;
      textMesh.rotation.y = Math.PI;

      textMesh.position.x = 0;
      textMesh.position.y = 0;
      textMesh.position.z = 0;
      textMesh.renderOrder = 1;
      scene.add(textMesh);
    }
  );
}

function addTextPoint(_text, _scale, _point) {
  var textGeo;
  var materials = [
    new THREE.MeshStandardMaterial({
      color: 0x0000ff,
      flatShading: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.4,
    }), // front
    new THREE.MeshStandardMaterial({
      color: 0x0000ff,
      flatShading: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.4,
    }), // side
  ];
  const loader = new FontLoader();
  var textSize = _scale / 10;
  loader.load(
    CONFIG.baseModulePath + "/fonts/helvetiker_regular.typeface.json",
    function (font) {
      const textGeo = new TextGeometry(_text, {
        font: font,
        size: _scale * 3,
        height: textSize,
        curveSegments: 4,
        bevelEnabled: true,
        bevelThickness: textSize,
        bevelSize: textSize,
        bevelOffset: 0,
        bevelSegments: 1,
        depth: textSize,
      });
      textGeo.computeBoundingBox();

      textMeshDistance = new THREE.Mesh(textGeo, materials);

      textMeshDistance.position.set(_point.x, _point.y, _point.z);
      textMeshDistance.renderOrder = 1;
      rulerObject.add(textMeshDistance);
    }
  );
}

export function selectObjectHierarchy(_id) {
  let search = true;
  for (let i = 0; i < selectedObjects.length && search === true; i++) {
    if (selectedObjects[i].id === _id) {
      search = false;
      if (selectedObjects[i].selected === true) {
        scene.getObjectById(_id).material = selectedObjects[i].originalMaterial;
        scene.getObjectById(_id).material.needsUpdate = true;
        selectedObjects[i].selected = false;
        selectedObjects.splice(selectedObjects.indexOf(selectedObjects[i]), 1);
      }
    }
  }
  if (search) {
    selectedObjects.push({
      id: _id,
      selected: true,
      originalMaterial: scene.getObjectById(_id).material.clone(),
    });
    const tempMaterial = scene.getObjectById(_id).material.clone();
    tempMaterial.color.setHex("0x00FF00");
    scene.getObjectById(_id).material = tempMaterial;
    scene.getObjectById(_id).material.needsUpdate = true;
  }
}

export function fetchMetadata(_object, _type) {
  switch (_type) {
    case "vertices":
      if (
        typeof _object.geometry.index !== "undefined" &&
        _object.geometry.index !== null
      ) {
        return _object.geometry.index.count;
      } else if (
        typeof _object.attributes !== "undefined" &&
        _object.attributes !== null
      ) {
        return _object.attributes.position.count;
      }
      break;
    case "faces":
      if (
        typeof _object.geometry.index !== "undefined" &&
        _object.geometry.index !== null
      ) {
        return _object.geometry.index.count / 3;
      } else if (
        typeof _object.attributes !== "undefined" &&
        _object.attributes !== null
      ) {
        return _object.attributes.position.count / 3;
      }
      break;
  }
}
function recreateBoundingBox(object) {
  var _min = new THREE.Vector3();
  var _max = new THREE.Vector3();
  if (object instanceof THREE.Object3D) {
    object.traverse(function (mesh) {
      if (mesh instanceof THREE.Mesh) {
        mesh.geometry.computeBoundingBox();
        var bBox = mesh.geometry.boundingBox;

        // compute overall bbox
        _min.x = Math.min(_min.x, bBox.min.x + mesh.position.x);
        _min.y = Math.min(_min.y, bBox.min.y + mesh.position.y);
        _min.z = Math.min(_min.z, bBox.min.z + mesh.position.z);
        _max.x = Math.max(_max.x, bBox.max.x + mesh.position.x);
        _max.y = Math.max(_max.y, bBox.max.y + mesh.position.y);
        _max.z = Math.max(_max.z, bBox.max.z + mesh.position.z);
      }
    });

    var bBox_min = new THREE.Vector3(_min.x, _min.y, _min.z);
    var bBox_max = new THREE.Vector3(_max.x, _max.y, _max.z);
    var bBox_new = new THREE.Box3(bBox_min, bBox_max);
    object.position.set(
      (bBox_new.min.x + bBox_new.max.x) / 2,
      bBox_new.min.y,
      (bBox_new.min.z + bBox_new.max.z) / 2
    );
  }
  return object;
}

function fetchObjectFromConfig(_name) {
  return objectsConfig?.models?.find(model => model.name === _name);
}

export function setupObject(_object, _light, _controls, _helperObjects) {
  const model = fetchObjectFromConfig(_object.children[0].name); //TODO: check for multiple objects
  if (typeof objectsConfig !== "undefined" && model) {
    console.log("Applying config for", model);
    if (typeof model.position !== undefined)
      _object.position.set(model.position.x, model.position.y, model.position.z);
    if (typeof objectsConfig.models.scale !== undefined)
      _object.scale.set(model.scale.x, model.scale.y, model.scale.z);
    if (typeof model.rotation !== undefined)
      _object.rotation.set(THREE.MathUtils.degToRad(model.rotation.x), THREE.MathUtils.degToRad(model.rotation.y), THREE.MathUtils.degToRad(model.rotation.z)
      );
    
      _object.needsUpdate = true;
    if (typeof _object.geometry !== "undefined") {
      _object.geometry.computeBoundingBox();
      _object.geometry.computeBoundingSphere();
    }
  } else {
    var boundingBox = new THREE.Box3();
    if (Array.isArray(_object)) {
      for (let i = 0; i < _object.length; i++) {
        boundingBox.setFromObject(_object[i]);
        _object[i].position.set(
          -(boundingBox.min.x + boundingBox.max.x) / 2,
          -boundingBox.min.y,
          -(boundingBox.min.z + boundingBox.max.z) / 2
        );
        _object[i].needsUpdate = true;
        if (typeof _object[i].geometry !== "undefined") {
          _object[i].geometry.computeBoundingBox();
          _object[i].geometry.computeBoundingSphere();
        }
      }
    } else if (_object.isGroup && fileObject.extension == "fbx") {
      //workaround for specific FBX case
      boundingBox.setFromObject(_object);
      var _obj = new THREE.Object3D();
      _obj.attach(_object);
      //_obj.position.set(-(boundingBox.min.x+boundingBox.max.x)/2, -boundingBox.min.y, -(boundingBox.min.z+boundingBox.max.z)/2);
      _obj.updateMatrixWorld();
      _object = _obj;
    } else {
      boundingBox.setFromObject(_object);
      _object.position.set(
        -(boundingBox.min.x + boundingBox.max.x) / 2,
        -boundingBox.min.y,
        -(boundingBox.min.z + boundingBox.max.z) / 2
      );
      //_object.position.set (0, 0, 0);
      _object.needsUpdate = true;
      if (typeof _object.geometry !== "undefined") {
        _object.geometry.computeBoundingBox();
        _object.geometry.computeBoundingSphere();
      }
    }
  }
  cameraLight.position.set(
    camera.position.x,
    camera.position.y,
    camera.position.z
  );
  if (Array.isArray(_object)) {
    cameraLightTarget.position.set(
      _object[0].position.x,
      _object[0].position.y,
      _object[0].position.z
    );
  } else {
    cameraLightTarget.position.set(
      _object.position.x,
      _object.position.y,
      _object.position.z
    );
  }
  cameraLight.target.updateMatrixWorld();
}

function setupClippingPlanes(_geom, _size, _distance) {
  /*var _geometry;
  if (_geom.isGroup)
    _geometry = _geom.children;
  else
    _geometry = _geom.geometry.clone();*/

  clippingPlanes[0].constant = _distance.x;
  clippingPlanes[1].constant = _distance.y;
  clippingPlanes[2].constant = _distance.z;

  scene.add(transformControlClippingPlaneX.getHelper());
  scene.add(transformControlClippingPlaneY.getHelper());
  scene.add(transformControlClippingPlaneZ.getHelper());
  let planeColor = new THREE.Color(0xffffff).getHexString();
  if (scene.background != null) planeColor = scene.background.getHexString();

  planeHelpers = clippingPlanes.map(
    (p) => new THREE.PlaneHelper(p, _size * 2, invertHexColor(planeColor))
  );
  planeHelpers.forEach((ph) => {
    ph.visible = false;
    ph.name = "PlaneHelper";
    scene.add(ph);
  });

  distanceGeometry = _distance;
  clippingFolder.add(planeParams.planeX, "displayHelperX").onChange((v) => {
    planeParams.clippingMode.x = planeHelpers[0].visible = v;
    if (v) {
      transformControlClippingPlaneX.attach(planeHelpers[0]);
      if (planeParams.outline.visible) outlineClipping.visible = true;
    } else {
      transformControlClippingPlaneX.detach();
      if (
        !planeParams.clippingMode.y &&
        !planeParams.clippingMode.z &&
        !planeParams.outline.visible
      )
        outlineClipping.visible = false;
    }
  });
  clippingFolder
    .add(planeParams.planeX, "constant")
    .min(-distanceGeometry.x)
    .max(distanceGeometry.x)
    .setValue(distanceGeometry.x)
    .step(_size / 100)
    .listen()
    .onChange((d) => (clippingPlanes[0].constant = d));

  clippingFolder.add(planeParams.planeY, "displayHelperY").onChange((v) => {
    planeParams.clippingMode.y = planeHelpers[1].visible = v;
    if (v) {
      transformControlClippingPlaneY.attach(planeHelpers[1]);
      if (planeParams.outline.visible) outlineClipping.visible = true;
    } else {
      transformControlClippingPlaneY.detach();
      if (
        !planeParams.clippingMode.x &&
        !planeParams.clippingMode.z &&
        !planeParams.outline.visible
      )
        outlineClipping.visible = false;
    }
  });
  clippingFolder
    .add(planeParams.planeY, "constant")
    .min(-distanceGeometry.y)
    .max(distanceGeometry.y)
    .setValue(distanceGeometry.y)
    .step(_size / 100)
    .listen()
    .onChange((d) => (clippingPlanes[1].constant = d));

  clippingFolder.add(planeParams.planeZ, "displayHelperZ").onChange((v) => {
    planeParams.clippingMode.z = planeHelpers[2].visible = v;
    if (v) {
      transformControlClippingPlaneZ.attach(planeHelpers[2]);
      if (planeParams.outline.visible) outlineClipping.visible = true;
    } else {
      transformControlClippingPlaneZ.detach();
      if (
        !planeParams.clippingMode.x &&
        !planeParams.clippingMode.y &&
        !planeParams.outline.visible
      )
        outlineClipping.visible = false;
    }
  });
  clippingFolder
    .add(planeParams.planeZ, "constant")
    .min(-distanceGeometry.z)
    .max(distanceGeometry.z)
    .setValue(distanceGeometry.z)
    .step(_size / 100)
    .listen()
    .onChange((d) => (clippingPlanes[2].constant = d));

  clippingFolder.add(planeParams.outline, "visible").onChange((v) => {
    outlineClipping.visible = v;
  });
}

async function fitCameraToCenteredObject(camera, object, add_offset, _fit, _helperObjects) {
  const boundingBox = new THREE.Box3();
  if (Array.isArray(object)) {
    for (let i = 0; i < object.length; i++) {
      boundingBox.setFromObject(object[i]);
    }
  } else {
    boundingBox.setFromObject(object);
  }

  var middle = new THREE.Vector3();
  var size = new THREE.Vector3();
  boundingBox.getSize(size);
  // ground
  var distance = new THREE.Vector3(
    Math.abs(boundingBox.max.x - boundingBox.min.x),
    Math.abs(boundingBox.max.y - boundingBox.min.y),
    Math.abs(boundingBox.max.z - boundingBox.min.z)
  );
  gridSize = Math.max(distance.x, distance.y, distance.z);

  dirLightTarget = new THREE.Object3D();
  dirLightTarget.position.set(0, 0, 0);

  lightHelper = new THREE.DirectionalLightHelper(dirLight, gridSize);
  scene.add(lightHelper);
  lightHelper.visible = false;

  scene.add(dirLightTarget);
  dirLight.target = dirLightTarget;
  dirLight.target.updateMatrixWorld();

  var gridSizeScale = gridSize * 1.5;
  const planeMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(gridSizeScale, gridSizeScale),
    new THREE.MeshPhongMaterial({
      color: 0xefefef,
      depthWrite: false,
      transparent: true,
      opacity: 0.65,
    })
  );
  planeMesh.rotation.x = -Math.PI / 2;
  planeMesh.position.set(0, 0, 0);
  planeMesh.receiveShadow = true;
  scene.add(planeMesh);

  const axesHelper = new THREE.AxesHelper(gridSize);
  axesHelper.position.set(0, 0, 0);
  scene.add(axesHelper);

  const grid = new THREE.GridHelper(gridSizeScale, 50, 0xaeaeae, 0x000000);
  grid.material.opacity = 0.1;
  grid.material.transparent = true;
  grid.position.set(0, 0, 0);
  scene.add(grid);

  // How to fit the box in the view:
  // 1. figure out horizontal FOV (on non-1.0 aspects)
  // 2. figure out distance from the object in X and Y planes
  // 3. select the max distance (to fit both sides in)
  //
  // The reason is as follows:
  //
  // Imagine a bounding box (BB) is centered at (0,0,0).
  // Camera has vertical FOV (camera.fov) and horizontal FOV
  // (camera.fov scaled by aspect, see fovh below)
  //
  // Therefore if you want to put the entire object into the field of view,
  // you have to compute the distance as: z/2 (half of Z size of the BB
  // protruding towards us) plus for both X and Y size of BB you have to
  // figure out the distance created by the appropriate FOV.
  //
  // The FOV is always a triangle:
  //
  //  (size/2)
  // +--------+
  // |       /
  // |      /
  // |     /
  // | F° /
  // |   /
  // |  /
  // | /
  // |/
  //
  // F° is half of respective FOV, so to compute the distance (the length
  // of the straight line) one has to: `size/2 / Math.tan(F)`.
  //
  // FTR, from https://threejs.org/docs/#api/en/cameras/PerspectiveCamera
  // the camera.fov is the vertical FOV.

  let cameraZ = camera.position.z;
  let offset = new THREE.Vector3(0, 0, 0);
  let sizeZ = Math.max(size.x, size.y, size.z) / 2;
  let dx, dy;
  if (_fit) {
    const fov = camera.fov * (Math.PI / 180);
    const fovh = Math.atan(Math.tan(fov) * camera.aspect);
    dx = sizeZ + size.x / 2 / Math.tan(fovh);
    dy = sizeZ + size.y / 2 / Math.tan(fov);
    cameraZ = Math.max(dx, dy);
    camera.position.y *= 0.65;
    camera.position.z *= 2.5;
  }

  // offset the camera, if desired (to avoid filling the whole canvas)
  if (add_offset !== undefined && add_offset !== 0 && _fit) {
    cameraZ *= add_offset;
    offset.y = dy / 2;
    offset.z = dx / 2;
  }

  cameraCoords = {
    x: camera.position.x,
    y: camera.position.y + offset.y,
    z: cameraZ * 0.75 + offset.z,
  };
  tween = new Tween(cameraCoords)
    .to({ z: camera.position.z }, 1500)
    .onUpdate(() => {
      camera.position.set(cameraCoords.x, cameraCoords.y, cameraCoords.z);
      cameraLight.position.set(cameraCoords.x, cameraCoords.y, cameraCoords.z);
      camera.updateProjectionMatrix();
      controls.update();
    })
    .start();

  // set the far plane of the camera so that it easily encompasses the whole object
  const minZ = boundingBox.min.z;
  const cameraToFarEdge = minZ < 0 ? -minZ + cameraZ : cameraZ - minZ;

  //camera.far = cameraToFarEdge * 3;
  camera.updateProjectionMatrix();
  if (controls !== undefined && _fit) {
    // set camera to rotate around the center
    controls.target = new THREE.Vector3(0, offset.y, 0);

    // prevent camera from zooming out far enough to create far plane cutoff
    controls.maxDistance = cameraToFarEdge * 2;
  }
  controls.update();

  if (_fit) {
    var rotateMetadata = new THREE.Vector3(
      THREE.MathUtils.radToDeg(_helperObjects[0].rotation.x),
      THREE.MathUtils.radToDeg(_helperObjects[0].rotation.y),
      THREE.MathUtils.radToDeg(_helperObjects[0].rotation.z)
    );
    originalMetadata = {
      objPosition: [object.position.x, object.position.y, object.position.z],
      objRotation: [rotateMetadata.x, rotateMetadata.y, rotateMetadata.z],
      objScale: [
        _helperObjects[0].scale.x,
        _helperObjects[0].scale.y,
        _helperObjects[0].scale.z,
      ],
      cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
      controlsTarget: [controls.target.x, controls.target.y, controls.target.z],
    };
  }
  setupClippingPlanes(object, gridSize, distance);
}

function prepareGalleryImages(imageElementsChildren) {
  imageElementsChildren = imageElementsChildren.filter(function (_image) {
    return isValidUrl(_image.innerHTML);
  });
  imageElementsChildren.forEach(function (imgLink, index) {
    imgLink.innerHTML =
      '<img loading="lazy" src="' +
      imgLink.innerHTML +
      '" width="200px" height="200px" alt="" class="img-fluid image-style-wisski-preview">';
  });
}

function handleImages(
  fileElement,
  mainElement,
  imageElements,
  imageElementsChildren
) {
  if (typeof (imageElementsChildren == undefined)) {
    imageElementsChildren = imageElements;
  }
  var imageList = document.createElement("div");
  imageList.setAttribute("id", "image-list");
  var modalGallery = document.createElement("div");
  var modalImage = document.createElement("img");
  modalImage.setAttribute("class", "modalImage");
  modalGallery.addEventListener("wheel", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.deltaY > 0 && zoomImage > 0.15) {
      modalImage.style.transform = `scale(${(zoomImage -= ZOOM_SPEED_IMAGE)})`;
    } else if (e.deltaY < 0 && zoomImage < 5) {
      modalImage.style.transform = `scale(${(zoomImage += ZOOM_SPEED_IMAGE)})`;
    }
    return false;
  });
  var modalClose = document.createElement("span");
  modalGallery.setAttribute("id", "modalGallery");
  modalGallery.setAttribute("class", "modalGallery");
  modalClose.setAttribute("class", "closeGallery");
  modalClose.setAttribute("title", "Close");
  modalClose.innerHTML = "&times";
  modalClose.onclick = function () {
    modalGallery.style.display = "none";
  };

  document.addEventListener("click", function (event) {
    if (
      !modalGallery.contains(event.target) &&
      !imageList.contains(event.target)
    ) {
      modalGallery.style.display = "none";
      zoomImage = 1.5;
      modalImage.style.transform = `scale(1.5)`;
    }
  });

  modalGallery.appendChild(modalImage);
  modalGallery.appendChild(modalClose);
  for (let i = 0; imageElementsChildren.length - i >= 0; i++) {
    if (
      imageElementsChildren[i] !== undefined &&
      imageElementsChildren[i].innerHTML !== undefined
    ) {
      var imgList = imageElementsChildren[i].getElementsByTagName("a");
      for (let j = 0; j < imgList.length; j++) {
        imgList[j].setAttribute("href", "#");
        imgList[j].setAttribute("src", imgList[j].firstChild.src);
        imgList[j].setAttribute("class", "image-list-item");
      }
      imgList = imageElementsChildren[i].getElementsByTagName("img");
      //for single thumbnail
      if (imgList.length == 1) {
        imgList[0].style.maxWidth = "fit-content";
        imgList[0].style.maxHeight = "180px";
      }
      for (let j = 0; j < imgList.length; j++) {
        imgList[j].onclick = function () {
          modalGallery.style.display = "block";
          modalGallery.style.zIndex = 999;
          imageList.style.zIndex = 0;
          imageList.style.display = "hidden";
          modalImage.src = this.src;
        };
      }
      imageList.appendChild(imageElementsChildren[i]);
    }
  }
  fileElement[0].insertAdjacentElement("beforebegin", modalGallery);
  mainElement.insertAdjacentElement("beforebegin", imageList);
  //mainElement.insertBefore(imageList, fileElement[0]);
}

function buildGallery() {
  if (fileElement.length > 0) {
    var mainElement = document.getElementById(CONFIG.viewer.gallery.container);
    var imageElements;
    if (CONFIG.viewer.gallery.imageClass !== "") {
      imageElements = document.getElementsByClassName(
        CONFIG.viewer.gallery.imageClass
      );
      if (imageElements.length > 0) {
        var galleryLabel = document.getElementsByClassName("field__label");
        if (galleryLabel !== undefined) galleryLabel[0].innerText = "";
      }
    } else if (CONFIG.viewer.gallery.imageId !== "") {
      imageElements = document.getElementById(CONFIG.viewer.gallery.imageId);
    } else {
      console.log("No gallery created");
    }

    if (imageElements !== null) {
      if (imageElements.length > 0) {
        if (imageElements[0].innerHTML !== undefined) {
          let imagesList = Array.from(
            imageElements[0].getElementsByClassName("field__items")[0]
              .childNodes
          );
          prepareGalleryImages(imagesList);
          //imageElements[0].classList.add("field--type-image");
          imageElements[0].classList.add("field--label-hidden");
          imageElements[0].classList.add("field__items");
          handleImages(fileElement, mainElement, imagesList, imageElements);
        } else {
          handleImages(fileElement, mainElement, imageElements);
        }
      } else if (
        imageElements.childNodes !== undefined &&
        imageElements.childNodes.length > 0
      ) {
        if (
          typeof imageElements.childNodes[0].innerHTML == "string" ||
          typeof imageElements.childNodes[1].innerHTML == "string"
        ) {
          //handle links and convert to img
          let imagesList = Array.from(imageElements.childNodes);
          prepareGalleryImages(imagesList);
          imageElements.classList.add("field--type-image");
          imageElements.classList.add("field--label-hidden");
          imageElements.classList.add("field__items");
          handleImages(fileElement, mainElement, imagesList, imageElements);
        } else {
          handleImages(fileElement, mainElement, imageElements);
        }
      }
    }
  }
}

function render() {
  controls.update();
  renderer.render(scene, camera);
}

async function setupEmptyCamera(_camera, _object, _helperObjects) {
  var boundingBox = new THREE.Box3();
  if (Array.isArray(_object)) {
    for (let i = 0; i < _object.length; i++) {
      boundingBox.setFromObject(_object[i]);
    }
  } else {
    boundingBox.setFromObject(_object);
  }
  var size = new THREE.Vector3();
  boundingBox.getSize(size);
  camera.position.set(size.x, size.y, size.z);
  await fitCameraToCenteredObject(_camera, _object, 1.2, true, _helperObjects);
}

export async function setupCamera(_object, _camera, _light, controls, _config, _helperObjects) {

  if (objectsConfig /*&& CONFIG.entity.metadata.source !== ''*/) {
    if (typeof objectsConfig.camera.position !== "undefined") {
      _camera.position.set(objectsConfig.camera.position.x, objectsConfig.camera.position.y, objectsConfig.camera.position.z);
    } else {
      setupEmptyCamera(_camera, _object, _helperObjects);
    }
    if (typeof objectsConfig.camera.target !== "undefined") {
      controls.target.set(objectsConfig.camera.target.x, objectsConfig.camera.target.y, objectsConfig.camera.target.z);
    } else {
      setupEmptyCamera(_camera, _object, _helperObjects);
    }
  
    // Setup lights
    objectsConfig.scene.lights.forEach(light => {
      switch (light.type) {
        case "directional":
          console.log("Directional light with color", light.color);
          _light.position.set(light.position.x, light.position.y, light.position.z);
          _light.rotation.set(light.target.x, light.target.y, light.target.z);
          
          _light.color = new THREE.Color().setHex(light.color);
          colors["DirectionalLight"] = light.color;
          
          intensity.startIntensityDir = _light.intensity = light.intensity;

        break;
        case "ambient":
          console.log("Ambient light with color", light.color);
          ambientLight.color = new THREE.Color().setHex(light.color);
          colors["AmbientLight"] = light.color;
          intensity.startIntensityAmbient = ambientLight.intensity = light.intensity;
        break;
        case "point":
          console.log("Point light at", light.position);
          cameraLight.color = new THREE.Color().setHex(light.color);
          colors["CameraLight"] = light.color;
          intensity.startIntensityCamera = cameraLight.intensity = light.intensity;
        break;
      }
    });

    if (typeof objectsConfig.scene.background !== "undefined") {
      mainCanvas.style.setProperty("background", objectsConfig.scene.background);
    }
    _camera.updateProjectionMatrix();
    controls.update();
    await fitCameraToCenteredObject(_camera, _object, 2.3, false, _helperObjects);
  } else {
    setupEmptyCamera(_camera, _object, _helperObjects);
  }
}

function pickFaces(_id) {
  if (lastPickedFace.id == "" && _id !== "") {
    lastPickedFace = {
      id: _id,
      color: _id.object.material.color.getHex(),
      object: _id.object.id,
    };
  } else if (_id == "" && lastPickedFace.id !== "") {
    scene
      .getObjectById(lastPickedFace.object)
      .material.color.setHex(lastPickedFace.color);
    lastPickedFace = { id: "", color: "", object: "" };
  } else if (_id != lastPickedFace.id) {
    scene
      .getObjectById(lastPickedFace.object)
      .material.color.setHex(lastPickedFace.color);
    lastPickedFace = {
      id: _id,
      color: _id.object.material.color.getHex(),
      object: _id.object.id,
    };
  }
  if (_id !== "") _id.object.material.color.setHex(0xff0000);
}

function buildRuler(_id) {
  rulerObject = new THREE.Object3D();
  var sphere = new THREE.Mesh(
    new THREE.SphereGeometry(gridSize / 150, 7, 7),
    new THREE.MeshNormalMaterial({
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    })
  );
  var newPoint = new THREE.Vector3(_id.point.x, _id.point.y, _id.point.z);
  sphere.position.set(newPoint.x, newPoint.y, newPoint.z);
  rulerObject.add(sphere);
  linePoints.push(newPoint);
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
  const line = new THREE.Line(lineGeometry, lineMaterial);
  rulerObject.add(line);
  var lineMtr = new THREE.LineBasicMaterial({
    color: 0x0000ff,
    linewidth: 3,
    opacity: 1,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  if (linePoints.length > 1) {
    var vectorPoints = vectorBetweenPoints(
      linePoints[linePoints.length - 2],
      newPoint
    );
    var distancePoints = distanceBetweenPointsVector(vectorPoints);

    //var distancePoints = distanceBetweenPoints(linePoints[linePoints.length-2], newPoint);
    var halfwayPoints = halfwayBetweenPoints(
      linePoints[linePoints.length - 2],
      newPoint
    );
    addTextPoint(distancePoints.toFixed(2), gridSize / 200, halfwayPoints);
    var rulerI = 0;
    var measureSize = gridSize / 400;
    while (rulerI <= distancePoints * 100) {
      const geoSegm = [];
      var interpolatePoints = interpolateDistanceBetweenPoints(
        linePoints[linePoints.length - 2],
        vectorPoints,
        distancePoints,
        rulerI / 100
      );
      geoSegm.push(
        new THREE.Vector3(
          interpolatePoints.x,
          interpolatePoints.y,
          interpolatePoints.z
        )
      );
      geoSegm.push(
        new THREE.Vector3(
          interpolatePoints.x + measureSize,
          interpolatePoints.y + measureSize,
          interpolatePoints.z + measureSize
        )
      );
      const geometryLine = new THREE.BufferGeometry().setFromPoints(geoSegm);
      var lineSegm = new THREE.Line(geometryLine, lineMtr);
      rulerObject.add(lineSegm);
      rulerI += 10;
    }
  }
  rulerObject.renderOrder = 1;
  scene.add(rulerObject);
  ruler.push(rulerObject);
}

function onWindowResize() {
  var rightOffsetEntity = -65;
  var rightOffsetFullscreen = canvasDimensions.x * 0.45;
  var bottomOffsetFullscreen = -canvasDimensions.y * 0.97 + 20;
  if (FULLSCREEN) {
    canvasDimensions = { x: window.innerWidth, y: window.innerHeight };
    rightOffsetEntity = -95;
    bottomOffsetFullscreen = -canvasDimensions.y * 0.96 + 20;
    downloadModel.setAttribute("style", "visibility: hidden");
    mainCanvas.style.width = "100vw !important";
    mainCanvas.style.height = "100vh !important";
    metadataContainer.style.width = "10%";
    metadataContainer.style.height = "10%";
  } else {
    canvasDimensions = {
      x: container.getBoundingClientRect().width * Number(CONFIG.viewer.scaleContainer.x),
      y: container.getBoundingClientRect().bottom * Number(CONFIG.viewer.scaleContainer.y),
    };
    bottomOffsetFullscreen = Math.round(-canvasDimensions.y) + 36;
    mainCanvas.style.width = "100% !imporant";
    mainCanvas.style.height = "100% !important";
    metadataContainer.style.width = "100%";
    metadataContainer.style.height = "100%";

    if (CONFIG.viewer.lightweight === false) {
      downloadModel.setAttribute("style", "visibility: visible");
      downloadModel.setAttribute(
        "style",
        "top:" + (canvasDimensions.y - 60) + "px;"
      );
    }
  }

  mainCanvas.style.width = canvasDimensions.x + "px;";
  mainCanvas.style.height = canvasDimensions.y + "px;";
  //mainCanvas.setAttribute("style", "width:" + canvasDimensions.x+"px;" + "height:" + canvasDimensions.y +"px;" );

  guiContainer.setAttribute(
    "style",
    "width:" +
    canvasDimensions.x +
    "px; left: " +
    canvasDimensions.x -
    lilGui[0].getBoundingClientRect().width +
    "px"
  );
  lilGui[0].style.left = canvasDimensions.x - lilGui[0].getBoundingClientRect().width - 10 + "px";

  renderer.setSize(canvasDimensions.x, canvasDimensions.y);
  renderer.setPixelRatio(window.devicePixelRatio);
  camera.aspect = canvasDimensions.x / canvasDimensions.y;
  camera.updateProjectionMatrix();
  renderer.setSize(canvasDimensions.x, canvasDimensions.y);

  if (typeof (viewEntity) !== "undefined") viewEntity.setAttribute("style", "right: " + rightOffsetEntity + "%");
  fullscreenMode.setAttribute("style", "top:" + (canvasDimensions.y - 50) + "px; left: " + (canvasDimensions.x - 36) + "px;"
  );
  //fullscreenMode.style.top = (bottomLineGUI) + 'px;';
  controls.update();
  render();
}

function fullscreen() {
  FULLSCREEN = !FULLSCREEN;
  if (FULLSCREEN) {
    if (container.requestFullscreen) {
      //mainCanvas.requestFullscreen();
      container.requestFullscreen();
    } else if (container.webkitRequestFullscreen) {
      /* Safari */
      container.webkitRequestFullscreen();
    } else if (container.msRequestFullscreen) {
      /* IE11 */
      container.msRequestFullscreen();
    } else if (container.mozRequestFullScreen) {
      /* Mozilla */
      container.mozRequestFullScreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      /* Safari */
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      /* IE11 */
      document.msExitFullscreen();
    }
  }
  onWindowResize();
}

function exitFullscreenHandler() {
  var fullscreenElement =
    document.fullscreenElement ||
    document.mozFullScreenElement ||
    document.webkitFullscreenElement;
  var fullscreenElement2 =
    document.webkitIsFullScreen &&
    document.mozFullScreen &&
    document.msFullscreenElement;
  if (
    !fullscreenElement &&
    typeof (fullscreenElement2 === undefined) &&
    FULLSCREEN
  ) {
    fullscreen();
  }
}

function animate(time) {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) {
    mixer.update(delta);
  }
  tween.update(time);
  controls.update();

  if (textMesh !== undefined) {
    textMesh.lookAt(camera.position.clone());
  }
  renderer.clear();
  renderer.render(scene, camera);
  stats.update();
}

function onPointerDown(e) {
  e.stopPropagation();
  if (e.button === 0) {
    onDownPosition.x =
      ((e.clientX - mainCanvas.getBoundingClientRect().left) /
        renderer.domElement.clientWidth) *
      2 -
      1;
    onDownPosition.y =
      -(
        (e.clientY - mainCanvas.getBoundingClientRect().top) /
        renderer.domElement.clientHeight
      ) *
      2 +
      1;
  }
}

function onPointerUp(e) {
  if (e.button == 0) {
    onUpPosition.x =
      ((e.clientX - mainCanvas.getBoundingClientRect().left) /
        renderer.domElement.clientWidth) *
      2 -
      1;
    onUpPosition.y =
      -(
        (e.clientY - mainCanvas.getBoundingClientRect().top) /
        renderer.domElement.clientHeight
      ) *
      2 +
      1;
    if (
      onUpPosition.x === onDownPosition.x &&
      onUpPosition.y === onDownPosition.y
    ) {
      raycaster.setFromCamera(onUpPosition, camera);
      var intersects;

      if (EDITOR || RULER_MODE) {
        if (mainObject.length > 1) {
          for (let ii = 0; ii < mainObject.length; ii++) {
            intersects = raycaster.intersectObjects(
              mainObject[ii].children,
              true
            );
          }
          if (intersects.length <= 0) {
            intersects = raycaster.intersectObjects(mainObject, true);
          }
        } else {
          intersects = raycaster.intersectObject(mainObject[0], true);
        }
        if (intersects.length > 0) {
          if (RULER_MODE) buildRuler(intersects[0]);
          else if (EDITOR) pickFaces(intersects[0]);
        }
      }
    }
  }
}

function onPointerMove(e) {
  pointer.x =
    ((e.clientX - mainCanvas.getBoundingClientRect().left) /
      renderer.domElement.clientWidth) *
    2 -
    1;
  pointer.y =
    -(
      (e.clientY - mainCanvas.getBoundingClientRect().top) /
      renderer.domElement.clientHeight
    ) *
    2 +
    1;

  if (e.buttons == 1) {
    if (pointer.x !== onDownPosition.x && pointer.y !== onDownPosition.y) {
      cameraLight.position.set(
        camera.position.x,
        camera.position.y,
        camera.position.z
      );
    }
  } else {
    if (EDITOR) {
      raycaster.setFromCamera(pointer, camera);
      var intersects;
      if (mainObject.length > 1) {
        for (let ii = 0; ii < mainObject.length; ii++) {
          intersects = raycaster.intersectObjects(
            mainObject[ii].children,
            true
          );
        }
        if (intersects.length <= 0) {
          intersects = raycaster.intersectObjects(mainObject, true);
        }
      } else {
        intersects = raycaster.intersectObject(mainObject[0], true);
      }
      if (intersects.length > 0) {
        pickFaces(intersects[0]);
      } else {
        pickFaces("");
      }
    }
  }
}

function changeScale() {
  if (transformControl.getMode() === "scale") {
    switch (transformControl.axis) {
      case "X":
      case "XY":
        helperObjects[0].scale.set(
          helperObjects[0].scale.x,
          helperObjects[0].scale.x,
          helperObjects[0].scale.x
        );
        break;
      case "Y":
      case "YZ":
        helperObjects[0].scale.set(
          helperObjects[0].scale.y,
          helperObjects[0].scale.y,
          helperObjects[0].scale.y
        );
        break;
      case "Z":
      case "XZ":
        helperObjects[0].scale.set(
          helperObjects[0].scale.x,
          helperObjects[0].scale.x,
          helperObjects[0].scale.x
        );
        break;
    }
  }
}

function calculateObjectScale() {
  const boundingBox = new THREE.Box3();
  if (Array.isArray(helperObjects[0])) {
    for (let i = 0; i < helperObjects[0].length; i++) {
      boundingBox.setFromObject(object[i]);
    }
  } else {
    boundingBox.setFromObject(helperObjects[0]);
  }

  var middle = new THREE.Vector3();
  var size = new THREE.Vector3();
  boundingBox.getSize(size);
  // ground
  var _distance = new THREE.Vector3(
    Math.abs(boundingBox.max.x - boundingBox.min.x),
    Math.abs(boundingBox.max.y - boundingBox.min.y),
    Math.abs(boundingBox.max.z - boundingBox.min.z)
  );
  distanceGeometry = _distance;
  planeParams.planeX.constant =
    clippingFolder.controllers[1]._max =
    clippingPlanes[0].constant =
    _distance.x;
  clippingFolder.controllers[1]._min = -clippingFolder.controllers[1]._max;
  planeParams.planeY.constant =
    clippingFolder.controllers[3]._max =
    clippingPlanes[1].constant =
    _distance.y;
  clippingFolder.controllers[3]._min = -clippingFolder.controllers[3]._max;
  planeParams.planeZ.constant =
    clippingFolder.controllers[5]._max =
    clippingPlanes[2].constant =
    _distance.z;
  clippingFolder.controllers[5]._min = -clippingFolder.controllers[5]._max;
  clippingFolder.controllers[1].updateDisplay();
  clippingFolder.controllers[3].updateDisplay();
  clippingFolder.controllers[5].updateDisplay();
  var _maxDistance = Math.max(_distance.x, _distance.y, _distance.z);
  planeHelpers[0].size =
    planeHelpers[1].size =
    planeHelpers[2].size =
    _maxDistance;
}

function changeLightRotation() {
  lightHelper.update();
}

function takeScreenshot() {
  /*const messDiv = document.createElement('div');
  messDiv.classList.add('message');
  document.body.appendChild(messDiv);*/
  camera.aspect = 1;
  camera.updateProjectionMatrix();
  renderer.setSize(256, 256);
  renderer.render(scene, camera);
  var prependName = "";
  if (archiveType !== "") {
    prependName = basename + "_" + archiveType.toUpperCase() + "/";
  }

  mainCanvas.toBlob((imgBlob) => {
    const fileform = new FormData();
    fileform.append("domain", CONFIG.mainUrl);
    fileform.append("filename", basename);
    fileform.append("path", uri + prependName);
    fileform.append("data", imgBlob);
    fileform.append("wisski_individual", entityID);
    fetch(CONFIG.mainUrl + "/thumbnail_upload.php", {
      method: "POST",
      body: fileform,
    })
      .then((response) => {
        console.log(response);
        return response;
      })
      .then((data) => {
        if (data.error) {
          //Show server errors
          showToast(data.error);
        } else {
          //Show success message
          showToast("Rendering saved successfully");
        }
      })
      .catch((err) => {
        //Handle js errors
        showToast(err.message);
      });
  }, "image/png");
  renderer.setPixelRatio(window.devicePixelRatio);
  camera.aspect = canvasDimensions.x / canvasDimensions.y;
  camera.updateProjectionMatrix();
  renderer.setSize(canvasDimensions.x, canvasDimensions.y);
}

async function mainLoadModel(_ext) {
  if (_ext === "glb" || _ext === "gltf") {
    await loadModel({
      fileObject, // <-- pass the whole fileObject
      config: CONFIG,
      getProxyPath,
      camera,
      lightObjects,
      controls,
      scene,
      mainObject,
      outlineClipping,
      circle,
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
    });
  } else if (
    _ext === "zip" ||
    _ext === "rar" ||
    _ext === "tar" ||
    _ext === "xz" ||
    _ext === "gz"
  ) {
    compressedFile = "_" + _ext.toUpperCase() + "/";
    fileObject.path = fileObject.path + fileObject.basename + compressedFile
    fileObject.extension = "glb";
    fileObject.newExtension = _ext;
    await loadModel(fileObject, config, getProxyPath, camera, lightObjects, controls, scene, mainObject, outlineClipping, circle, gui, stats,
      entityID, container,
      metadataContainer,
      canvasText,
      bottomLineGUI,
      compressedFile,
      viewEntity, helperObjects
    );
  } else {
    fileObject.extension = "glb";
    if (_ext === "glb") {
      await loadModel(fileObject, CONFIG, getProxyPath, camera, lightObjects, controls, scene, mainObject, outlineClipping, circle, gui, stats,
        entityID, container,
        metadataContainer,
        canvasText,
        bottomLineGUI,
        compressedFile,
        viewEntity, helperObjects);
    }
    else await loadModel(fileObject.path, fileObject.basename, fileObject.filename, _ext, fileObject.extension, CONFIG, getProxyPath, camera, lightObjects, controls, scene, mainObject, outlineClipping, circle, gui, stats,
      entityID, container,
      metadataContainer,
      canvasText,
      bottomLineGUI,
      compressedFile,
      viewEntity, helperObjects);
  }
}

function createClippingPlaneAxis(_number) {
  var tempClippingControl = new TransformControls(camera, renderer.domElement);
  tempClippingControl.space = "local";
  tempClippingControl.mode = "translate";
  tempClippingControl.addEventListener("change", render);
  tempClippingControl.addEventListener("objectChange", function (event) {
    switch (_number) {
      case 0:
        clippingPlanes[_number].constant =
          event.target.children[0].pointEnd.x + distanceGeometry.x;
        break;
      case 1:
        clippingPlanes[_number].constant =
          event.target.children[0].pointEnd.y + distanceGeometry.y;
        break;
      case 2:
        clippingPlanes[_number].constant =
          event.target.children[0].pointEnd.z + distanceGeometry.z;
        break;
    }
  });
  tempClippingControl.addEventListener("dragging-changed", function (event) {
    controls.enabled = !event.value;
  });
  return tempClippingControl;
}

function resetCamera() {
  var camPosition = camera.position;
  let _tween = new Tween(camPosition)
    .to(cameraCoords, 1500)
    .onUpdate(() => {
      camera.position.set(camPosition.x, camPosition.y, camPosition.z);
      cameraLight.position.set(camPosition.x, camPosition.y, camPosition.z);
      camera.updateProjectionMatrix();
      controls.update();
    })
    .start();
}

function changeBackgroundHelper(_color1, _color2) {
  mainCanvas.style.setProperty(
    "background",
    "-moz-radial-gradient(circle, " + _color1 + " 0%, " + _color2 + " 100%)"
  );
  mainCanvas.style.setProperty(
    "background",
    "-webkit-radial-gradient(circle, " + _color1 + " 0%, " + _color2 + " 100%)"
  );
  mainCanvas.style.setProperty(
    "background",
    "radial-gradient(circle, " + _color1 + " 0%, " + _color2 + " 100%)"
  );
}

function changeBackground(_type, _color1, _color2) {
  switch (_type) {
    case "linear":
      changeBackgroundHelper(_color1, _color1);
      break;
    case "gradient":
      changeBackgroundHelper(_color1, _color2);
      break;
  }
}

async function init() {
  if (!renderer) {
    camera = new THREE.PerspectiveCamera(
      45,
      canvasDimensions.x / canvasDimensions.y,
      0.001,
      999000000
    );
    camera.position.set(0, 0, 0);

    scene = new THREE.Scene();

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    ambientLight = new THREE.AmbientLight(0x404040); // soft white light
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xffffff);
    dirLight.position.set(0, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 180;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    dirLight.shadow.bias = -0.0001;
    dirLight.shadow.mapSize.width = 1024 * 4;
    dirLight.shadow.mapSize.height = 1024 * 4;
    scene.add(dirLight);
    lightObjects.push(dirLight);

    cameraLightTarget = new THREE.Object3D();
    cameraLightTarget.position.set(
      camera.position.x,
      camera.position.y,
      camera.position.z
    );
    scene.add(cameraLightTarget);

    cameraLight = new THREE.DirectionalLight(0xffffff);
    cameraLight.position.set(camera.position);
    cameraLight.castShadow = false;
    cameraLight.intensity = 0.3;
    scene.add(cameraLight);
    cameraLight.target = cameraLightTarget;
    cameraLight.target.updateMatrixWorld();

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      logarithmicDepthBuffer: true,
      colorManagement: true,
      sortObjects: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
      alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvasDimensions.x, canvasDimensions.y);
    renderer.shadowMap.enabled = true;
    renderer.localClippingEnabled = true;
    renderer.physicallyCorrectLights = true; //can be considered as better looking
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0.0);
    renderer.domElement.id = "MainCanvas";
    mainCanvas = document.getElementById("MainCanvas") || renderer.domElement;

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointermove", onPointerMove);

    renderer.setSize(canvasDimensions.x, canvasDimensions.y);
    renderer.domElement.style.width = `${canvasDimensions.x}px`;
    renderer.domElement.style.height = `${canvasDimensions.y}px`;
    renderer.domElement.style.display = "block"; // usually best
    container.appendChild(renderer.domElement);
    mainCanvas.setAttribute(
      "style",
      `width: ${canvasDimensions.x}px; height: clamp(20vh, ${canvasDimensions.y}px, 100vh); display: flex;`
    );
    canvasText = document.createElement("div");
    canvasText.id = "TextCanvas";
    canvasText.width = canvasDimensions.x;
    canvasText.height = canvasDimensions.y;

    guiContainer.style.width = canvasDimensions.x;
    guiContainer.style.left = container.offsetLeft + "px";
    lilGui = document.getElementsByClassName("lil-gui root");
    lilGui[0].style.left =
      canvasDimensions.x - lilGui[0].getBoundingClientRect().width - 10 + "px";

    fileElement = document.getElementsByClassName("field--type-file");
    if (fileElement.length > 0) {
      fileElement[0].style.height = canvasDimensions.y * 1.1 + "px";
    }

    if (
      CONFIG.viewer.lightweight === 0 ||
      CONFIG.viewer.lightweight === false
    ) {
      buildGallery();
    }

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 100, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableRotate = true;
    controls.update();

    transformControl = new TransformControls(camera, renderer.domElement);
    transformControl.rotationSnap = THREE.MathUtils.degToRad(5);
    transformControl.space = "local";
    transformControl.addEventListener("change", render);
    transformControl.addEventListener("objectChange", changeScale);
    transformControl.addEventListener("mouseUp", calculateObjectScale);
    transformControl.addEventListener("dragging-changed", function (event) {
      controls.enabled = !event.value;
    });
    scene.add(transformControl.getHelper());

    transformControlLight = new TransformControls(camera, renderer.domElement);
    transformControlLight.space = "local";
    transformControlLight.addEventListener("change", render);
    //transformControlLight.addEventListener('objectChange', changeLightRotation);
    transformControlLight.addEventListener(
      "dragging-changed",
      function (event) {
        controls.enabled = !event.value;
      }
    );
    scene.add(transformControlLight.getHelper());

    transformControlLightTarget = new TransformControls(
      camera,
      renderer.domElement
    );
    transformControlLightTarget.space = "global";
    transformControlLightTarget.addEventListener("change", render);
    transformControlLightTarget.addEventListener(
      "objectChange",
      changeLightRotation
    );
    transformControlLightTarget.addEventListener(
      "dragging-changed",
      function (event) {
        controls.enabled = !event.value;
      }
    );
    scene.add(transformControlLightTarget.getHelper());

    transformControlClippingPlaneX = createClippingPlaneAxis(0, "x");
    transformControlClippingPlaneY = createClippingPlaneAxis(1, "y");
    transformControlClippingPlaneZ = createClippingPlaneAxis(2, "z");

    transformControlClippingPlaneX.showX =
      transformControlClippingPlaneX.showY = false;
    transformControlClippingPlaneY.showX =
      transformControlClippingPlaneY.showY = false;
    transformControlClippingPlaneZ.showX =
      transformControlClippingPlaneZ.showY = false;

    var _ext = fileObject.extension.toLowerCase();
    if (
      _ext === "zip" ||
      _ext === "rar" ||
      _ext === "tar" ||
      _ext === "xz" ||
      _ext === "gz"
    ) {
      archiveType = _ext;
    }

    var _autoPath = "";
    if (CONFIG.entity.metadata.source === "") {
      var req = new XMLHttpRequest();
      req.responseType = "";
      req.open(
        "GET",
        CONFIG.metadataUrl + CONFIG.viewer.exportPath + entityID + "?page=0&amp;_format=xml",
        true
      );
      req.onreadystatechange = async function (aEvt) {
        if (req.readyState == 4) {
          if (req.status == 200) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(
              req.responseText,
              "application/xml"
            );
            if (doc.documentElement.childNodes > 0) {
              var data = doc.documentElement.childNodes[0].childNodes;
              if (typeof data !== undefined) {
                var _found = false;
                for (var i = 0; i < data.length && !_found; i++) {
                  if (
                    typeof data[i].tagName !== "undefined" &&
                    typeof data[i].textContent !== "undefined"
                  ) {
                    var _label = data[i].tagName.replace(
                      "wisski_path_3d_model__",
                      ""
                    );
                    if (
                      typeof _label !== "undefined" &&
                      _label === "converted_file"
                    ) {
                      _found = true;
                      _autoPath = data[i].textContent;
                    }
                  }
                }
              }
            }
            //check wheter semo-automatic path found
            if (_autoPath !== "") {
              fileObject.filename = _autoPath.split("/").pop();
              fileObject.basename = fileObject.filename.substring(0, fileObject.filename.lastIndexOf("."));
              fileObject.extension = fileObject.filename.substring(fileObject.filename.lastIndexOf(".") + 1);
              _ext = fileObject.extension.toLowerCase();
              fileObject.path = _autoPath.substring(0, _autoPath.lastIndexOf(fileObject.filename));
            }
            await mainLoadModel(_ext);
          } else {
            console.log("Error during loading metadata content\n");
            await mainLoadModel(_ext);
          }
        }
      };
      req.send(null);
    } else {
      async function setupIIIF() {
        const loadedIIIF = await loadIIIFManifest(iiifConfigURL);
        if (loadedIIIF.modelUrl) {
          fileObject.originalPath = loadedIIIF.modelUrl;
          setModelPaths();
          await getAnnotations(loadedIIIF.annotations, objectsConfig);
          _ext = fileObject.extension.toLowerCase();
          await mainLoadModel(_ext);
        }
      }
      async function loadIIIFURL() {
        // create a small dropdown to switch iiif manifests at runtime
        document.getElementById("iiif-dropdown").addEventListener("change", async (ev) => {
          try {
            if (ev.target.value !== iiifConfigURL) {
              iiifConfigURL = ev.target.value;
              await setupIIIF();
            }
          } catch (err) {
            console.error(err);
            showToast("Error loading IIIF manifest: " + (err.message || err));
          }
          });
      }      
      
      switch(CONFIG.entity.metadata.source.substring(0, 4).toLowerCase()) {
        case "iiif":
          if (iiifConfigURL !== "") {
            createIIIFDropdown(container, iiifConfigURL, canvasDimensions);
            await loadIIIFURL();
            CONFIG.entity.metadata.source = "IIIF";
            await setupIIIF();
          }
          break;
        case "file": //TODO: add more sources
          break;
      }
    }
    /*try {

  } catch (e) {
    // statements to handle any exceptions
    loadModel(path, basename, filename, extension);
  }*/
    window.addEventListener("resize", onWindowResize);

    fullscreenMode = document.createElement("div");
    fullscreenMode.setAttribute("id", "fullscreenMode");
    fullscreenMode.innerHTML =
      "<img src='" +
      CONFIG.baseModulePath +
      "/img/fullscreen.png' alt='Fullscreen' width=20 height=20 title='Fullscreen mode'/>";
    fullscreenMode.setAttribute(
      "style",
      "top:" +
      (bottomLineGUI + 20) +
      "px; left: " +
      (canvasDimensions.x - 36) +
      "px"
    );
    container.appendChild(fullscreenMode);
    document
      .getElementById("fullscreenMode")
      .addEventListener("click", fullscreen, false);
    if (document.addEventListener) {
      document.addEventListener(
        "webkitfullscreenchange",
        exitFullscreenHandler,
        false
      );
      document.addEventListener(
        "mozfullscreenchange",
        exitFullscreenHandler,
        false
      );
      document.addEventListener(
        "fullscreenchange",
        exitFullscreenHandler,
        false
      );
      document.addEventListener(
        "MSFullscreenChange",
        exitFullscreenHandler,
        false
      );
    }

    // stats
    stats = new Stats();
    stats.domElement.style.cssText =
      "position:relative;top:0px;left:" +
      (canvasDimensions.x - 90) +
      "px;max-height:120px;max-width:90px;z-index:2;visibility:hidden;";

    windowHalfX = canvasDimensions.x / 2;
    windowHalfY = canvasDimensions.y / 2;

    const editorFolder = gui.addFolder("Editor").close();
    editorFolder
      .add(transformText, "Transform 3D Object", {
        None: "",
        Move: "translate",
        Rotate: "rotate",
        Scale: "scale",
      })
      .onChange(function (value) {
        if (value === "") {
          transformControl.detach();
        } else {
          renderer.localClippingEnabled = false;
          transformControl.mode = value;
          transformControl.attach(helperObjects[0]);
        }
      });
    editorFolder
      .add(transformText, "Transform Mode", {
        Local: "local",
        Global: "global",
      })
      .onChange(function (value) {
        transformControl.space = value;
      });
    const lightFolder = editorFolder.addFolder("Directional Light").close();
    lightFolder
      .add(transformText, "Transform Light", {
        None: "",
        Move: "translate",
        Target: "rotate",
      })
      .onChange(function (value) {
        if (value === "") {
          transformControlLight.detach();
          transformControlLightTarget.detach();
          lightHelper.visible = false;
        } else {
          if (value === "translate") {
            transformControlLight.mode = "translate";
            transformControlLight.attach(dirLight);
            lightHelper.visible = true;
            transformControlLightTarget.detach();
          } else {
            transformControlLightTarget.mode = "translate";
            transformControlLightTarget.attach(dirLightTarget);
            lightHelper.visible = true;
            transformControlLight.detach();
          }
        }
      });
    lightFolder
      .addColor(colors, "DirectionalLight")
      .onChange(function (value) {
        lightObjects[0].color = new THREE.Color(value);
      })
      .listen();
    lightFolder
      .add(intensity, "startIntensityDir", 0, 10)
      .onChange(function (value) {
        lightObjects[0].intensity = value;
      })
      .listen();

    const lightFolderAmbient = editorFolder.addFolder("Ambient Light").close();
    lightFolderAmbient
      .addColor(colors, "AmbientLight")
      .onChange(function (value) {
        ambientLight.color = new THREE.Color(value);
      })
      .listen();
    lightFolderAmbient
      .add(intensity, "startIntensityAmbient", 0, 10)
      .onChange(function (value) {
        ambientLight.intensity = value;
      })
      .listen();

    const lightFolderCamera = editorFolder.addFolder("Camera Light").close();
    lightFolderCamera
      .addColor(colors, "CameraLight")
      .onChange(function (value) {
        cameraLight.color = new THREE.Color(value);
      })
      .listen();
    lightFolderCamera
      .add(intensity, "startIntensityCamera", 0, 10)
      .onChange(function (value) {
        cameraLight.intensity = value;
      })
      .listen();

    const backgroundFolder = editorFolder.addFolder("Background Color").close();
    backgroundFolder
      .addColor(colors, "BackgroundColor")
      .onChange(function (value) {
        changeBackground(
          backgroundType["Background Type"],
          value,
          colors["BackgroundColorOuter"]
        );
      })
      .listen();
    backgroundOuterFolder = backgroundFolder
      .addColor(colors, "BackgroundColorOuter")
      .onChange(function (value) {
        changeBackground(
          backgroundType["Background Type"],
          colors["BackgroundColor"],
          value
        );
      })
      .listen();
    backgroundFolder
      .add(backgroundType, "Background Type", {
        Linear: "linear",
        Gradient: "gradient",
      })
      .onChange(function (value) {
        if (value == "linear") backgroundOuterFolder.hide();
        else backgroundOuterFolder.show();
        changeBackground(
          value,
          colors["BackgroundColor"],
          colors["BackgroundColorOuter"]
        );
      });

    clippingFolder = editorFolder.addFolder("Clipping Planes").close();
    materialsFolder = editorFolder.addFolder("Materials").close();

    if (!CONFIG.viewer.lightweight) {
      propertiesFolder = editorFolder.addFolder("Save properties").close();
      propertiesFolder.add(saveProperties, "Position");
      propertiesFolder.add(saveProperties, "Rotation");
      propertiesFolder.add(saveProperties, "Scale");
      propertiesFolder.add(saveProperties, "Camera");
      propertiesFolder.add(saveProperties, "DirectionalLight");
      propertiesFolder.add(saveProperties, "AmbientLight");
      propertiesFolder.add(saveProperties, "CameraLight");
      propertiesFolder.add(saveProperties, "BackgroundColor");
    }

    if (editor && !CONFIG.viewer.lightweight) {
      editorFolder.add(
        {
          ["Save"]() {
            var xhr = new XMLHttpRequest(),
              jsonArr,
              method = "POST",
              jsonRequestURL = CONFIG.mainUrl + "/editor.php";

            xhr.open(method, jsonRequestURL, true);
            xhr.setRequestHeader(
              "Content-Type",
              "application/x-www-form-urlencoded"
            );
            var params;
            var rotateMetadata = new THREE.Vector3(
              THREE.MathUtils.radToDeg(helperObjects[0].rotation.x),
              THREE.MathUtils.radToDeg(helperObjects[0].rotation.y),
              THREE.MathUtils.radToDeg(helperObjects[0].rotation.z)
            );
            var newMetadata = new Object();

            //Fetch data from original metadata file anyway before saving any changes
            //var originalMetadata = [];
            //var metadataUrl = path.replace("gltf/", "") + "metadata/" + filename + "_viewer";
            if (CONFIG.entity.proxyPath !== undefined) {
              metadataUrl = getProxyPath(metadataUrl);
            }

            fetch(metadataUrl, { cache: "no-cache" })
              .then((response) => {
                if (response["status"] !== 404) {
                  return response.json();
                } else {
                  return (response = {});
                }
              })
              .then((_data) => {
                if (typeof _data !== "undefined") {
                  if (typeof _data[`objPosition`] !== "undefined") originalMetadata["objPosition"] = _data["objPosition"];
                  if (typeof _data["objRotation"] !== "undefined") originalMetadata["objRotation"] = _data["objRotation"];
                  if (typeof _data["objScale"] !== "undefined") originalMetadata["objScale"] = _data["objScale"];
                  if (typeof _data["cameraPosition"] !== "undefined") originalMetadata["cameraPosition"] = _data["cameraPosition"];
                  if (typeof _data["controlsTarget"] !== "undefined") originalMetadata["controlsTarget"] = _data["controlsTarget"];
                  if (typeof _data["lightPosition"] !== "undefined") originalMetadata["lightPosition"] = _data["lightPosition"];
                  if (typeof _data["lightTarget"] !== "undefined") originalMetadata["lightTarget"] = _data["lightTarget"];
                  if (typeof _data["lightColor"] !== "undefined") originalMetadata["lightColor"] = _data["lightColor"];
                  if (typeof _data["lightIntensity"] !== "undefined") originalMetadata["lightIntensity"] = _data["lightIntensity"];
                  if (typeof _data["lightAmbientColor"] !== "undefined") originalMetadata["lightAmbientColor"] = _data["lightAmbientColor"];
                  if (typeof _data["lightAmbientIntensity"] !== "undefined") originalMetadata["lightAmbientIntensity"] = _data["lightAmbientIntensity"];
                  if (typeof _data["lightCameraColor"] !== "undefined") originalMetadata["lightCameraColor"] = _data["lightCameraColor"];
                  if (typeof _data["lightCameraIntensity"] !== "undefined") originalMetadata["lightCameraIntensity"] = _data["lightCameraIntensity"];
                  if (typeof _data["background"] !== "undefined") originalMetadata["background"] = _data["background"];

                  if (saveProperties.Position) {
                    newMetadata = Object.assign(newMetadata, {
                      objPosition: [
                        helperObjects[0].position.x, helperObjects[0].position.y, helperObjects[0].position.z,
                      ],
                    });
                  } else {
                    newMetadata = Object.assign(newMetadata, {
                      objPosition: [
                        originalMetadata["objPosition"][0], originalMetadata["objPosition"][1], originalMetadata["objPosition"][2],
                      ],
                    });
                  }

                  if (saveProperties.Rotation) {
                    newMetadata = Object.assign(newMetadata, {
                      objRotation: [
                        rotateMetadata.x, rotateMetadata.y, rotateMetadata.z,
                      ],
                    });
                  } else {
                    newMetadata = Object.assign(newMetadata, {
                      objRotation: [
                        originalMetadata["objRotation"][0], originalMetadata["objRotation"][1], originalMetadata["objRotation"][2],
                      ],
                    });
                  }

                  if (saveProperties.Scale) {
                    newMetadata = Object.assign(newMetadata, {
                      objScale: [
                      helperObjects[0].scale.x, helperObjects[0].scale.y, helperObjects[0].scale.z,
                      ],
                      });
                  } else {
                    newMetadata = Object.assign(newMetadata, {
                      objScale: [
                        originalMetadata["objScale"][0], originalMetadata["objScale"][1], originalMetadata["objScale"][2],
                      ],
                    });
                  }

                  if (saveProperties.Camera) {
                    newMetadata = Object.assign(newMetadata, {
                      cameraPosition: [
                        camera.position.x, camera.position.y, camera.position.z,
                      ],
                      controlsTarget: [
                        controls.target.x, controls.target.y, controls.target.z,
                      ],
                    });
                  } else {
                    newMetadata = Object.assign(newMetadata, {
                      cameraPosition: [
                        originalMetadata["cameraPosition"][0], originalMetadata["cameraPosition"][1], originalMetadata["cameraPosition"][2],
                      ],
                      controlsTarget: [
                        originalMetadata["controlsTarget"][0], originalMetadata["controlsTarget"][1], originalMetadata["controlsTarget"][2],
                      ],
                    });
                  }

                  if (saveProperties.DirectionalLight) {
                    newMetadata = Object.assign(newMetadata, {
                      lightPosition: [
                        dirLight.position.x, dirLight.position.y, dirLight.position.z,
                      ],
                      lightTarget: [
                        dirLight.rotation._x, dirLight.rotation._y, dirLight.rotation._z,
                      ],
                      lightColor: [
                        "#" + dirLight.color.getHexString().toUpperCase(),
                      ],
                      lightIntensity: [dirLight.intensity],
                    });
                  } else {
                    newMetadata = Object.assign(newMetadata, {
                      lightPosition: [
                        originalMetadata["lightPosition"][0], originalMetadata["lightPosition"][1], originalMetadata["lightPosition"][2],
                      ],
                      lightTarget: [
                        originalMetadata["lightTarget"][0], originalMetadata["lightTarget"][1], originalMetadata["lightTarget"][2],
                      ],
                      lightColor: [originalMetadata["lightColor"][0]],
                      lightIntensity: [originalMetadata["lightIntensity"][0]],
                    });
                  }

                  if (saveProperties.AmbientLight) {
                    newMetadata = Object.assign(newMetadata, {
                      lightAmbientColor: [
                        "#" + ambientLight.color.getHexString().toUpperCase(),
                      ],
                      lightAmbientIntensity: [ambientLight.intensity],
                    });
                  } else {
                    newMetadata = Object.assign(newMetadata, {
                      lightAmbientColor: [
                        originalMetadata["lightAmbientColor"][0],
                      ],
                      lightAmbientIntensity: [
                        originalMetadata["lightAmbientIntensity"][0],
                      ],
                    });
                  }

                  if (saveProperties.CameraLight) {
                    newMetadata = Object.assign(newMetadata, {
                      lightCameraColor: [
                        "#" + cameraLight.color.getHexString().toUpperCase(),
                      ],
                      lightCameraIntensity: [cameraLight.intensity],
                    });
                  } else {
                    newMetadata = Object.assign(newMetadata, {
                      lightCameraColor: [
                        originalMetadata["lightCameraColor"][0],
                      ],
                      lightCameraIntensity: [
                        originalMetadata["lightCameraIntensity"][0],
                      ],
                    });
                  }

                  if (saveProperties.BackgroundColor) {
                    newMetadata = Object.assign(newMetadata, {
                      background: [
                        window.getComputedStyle(mainCanvas).background,
                      ],
                    });
                  }

                  if (archiveType !== "") {
                    if (!compressedFile.includes(archiveType.toUpperCase()))
                      compressedFile += "_" + archiveType.toUpperCase();
                    params =
                      CONFIG.viewer.salt +
                      "=" +
                      JSON.stringify(newMetadata, null, "\t") +
                      "&path=" +
                      fileObject.uri +
                      fileObject.basename +
                      compressedFile +
                      "/" +
                      "&filename=" +
                      filename;
                  } else {
                    params =
                      CONFIG.viewer.salt +
                      "=" +
                      JSON.stringify(newMetadata, null, "\t") +
                      "&path=" +
                      uri +
                      "&filename=" +
                      filename;
                  }
                  xhr.onreadystatechange = function () {
                    if (xhr.readyState === XMLHttpRequest.DONE) {
                      var status = xhr.status;
                      if (status === 0 || (status >= 200 && status < 400)) {
                        showToast("Settings have been saved.");
                      }
                    }
                  };
                  xhr.send(params);
                }
              })
              .catch((error) => console.log(error));
          },
        },
        "Save"
      );
      if (!CONFIG.viewer.lightweight) {
        editorFolder.add(
          {
            ["Picking mode"]() {
              EDITOR = !EDITOR;
              var _str;
              EDITOR ? (_str = "enabled") : (_str = "disabled");
              showToast("Face picking is " + _str);
              if (!EDITOR) {
              } else {
                RULER_MODE = false;
              }
            },
          },
          "Picking mode"
        );
      }
      editorFolder.add(
        {
          ["Distance Measurement"]() {
            RULER_MODE = !RULER_MODE;
            var _str;
            RULER_MODE ? (_str = "enabled") : (_str = "disabled");
            showToast("Distance measurement mode is " + _str);
            if (!RULER_MODE) {
              ruler.forEach((r) => {
                scene.remove(r);
              });
              rulerObject = new THREE.Object3D();
              ruler = [];
              linePoints = [];
            } else {
              EDITOR = false;
            }
          },
        },
        "Distance Measurement"
      );
      if (!CONFIG.viewer.lightweight) {
        editorFolder.add(
          {
            ["Render preview"]() {
              takeScreenshot();
            },
          },
          "Render preview"
        );
      }
      editorFolder.add(
        {
          ["Reset camera position"]() {
            resetCamera();
          },
        },
        "Reset camera position"
      );
    }
  }
}

(async function () {
  await init();
  animate();
})();

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

const SOURCE = (typeof __BUILD_SOURCE__ !== 'undefined') ? __BUILD_SOURCE__ : "";
const IS_PROD = (typeof __IS_PROD__ !== 'undefined') ? __IS_PROD__ === true : false;
const isE2E = (typeof __IS_PROD__ !== 'undefined') ? window.__E2E__ === true : false;

window.viewer = {
  ready: false,
  modelLoaded: false,
  webglReady: false,
  camera: null,
  scene: null,
  renderer: null,
  controls: null
};

import { core, setCore } from './core.js';

import {
  distanceBetweenPointsVector,
  vectorBetweenPoints,
  halfwayBetweenPoints,
  interpolateDistanceBetweenPoints,
  isValidUrl,
  getProxyPath,
  normalizeColor,
} from "./utils.js";

import { initClippingPlanes, showToast, changeBackground } from './viewer-utils.js';

import { loadModel, outlineClipping } from "./loaders.js";
import { createIIIFDropdown } from "./metadata.js";

//three.js core
import THREE from "./init.js";

//three.js components
import TWEEN from "three/examples/jsm/libs/tween.module.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

//custom libraries
import Stats from "stats.js";
import { GUI } from "./js/external_libs/lil-gui.esm.min.js";
import { objectsConfig, setObjectsConfig } from "./object-settings.js";
import { lv } from "./spinner/main.js";

import './css/main.css';
import './css/spinner.css';
import '../css/theme.css';
import '../css/external-sources.css';

import { loadIIIFManifest, getAnnotations } from "./IIIF/iiif-api.js";

export const Viewer = {
  CONFIG: null,
  camera: null,
  scene: null,
  activeScene: 0,
  renderer: null,
  stats: null,
  controls: null,
  loader: null,
  ambientLight: null,
  dirLight: null,
  dirLightTarget: null,
  cameraLight: null,
  cameraLightTarget: null,
  dirLights: [],
  imported: null,
  mainObject: [],
  metadataContentTech: null,
  mainCanvas: null,
  distanceGeometry: new THREE.Vector3(),
  entityID: "",
  metadataUrl: null,
  iiifConfigURL: {url: "https://raw.githubusercontent.com/IIIF/3d/main/manifests/4_transform_and_position/model_transform_scale_position.json", name: "Inbuilt"},
  testModelURL: 'https://raw.githubusercontent.com/IIIF/3d/main/assets/astronaut/astronaut.glb',
  clock: null,
  editor: true,
  FULLSCREEN: false,
  mixer: null,
  cameraTween: null,
  targetTween: null,
  container: null,
  viewerWrapper: null,
  scrollTop: null,
  rect: null,
  fileObject: { originalPath: '', filename: '', basename: '', extension: '', path: '', uri: '', newExtension: '', relativePath: '', autopath: '' },
  bottomLineGUI: null,
  loadedFile: null,    
  fileElement: null,
  COPYRIGHTS: false,
  EXIT_CODE: 1,
  gridSize: null,
  noMTL: false,
  canvasText: null,
  viewEntity: null,
  fullscreenMode: null,
  downloadModel: null,
  GESTURE: {handPx: 55, period: 5.5, rotate: false, active: false, target: new THREE.Vector3(), startTime: 0, baseAngle: 0, orbitAngle: THREE.MathUtils.degToRad(15), easeInTime: 2.25},
  lastTime: null,
  originalMetadata: [],
  spinnerContainer: null,
  spinnerElement: null,
  guiContainer: null,
  metadataContainer: null,
  spinner: null,
  circle: null,
  lilGui: null,
  raycaster: new THREE.Raycaster(),
  pointer: new THREE.Vector2(),
  onUpPosition: new THREE.Vector2(),
  onDownPosition: new THREE.Vector2(),
  bottomOffsetFullscreen: 0,
  geometry: new THREE.BoxGeometry(20, 20, 20),
  transformControl: null,
  transformControlLight: null,
  transformControlLightTarget: null,
  transformControlClippingPlaneX: null,
  transformControlClippingPlaneY: null,
  transformControlClippingPlaneZ: null,
  cameraCoords: null,
  helperObjects: [],
  lightObjects: [],
  lightHelper: null,
  lightHelperTarget: null,
  selectedObject: false,
  selectedObjects:[],
  selectedFaces: [],
  pickingTexture: null,
  windowHalfX: null,
  windowHalfY: null,
  transformType: "",
  transformText: {
    "Transform 3D Object": "select type",
    "Transform Light": "select type",
    "Transform Mode": "Local",
  },
  materialsPropertiesText: {
    "Edit material": "select by name",
  },
  colors: {
    DirectionalLight: "0xFFFFFF",
    AmbientLight: "0x404040",
    CameraLight: "0xFFFFFF",
    BackgroundColor: "#FFFFFF",
    BackgroundColorOuter: "#999999",
  },
  materialProperties: {
    color: "0xFFFFFF",
    emissiveColor: "0x404040",
    emissive: 1,
    metalness: 0,
  },
  intensity: {
    startIntensityDir: 1,
    startIntensityAmbient: 1,
    startIntensityCamera: 1,
  },
  saveProperties: {
    Position: true,
    Rotation: true,
    Scale: true,
    Camera: true,
    DirectionalLight: true,
    AmbientLight: true,
    CameraLight: true,
    BackgroundColor: true,
    BackgroundColorOuter: true,
  },
  backgroundType: { "Background Type": "gradient" },
  backgroundOuterFolder: null,
  EDITOR: false,
  RULER_MODE: false,
  lineMaterial: new THREE.LineBasicMaterial({ color: 0x0000ff }),
  linePoints: [],
  gui: null,
  hierarchyFolder: null,
  GUILength: 35,
  zoomImage: 1,
  ZOOM_SPEED_IMAGE: 0.1,
  compressedFile: "",
  archiveType: "",
  planeParams: {
    planeX: {
      constantX: 0,
      negated: false,
      displayHelperX: false,
    },
    planeY: {
      constantY: 0,
      negated: false,
      displayHelperY: false,
    },
    planeZ: {
      constantZ: 0,
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
  },
  clippingPlanes: null,    
  planeHelpers: [],
  clippingFolder: null,
  propertiesFolder: null,
  planeObjects: [],
  editorFolder: null,
  materialsFolder: null,
  textMesh: null,
  textMeshDistance: null,
  ruler: [],
  rulerObject: null,
  lastPickedFace: { id: "", color: "", object: "" },
  loadedTimes: 0,
  _ext: '',
  DFG_ASSETS: '',
  isLightweight: false,

  async MainInit() {
    if (window.__E2E__) {
      window.viewer = {
        e2eMode: true,
        modelLoaded: false,

        get camera() {
          return core.camera;
        },

        get scene() {
          return core.scene;
        },
      };
    }

    await new Promise(r => {
      if (document.readyState !== 'loading') r();
      else document.addEventListener('DOMContentLoaded', r);
    });
    const url = new URL('./viewer-settings.json', import.meta.url);

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    this.CONFIG = await res.json();
    console.log("Loaded viewer-settings.json", this.CONFIG.viewer);

    if (Object.keys(this.CONFIG).length === 0) {
      this.CONFIG = {
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
            source: "IIIF",
          },
        },
        viewer: {
          container: "DFG_3DViewer",
          fileUpload: "fbf95bddee5160d515b982b3fd2e05f7",
          fileName: "faa602a0be629324806aef22892cdbe5",
          imageGeneration: "f605dc6b727a1099b9e52b3ccbdf5673",
          lightweight: 0,
          scaleContainer: {
            x: 0.85,
            y: 1.4,
          },
          gallery: {
            build: true,
            container: "block-bootstrap5-content",
            imageClass: "field--name-fd6a974b7120d422c7b21b5f1f2315d9",
            imageId: "",
          },
          background:
            "radial-gradient(circle, #ffffff 0%, #999999 100%)",
          performanceMode: {
            Performance: "high-performance",
          }
        },
      };
    }
    this.isLightweight = Boolean(this.CONFIG.viewer.lightweight);
    console.log(`AIM 3D-Viewer ${this.isLightweight ? '🪶 LIGHTWEIGHT' : '💪 FULL'} mode`);
    console.log(`Powered by Three.js (v${THREE.REVISION})`);
    
    this.CONFIG.entity.metadata.source = SOURCE;
    if (this.CONFIG.entity.metadata.source) console.log(`Metadata source: ${this.CONFIG.entity.metadata.source}`);

    this.container = document.getElementById(this.CONFIG.viewer.container);
    if (!this.container) throw new Error("Container not found");
    setCore('container', this.container);

    this.scrollTop = window.scrollY || document.documentElement.scrollTop;
    this.rect = core.container.getBoundingClientRect();
    this.fileObject.originalPath = core.container.getAttribute("3d");
    setCore('fileObject', this.fileObject)
    this.CONFIG.viewer.canvasDimensions = {
      x: this.rect.width * Number(this.CONFIG.viewer.scaleContainer.x),
      y: this.rect.height * Number(this.CONFIG.viewer.scaleContainer.y),
    };
    this.bottomLineGUI = this.CONFIG.viewer.canvasDimensions.y - 85;

    if (this.isLightweight) {
      this.CONFIG.viewer.lightweight = core.container.getAttribute("proxy");
    }
    else {
      var elementsURL = window.location.pathname;
      elementsURL = elementsURL.match(this.CONFIG.entity.idUri);
      if (elementsURL !== null) {
        this.entityID = elementsURL[1];
        core.container.setAttribute(this.CONFIG.entity.attributeId, this.entityID);
        console.log("Entity ID:", this.entityID);
      }
    }    
    // Initialize clipping planes at startup
    this.core = initClippingPlanes();
    setCore('isLightweight', this.isLightweight);
    setCore('EXIT_CODE', this.EXIT_CODE);
    // Initialize objectsConfig in core
    setCore('objectsConfig', objectsConfig);
    setCore('outlineClipping', outlineClipping);
    core.objectsConfig.setupIndex = core.objectsConfig.index = 0;

    this.cameraTween = new TWEEN.Tween();
    setCore('cameraTween', this.cameraTween);

    this.targetTween = new TWEEN.Tween();
    setCore('targetTween', this.targetTween);

    core.container.classList.add("mainContainer");

    if (core.container.hasAttribute("basePath")) {
      this.CONFIG.baseModulePath = core.container.getAttribute("basePath");
    }

    this.setModelPaths();

    this.CONFIG.viewer.exportPath = "/api/editor/xml-export/";    
    this.loadedFile = `${core.fileObject.basename}.${core.fileObject.extension}`;

    this.handHint = document.createElement("div");
    this.handHint.id = "handHint";
    this.handHint.hidden = true;
    core.container.appendChild(this.handHint);
    setCore('handHint', this.handHint);

    this.spinnerContainer = document.createElement("div");
    this.spinnerContainer.id = "spinnerContainer";
    this.spinnerElement = document.createElement("div");
    this.spinnerElement.id = "spinner";
    this.spinnerElement.className = "lv-determinate_circle lv-mid md";
    this.spinnerElement.setAttribute("data-label", "Loading...");
    this.spinnerElement.setAttribute("data-percentage", "true");
    this.spinnerContainer.appendChild(this.spinnerElement);
    core.container.appendChild(this.spinnerContainer);
    this.spinnerContainer.style.left = `calc(50% - ${this.spinnerContainer.getBoundingClientRect().width / 2}px)`;

    this.rect = core.container.getBoundingClientRect();

    this.guiContainer = document.createElement("div");
    this.guiContainer.id = "guiContainer";
    this.guiContainer.className = "guiContainer";
    core.container.appendChild(this.guiContainer);

    this.gui  = new GUI({ container: guiContainer });

    this.metadataContainer = document.createElement("div");
    this.metadataContainer.setAttribute("id", "metadata-container");
    this.metadataContainer.style.top = -this.metadataContainer.getBoundingClientRect().top + "px";
    setCore('metadataContainer', this.metadataContainer)

    this.spinner = new lv();
    this.spinner.initLoaderAll();
    this.spinner.startObserving();

    this.circle = lv.create(this.spinnerElement);
    setCore('circle', this.circle);
    setCore('spinner', this.spinner);
        
    setCore('colors', this.colors);
    setCore("planeHelpers", this.planeHelpers);    
    setCore("planeParams", this.planeParams);
    setCore('materialProperties', this.materialProperties);
    setCore('materialsPropertiesText', this.materialsPropertiesText);
    setCore('intensity', this.intensity);
    this.clippingPlanes = this.core;
    setCore("clippingPlanes", this.clippingPlanes);
    setCore('helperObjects', this.helperObjects);
    setCore('lightHelper', this.lightHelper);
    setCore('selectedObjects', this.selectedObjects)

    this.clock = new THREE.Timer();

    Viewer.init();
    Viewer.prepareStats();
    localStorage.setItem("viewerHintSeen", "0");
    
    this.updateSize();
    if (this.CONFIG.entity?.metadata?.source != null) {
      await Viewer.mainLoadModel();
    }
    Viewer.animate();
  },

  normalizeDrupalFilesPath(path) {
    return path
      .replace(/^\/?sites\/default\/files\/?/, '')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '');
  },

  setModelPaths() {
    core.fileObject.filename = core.fileObject.originalPath.split("/").pop();
    core.fileObject.basename = core.fileObject.filename.substring(0, core.fileObject.filename.lastIndexOf("."));
    core.fileObject.extension = core.fileObject.filename.substring(core.fileObject.filename.lastIndexOf(".") + 1);
    core.fileObject.path = core.fileObject.originalPath.substring(0, core.fileObject.originalPath.lastIndexOf(core.fileObject.filename)) || "/";
    core.fileObject.uri = core.fileObject.path.replace(this.CONFIG.mainUrl + "/", "");
    core.fileObject.relativePath = Viewer.normalizeDrupalFilesPath(core.fileObject.uri);
  },
  // Disable interaction hint on first interaction
 disableInteractionHint() {
    Viewer.handHint.hidden = true;
    Viewer.stopGesture();
    //Viewer.handHint.classList.remove("hand-drag-animate");
    localStorage.setItem("viewerHintSeen", "1");
  },

  addTextWatermark(_text, _scale) {
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
      '.' + CONFIG.baseModulePath + "/fonts/helvetiker_regular.typeface.json",
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

        Viewer.textMesh = new THREE.Mesh(textGeo, materials);

        Viewer.textMesh.rotation.z = Math.PI;
        Viewer.textMesh.rotation.y = Math.PI;

        Viewer.textMesh.position.x = 0;
        Viewer.textMesh.position.y = 0;
        Viewer.textMesh.position.z = 0;
        Viewer.textMesh.renderOrder = 1;
        core.scene.add(Viewer.textMesh);
      }
    );
  },

  addTextPoint(_text, _scale, _point) {
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
      '.' + CONFIG.baseModulePath + "/fonts/helvetiker_regular.typeface.json",
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

        Viewer.textMeshDistance = new THREE.Mesh(textGeo, materials);

        Viewer.textMeshDistance.position.set(_point.x, _point.y, _point.z);
        Viewer.textMeshDistance.renderOrder = 1;
        Viewer.rulerObject.add(Viewer.textMeshDistance);
      }
    );
  },

  selectObjectHierarchy(_id) {
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
      tempMaterial.color = normalizeColor("0x00FF00");
      core.scene.getObjectById(_id).material = tempMaterial;
      core.scene.getObjectById(_id).material.needsUpdate = true;
    }
  },

  recreateBoundingBox(object) {
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
  },

  prepareGalleryImages(imageElementsChildren) {
    imageElementsChildren = imageElementsChildren.filter(function (_image) {
      return isValidUrl(_image.innerHTML);
    });
    imageElementsChildren.forEach(function (imgLink, index) {
      imgLink.innerHTML =
        '<img loading="lazy" src="' +
        imgLink.innerHTML +
        '" width="200px" height="200px" alt="" class="img-fluid image-style-wisski-preview">';
    });
  },

  handleImages(
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
      if (e.deltaY > 0 && Viewer.zoomImage > 0.15) {
        modalImage.style.transform = `scale(${(Viewer.zoomImage -= Viewer.ZOOM_SPEED_IMAGE)})`;
      } else if (e.deltaY < 0 && Viewer.zoomImage < 5) {
        modalImage.style.transform = `scale(${(Viewer.zoomImage += Viewer.ZOOM_SPEED_IMAGE)})`;
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
        Viewer.zoomImage = 1.5;
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
            imageList.style.zIndex = 0;
            imageList.style.display = "hidden";
            modalImage.src = this.src;
          };
        }
        imageList.appendChild(imageElementsChildren[i]);
      }
    }
    if (
      imageList &&
      imageList.childNodes.length > 0 &&
      Viewer.fileElement &&
      Viewer.fileElement[0] &&
      mainElement
    ) {
      Viewer.fileElement[0].insertAdjacentElement("beforebegin", modalGallery);
      mainElement.insertAdjacentElement("beforebegin", imageList);
    }
    //mainElement.insertBefore(imageList, fileElement[0]);
  },

  buildGallery() {
    if (Viewer.fileElement && Viewer.fileElement?.length > 0) {
      var mainElement = document.getElementById(Viewer.CONFIG.viewer.gallery.container);
      var imageElements;
      if (Viewer.CONFIG.viewer.gallery.imageClass !== "") {
        imageElements = document.getElementsByClassName(
          Viewer.CONFIG.viewer.gallery.imageClass
        );
        if (imageElements.length > 0) {
          var galleryLabel = document.getElementsByClassName("field__label");
          if (galleryLabel !== undefined) galleryLabel[0].innerText = "";
        }
      } else if (Viewer.CONFIG.viewer.gallery.imageId !== "") {
        imageElements = document.getElementById(Viewer.CONFIG.viewer.gallery.imageId);
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
            Viewer.prepareGalleryImages(imagesList);
            //imageElements[0].classList.add("field--type-image");
            imageElements[0].classList.add("field--label-hidden");
            imageElements[0].classList.add("field__items");
            Viewer.handleImages(mainElement, imagesList, imageElements);
          } else {
            Viewer.handleImages(mainElement, imageElements);
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
            Viewer.prepareGalleryImages(imagesList);
            imageElements.classList.add("field--type-image");
            imageElements.classList.add("field--label-hidden");
            imageElements.classList.add("field__items");
            Viewer.handleImages(mainElement, imagesList, imageElements);
          } else {
            Viewer.handleImages(mainElement, imageElements);
          }
        }
      }
    }
  },

  pickFaces(_id) {
    if (lastPickedFace.id == "" && _id !== "") {
      lastPickedFace = {
        id: _id,
        color: _id.object.material.color.getHex(),
        object: _id.object.id,
      };
    } else if (_id == "" && lastPickedFace.id !== "") {
      core.scene
        .getObjectById(lastPickedFace.object)
        .material.color = normalizeColor(lastPickedFace.color);
      lastPickedFace = { id: "", color: "", object: "" };
    } else if (_id != lastPickedFace.id) {
      core.scene
        .getObjectById(lastPickedFace.object)
        .material.color = Viewer.normalizeColor(lastPickedFace.color);
      lastPickedFace = {
        id: _id,
        color: _id.object.material.color.getHex(),
        object: _id.object.id,
      };
    }
    if (_id !== "") _id.object.material.color = normalizeColor(0xff0000);
  },

  buildRuler(_id) {
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
    core.scene.add(rulerObject);
    ruler.push(rulerObject);
  },


  updateSize() {
    const isFullscreen = !!document.fullscreenElement;
    Viewer.FULLSCREEN = isFullscreen;

    let widthCSS, heightCSS;  // CSS pixels (layout)
    let widthDev, heightDev;  // Device pixels (Three.js)
    let scale = {x: 1, y: 1};
    let rect = {width: 1, height: 1};

    if (isFullscreen) {
        widthCSS = window.innerWidth;
        heightCSS = window.innerHeight;
        widthDev = widthCSS * devicePixelRatio;
        heightDev = heightCSS * devicePixelRatio;

        Viewer.mainCanvas.style.width = '100vw';
        Viewer.mainCanvas.style.height = '100vh';
        Viewer.fullscreenMode.style.left = (widthCSS - 40) + 'px';
        Viewer.fullscreenMode.innerHTML = `<img src="${Viewer.DFG_ASSETS}exit-fullscreen.png" alt="Fullscreen" width=25 height=25 title="Exit fullscreen mode"/>`;
        //Viewer.downloadModel?.setAttribute("style", "visibility: none");
    } else {
      scale = {x: Number(Viewer.CONFIG.viewer.scaleContainer?.x || 1), y: Number(Viewer.CONFIG.viewer.scaleContainer?.y || 1)};
      rect = Viewer.viewerWrapper.getBoundingClientRect();
      widthCSS = (rect.width * scale.x) || 800;
      heightCSS = (rect.height * scale.y) || 600;

      widthDev = widthCSS * devicePixelRatio;
      heightDev = heightCSS * devicePixelRatio;
      Viewer.mainCanvas.style.width = widthCSS + 'px';
      Viewer.mainCanvas.style.height = heightCSS + 'px';
      
      core.metadataContainer.style.width = '100%';
      core.metadataContainer.style.height = '100%';
      Viewer.downloadModel?.setAttribute("style", "visibility: visible");

      if (Viewer.fileElement && Viewer.fileElement.length > 0) {
        Viewer.fileElement[0].style.height = (heightCSS * 1.1) + 'px';
      }
      Viewer.fullscreenMode.style.left = (widthCSS - Viewer.fullscreenMode.getBoundingClientRect().width - 15) + 'px';
    }

    Viewer.guiContainer.style.left = (widthCSS - Viewer.lilGui[0]?.getBoundingClientRect().width) + 'px';

    Viewer.mainCanvas.width = widthDev;
    Viewer.mainCanvas.height = heightDev;

    Viewer.fullscreenMode.style.top = (heightCSS - 40) + 'px';
    if (Viewer.downloadModel) {
      let _offset = (Viewer.CONFIG.isLightweight) ? 130 : 70;
      Viewer.downloadModel.style.top = (heightCSS - _offset) + 'px';
    }
    if (Viewer.viewEntity) {
      Viewer.viewEntity.style.right = isFullscreen ? '-95%' : '-75%';
    }
    core.handHint.style.top = (heightCSS - 70) + 'px';
   
    core.renderer.setPixelRatio(devicePixelRatio * scale.x);
    core.renderer.setSize(widthCSS*scale.x, heightCSS*scale.y, false);
    core.camera.aspect = widthCSS / heightCSS;
    core.camera.updateProjectionMatrix();
    core.controls?.update();
    Viewer.CONFIG.viewer.canvasDimensions = { x: widthCSS, y: heightCSS };
  },

    // Three.js renderer needs actual pixel size

  async toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await core.container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  },

  onFullscreenChange () {
    const isFs = !!document.fullscreenElement;

    // UI
    Viewer.fullscreenMode.innerHTML = isFs
      ? `<img src="${Viewer.DFG_ASSETS}exit-fullscreen.png" width="25" height="25" title="Exit fullscreen mode"/>`
      : `<img src="${Viewer.DFG_ASSETS}fullscreen.png" width="25" height="25" title="Fullscreen mode"/>`;

    // Layout (ESC + klik)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        Viewer.updateSize();
      });
    });
  },

  exitFullscreenHandler() {
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
      Viewer.FULLSCREEN
    ) {
      fullscreen();
    }
  },

  updateHandAnimation: (time) => {
    const g = core.GESTURE;
    if (!g) return;
  
    if (!g.active || !g.baseAngle || !g.target) return;

    const t = (time - g.startTime) / 1000;
    const s = Math.sin((t / core.GESTURE.period) * Math.PI * 2);

    // EASE-IN (smoothstep)
    const ei = Math.min(t / g.easeInTime, 1);
    const ease = ei * ei * (3 - 2 * ei); // smoothstep(0..1)

    // hand icon
    core.handHint.style.setProperty(
      '--hand-x',
      `${s * core.GESTURE.handPx}px`
    );

    // camera - orbit
    const sph = g.baseAngle.clone();
    sph.theta = g.baseAngle.theta + s * core.GESTURE.orbitAngle * ease;


    core.camera.position
      .setFromSpherical(sph)
      .add(g.target);

    core.camera.lookAt(g.target);
  },

  startGesture: (time) => {
    const g = core.GESTURE;
    if (!g) return;
    if (g.active) return;

    g.rotate = true;
    g.startTime = time;
    g.active = true;

    g.target = core.controls.target.clone();

    g.baseAngle = new THREE.Spherical().setFromVector3(
      core.camera.position.clone().sub(g.target)
    );

    core.controls.enabled = false;
  },

  stopGesture: () => {
    const g = core.GESTURE;
    if (!g) return;
    if (!g.active) return;
    g.rotate = false;
    g.active = false;

    core.controls.target.copy(g.target);

    core.controls.object.position.copy(core.camera.position);
    core.controls.update();
    core.controls.enabled = true;

    g.baseAngle = null;
    g.target = null;
  },

  animate: (time) => {
    requestAnimationFrame(Viewer.animate);

    // =========================
    // GESTURE LIFECYCLE
    // =========================
    const canGesture =
      !window.__E2E__ &&
      !core.handHint.hidden;

    if (canGesture && core.GESTURE?.rotate && !core.GESTURE?.active ) {
      Viewer.startGesture(time);
    }

    if (core.GESTURE?.active && (!core.GESTURE?.rotate || !canGesture)) {
      Viewer.stopGesture();
    }

    // =========================
    // GESTURE UPDATE
    // =========================
    Viewer.updateHandAnimation(time);

    // =========================
    // LOOP UPDATE
    // =========================
    const delta = Viewer.clock.getDelta();
    if (Viewer.mixer) {
      Viewer.mixer.update(delta);
    }

    if (core.handHint.hidden && !core.GESTURE?.active) {
      core.cameraTween.update(time);
      core.targetTween.update(time);
    }

    if (!core.GESTURE?.active) {
      core.controls?.update();
    }

    if (Viewer.textMesh !== null) {
      Viewer.textMesh.lookAt(core.camera.position);
    }

    core.renderer.clear();
    core.renderer.render(core.scene, core.camera);
    Viewer.stats.update();
  },

  onPointerDown(e) {
    Viewer.disableInteractionHint();
    e.stopPropagation();
    if (e.button === 0) {
      Viewer.onDownPosition.x =
        ((e.clientX - Viewer.mainCanvas.getBoundingClientRect().left) /
          core.renderer.domElement.clientWidth) *
        2 -
        1;
      Viewer.onDownPosition.y =
        -(
          (e.clientY - Viewer.mainCanvas.getBoundingClientRect().top) /
          core.renderer.domElement.clientHeight
        ) *
        2 +
        1;
    }
  },

  onPointerUp(e) {
    if (e.button == 0) {
      Viewer.onUpPosition.x =
        ((e.clientX - Viewer.mainCanvas.getBoundingClientRect().left) /
          core.renderer.domElement.clientWidth) *
        2 -
        1;
      Viewer.onUpPosition.y =
        -(
          (e.clientY - Viewer.mainCanvas.getBoundingClientRect().top) /
          core.renderer.domElement.clientHeight
        ) *
        2 +
        1;
      if (
        Viewer.onUpPosition.x === Viewer.onDownPosition.x &&
        Viewer.onUpPosition.y === Viewer.onDownPosition.y
      ) {
        Viewer.raycaster.setFromCamera(Viewer.onUpPosition, core.camera);
        var intersects;

        if (Viewer.EDITOR || Viewer.RULER_MODE) {
          if (core.mainObject.length > 1) {
            for (let ii = 0; ii < core.mainObject.length; ii++) {
              intersects = Viewer.raycaster.intersectObjects(
                core.mainObject[ii].children,
                true
              );
            }
            if (intersects.length <= 0) {
              intersects = Viewer.raycaster.intersectObjects(core.mainObject, true);
            }
          } else {
            intersects = Viewer.raycaster.intersectObject(core.mainObject[0], true);
          }
          if (intersects.length > 0) {
            if (Viewer.RULER_MODE) buildRuler(intersects[0]);
            else if (Viewer.EDITOR) pickFaces(intersects[0]);
          }
        }
      }
    }
  },

  onPointerMove(e) {
    Viewer.pointer.x =
      ((e.clientX - Viewer.mainCanvas.getBoundingClientRect().left) /
        core.renderer.domElement.clientWidth) *
      2 -
      1;
    Viewer.pointer.y =
      -(
        (e.clientY - Viewer.mainCanvas.getBoundingClientRect().top) /
        core.renderer.domElement.clientHeight
      ) *
      2 +
      1;
    if (e.buttons !== 0) {
      Viewer.disableInteractionHint();
    }
    if (e.buttons == 1) {
      if (Viewer.pointer.x !== Viewer.onDownPosition.x && Viewer.pointer.y !== Viewer.onDownPosition.y) {
        Viewer.cameraLight.position.set(
          core.camera.position.x,
          core.camera.position.y,
          core.camera.position.z
        );
      }
    } else {
      if (this.EDITOR) {
        Viewer.raycaster.setFromCamera(Viewer.pointer, core.camera);
        var intersects;
        if (core.mainObject.length > 1) {
          for (let ii = 0; ii < core.mainObject.length; ii++) {
            intersects = Viewer.raycaster.intersectObjects(
              core.mainObject[ii].children,
              true
            );
          }
          if (intersects.length <= 0) {
            intersects = Viewer.raycaster.intersectObjects(core.mainObject, true);
          }
        } else {
          intersects = Viewer.raycaster.intersectObject(core.mainObject[0], true);
        }
        if (intersects.length > 0) {
          pickFaces(intersects[0]);
        } else {
          pickFaces("");
        }
      }
    }
  },

  async changeScale() {
    if (core.transformControl.getMode() === "scale") {
      switch (core.transformControl.axis) {
        case "X":
        case "XY":
          core.helperObjects[0].scale.set(
            core.helperObjects[0].scale.x,
            core.helperObjects[0].scale.x,
            core.helperObjects[0].scale.x
          );
          break;
        case "Y":
        case "YZ":
          core.helperObjects[0].scale.set(
            core.helperObjects[0].scale.y,
            core.helperObjects[0].scale.y,
            core.helperObjects[0].scale.y
          );
          break;
        case "Z":
        case "XZ":
          core.helperObjects[0].scale.set(
            core.helperObjects[0].scale.x,
            core.helperObjects[0].scale.x,
            core.helperObjects[0].scale.x
          );
          break;
      }
    }
  },

  async calculateObjectScale() {
    const boundingBox = new THREE.Box3();
    if (Array.isArray(core.helperObjects[0])) {
      for (let i = 0; i < core.helperObjects[0].length; i++) {
        boundingBox.setFromObject(Viewer.object[i]);
      }
    } else {
      boundingBox.setFromObject(core.helperObjects[0]);
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
    Viewer.distanceGeometry = _distance;
    setCore("distanceGeometry", Viewer.distanceGeometry);
    Viewer.planeParams.planeX.constantZ =
      Viewer.clippingFolder.controllers[1]._max =
      Viewer.clippingPlanes[0].constant =
      _distance.x;
    Viewer.clippingFolder.controllers[1]._min = -Viewer.clippingFolder.controllers[1]._max;
    Viewer.planeParams.planeY.constantY =
      Viewer.clippingFolder.controllers[3]._max =
      Viewer.clippingPlanes[1].constant =
      _distance.y;
    Viewer.clippingFolder.controllers[3]._min = -Viewer.clippingFolder.controllers[3]._max;
    Viewer.planeParams.planeZ.constantZ =
      Viewer.clippingFolder.controllers[5]._max =
      Viewer.clippingPlanes[2].constant =
      _distance.z;
    Viewer.clippingFolder.controllers[5]._min = -Viewer.clippingFolder.controllers[5]._max;
    Viewer.clippingFolder.controllers[1].updateDisplay();
    Viewer.clippingFolder.controllers[3].updateDisplay();
    Viewer.clippingFolder.controllers[5].updateDisplay();
    var _maxDistance = Math.max(_distance.x, _distance.y, _distance.z);
    Viewer.planeHelpers?.forEach(h => h && (h.size = _maxDistance));
  },

  changeLightRotation() {
    core.lightHelper.update();
  },

  takeScreenshot() {
    /*const messDiv = document.createElement('div');
    messDiv.classList.add('message');
    document.body.appendChild(messDiv);*/
    core.camera.aspect = 1;
    core.camera.updateProjectionMatrix();
    core.renderer.setSize(256, 256);
    core.renderer.render(core.scene, core.camera);
    var prependName = "";
    if (core.fileObject.archiveType !== "") {
      prependName = core.fileObject.basename + "_" + core.fileObject.archiveType.toUpperCase() + "/";
    }

    Viewer.mainCanvas.toBlob((imgBlob) => {
      if (!imgBlob) {
        console.error("Failed to capture screenshot");
        return;
      }

      if (!(imgBlob instanceof Blob) || imgBlob.size === 0) {
        console.error("Invalid blob data");
        return;
      }

      if (!["image/png", "image/jpeg"].includes(imgBlob.type)) {
        console.error("Invalid blob type:", imgBlob.type);
        return;
      }
      const fileform = new FormData();
      fileform.append("path", core.fileObject.path);
      fileform.append("filename", core.fileObject.basename);
      //fileform.append("path", uri + prependName);
      fileform.append("data", imgBlob, "thumbnail.png");
      console.log("Uploading thumbnail for entity ID:", Viewer.entityID);
      fileform.append("wisski_individual", Viewer.entityID);
      fetch(Viewer.CONFIG.mainUrl + "/api/editor/upload-thumbnail", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "X-CSRF-Token": window.CSRF_TOKEN
        },
        body: fileform
      })
      .then(async (res) => {
        //console.log("HTTP STATUS:", res.status);
        const text = await res.text();
        //console.log("RAW RESPONSE:", text);
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(data.error || "Upload failed");
        return data;
      })
    }, "image/png");

    core.renderer.setPixelRatio(devicePixelRatio);
    core.camera.aspect = Viewer.CONFIG.viewer.canvasDimensions.x / Viewer.CONFIG.viewer.canvasDimensions.y;
    core.camera.updateProjectionMatrix();
    core.renderer.setSize(Viewer.CONFIG.viewer.canvasDimensions.x, Viewer.CONFIG.viewer.canvasDimensions.y);
  },

  async mainLoadModelWrapper() {
    if (core.autoPath !== '') {
      core.fileObject.filename = core.autoPath.split('/').pop();
      core.fileObject.basename =
        core.fileObject.filename.substring(
          0,
          core.fileObject.filename.lastIndexOf('.')
        );
      core.fileObject.extension =
        core.fileObject.filename.substring(
          core.fileObject.filename.lastIndexOf('.') + 1
        );
      Viewer._ext = core.fileObject.extension.toLowerCase();
      core.fileObject.path =
        core.autoPath.substring(0, core.autoPath.lastIndexOf(core.fileObject.filename));
    }

    await Viewer.mainLoadModel();
  },

  async mainLoadModel() {
    console.log("Loading model: ", core.fileObject.basename, ", with extension: ", core.fileObject.extension);
    if (Viewer._ext === "glb" || Viewer._ext === "gltf") {
      await loadModel({
        config: Viewer.CONFIG,
        getProxyPath: getProxyPath,
        stats: Viewer.stats,
        entityID: Viewer.entityID,
        canvasText: Viewer.canvasText,
        bottomLineGUI: Viewer.bottomLineGUI,
        compressedFile: Viewer.compressedFile,
        viewEntity: Viewer.viewEntity
      });
    } else if (
      Viewer._ext === "zip" ||
      Viewer._ext === "rar" ||
      Viewer._ext === "tar" ||
      Viewer._ext === "xz" ||
      Viewer._ext === "gz"
    ) {
      Viewer.compressedFile = "_" + Viewer._ext.toUpperCase() + "/";
      core.fileObject.path = core.fileObject.path + core.fileObject.basename + Viewer.compressedFile
      core.fileObject.extension = "glb";
      core.fileObject.newExtension = Viewer._ext;
      await loadModel({
        config: Viewer.CONFIG,
        getProxyPath: getProxyPath,
        stats: Viewer.stats,
        entityID: Viewer.entityID,
        canvasText: Viewer.canvasText,
        bottomLineGUI: Viewer.bottomLineGUI,
        compressedFile: Viewer.compressedFile,
        viewEntity: Viewer.viewEntity
      });
    } else {
      //core.fileObject.extension = "glb";
      if (Viewer._ext === "glb") {
        await loadModel({
        config: Viewer.CONFIG,
        getProxyPath: getProxyPath,
        stats: Viewer.stats,
        entityID: Viewer.entityID,
        canvasText: Viewer.canvasText,
        bottomLineGUI: Viewer.bottomLineGUI,
        compressedFile: Viewer.compressedFile,
        viewEntity: Viewer.viewEntity
      });
      }
      else await loadModel({
        config: Viewer.CONFIG,
        getProxyPath: getProxyPath,
        stats: Viewer.stats,
        entityID: Viewer.entityID,
        canvasText: Viewer.canvasText,
        bottomLineGUI: Viewer.bottomLineGUI,
        compressedFile: Viewer.compressedFile,
        viewEntity: Viewer.viewEntity
      });
    }
  },

  createClippingPlaneAxis(_number) {
    var tempClippingControl = new TransformControls(core.camera, core.renderer.domElement);
    tempClippingControl.space = "local";
    tempClippingControl.setMode("translate");
    tempClippingControl.addEventListener("change", Viewer.render);
    tempClippingControl.addEventListener("objectChange", function (event) {
      switch (_number) {
        case 0:
          Viewer.clippingPlanes[_number].constant =
            event.target.children[0].pointEnd.x + Viewer.distanceGeometry.x;
          break;
        case 1:
          Viewer.clippingPlanes[_number].constant =
            event.target.children[0].pointEnd.y + Viewer.distanceGeometry.y;
          break;
        case 2:
          Viewer.clippingPlanes[_number].constant =
            event.target.children[0].pointEnd.z + Viewer.distanceGeometry.z;
          break;
      }
    });
    tempClippingControl.addEventListener("dragging-changed", function (event) {
      core.controls.enabled = !event.value;
    });
    return tempClippingControl;
  },

  resetCamera() {
    var camPosition = core.camera.position;
    let _tween = new Tween(camPosition)
      .to(core.cameraCoords, 1500)
      .onUpdate(() => {
        core.camera.position.set(camPosition.x, camPosition.y, camPosition.z);
        core.cameraLight.position.set(camPosition.x, camPosition.y, camPosition.z);
        core.camera.updateProjectionMatrix();
        core.controls.update();
      })
      .start();
  },

  pick(save, current, original) {
    return save ? current : original;
  },

  buildMetadata(Viewer, rotateMetadata) {
    const O = Viewer.originalMetadata;
    const S = Viewer.saveProperties;

    const M = {};

    // --- OBJECT ---
    M.objPosition = Viewer.pick(
      S.Position,
      [
        core.helperObjects[0].position.x,
        core.helperObjects[0].position.y,
        core.helperObjects[0].position.z
      ],
      O.objPosition
    );

    M.objRotation = Viewer.pick(
      S.Rotation,
      [rotateMetadata.x, rotateMetadata.y, rotateMetadata.z],
      O.objRotation
    );

    M.objScale = Viewer.pick(
      S.Scale,
      [
        core.helperObjects[0].scale.x,
        core.helperObjects[0].scale.y,
        core.helperObjects[0].scale.z
      ],
      O.objScale
    );

    // --- CAMERA ---
    M.cameraPosition = Viewer.pick(
      S.Camera,
      [
        core.camera.position.x,
        core.camera.position.y,
        core.camera.position.z
      ],
      O.cameraPosition
    );

    M.controlsTarget = Viewer.pick(
      S.Camera,
      [
        core.controls.target.x,
        core.controls.target.y,
        core.controls.target.z
      ],
      O.controlsTarget
    );

    M.controlsZoom = Viewer.pick(
      S.Camera,
      [
        core.camera.position.distanceTo(core.controls.target)
      ],
      O.controlsZoom
    );

    // --- DIRECTIONAL LIGHT ---
    M.lightPosition = Viewer.pick(
      S.DirectionalLight,
      [
        core.dirLight.position.x,
        core.dirLight.position.y,
        core.dirLight.position.z
      ],
      O.lightPosition
    );

    M.lightTarget = Viewer.pick(
      S.DirectionalLight,
      [
        core.dirLight.rotation._x,
        core.dirLight.rotation._y,
        core.dirLight.rotation._z
      ],
      O.lightTarget
    );

    M.lightColor = Viewer.pick(
      S.DirectionalLight,
      ["#" + core.dirLight.color.getHexString().toUpperCase()],
      O.lightColor
    );

    M.lightIntensity = Viewer.pick(
      S.DirectionalLight,
      [core.dirLight.intensity],
      O.lightIntensity
    );

    // --- AMBIENT LIGHT ---
    M.lightAmbientColor = Viewer.pick(
      S.AmbientLight,
      ["#" + core.ambientLight.color.getHexString().toUpperCase()],
      O.lightAmbientColor
    );

    M.lightAmbientIntensity = Viewer.pick(
      S.AmbientLight,
      [core.ambientLight.intensity],
      O.lightAmbientIntensity
    );

    // --- CAMERA LIGHT ---
    M.lightCameraColor = Viewer.pick(
      S.CameraLight,
      ["#" + core.cameraLight.color.getHexString().toUpperCase()],
      O.lightCameraColor
    );

    M.lightCameraIntensity = Viewer.pick(
      S.CameraLight,
      [core.cameraLight.intensity],
      O.lightCameraIntensity
    );

    // --- BACKGROUND ---
    if (S.BackgroundColor) {
      M.background = [
        window.getComputedStyle(Viewer.mainCanvas).background
      ];
    } else {
      M.background = O.background;
    }

    return M;
  },


  prepareStats () {
      // stats
      Viewer.stats = new Stats();
      Viewer.stats.domElement.style.cssText =
        "position:relative;top:0px;" +
        "max-height:120px;max-width:90px;z-index:2;visibility:hidden;";

      Viewer.windowHalfX = Viewer.CONFIG.viewer.canvasDimensions.x / 2;
      Viewer.windowHalfY = Viewer.CONFIG.viewer.canvasDimensions.y / 2;

      Viewer.editorFolder = core.gui.addFolder("Editor").close();
      Viewer.editorFolder
        .add(Viewer.transformText, "Transform 3D Object", {
          None: "",
          Move: "translate",
          Rotate: "rotate",
          Scale: "scale",
        })
        .onChange(function (value) {
          if (value === "") {
            core.transformControl.detach();
            core.axesHelper.visible = false;
          } else {
            const object = core.helperObjects?.[0];

            if (!object) {
              return;
            }
            core.axesHelper.visible = true;
            core.renderer.localClippingEnabled = false;

            core.transformControl.setMode(value);
            core.transformControl.attach(object);

          }
        });
      Viewer.editorFolder
        .add(Viewer.transformText, "Transform Mode", {
          Local: "local",
          Global: "global",
        })
        .onChange(function (value) {
          core.transformControl.space = value;
        });
      const lightFolder = Viewer.editorFolder.addFolder("Directional Light").close();
      lightFolder
        .add(Viewer.transformText, "Transform Light", {
          None: "",
          Move: "translate",
          Target: "rotate",
        })
        .onChange(function (value) {
          if (value === "") {
            core.transformControlLight.detach();
            core.transformControlLightTarget.detach();
            core.lightHelper.visible = false;
          } else {
            core.lightHelper.visible = true;
            if (value === "translate") {
              core.transformControlLight.setMode("translate");
              core.transformControlLight.attach(core.dirLight);
              core.transformControlLightTarget.detach();
            } else {
              core.transformControlLightTarget.setMode("translate");
              core.transformControlLightTarget.attach(core.dirLightTarget);
              core.transformControlLight.detach();
            }
          }
        });
      lightFolder
        .addColor(Viewer.colors, "DirectionalLight")
        .onChange(function (value) {
          core.lightObjects[0].color = new THREE.Color(value);
        })
        .listen();
      lightFolder
        .add(Viewer.intensity, "startIntensityDir", 0, 10)
        .onChange(function (value) {
          core.lightObjects[0].intensity = value;
        })
        .listen();

      const lightFolderAmbient = Viewer.editorFolder.addFolder("Ambient Light").close();
      lightFolderAmbient
        .addColor(Viewer.colors, "AmbientLight")
        .onChange(function (value) {
          Viewer.ambientLight.color = new THREE.Color(value);
        })
        .listen();
      lightFolderAmbient
        .add(Viewer.intensity, "startIntensityAmbient", 0, 10)
        .onChange(function (value) {
          Viewer.ambientLight.intensity = value;
        })
        .listen();

      const lightFolderCamera = Viewer.editorFolder.addFolder("Camera Light").close();
      lightFolderCamera
        .addColor(Viewer.colors, "CameraLight")
        .onChange(function (value) {
          Viewer.cameraLight.color = new THREE.Color(value);
        })
        .listen();
      lightFolderCamera
        .add(Viewer.intensity, "startIntensityCamera", 0, 10)
        .onChange(function (value) {
          Viewer.cameraLight.intensity = value;
        })
        .listen();

      const backgroundFolder = Viewer.editorFolder.addFolder("Background Color").close();
      backgroundFolder
        .addColor(Viewer.colors, "BackgroundColor")
        .onChange(function (value) {
          changeBackground(
            Viewer.backgroundType["Background Type"],
            value,
            Viewer.colors["BackgroundColorOuter"]
          );
        })
        .listen();
      Viewer.backgroundOuterFolder = backgroundFolder
        .addColor(Viewer.colors, "BackgroundColorOuter")
        .onChange(function (value) {
          changeBackground(
            Viewer.backgroundType["Background Type"],
            Viewer.colors["BackgroundColor"],
            value
          );
        })
        .listen();
      backgroundFolder
        .add(Viewer.backgroundType, "Background Type", {
          Linear: "linear",
          Gradient: "gradient",
        })
        .onChange(function (value) {
          if (value == "linear") Viewer.backgroundOuterFolder.hide();
          else Viewer.backgroundOuterFolder.show();
          changeBackground(
            value,
            Viewer.colors["BackgroundColor"],
            Viewer.colors["BackgroundColorOuter"]
          );
        });

      Viewer.clippingFolder = Viewer.editorFolder.addFolder("Clipping Planes").close();
      setCore("clippingFolder", Viewer.clippingFolder);
      core.materialsFolder = Viewer.editorFolder.addFolder("Materials").close();
      setCore("materialsFolder", core.materialsFolder);

      if (!Viewer.isLightweight) {
        Viewer.propertiesFolder = Viewer.editorFolder.addFolder("Save properties").close();
        Viewer.propertiesFolder.add(Viewer.saveProperties, "Position");
        Viewer.propertiesFolder.add(Viewer.saveProperties, "Rotation");
        Viewer.propertiesFolder.add(Viewer.saveProperties, "Scale");
        Viewer.propertiesFolder.add(Viewer.saveProperties, "Camera");
        Viewer.propertiesFolder.add(Viewer.saveProperties, "DirectionalLight");
        Viewer.propertiesFolder.add(Viewer.saveProperties, "AmbientLight");
        Viewer.propertiesFolder.add(Viewer.saveProperties, "CameraLight");
        Viewer.propertiesFolder.add(Viewer.saveProperties, "BackgroundColor");
      }

      if (Viewer.editor && !Viewer.isLightweight) {
        Viewer.editorFolder.add(
          {
            ["Save"]() {

              var rotateMetadata = new THREE.Vector3(
                THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.x),
                THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.y),
                THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.z)
              );

              //Fetch data from original metadata file anyway before saving any changes
              if (Viewer.CONFIG.entity.proxyPath !== undefined) {
                Viewer.metadataUrl = getProxyPath(Viewer.metadataUrl);
              }

              (async () => {
                let fetchedMetadata = {};

                try {
                  if (Viewer?.metadataUrl) {
                    const response = await fetch(Viewer.metadataUrl, { cache: "no-cache" });

                    if (response.ok) {
                      fetchedMetadata = await response.json();
                    }
                  }
                } catch (err) {
                  console.warn("Metadata fetch failed, continuing with save", err);
                }

                // always run
                Viewer.originalMetadata = {
                  ...Viewer.originalMetadata,
                  ...fetchedMetadata
                };

                const newMetadata = Viewer.buildMetadata(Viewer, rotateMetadata);

                try {
                  const token = await fetch("/session/token").then(r => r.text());

                  await fetch(Viewer.CONFIG.mainUrl + "/api/editor/save-metadata", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                      "Content-Type": "application/json",
                      "X-CSRF-Token": token
                    },
                    body: JSON.stringify({
                      filename: core.fileObject.filename,
                      path:
                        Viewer.archiveType !== ""
                          ? core.fileObject.relativePath +
                            core.fileObject.basename +
                            Viewer.compressedFile
                          : core.fileObject.relativePath,
                      content: JSON.stringify(newMetadata, null, "\t")
                    })
                  });

                  showToast("Settings have been saved.");
                } catch (err) {
                  console.error(err);
                  showToast("Error saving settings");
                }
              })();
            }
          },
          "Save"
        );
        if (!Viewer.isLightweight) {
          Viewer.editorFolder.add(
            {
              ["Picking mode"]() {
                Viewer.EDITOR = !EDITOR;
                var _str;
                Viewer.EDITOR ? (_str = "enabled") : (_str = "disabled");
                showToast("Face picking is " + _str);
                if (!Viewer.EDITOR) {
                } else {
                  Viewer.RULER_MODE = false;
                }
              },
            },
            "Picking mode"
          );
        }
        Viewer.editorFolder.add(
          {
            ["Distance Measurement"]() {
              Viewer.RULER_MODE = !Viewer.RULER_MODE;
              var _str;
              Viewer.RULER_MODE ? (_str = "enabled") : (_str = "disabled");
              showToast("Distance measurement mode is " + _str);
              if (!RULER_MODE) {
                Viewer.ruler.forEach((r) => {
                  core.scene.remove(r);
                });
                Viewer.rulerObject = new THREE.Object3D();
                Viewer.ruler = [];
                Viewer.linePoints = [];
              } else {
                Viewer.EDITOR = false;
              }
            },
          },
          "Distance Measurement"
        );
        if (!Viewer.isLightweight) {
          Viewer.editorFolder.add(
            {
              ["Render preview"]() {
                Viewer.takeScreenshot();
              },
            },
            "Render preview"
          );
        }
        Viewer.editorFolder.add(
          {
            ["Reset camera position"]() {
              Viewer.resetCamera();
            },
          },
          "Reset camera position"
        );
      }
    },

  async init() {
    if (!Viewer.renderer) {
      Viewer.camera = new THREE.PerspectiveCamera(
        45,
        Viewer.CONFIG.viewer.canvasDimensions.x / Viewer.CONFIG.viewer.canvasDimensions.y,
        0.001,
        999000000
      );
      Viewer.camera.position.set(0, 0, 0);
      setCore('renderer', Viewer.renderer);
      setCore('camera', Viewer.camera);
      setCore('mainObject', Viewer.mainObject);

      Viewer.scene = new THREE.Scene();
      setCore('scene', Viewer.scene);
      setCore('activeScene', Viewer.activeScene);

      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
      hemiLight.position.set(0, 200, 0);
      core.scene.add(hemiLight);

      Viewer.ambientLight = new THREE.AmbientLight(0x404040); // soft white light
      core.scene.add(Viewer.ambientLight);

      setCore('ambientLight', Viewer.ambientLight);

      Viewer.dirLight = new THREE.DirectionalLight(0xffffff);
      Viewer.dirLight.position.set(0, 100, 50);
      Viewer.dirLight.castShadow = true;
      Viewer.dirLight.shadow.camera.top = 180;
      Viewer.dirLight.shadow.camera.bottom = -100;
      Viewer.dirLight.shadow.camera.left = -120;
      Viewer.dirLight.shadow.camera.right = 120;
      Viewer.dirLight.shadow.bias = -0.0001;
      Viewer.dirLight.shadow.mapSize.width = 1024 * 4;
      Viewer.dirLight.shadow.mapSize.height = 1024 * 4;
      core.scene.add(Viewer.dirLight);
      Viewer.lightObjects.push(Viewer.dirLight);
      setCore('dirLight', Viewer.dirLight);
      setCore('lightObjects', Viewer.lightObjects);

      Viewer.cameraLightTarget = new THREE.Object3D();
      Viewer.cameraLightTarget.position.set(
        Viewer.camera.position.x,
        Viewer.camera.position.y,
        Viewer.camera.position.z
      );
      core.scene.add(Viewer.cameraLightTarget);
      // Store in core
      setCore('cameraLightTarget', Viewer.cameraLightTarget);

      Viewer.cameraLight = new THREE.DirectionalLight(0xffffff);
      Viewer.cameraLight.position.set(core.camera.position);
      Viewer.cameraLight.castShadow = false;
      Viewer.cameraLight.intensity = 0.3;
      core.scene.add(Viewer.cameraLight);
      Viewer.cameraLight.target = Viewer.cameraLightTarget;
      Viewer.cameraLight.target.updateMatrixWorld();
      // Store in core
      setCore('cameraLight', Viewer.cameraLight);      

      core.renderer = new THREE.WebGLRenderer({
        antialias: true,
        logarithmicDepthBuffer: true,
        colorManagement: true,
        sortObjects: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
        alpha: true,
      });
      
      core.renderer.shadowMap.enabled = true;
      core.renderer.localClippingEnabled = true;
      core.renderer.physicallyCorrectLights = true; //can be considered as better looking
      core.renderer.autoClear = false;
      core.renderer.setClearColor(0x000000, 0.0);

      core.renderer.outputColorSpace = THREE.SRGBColorSpace;
      core.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      core.renderer.toneMappingExposure = 0.65;
      setCore('renderer', core.renderer);

      core.renderer.domElement.id = "MainCanvas";
      Viewer.mainCanvas = document.getElementById("MainCanvas") || core.renderer.domElement;

      if (window.__E2E__) {
        document.body.appendChild(core.renderer.domElement);
      }

      core.renderer.domElement.addEventListener("pointerdown", Viewer.onPointerDown);
      core.renderer.domElement.addEventListener("pointerup", Viewer.onPointerUp);
      core.renderer.domElement.addEventListener("pointermove", Viewer.onPointerMove);

      const devicePixelRatio = window.devicePixelRatio || 1;
      core.renderer.setSize(Viewer.CONFIG.viewer.canvasDimensions.x, Viewer.CONFIG.viewer.canvasDimensions.y);

      if (isE2E) {
        console.info('E2E MODE ENABLED');
        core.renderer.setPixelRatio(1);
        core.renderer.toneMappingExposure = 1;
        disablePostProcessing();
        window.viewer = {
          e2eMode: true,
          modelLoaded: false
        };
      } else {
            core.renderer.setPixelRatio(devicePixelRatio);
      }
      core.renderer.domElement.style.width = Viewer.CONFIG.viewer.canvasDimensions.x + "px";
      core.renderer.domElement.style.height = Viewer.CONFIG.viewer.canvasDimensions.y + "px";

      core.renderer.domElement.style.display = "block";
      core.container.appendChild(core.renderer.domElement);
      Viewer.mainCanvas.classList.add("mainCanvas");
      //Viewer.canvasText = document.createElement("div");
      //Viewer.canvasText.id = "metadata-container";
      //Viewer.canvasText.width = Viewer.CONFIG.viewer.canvasDimensions.x + "px";
      //Viewer.canvasText.height = Viewer.CONFIG.viewer.canvasDimensions.y + "px";

      Viewer.viewerWrapper = core.container.closest('.viewer-wrapper');

      if (!Viewer.viewerWrapper) {
        Viewer.viewerWrapper = core.container.parentElement;
        Viewer.viewerWrapper.classList.add('viewer-wrapper');
      }

      core.camera.aspect = Viewer.CONFIG.viewer.canvasDimensions.x / Viewer.CONFIG.viewer.canvasDimensions.y;
      core.camera.updateProjectionMatrix();

      setCore('mainCanvas', Viewer.mainCanvas);
      Viewer.fullscreenMode = document.createElement("div");
      Viewer.fullscreenMode.setAttribute("id", "fullscreenMode");
      const scriptUrl = document.currentScript?.src || import.meta.url;
      Viewer.DFG_ASSETS = scriptUrl.replace(/dfg_3dviewer-module\.js.*$/, 'assets/img/');

      Viewer.fullscreenMode.innerHTML = `<img src="${Viewer.DFG_ASSETS}fullscreen.png" alt="Fullscreen" width=25 height=25 title="Fullscreen mode"/>`;
      Viewer.fullscreenMode.setAttribute(
        "style",
        "top:" +
        (Viewer.bottomLineGUI + 18) +
        "px; left: " +
        (Viewer.CONFIG.viewer.canvasDimensions.x - 40) +
        "px"
      );
      core.container.appendChild(Viewer.fullscreenMode);
      document.getElementById("fullscreenMode").addEventListener("click", Viewer.toggleFullscreen, false);

      Viewer.downloadModel = document.createElement("div");
      setCore('downloadModel', Viewer.downloadModel);

      Viewer.handHint.innerHTML = `<img src="${Viewer.DFG_ASSETS}hand-hint.png" alt="Fullscreen" width=48 height=48 title="Hand hint animation"/>`;
      
      Viewer.rect = core.container.getBoundingClientRect();
      Viewer.guiContainer.style.maxHeight = `${Viewer.rect.height - 20}px`;
      Viewer.lilGui = document.getElementsByClassName("lil-gui root");
      setCore('lilGui', Viewer.lilGui);
      setCore('gui', Viewer.gui);

      Viewer.fileElement = document.getElementsByClassName("field--type-file");
      if (Viewer.fileElement.length > 0) {
        Viewer.fileElement[0].style.height = Viewer.CONFIG.viewer.canvasDimensions.y * 1.1 + "px";
      }

      if (
        !Viewer.isLightweight || 
        Viewer.CONFIG.viewer.gallery?.build === true
      ) {
        Viewer.buildGallery();
      }

      Viewer.controls = new OrbitControls(core.camera, core.renderer.domElement);
      Viewer.controls.target.set(0, 100, 0);
      Viewer.controls.enableDamping = true;
      Viewer.controls.dampingFactor = 0.05;
      Viewer.controls.enableRotate = true;
      Viewer.controls.update();
      setCore('controls', Viewer.controls);
      setCore('GESTURE', Viewer.GESTURE);
      setCore('lastTime', Viewer.lastTime);
      //Viewer.changeScale();
      setCore('helperObjects', Viewer.helperObjects);

      Viewer.transformControl = new TransformControls(core.camera, core.renderer.domElement);
      Viewer.transformControl.rotationSnap = THREE.MathUtils.degToRad(5);
      Viewer.transformControl.space = "local";
      Viewer.transformControl.addEventListener("change", Viewer.render);
      Viewer.transformControl.addEventListener("objectChange", Viewer.changeScale);
      Viewer.transformControl.addEventListener("mouseUp", Viewer.calculateObjectScale);
      Viewer.transformControl.addEventListener("dragging-changed", function (event) {
        core.controls.enabled = !event.value;
      });
      core.scene.add(Viewer.transformControl.getHelper());
      setCore('transformControl', Viewer.transformControl);

      Viewer.transformControlLight = new TransformControls(core.camera, core.renderer.domElement);
      Viewer.transformControlLight.space = "local";
      Viewer.transformControlLight.addEventListener("change", Viewer.render);
      //Viewer.transformControlLight.addEventListener('objectChange', changeLightRotation);
      Viewer.transformControlLight.addEventListener(
        "dragging-changed",
        function (event) {
          core.controls.enabled = !event.value;
        }
      );
      core.scene.add(Viewer.transformControlLight.getHelper());
      setCore('transformControlLight', Viewer.transformControlLight);

      Viewer.transformControlLightTarget = new TransformControls(
        core.camera,
        core.renderer.domElement
      );
      Viewer.transformControlLightTarget.space = "global";
      Viewer.transformControlLightTarget.addEventListener("change", Viewer.render);
      Viewer.transformControlLightTarget.addEventListener(
        "objectChange",
        Viewer.changeLightRotation
      );
      Viewer.transformControlLightTarget.addEventListener(
        "dragging-changed",
        function (event) {
          core.controls.enabled = !event.value;
        }
      );
      core.scene.add(Viewer.transformControlLightTarget.getHelper());
      setCore('transformControlLightTarget', Viewer.transformControlLightTarget);

      Viewer.transformControlClippingPlaneX = Viewer.createClippingPlaneAxis(0, "x");
      Viewer.transformControlClippingPlaneY = Viewer.createClippingPlaneAxis(1, "y");
      Viewer.transformControlClippingPlaneZ = Viewer.createClippingPlaneAxis(2, "z");
      setCore('transformControlClippingPlaneX', Viewer.transformControlClippingPlaneX);
      setCore('transformControlClippingPlaneY', Viewer.transformControlClippingPlaneY);
      setCore('transformControlClippingPlaneZ', Viewer.transformControlClippingPlaneZ);

      setCore('clippingPlanes', Viewer.clippingPlanes);
      setCore('selectObjectHierarchy', this.selectObjectHierarchy);

      Viewer.transformControlClippingPlaneX.showX = Viewer.transformControlClippingPlaneX.showY = false;
      Viewer.transformControlClippingPlaneY.showX = Viewer.transformControlClippingPlaneY.showY = false;
      Viewer.transformControlClippingPlaneZ.showX = Viewer.transformControlClippingPlaneZ.showY = false;

      Viewer.GESTURE.handPx *= Math.min(window.innerWidth / 1200, 1);

      Viewer._ext = core.fileObject.extension.toLowerCase();
      if (
        Viewer._ext === "zip" ||
        Viewer._ext === "rar" ||
        Viewer._ext === "tar" ||
        Viewer._ext === "xz" ||
        Viewer._ext === "gz"
      ) {
        Viewer.archiveType = Viewer._ext;
      }

      core.autoPath = "";
          
      if (Viewer.CONFIG.entity.metadata.source === "" && !Viewer.isLightweight) {
        try {
          const response = await fetch('/api/editor/xml-export/' + Viewer.entityID, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/xml'
            },
            body: JSON.stringify({
              id: Viewer.entityID,
              domain: Viewer.CONFIG.metadataUrl
            })
          });

          if (!response.ok) {
            throw new Error(`XML export failed: ${response.status}`);
          }

          const xmlText = await response.text();

          const parser = new DOMParser();
          const doc = parser.parseFromString(xmlText, 'application/xml');

          core.autoPath = '';

          const nodes = doc.getElementsByTagName('*');
          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (
              node.tagName?.includes('converted_file') &&
              node.textContent
            ) {
              core.autoPath = node.textContent;
              break;
            }
          }
          await Viewer.mainLoadModelWrapper();
        } catch (err) {
          console.error('Metadata load error:', err);
        }
      } else if (Viewer.CONFIG.entity.metadata.source.toLowerCase().substring(0, 4) === "iiif") {
          const formContainer = document.createElement("div");
          formContainer.id = "form-IIIF";

          /* header */
          const header = document.createElement("div");
          header.className = "form-IIIF-header";
          header.innerHTML = `
            <span class="title">IIIF Loader</span>
            <div class="tools">
              <button type="button" id="iiif-toggle-theme" title="Toggle dark mode">🌙</button>
              <button type="button" id="iiif-toggle-collapse" title="Collapse">▾</button>
            </div>
          `;

          formContainer.appendChild(header);

          /* content */
          const content = document.createElement("div");
          content.className = "form-IIIF-content";
          content.id = "form-IIIF-content";
          content.innerHTML = `
            <div class="form-IIIF-group">
              <input type="text" id="manifest-url" placeholder="https://example.org/iiif/manifest.json">
              <button class="primary" id="load-manifest-from-url">Load from URL</button>
            </div>

            <div class="form-IIIF-group column">
              <textarea id="manifest-text" rows="8" placeholder="Paste IIIF manifest JSON here…"></textarea>
              <div class="actions">
                <button class="secondary" id="load-manifest-from-text">Load from Text</button>
              </div>
            </div>
          `;

          formContainer.appendChild(content);

          document.body.appendChild(formContainer);

        async function setupIIIF(newUrlOrJson, type="url") {
          if (type === "text") {
            Viewer.iiifConfigURL.url = "";
          } else {
            Viewer.iiifConfigURL.url = newUrlOrJson;
          }
          const loadedIIIF = await loadIIIFManifest(newUrlOrJson);
          if (loadedIIIF.modelUrls.length === 0) { // no 3D model found, use example model
            loadedIIIF.modelUrls.push('https://raw.githubusercontent.com/IIIF/3d/main/assets/astronaut/astronaut.glb');
            showToast("No 3D model found in IIIF manifest, loading example model.");
          }
          // reset scene
          // detach first to avoid issues with transform controls
          if (core.transformControl?.object) {
            core.transformControl.detach();
          }
          core.axesHelper.visible = false;         

          // remove objects from scene
          core.mainObject.forEach((obj) => {
            core.scene.remove(obj);
          });

          // clear arrays
          core.mainObject.length = 0;
          core.helperObjects.length = 0;
          console.log("TOTAL Annotations: " + loadedIIIF.annotations.length);
          if (loadedIIIF.annotations.length !== loadedIIIF.modelUrls.length) {
            //console.warn("Number of annotations does not match number of model URLs, adding testing model...");
              const diff = loadedIIIF.annotations.length - loadedIIIF.modelUrls.length;
              if (diff > 0) {
                // Need more model URLs → push empty strings (or null)
                for (let i = 0; i < diff; i++) {
                  loadedIIIF.modelUrls.push(Viewer.testModelURL);
                  core.objectsConfig.models.push({name: "Test Model", url: Viewer.testModelURL});
                }
              }
          }
          for (const [i, url] of loadedIIIF.modelUrls?.entries()) {
            core.objectsConfig.index = i;
            core.fileObject.originalPath = loadedIIIF.modelUrl = url;
            //fileObject.originalPath = loadedIIIF.modelUrl;
            Viewer.setModelPaths();
            await getAnnotations(loadedIIIF, core.objectsConfig);
            if (loadedIIIF.scenes && loadedIIIF.scenes.length > 0) {
              core.objectsConfig.scenes = loadedIIIF.scenes;
            }
            Viewer._ext = core.fileObject.extension.toLowerCase();
            await Viewer.mainLoadModel();
          }
        }

        function isUrlFlexible(string) {
          try {
            new URL(string);
            return true;
          } catch {
            return /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i.test(string);
          }
        }

        function isValidJsonObject(text) {
          try {
            const parsed = JSON.parse(text);
            return typeof parsed === 'object' && parsed !== null;
          } catch {
            return false;
          }
        }

        async function loadIIIFURL() {
          const form = document.getElementById("form-IIIF");
          const collapseBtn = document.getElementById("iiif-toggle-collapse");
          const themeBtn = document.getElementById("iiif-toggle-theme");
          const STORAGE_KEY = "iiif-dark-mode";

          // restore
          if (localStorage.getItem(STORAGE_KEY) === "1") {
            form.classList.add("dark");
            themeBtn.textContent = "☀️";
          }

          themeBtn.addEventListener("click", () => {
            const isDark = form.classList.toggle("dark");
            themeBtn.textContent = isDark ? "☀️" : "🌙";
            localStorage.setItem(STORAGE_KEY, isDark ? "1" : "0");
          });

          collapseBtn.addEventListener("click", () => {
            form.classList.toggle("collapsed");
            collapseBtn.textContent = form.classList.contains("collapsed") ? "▸" : "▾";
          });
          // create a small dropdown to switch iiif manifests at runtime
          document.getElementById("iiif-manifest-select").addEventListener("change", async (ev) => {
            try {
              if (ev.target.value !== Viewer.iiifConfigURL.url) {
                core.objectsConfig.setupIndex = 0;
                await setupIIIF(ev.target.value, "url");
              }
            } catch (err) {
              console.error(err);
              showToast("Error loading IIIF manifest: " + (err.message || err));
            }
            });

          document.getElementById("load-manifest-from-url").addEventListener("click", async (ev) => {
            try {
              const inputElement = document.getElementById("manifest-url");
              if (inputElement.value === "" || !isUrlFlexible(inputElement.value)) {
                inputElement.style.border = "2px solid red";
                showToast("Please enter a valid IIIF manifest URL.");
                return;
              } else {
                inputElement.style.border = "2px solid green";
                core.objectsConfig.setupIndex = 0;
                console.log("Loading IIIF manifest from URL: " + inputElement.value);
                await setupIIIF(inputElement.value, "url");
              }
            } catch (err) {
              console.error(err);
              showToast("Error loading IIIF manifest: " + (err.message || err));
            }
            });

          document.getElementById("load-manifest-from-text").addEventListener("click", async (ev) => {
            try {
              const inputElement = document.getElementById("manifest-text");
              if (inputElement.value === "" || !isValidJsonObject(inputElement.value)) {
                inputElement.style.border = "2px solid red";
                showToast("Please enter a valid IIIF JSON text.");
                return;
              } else {
                inputElement.style.border = "2px solid green";
                core.objectsConfig.setupIndex = 0;
                console.log("Loading IIIF manifest from privided text");
                await setupIIIF(inputElement.value, "text");
              }
            } catch (err) {
              console.error(err);
              showToast("Error loading IIIF manifest: " + (err.message || err));
            }
            });

        }      
        console.log("Loading from source: " + Viewer.CONFIG.entity.metadata.source);
        switch(Viewer.CONFIG.entity.metadata.source.substring(0, 4).toLowerCase()) {
          case "iiif":
            if (Viewer.iiifConfigURL.url !== "") {
              createIIIFDropdown(core.container, Viewer.iiifConfigURL, Viewer.CONFIG.viewer.canvasDimensions);
              await loadIIIFURL();
              Viewer.CONFIG.entity.metadata.source = "IIIF";
              await setupIIIF(Viewer.iiifConfigURL.url);
            }
            break;
          case "file": //TODO: add more sources
            break;
        }
      } else {
      // statements to handle any exceptions
    }


      core.renderer.setPixelRatio(devicePixelRatio);
      const update = () => Viewer.updateSize();

      window.addEventListener('resize', update);

      Viewer.resizeObserver = new ResizeObserver(update);
      Viewer.resizeObserver.observe(Viewer.viewerWrapper);


      document.addEventListener('fullscreenchange', Viewer.onFullscreenChange);

      window.addEventListener('orientationchange', () =>
        setTimeout(update, 100)
      );
    }
  },
  render() {
    core.controls?.update();
    core.renderer?.render(core.scene, core.camera);
  }
  
};

export async function expectWebGL(page) {
  const hasWebGL = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;
    const gl =
      canvas.getContext('webgl') ||
      canvas.getContext('webgl2');
    return !!gl;
  });

  if (!hasWebGL) {
    throw new Error('WebGL context not available');
  }
}

(async () => {
  await Viewer.MainInit();
})();

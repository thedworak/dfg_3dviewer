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
const envSubDir = (typeof __ENV_SUBDIR__ !== 'undefined') ? __ENV_SUBDIR__ : "main";

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
  normalizeColor,
} from "./utils.js";

import { initClippingPlanes, reportViewerError, showToast, changeBackground } from './viewer-utils.js';

import { loadModel, outlineClipping, getModuleAssetBasePath } from "./loaders.js";
import { createIIIFDropdown, createIIIFUI } from "./metadata.js";
import { UltraLoader } from "./ultra-loader.js";
import { StatusPoller } from "./status-poller.js";

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
import { lv } from "./js/external_libs/spinner.js";

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
  metadataUrl: null,
  iiifConfigURL: {url: "https://raw.githubusercontent.com/IIIF/3d/main/manifests/4_transform_and_position/model_transform_scale_position.json", name: "Inbuilt"},
  testModelURL: 'https://raw.githubusercontent.com/IIIF/3d/main/assets/astronaut/astronaut.glb',
  clock: null,
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
  actionMenu: null,
  actionMenuToggle: null,
  actionMenuPanel: null,
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
  pickingMode: false,
  EDITOR: false,
  RULER_MODE: false,
  linePoints: [],
  gui: null,
  hierarchyFolder: null,
  GUILength: 35,
  zoomImage: 1,
  ZOOM_SPEED_IMAGE: 0.1,
  loadedFile: "",
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
  cleanupCallbacks: [],
  resizeObserver: null,

  getE2EModelOverride() {
    if (!window.__E2E__) return null;
    const model = new URLSearchParams(window.location.search).get('e2eModel');
    return model || null;
  },

  ensureE2EState() {
    if (!window.__E2E__) return null;

    if (!window.viewer || window.viewer.e2eMode !== true) {
      window.viewer = {
        e2eMode: true,
        modelLoaded: false,
        errors: [],
        toasts: [],

        get camera() {
          return core.camera;
        },

        get scene() {
          return core.scene;
        },
      };
    } else {
      window.viewer.errors ??= [];
      window.viewer.toasts ??= [];
    }

    return window.viewer;
  },

  recordE2EError(error) {
    if (!window.__E2E__) return;
    const state = this.ensureE2EState();
    const message = error instanceof Error ? error.message : String(error);
    state.errors.push(message);
  },

  addCleanup(callback) {
    if (typeof callback === "function") {
      this.cleanupCallbacks.push(callback);
    }
  },

  bindEventListener(target, type, handler, options) {
    if (!target || typeof target.addEventListener !== "function") return;
    target.addEventListener(type, handler, options);
    this.addCleanup(() => target.removeEventListener(type, handler, options));
  },

  closeActionMenu() {
    if (this.actionMenuToggle) {
      this.actionMenuToggle.checked = false;
    }
  },

  isEmbedMode() {
    const params = new URLSearchParams(window.location.search);
    const embedParam = params.get("embed");
    return window.location.pathname.endsWith("/embed.html") || embedParam === "1" || embedParam === "true";
  },

  getEmbedPageUrl() {
    const embedUrl = new URL("embed.html", import.meta.url);
    embedUrl.search = "";
    embedUrl.hash = "";
    return embedUrl;
  },

  getSharePayload() {
    const embedUrl = this.getEmbedPageUrl();
    const params = new URLSearchParams();
    const entityId = core.CONFIG?.entity?.id;
    const modelPath = core.fileObject?.originalPath || core.container?.getAttribute("3d") || "";

    if (entityId) {
      params.set("id", entityId);
    } else if (modelPath) {
      params.set("model", modelPath);
    }

    embedUrl.search = params.toString();

    return {
      url: embedUrl.toString(),
      code: `<iframe src="${embedUrl.toString()}" title="DFG 3D Viewer" loading="lazy" allow="fullscreen; xr-spatial-tracking" referrerpolicy="strict-origin-when-cross-origin" style="width:100%; aspect-ratio: 16 / 9; border: 0;"></iframe>`,
    };
  },

  async copyEmbedCode(event) {
    event?.preventDefault?.();
    Viewer.closeActionMenu();

    try {
      const { code } = Viewer.getSharePayload();

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const tempInput = document.createElement("textarea");
        tempInput.value = code;
        tempInput.setAttribute("readonly", "true");
        tempInput.style.position = "absolute";
        tempInput.style.left = "-9999px";
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        tempInput.remove();
      }

      showToast("Embed code copied to clipboard");
    } catch (error) {
      Viewer.reportError(error, { context: "Copy embed code failed" });
      showToast("Could not copy embed code");
    }
  },

  updateFullscreenButtonIcon() {
    if (!this.fullscreenMode) return;

    const isFullscreen = !!document.fullscreenElement;
    const icon = isFullscreen ? "exit-fullscreen.png" : "fullscreen.png";
    const label = isFullscreen ? "Exit fullscreen mode" : "Fullscreen mode";

    this.fullscreenMode.innerHTML = `
      <img src="${core.DFG_ASSETS}/img/${icon}" alt="${label}" width="20" height="20"/>
      <span>${isFullscreen ? "Exit fullscreen" : "Fullscreen"}</span>
    `;
    this.fullscreenMode.setAttribute("aria-label", label);
    this.fullscreenMode.setAttribute("title", label);
  },

  cleanupRuntimeBindings() {
    while (this.cleanupCallbacks.length > 0) {
      const callback = this.cleanupCallbacks.pop();
      try {
        callback();
      } catch (error) {
        console.warn("Viewer cleanup callback failed:", error);
      }
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  },

  cleanupTransientUI() {
    const iiifForm = document.getElementById("form-IIIF");
    if (iiifForm) {
      iiifForm.remove();
    }
  },

  reportError(error, options = {}) {
    return reportViewerError(error, {
      consoleLabel: "Viewer error:",
      ...options,
    });
  },

  disposeMaterial(material) {
    if (!material) return;

    const materials = Array.isArray(material) ? material : [material];

    materials.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;

      Object.values(entry).forEach((value) => {
        if (value && typeof value === "object" && value.isTexture === true) {
          value.dispose();
        }
      });

      entry.dispose?.();
    });
  },

  disposeObjectResources(object) {
    if (!object) return;

    const disposeNode = (node) => {
      if (!node || typeof node !== "object") return;
      node.geometry?.dispose?.();
      Viewer.disposeMaterial(node.material);
    };

    if (Array.isArray(object)) {
      object.forEach((entry) => Viewer.disposeObjectResources(entry));
      return;
    }

    object.traverse?.((child) => disposeNode(child));
  },

  removeAndDisposeFromScene(object) {
    if (!object) return;

    if (Array.isArray(object)) {
      object.forEach((entry) => Viewer.removeAndDisposeFromScene(entry));
      return;
    }

    if (object.parent) {
      object.parent.remove(object);
    } else {
      core.scene?.remove?.(object);
    }

    Viewer.disposeObjectResources(object);
  },

  resetLoadedModelState() {
    core.transformControl?.detach?.();
    core.transformControlLight?.detach?.();
    core.transformControlLightTarget?.detach?.();

    if (core.outlineClipping) {
      Viewer.removeAndDisposeFromScene(core.outlineClipping);
      core.outlineClipping = null;
      setCore('outlineClipping', null);
    }

    if (Viewer.textMesh) {
      Viewer.removeAndDisposeFromScene(Viewer.textMesh);
      Viewer.textMesh = null;
    }

    if (Viewer.ruler?.length) {
      Viewer.ruler.forEach((item) => Viewer.removeAndDisposeFromScene(item));
    }
    Viewer.ruler = [];
    Viewer.rulerObject = null;
    Viewer.textMeshDistance = null;

    if (core.mainObject?.length) {
      core.mainObject.forEach((obj) => Viewer.removeAndDisposeFromScene(obj));
      core.mainObject.length = 0;
    }

    if (Array.isArray(core.helperObjects)) core.helperObjects.length = 0;
    if (Array.isArray(core.selectedObjects)) core.selectedObjects.length = 0;
    if (Array.isArray(Viewer.helperObjects)) Viewer.helperObjects.length = 0;
    if (Array.isArray(Viewer.selectedObjects)) Viewer.selectedObjects.length = 0;
    if (Array.isArray(Viewer.selectedFaces)) Viewer.selectedFaces.length = 0;
    Viewer.lastPickedFace = { id: "", color: "", object: "" };
  },

  renderFatalError(error) {
    const message = this.reportError(error, {
      context: "Viewer initialization failed",
      toast: false,
      consoleLabel: "Viewer initialization error:",
    });
    const container =
      this.container ||
      document.getElementById(core.CONFIG?.viewer?.container || "DFG_3DViewer") ||
      document.body;

    if (!container) return;

    let errorBox = document.getElementById("viewer-fatal-error");
    if (!errorBox) {
      errorBox = document.createElement("div");
      errorBox.id = "viewer-fatal-error";
      errorBox.style.padding = "16px";
      errorBox.style.margin = "12px 0";
      errorBox.style.border = "1px solid #b91c1c";
      errorBox.style.background = "#fef2f2";
      errorBox.style.color = "#7f1d1d";
      errorBox.style.fontFamily = "sans-serif";
      container.prepend(errorBox);
    }

    errorBox.textContent = message;
  },

  async MainInit() {
    if (window.__E2E__) {
      this.ensureE2EState();
    }

    this.cleanupRuntimeBindings();
    this.cleanupTransientUI();
    this.resetLoadedModelState();

    await new Promise(r => {
      if (document.readyState !== 'loading') r();
      else document.addEventListener('DOMContentLoaded', r);
    });
    const url = new URL('./viewer-settings.json', import.meta.url);

    //Setup core variables first to make them available in the loaders and utils
    setCore('viewEntity', this.viewEntity);
    setCore('CONFIG', this.CONFIG);
    setCore('loadedFile', this.loadedFile);
    setCore('stats', this.stats);
    setCore('guiContainer', this.guiContainer);
    setCore('lilGui', this.lilGui);
    setCore('gui', this.gui);

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    core.CONFIG = await res.json();
    console.log("Loaded viewer-settings.json", core.CONFIG.viewer);

    if (Object.keys(core.CONFIG).length === 0) {
      core.CONFIG = {
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
          editor: true,
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

    this.isLightweight = Boolean(core.CONFIG.viewer.lightweight);
    setCore('isLightweight', this.isLightweight);
    console.log(`AIM 3D-Viewer ${this.isLightweight ? '🪶 LIGHTWEIGHT' : '💪 FULL'} mode`);
    console.log(`Powered by Three.js (v${THREE.REVISION})`);

    this.EDITOR = Boolean(core.CONFIG.viewer.editor);
    setCore('EDITOR', this.EDITOR);
    
    if (!core.CONFIG.entity.metadata.sourceType) { 
      core.CONFIG.entity.metadata.sourceType = SOURCE;
      console.log(`Metadata source: ${core.CONFIG.entity.metadata.sourceType}`);
    }

    this.container = document.getElementById(core.CONFIG.viewer.container);
    if (!this.container) throw new Error("Container not found");
    setCore('container', this.container);
    document.body.classList.toggle("viewer-embed-page", this.isEmbedMode());

    const urlParams = new URLSearchParams(window.location.search);
    const modelFromQuery = urlParams.get("model");
    if (modelFromQuery) {
      this.container.setAttribute("3d", modelFromQuery);
    }

    this.scrollTop = window.scrollY || document.documentElement.scrollTop;
    this.rect = core.container.getBoundingClientRect();
    const e2eModel = this.getE2EModelOverride();
    if (e2eModel) {
      core.container.setAttribute("3d", e2eModel);
    }

    this.fileObject.originalPath = core.container.getAttribute("3d");
    setCore('fileObject', this.fileObject)
    core.CONFIG.viewer.canvasDimensions = {
      x: this.rect.width * Number(core.CONFIG.viewer.scaleContainer.x),
      y: this.rect.height * Number(core.CONFIG.viewer.scaleContainer.y),
    };
    this.bottomLineGUI = core.CONFIG.viewer.canvasDimensions.y - 85;
    setCore('bottomLineGUI', this.bottomLineGUI);

    if (core.isLightweight) {
      core.CONFIG.viewer.lightweight = core.container.getAttribute("proxy");
    }
    var elementsURL = window.location.pathname;
    elementsURL = elementsURL.match(core.CONFIG.entity.idUri);
    if (elementsURL !== null) {
      core.CONFIG.entity.id = elementsURL[1];
    } else {
      // Fallback: check for ?id= parameter
      const idFromQuery = urlParams.get('id');
      if (idFromQuery) {
        core.CONFIG.entity.id = idFromQuery;
      }
    }
    if (core.CONFIG.entity.id) {
      core.container.setAttribute(core.CONFIG.entity.attributeId, core.CONFIG.entity.id);
      console.log("Entity ID:", core.CONFIG.entity.id);
    }
    // Initialize clipping planes at startup
    this.core = initClippingPlanes();
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
      core.CONFIG.baseModulePath = core.container.getAttribute("basePath");
    }

    this.setModelPaths();

    core.CONFIG.viewer.exportPath = "/api/editor/xml-export/";    
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
    this.spinnerElement.setAttribute("data-label", "Loading 3D model...");
    this.spinnerElement.setAttribute("data-percentage", "true");
    this.spinnerContainer.appendChild(this.spinnerElement);
    core.container.appendChild(this.spinnerContainer);
    this.spinnerContainer.style.left = `calc(50% - ${this.spinnerContainer.getBoundingClientRect().width / 2}px)`;

    this.rect = core.container.getBoundingClientRect();

    core.guiContainer = document.createElement("div");
    core.guiContainer.id = "guiContainer";
    core.guiContainer.className = "guiContainer";
    core.container.appendChild(core.guiContainer);

    core.gui  = new GUI({ container: core.guiContainer });

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
    /*if (core.CONFIG.entity?.metadata?.source != null) {
      await Viewer.mainLoadModel();
    }*/
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
    core.fileObject.uri = core.fileObject.path.replace(core.CONFIG.mainUrl + "/", "");
    core.fileObject.relativePath = Viewer.normalizeDrupalFilesPath(core.fileObject.uri);
  },

  // Disable interaction hint on first interaction
 disableInteractionHint() {
    Viewer.handHint.hidden = true;
    Viewer.stopGesture();

    // Stop any running camera tweens when user interacts
    if (core.cameraTween && typeof core.cameraTween.stop === "function") {
      core.cameraTween.stop();
      core.cameraTween = null;
    }
    if (core.targetTween && typeof core.targetTween.stop === "function") {
      core.targetTween.stop();
      core.targetTween = null;
    }

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
    var materials = [
      new THREE.MeshStandardMaterial({
        color: 0x0000ff,
        flatShading: true,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.8,
      }), // front
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        flatShading: true,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.5,
      }), // side
    ];
    const loader = new FontLoader();
    const bevelSize = _scale / 10;
    loader.load(
      `${core.DFG_ASSETS}/fonts/helvetiker_regular.typeface.json`,
      function (font) {
        const textGeo = new TextGeometry(_text, {
          font: font,
          size: _scale * 3,
          height: _scale,
          curveSegments: 4,
          bevelEnabled: true,
          bevelThickness: bevelSize,
          bevelSize: bevelSize/10,
          bevelOffset: 0,
          bevelSegments: 1,
          depth: _scale/10,
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
      const selectedColor = Viewer.toThreeColor("0x00FF00");
      if (selectedColor) {
        tempMaterial.color = selectedColor;
      }
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
      if (!(_image instanceof Element)) return false;
      let rawUrl = "";
      const img = _image.querySelector("img");
      const link = _image.querySelector("a");
      if (img && img.getAttribute("src")) {
        rawUrl = img.getAttribute("src");
      } else if (link && link.getAttribute("href")) {
        rawUrl = link.getAttribute("href");
      } else {
        rawUrl = (_image.textContent || _image.innerHTML || "").trim();
      }

      const normalized = Viewer.normalizeGalleryUrl(rawUrl);
      if (!isValidUrl(normalized)) {
        return false;
      }
      _image.innerHTML = normalized;
      return !!img;
    });
    imageElementsChildren.forEach(function (imgLink, index) {
      imgLink.innerHTML =
        '<img loading="lazy" src="' +
        imgLink.innerHTML +
        '" width="200px" height="200px" alt="" class="img-fluid image-style-wisski-preview">';
    });
    return imageElementsChildren;
  },

  normalizeGalleryUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") {
      return "";
    }

    let url = rawUrl.trim();
    if (url === "") {
      return "";
    }

    if (url.startsWith("public://")) {
      url = "/sites/default/files/" + url.substring("public://".length);
    } else if (url.startsWith("sites/default/files/")) {
      url = "/" + url;
    }

    const base = (core.CONFIG?.mainUrl || window.location.origin || "").replace(/\/+$/, "");

    try {
      const parsed = new URL(url, window.location.origin);
      const host = parsed.host || "";
      const path = parsed.pathname || "";

      if (path.startsWith("/sites/default/files/")) {
        if (host.includes("_")) {
          return `${base}${path}`;
        }
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return parsed.href;
        }
        return `${base}${path}`;
      }
      return parsed.href;
    } catch (e) {
      if (url.startsWith("/sites/default/files/")) {
        return `${base}${url}`;
      }
      return url;
    }
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
    modalImage.style.transform = `scale(0.95)`;
    Viewer.bindEventListener(modalGallery, "wheel", function (e) {
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

    Viewer.bindEventListener(document, "click", function (event) {
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
      var mainElement = document.getElementById(core.CONFIG.viewer.gallery.container);
      var imageElements;
      if (core.CONFIG.viewer.gallery.imageClass !== "") {
        imageElements = document.getElementsByClassName(
          core.CONFIG.viewer.gallery.imageClass
        );
        if (imageElements.length > 0) {
          var galleryLabel = document.getElementsByClassName("field__label");
          if (galleryLabel !== undefined) galleryLabel[0].innerText = "";
        }
      } else if (core.CONFIG.viewer.gallery.imageId !== "") {
        imageElements = document.getElementById(core.CONFIG.viewer.gallery.imageId);
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
            imagesList = Viewer.prepareGalleryImages(imagesList);
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
            imagesList = Viewer.prepareGalleryImages(imagesList);
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

  toHexColor(input) {
    if (!input) return null;

    // THREE.Color
    if (typeof input.getHex === "function") {
      return input.getHex();
    }

    // hex number
    if (typeof input === "number") {
      return input >>> 0;
    }

    // hex string: "#ff00aa" / "ff00aa"
    if (typeof input === "string") {
      const s = input.replace("#", "");
      if (/^[0-9a-fA-F]{6}$/.test(s)) return parseInt(s, 16);
      return null;
    }

    // array [r,g,b] / [r,g,b,a]
    if (Array.isArray(input)) {
      const [r, g, b] = input;
      if ([r, g, b].every(v => typeof v === "number")) {
        const rr = r <= 1 ? Math.round(r * 255) : r;
        const gg = g <= 1 ? Math.round(g * 255) : g;
        const bb = b <= 1 ? Math.round(b * 255) : b;
        return ((rr & 255) << 16) | ((gg & 255) << 8) | (bb & 255);
      }
      return null;
    }

    // object { r, g, b, a? }
    if (typeof input === "object" && "r" in input && "g" in input && "b" in input) {
      const rr = input.r <= 1 ? Math.round(input.r * 255) : input.r;
      const gg = input.g <= 1 ? Math.round(input.g * 255) : input.g;
      const bb = input.b <= 1 ? Math.round(input.b * 255) : input.b;
      return ((rr & 255) << 16) | ((gg & 255) << 8) | (bb & 255);
    }

    return null;
  },

  toThreeColor(input) {
    const normalized = normalizeColor(input);
    if (!normalized) return null;
    return new THREE.Color(
      normalized.r / 255,
      normalized.g / 255,
      normalized.b / 255
    );
  },

  pickFaces(_id) {
    let mat, colorHex;
    if ((Viewer.lastPickedFace.id == "" && _id !== "") || _id != Viewer.lastPickedFace.id) {
      mat = Array.isArray(_id?.object?.material) ? _id.object.material[0] : _id?.object?.material;
      colorHex = Viewer.toHexColor(mat?.color);
    }
    if (Viewer.lastPickedFace.id == "" && _id !== "") {
      Viewer.lastPickedFace = {
        id: _id,
        color: colorHex,
        object: _id.object.id,
      };
    } else if (_id == "" && Viewer.lastPickedFace.id !== "") {
      const previousColor = Viewer.toThreeColor(Viewer.lastPickedFace.color);
      core.scene
        .getObjectById(Viewer.lastPickedFace.object)
        .material.color = previousColor ?? core.scene.getObjectById(Viewer.lastPickedFace.object).material.color;
      Viewer.lastPickedFace = { id: "", color: "", object: "" };
    } else if (_id != Viewer.lastPickedFace.id) {
      const previousColor = Viewer.toThreeColor(Viewer.lastPickedFace.color);
      core.scene
        .getObjectById(Viewer.lastPickedFace.object)
        .material.color = previousColor ?? core.scene.getObjectById(Viewer.lastPickedFace.object).material.color;
      Viewer.lastPickedFace = {
        id: _id,
        color: colorHex,
        object: _id.object.id,
      };
    }
    if (_id !== "") {
      const pickedColor = Viewer.toThreeColor(0xff0000);
      if (pickedColor) _id.object.material.color = pickedColor;
    }
  },

  buildRuler(_id) {
    Viewer.rulerObject = new THREE.Object3D();
    const gridSize = Viewer.gridSize || core.gridSize || 1;
    const sphereRadius = Math.max(gridSize / 150, 0.001);
    const textScale = Math.max(gridSize / 100, 0.01);
    const measureSize = Math.max(gridSize / 200, 0.01);

    var sphere = new THREE.Mesh(
      new THREE.SphereGeometry(sphereRadius, 7, 7),
      new THREE.MeshStandardMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      })
    );
    var newPoint = new THREE.Vector3(_id.point.x, _id.point.y, _id.point.z);
    sphere.position.set(newPoint.x, newPoint.y, newPoint.z);
    Viewer.rulerObject.add(sphere);
    Viewer.linePoints.push(newPoint);
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(Viewer.linePoints);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    Viewer.rulerObject.add(line);
    var lineMtr = new THREE.LineBasicMaterial({
      color: 0x0000ff,
      linewidth: 3,
      opacity: 1,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    if (Viewer.linePoints.length > 1) {
      var vectorPoints = vectorBetweenPoints(
        Viewer.linePoints[Viewer.linePoints.length - 2],
        newPoint
      );
      var distancePoints = distanceBetweenPointsVector(vectorPoints);

      //var distancePoints = distanceBetweenPoints(Viewer.linePoints[Viewer.linePoints.length-2], newPoint);
      var halfwayPoints = halfwayBetweenPoints(
        Viewer.linePoints[Viewer.linePoints.length - 2],
        newPoint
      );
      Viewer.addTextPoint(distancePoints.toFixed(2), textScale, halfwayPoints);
      var rulerI = 0;
      // `measureSize` was already precomputed outside, keep same scale
      while (rulerI <= distancePoints * 100) {
        const geoSegm = [];
        var interpolatePoints = interpolateDistanceBetweenPoints(
          Viewer.linePoints[Viewer.linePoints.length - 2],
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
        Viewer.rulerObject.add(lineSegm);
        rulerI += 10;
      }
    }
    Viewer.rulerObject.renderOrder = 10;
    core.scene.add(Viewer.rulerObject);
    Viewer.ruler.push(Viewer.rulerObject);
  },


  updateSize() {
    const isFullscreen = !!document.fullscreenElement;
    Viewer.FULLSCREEN = isFullscreen;

    if (!Viewer.mainCanvas || !Viewer.fullscreenMode || !core.guiContainer) {
      return;
    }

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
    } else {
      scale = {x: Number(core.CONFIG.viewer.scaleContainer?.x || 1), y: Number(core.CONFIG.viewer.scaleContainer?.y || 1)};
      const wrapper = Viewer.viewerWrapper || core.container;
      if (!wrapper) {
        return;
      }
      rect = wrapper.getBoundingClientRect();
      widthCSS = (rect.width * scale.x) || 800;
      heightCSS = (rect.height * scale.y) || 600;

      widthDev = widthCSS * devicePixelRatio;
      heightDev = heightCSS * devicePixelRatio;
      Viewer.mainCanvas.style.width = widthCSS + 'px';
      Viewer.mainCanvas.style.height = heightCSS + 'px';

      core.metadataContainer.style.width = '100%';
      core.metadataContainer.style.height = '100%';

      if (Viewer.fileElement && Viewer.fileElement.length > 0) {
        Viewer.fileElement[0].style.height = (heightCSS * 1.1) + 'px';
      }
    }

    core.guiContainer.style.left = (widthCSS - core.lilGui[0]?.getBoundingClientRect().width) + 'px';

    Viewer.mainCanvas.width = widthDev;
    Viewer.mainCanvas.height = heightDev;

    if (Viewer.actionMenu) {
      const menuMargin = 16;
      const toggleSize = Viewer.actionMenu.querySelector(".viewer-action-menu__toggle")?.getBoundingClientRect().height || 45;
      Viewer.actionMenu.style.top = (heightCSS - toggleSize - menuMargin) + "px";
      Viewer.actionMenu.style.right = menuMargin + "px";
      Viewer.actionMenu.style.bottom = "auto";
    }

    core.handHint.style.top = (heightCSS - 70) + 'px';
   
    core.renderer.setPixelRatio(devicePixelRatio * scale.x);
    core.renderer.setSize(widthCSS*scale.x, heightCSS*scale.y, false);
    core.camera.aspect = widthCSS / heightCSS;
    core.camera.updateProjectionMatrix();
    core.controls?.update();
    core.CONFIG.viewer.canvasDimensions = { x: widthCSS, y: heightCSS };
  },

    // Three.js renderer needs actual pixel size

  async toggleFullscreen() {
    Viewer.closeActionMenu();
    try {
      if (!document.fullscreenElement) {
        await core.container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      Viewer.reportError(err, {
        context: "Fullscreen error",
        toast: false,
        e2e: false,
      });
    }
  },

  onFullscreenChange () {
    Viewer.updateFullscreenButtonIcon();
    Viewer.closeActionMenu();

    // Layout (ESC + click)
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
    core.handHint.hidden = true;
    core.GESTURE.active = false;
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

    if (core.handHint?.hidden && !core.GESTURE?.active) {
      core.cameraTween?.update(time);
      core.targetTween?.update(time);
    }

    if (!core.GESTURE?.active) {
      core.controls?.update();
    }

    if (Viewer.textMesh !== null) {
      Viewer.textMesh.lookAt(core.camera.position);
    }

    core.renderer.clear();
    core.renderer.render(core.scene, core.camera);
    core.stats.update();
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

        if (Viewer.pickingMode || Viewer.RULER_MODE) {
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
            if (Viewer.RULER_MODE) Viewer.buildRuler(intersects[0]);
            else if (Viewer.pickingMode) Viewer.pickFaces(intersects[0]);
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
      if (Viewer.pickingMode) {
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
          Viewer.pickFaces(intersects[0]);
        } else {
          Viewer.pickFaces("");
        }
      }
    }
  },

  onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  },

  async onDrop(e) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const supportedExtensions = ['obj', 'dae', 'fbx', 'ply', 'ifc', 'stl', 'xyz', 'json', '3ds', 'pcd', 'gltf', 'glb', 'zip', 'rar', 'tar', 'xz', 'gz'];
      const extension = file.name.split('.').pop().toLowerCase();
      
      if (supportedExtensions.includes(extension)) {
        // Clear existing model
        if (core.mainObject.length > 0) {
          core.mainObject.forEach(obj => {
            core.scene.remove(obj);
          });
          core.mainObject = [];
        }
        
        // Set up fileObject for the dropped file
        const url = URL.createObjectURL(file);
        core.fileObject.originalPath = url;
        core.fileObject.filename = url;  // Use URL as filename for blob
        core.fileObject.basename = file.name.substring(0, file.name.lastIndexOf('.'));
        core.fileObject.extension = extension;
        core.fileObject.path = '';  // No path for blob URLs
        core.fileObject.uri = url;
        core.fileObject.relativePath = url;
        
        Viewer._ext = extension;
        
        setCore('fileObject', core.fileObject);
        
        // Clear autoPath to prevent overriding with server URL
        core.autoPath = '';
        
        // Load the model
        await Viewer.mainLoadModel();
        
        showToast('Model loaded successfully', 'success');
      } else {
        showToast('Unsupported file format', 'error');
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
    Viewer.planeParams.planeX.constantZ = core.clippingFolder.controllers[1]._max = core.clippingPlanes[0].constant = _distance.x;
    core.clippingFolder.controllers[1]._min = -core.clippingFolder.controllers[1]._max;
    Viewer.planeParams.planeY.constantY = core.clippingFolder.controllers[3]._max = core.clippingPlanes[1].constant = _distance.y;
    core.clippingFolder.controllers[3]._min = -core.clippingFolder.controllers[3]._max;
    Viewer.planeParams.planeZ.constantZ = core.clippingFolder.controllers[5]._max = core.clippingPlanes[2].constant = _distance.z;
    core.clippingFolder.controllers[5]._min = -core.clippingFolder.controllers[5]._max;
    core.clippingFolder.controllers[1].updateDisplay();
    core.clippingFolder.controllers[3].updateDisplay();
    core.clippingFolder.controllers[5].updateDisplay();
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
      console.log("Uploading thumbnail for entity ID:", core.CONFIG.entity.id);
      fileform.append("wisski_individual", core.CONFIG.entity.id);
      fetch(core.CONFIG.mainUrl + "/api/editor/upload-thumbnail", {
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
    core.camera.aspect = core.CONFIG.viewer.canvasDimensions.x / core.CONFIG.viewer.canvasDimensions.y;
    core.camera.updateProjectionMatrix();
    core.renderer.setSize(core.CONFIG.viewer.canvasDimensions.x, core.CONFIG.viewer.canvasDimensions.y);
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
    console.log("Loading model:", core.fileObject.basename, ", with extension:", core.fileObject.extension);
    if (Viewer._ext === "glb" || Viewer._ext === "gltf") {
      await loadModel();
    } else if (
      Viewer._ext === "zip" ||
      Viewer._ext === "rar" ||
      Viewer._ext === "tar" ||
      Viewer._ext === "xz" ||
      Viewer._ext === "gz"
    ) {
      core.loadedFile = "_" + Viewer._ext.toUpperCase() + "/";
      core.fileObject.path = core.fileObject.path + core.fileObject.basename + core.loadedFile
      core.fileObject.extension = "glb";
      core.fileObject.newExtension = Viewer._ext;
      await loadModel();
    } else {
      //core.fileObject.extension = "glb";
      if (Viewer._ext === "glb") {
        await loadModel();
      }
      else await loadModel();
    }
  },

  createClippingPlaneAxis(_number) {
    var tempClippingControl = new TransformControls(core.camera, core.renderer.domElement);
    tempClippingControl.space = "local";
    tempClippingControl.setMode("translate");
    tempClippingControl.addEventListener("change", Viewer.render);
    tempClippingControl.addEventListener("objectChange", function (event) {
      if (event.target === undefined || event.target.object === undefined) {
        return;
      }
      let newConstant;
      switch (_number) {
        case 0:
          newConstant = event.target.worldPositionStart.x + event.target.pointEnd.x;
          core.clippingPlanes[_number].constant = newConstant;
          core.planeParams.planeX.constantX = newConstant;
          if (core.clippingFolder.controllers[1]) {
            core.clippingFolder.controllers[1].setValue(newConstant);
          }
          core.planeHelpers[0].position.copy(core.clippingPlanes[0].normal).multiplyScalar(newConstant);
          break;
        case 1:
          newConstant = event.target.worldPositionStart.y + event.target.pointEnd.y;
          core.clippingPlanes[_number].constant = newConstant;
          core.planeParams.planeY.constantY = newConstant;
          if (core.clippingFolder.controllers[3]) {
            core.clippingFolder.controllers[3].setValue(newConstant);
          }
          core.planeHelpers[1].position.copy(core.clippingPlanes[1].normal).multiplyScalar(newConstant);
          break;
        case 2:
          newConstant = event.target.worldPositionStart.z + event.target.pointEnd.z;
          core.clippingPlanes[_number].constant = newConstant;
          core.planeParams.planeZ.constantZ = newConstant;
          if (core.clippingFolder.controllers[5]) {
            core.clippingFolder.controllers[5].setValue(newConstant);
          }
          core.planeHelpers[2].position.copy(core.clippingPlanes[2].normal).multiplyScalar(newConstant);
          break;
      }
    });
    tempClippingControl.addEventListener("dragging-changed", function (event) {
      core.controls.enabled = !event.value;
    });
    return tempClippingControl;
  },

  resetCamera() {
    const targetCamera = core.cameraCoords || core.camera.position.clone();
    const targetControls =
      core.controlsTarget ||
      core.controls?.target?.clone() ||
      new THREE.Vector3();

    if (!targetCamera || typeof targetCamera.x !== 'number') {
      return;
    }

    const startCam = core.camera.position.clone();
    const startTarget = core.controls?.target?.clone() || new THREE.Vector3();

    core.cameraTween = new TWEEN.Tween(startCam)
      .to(targetCamera, 1500)
      .easing(TWEEN.Easing.Cubic.Out)
      .onUpdate(() => {
        core.camera.position.copy(startCam);
        core.cameraLight.position.copy(startCam);
        core.camera.updateProjectionMatrix();
      });

    core.targetTween = new TWEEN.Tween(startTarget)
      .to(targetControls, 1500)
      .easing(TWEEN.Easing.Cubic.Out)
      .onUpdate(() => {
        core.controls?.target.copy(startTarget);
        core.controls?.update();
      });

    core.cameraTween.onComplete(() => {
      core.camera.position.copy(targetCamera);
      core.cameraLight.position.copy(targetCamera);
      core.controls?.target.copy(targetControls);
      core.controls?.update();
      core.camera.updateProjectionMatrix();
    });

    core.cameraTween.start();
    core.targetTween.start();
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
    core.stats = new Stats();
    core.stats.domElement.style.cssText =
      "position:relative;top:0px;" +
      "max-height:120px;max-width:90px;z-index:2;visibility:hidden;";

    Viewer.windowHalfX = core.CONFIG.viewer.canvasDimensions.x / 2;
    Viewer.windowHalfY = core.CONFIG.viewer.canvasDimensions.y / 2;

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
    setCore("clippingFolder", Viewer.clippingFolder);

    if (core.EDITOR) {
      core.clippingFolder = Viewer.editorFolder.addFolder("Clipping Planes").close();
      
      core.materialsFolder = Viewer.editorFolder.addFolder("Materials").close();
      setCore("materialsFolder", core.materialsFolder);
      Viewer.editorFolder.add(
        {
          ["Picking mode"]() {
            Viewer.pickingMode = !Viewer.pickingMode;
            var _str;
            Viewer.pickingMode ? (_str = "enabled") : (_str = "disabled");
            showToast("Face picking is " + _str);
            if (!Viewer.pickingMode) {
            } else {
              Viewer.RULER_MODE = false;
            }
          },
        },
        "Picking mode"
      );

      Viewer.editorFolder.add(
        {
          ["Distance Measurement"]() {
            Viewer.RULER_MODE = !Viewer.RULER_MODE;
            var _str;
            Viewer.RULER_MODE ? (_str = "enabled") : (_str = "disabled");
            showToast("Distance measurement mode is " + _str);
            if (!Viewer.RULER_MODE) {
              Viewer.ruler.forEach((r) => {
                core.scene.remove(r);
              });
              Viewer.rulerObject = new THREE.Object3D();
              Viewer.ruler = [];
              Viewer.linePoints = [];
            } else {
              Viewer.pickingMode = false;
            }
          },
        },
        "Distance Measurement"
      );

      Viewer.editorFolder.add(
        {
          ["Reset camera position"]() {
            Viewer.resetCamera();
          },
        },
        "Reset camera position"
      );
    }

    if (!core.isLightweight) {
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

    if (core.EDITOR && !core.isLightweight) {
      Viewer.editorFolder.add(
        {
          ["Save"]() {

            var rotateMetadata = new THREE.Vector3(
              THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.x),
              THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.y),
              THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.z)
            );

            //Fetch data from original metadata file anyway before saving any changes
            if (core.CONFIG.entity.proxyPath !== undefined) {
              core.CONFIG.metadataUrl = core.getProxyPath(core.CONFIG.metadataUrl);
            }

            (async () => {
              let fetchedMetadata = {};

              try {
                if (core.CONFIG?.metadataUrl) {
                  const response = await fetch(core.CONFIG.metadataUrl, { cache: "no-cache" });

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

                await fetch(core.CONFIG.mainUrl + "/api/editor/save-metadata", {
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
                          core.loadedFile
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
      Viewer.editorFolder.add(
        {
          ["Render preview"]() {
            Viewer.takeScreenshot();
          },
        },
        "Render preview"
      );
    }
  },

  async startModelProcessing() {
    /*const r = await fetch("/api/model/create", {method:"POST" });

    const data = await r.json();

    const id = data.entity_id;*/

    const _id = core.CONFIG.entity.id;

    localStorage.setItem("processing_model_id", _id);

    let loadingMap =  [
      "Preparing model",
      "Converting to transmission format",
      "Rendering thumbnails",
      "Saving entity",
      "Finalizing 3D model",
      "Initializing viewer"
    ];

    loadingMap = core.isLocalPreview ? loadingMap.slice(-2) : loadingMap;

    UltraLoader.start(loadingMap);
    setCore("UltraLoader", UltraLoader);

    const poller = new StatusPoller(_id);
    setCore("poller", poller);
    poller.start();
  },

  // IIIF setup and loading
  async setupIIIF(newUrlOrJson, type="url") {
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
    // reset scene and release GPU resources from the previous model batch
    Viewer.resetLoadedModelState();
    core.axesHelper.visible = false;
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
  },

  async loadIIIFURL() {
    const form = document.getElementById("form-IIIF");
    const collapseBtn = document.getElementById("iiif-toggle-collapse");
    const themeBtn = document.getElementById("iiif-toggle-theme");
    const STORAGE_KEY = "iiif-dark-mode";
    const syncGlobalTheme = (isDark) => {
      document.body.classList.toggle("iiif-dark", isDark);
      themeBtn.textContent = isDark ? "☀️" : "🌙";
      themeBtn.setAttribute("aria-pressed", isDark ? "true" : "false");
      const testThemeToggle = document.getElementById("test-theme-toggle");
      if (testThemeToggle) {
        testThemeToggle.textContent = isDark ? "☀️" : "🌙";
        testThemeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
      }
    };

    // restore
    if (localStorage.getItem(STORAGE_KEY) === "1") {
      form.classList.add("dark");
    }
    syncGlobalTheme(form.classList.contains("dark"));

    Viewer.bindEventListener(themeBtn, "click", () => {
      const isDark = form.classList.toggle("dark");
      localStorage.setItem(STORAGE_KEY, isDark ? "1" : "0");
      syncGlobalTheme(isDark);
    });

    Viewer.bindEventListener(collapseBtn, "click", () => {
      form.classList.toggle("collapsed");
      collapseBtn.textContent = form.classList.contains("collapsed") ? "▸" : "▾";
    });
    // create a small dropdown to switch iiif manifests at runtime
    Viewer.bindEventListener(document.getElementById("iiif-manifest-select"), "change", async (ev) => {
      try {
        if (ev.target.value !== Viewer.iiifConfigURL.url) {
          core.objectsConfig.setupIndex = 0;
          await Viewer.setupIIIF(ev.target.value, "url");
        }
      } catch (err) {
        Viewer.reportError(err, {
          context: "Error loading IIIF manifest",
        });
      }
      });

    Viewer.bindEventListener(document.getElementById("load-manifest-from-url"), "click", async (ev) => {
      try {
        const inputElement = document.getElementById("manifest-url");
        if (inputElement.value === "" || !Viewer.isUrlFlexible(inputElement.value)) {
        inputElement.style.border = "2px solid red";
        showToast("Please enter a valid IIIF manifest URL.");
        return;
      } else {
        inputElement.style.border = "2px solid green";
        core.objectsConfig.setupIndex = 0;
          console.log("Loading IIIF manifest from URL: " + inputElement.value);
          await Viewer.setupIIIF(inputElement.value, "url");
        }
      } catch (err) {
        Viewer.reportError(err, {
          context: "Error loading IIIF manifest",
        });
      }
      });

    Viewer.bindEventListener(document.getElementById("load-manifest-from-text"), "click", async (ev) => {
      try {
        const inputElement = document.getElementById("manifest-text");
        if (inputElement.value === "" || !Viewer.isValidJsonObject(inputElement.value)) {
        inputElement.style.border = "2px solid red";
        showToast("Please enter a valid IIIF JSON text.");
        return;
      } else {
        inputElement.style.border = "2px solid green";
        core.objectsConfig.setupIndex = 0;
          console.log("Loading IIIF manifest from privided text");
          await Viewer.setupIIIF(inputElement.value, "text");
        }
      } catch (err) {
        Viewer.reportError(err, {
          context: "Error loading IIIF manifest",
        });
      }
    });
  },

  isUrlFlexible(string) {
    try {
      new URL(string);
      return true;
    } catch {
      return /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i.test(string);
    }
  },

  isValidJsonObject(text) {
    try {
      const parsed = JSON.parse(text);
      return typeof parsed === 'object' && parsed !== null;
    } catch {
      return false;
    }
  },

  async init() {
    if (!Viewer.renderer) {
      Viewer.camera = new THREE.PerspectiveCamera(
        45,
        core.CONFIG.viewer.canvasDimensions.x / core.CONFIG.viewer.canvasDimensions.y,
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

      const isLocalPreview = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
      setCore('isLocalPreview', isLocalPreview);
      console.info('Running on', window.location.hostname, '- Local preview mode:', core.isLocalPreview);

      Viewer.startModelProcessing();

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
        shadowMap: {
          enabled: true,
          type: THREE.PCFSoftShadowMap
        },
        localClippingEnabled: true,
        physicallyCorrectLights: true,
        autoClear: false,
        setClearColor: (0x000000, 0.0),
        outputColorSpace: THREE.SRGBColorSpace,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.65
      });
      
      core.renderer.localClippingEnabled = true;

      setCore('renderer', core.renderer);

      core.renderer.domElement.id = "MainCanvas";
      Viewer.mainCanvas = document.getElementById("MainCanvas") || core.renderer.domElement;

      if (window.__E2E__) {
        document.body.appendChild(core.renderer.domElement);
      }

	      Viewer.bindEventListener(core.renderer.domElement, "pointerdown", Viewer.onPointerDown);
	      Viewer.bindEventListener(core.renderer.domElement, "pointerup", Viewer.onPointerUp);
	      Viewer.bindEventListener(core.renderer.domElement, "pointermove", Viewer.onPointerMove);

	      // Add drag and drop support for localhost
	      if (isLocalPreview) {
	        Viewer.bindEventListener(core.renderer.domElement, "dragover", Viewer.onDragOver);
	        Viewer.bindEventListener(core.renderer.domElement, "drop", Viewer.onDrop);
	      }

      const devicePixelRatio = window.devicePixelRatio || 1;
      core.renderer.setSize(core.CONFIG.viewer.canvasDimensions.x, core.CONFIG.viewer.canvasDimensions.y);

      if (isE2E) {
        console.info('E2E MODE ENABLED');
        core.renderer.setPixelRatio(1);
        core.renderer.toneMappingExposure = 1;
        if (typeof disablePostProcessing === 'function') {
          disablePostProcessing();
        }
        this.ensureE2EState();
      } else {
            core.renderer.setPixelRatio(devicePixelRatio);
      }
      core.renderer.domElement.style.width = core.CONFIG.viewer.canvasDimensions.x + "px";
      core.renderer.domElement.style.height = core.CONFIG.viewer.canvasDimensions.y + "px";

      core.renderer.domElement.style.display = "block";
      core.container.appendChild(core.renderer.domElement);
      Viewer.mainCanvas.classList.add("mainCanvas");
      //Viewer.canvasText = document.createElement("div");
      //Viewer.canvasText.id = "metadata-container";
      //Viewer.canvasText.width = core.CONFIG.viewer.canvasDimensions.x + "px";
      //Viewer.canvasText.height = core.CONFIG.viewer.canvasDimensions.y + "px";

      Viewer.viewerWrapper = core.container.closest('.viewer-wrapper');

      if (!Viewer.viewerWrapper) {
        Viewer.viewerWrapper = core.container.parentElement;
        Viewer.viewerWrapper.classList.add('viewer-wrapper');
      }

      core.camera.aspect = core.CONFIG.viewer.canvasDimensions.x / core.CONFIG.viewer.canvasDimensions.y;
      core.camera.updateProjectionMatrix();

      setCore('mainCanvas', Viewer.mainCanvas);
      const scriptUrl = document.currentScript?.src || import.meta.url;
      Viewer.DFG_ASSETS = scriptUrl.replace(/\/[^\/]*$/, '');

      setCore('DFG_ASSETS', Viewer.DFG_ASSETS);
      getModuleAssetBasePath();

      Viewer.actionMenu = document.createElement("div");
      Viewer.actionMenu.setAttribute("id", "viewerActionMenu");
      Viewer.actionMenu.innerHTML = `
        <input
          id="viewerActionMenuToggle"
          class="viewer-action-menu__checkbox"
          type="checkbox"
          aria-label="Open viewer actions"
        />
        <label
          for="viewerActionMenuToggle"
          class="viewer-action-menu__toggle"
          aria-label="Open viewer actions"
          title="Viewer actions"
        >
          <span></span>
          <span></span>
          <span></span>
        </label>
        <div class="viewer-action-menu__panel" aria-label="Viewer actions"></div>
      `;
      core.container.appendChild(Viewer.actionMenu);

      Viewer.actionMenuToggle = Viewer.actionMenu.querySelector("#viewerActionMenuToggle");
      Viewer.actionMenuPanel = Viewer.actionMenu.querySelector(".viewer-action-menu__panel");

      Viewer.viewEntity = document.createElement("button");
      Viewer.viewEntity.setAttribute("id", "viewEntity");
      Viewer.viewEntity.setAttribute("type", "button");
      Viewer.viewEntity.hidden = true;

      Viewer.downloadModel = document.createElement("a");
      setCore('downloadModel', Viewer.downloadModel);
      Viewer.downloadModel.setAttribute("id", "downloadModel");
      Viewer.downloadModel.hidden = true;

      Viewer.fullscreenMode = document.createElement("button");
      Viewer.fullscreenMode.setAttribute("id", "fullscreenMode");
      Viewer.fullscreenMode.setAttribute("type", "button");
      Viewer.updateFullscreenButtonIcon();

      Viewer.actionMenuPanel.appendChild(Viewer.viewEntity);
      Viewer.actionMenuPanel.appendChild(Viewer.downloadModel);
      Viewer.actionMenuPanel.appendChild(Viewer.fullscreenMode);

      setCore('viewEntity', Viewer.viewEntity);
	      Viewer.bindEventListener(Viewer.fullscreenMode, "click", Viewer.toggleFullscreen, false);
      Viewer.bindEventListener(Viewer.viewEntity, "click", Viewer.copyEmbedCode);
      Viewer.bindEventListener(Viewer.downloadModel, "click", () => Viewer.closeActionMenu());
      Viewer.bindEventListener(document, "click", (event) => {
        if (!Viewer.actionMenu?.contains(event.target)) {
          Viewer.closeActionMenu();
        }
      });

      Viewer.handHint.innerHTML = `<img src="${core.DFG_ASSETS}/img/hand-hint.png" alt="Fullscreen" width=48 height=48 title="Hand hint animation"/>`;
      
      Viewer.rect = core.container.getBoundingClientRect();
      core.guiContainer.style.maxHeight = `${Viewer.rect.height - 20}px`;
      core.lilGui = document.getElementsByClassName("lil-gui root");      


      Viewer.fileElement = document.getElementsByClassName("field--type-file");
      if (Viewer.fileElement.length > 0) {
        Viewer.fileElement[0].style.height = core.CONFIG.viewer.canvasDimensions.y * 1.1 + "px";
      }

      if (
        !core.isLightweight || 
        core.CONFIG.viewer.gallery?.build === true
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
      setCore('selectObjectHierarchy', Viewer.selectObjectHierarchy);

      core.transformControlClippingPlaneX.showX = core.transformControlClippingPlaneX.showY = false;
      core.transformControlClippingPlaneY.showX = core.transformControlClippingPlaneY.showY = false;
      core.transformControlClippingPlaneZ.showX = core.transformControlClippingPlaneZ.showY = false;

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

      if (core.isLocalPreview) {
        const picker = document.getElementById('example-model-picker');
        const selectModel = document.getElementById('example-model-select');
        const themeToggle = document.getElementById('example-theme-toggle');
        const viewerElement = document.getElementById('DFG_3DViewer');
        const THEME_STORAGE_KEY = 'iiif-dark-mode';
        if (picker && selectModel && themeToggle && viewerElement) {
          const syncPickerTheme = (isDark = window.localStorage.getItem(THEME_STORAGE_KEY) === '1') => {
            document.body.classList.toggle('iiif-dark', Boolean(isDark));
            themeToggle.textContent = isDark ? '☀️' : '🌙';
            themeToggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
          };

          const localurl = new URL(window.location.href);
          let selectedModel = localurl.searchParams.get('model');
          if (!selectedModel) {
            selectedModel = localStorage.getItem('dfg3dviewer-example-model');
          }
          if (!selectedModel) {
            selectedModel = viewerElement.getAttribute('3d');
          }
          if (!selectedModel) {
            selectedModel = './examples/box.stl';
          }
          core.autoPath = selectedModel;
          picker.style.display = 'inline-flex';
          selectModel.value = selectedModel;
          viewerElement.setAttribute('3d', selectedModel);
          syncPickerTheme();

          themeToggle.addEventListener('click', () => {
            const nextIsDark = !document.body.classList.contains('iiif-dark');
            window.localStorage.setItem(THEME_STORAGE_KEY, nextIsDark ? '1' : '0');
            document.getElementById('form-IIIF')?.classList.toggle('dark', nextIsDark);
            const iiifThemeToggle = document.getElementById('iiif-toggle-theme');
            if (iiifThemeToggle) {
              iiifThemeToggle.textContent = nextIsDark ? '☀️' : '🌙';
              iiifThemeToggle.setAttribute('aria-pressed', nextIsDark ? 'true' : 'false');
            }
            syncPickerTheme(nextIsDark);
          });

          selectModel.addEventListener('change', () => {
            core.autoPath = selectModel.value;
            window.localStorage.setItem('dfg3dviewer-example-model', selectModel.value);
            this.resetLoadedModelState();
            this.mainLoadModelWrapper();
          });
        }
      }

      const sourceType = core.CONFIG.entity.metadata.sourceType.toLowerCase();
      console.log("Loading from source: " + sourceType);
          
      if (window.__E2E__) {
        try {
          await Viewer.mainLoadModelWrapper();
        } catch (error) {
          Viewer.reportError(error, {
            context: "E2E model load error",
          });
        }
	    } 
      else if (sourceType === "drupal") {
        try {
          if (core.CONFIG.entity.metadata.exportUrl && core.CONFIG.entity.metadata.exportUrl !== "") 
          {
            const response = await fetch(core.CONFIG.viewer.exportPath + core.CONFIG.entity.id, 
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/xml'
              },
              body: JSON.stringify({
                id: core.CONFIG.entity.id,
                domain: core.CONFIG.metadataUrl
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
          }
          await Viewer.mainLoadModelWrapper();
        } catch (err) {
          Viewer.reportError(err, {
            context: core.isLightweight ? "Lightweight model load error" : "Metadata load error",
          });
        }
	    } else if (sourceType === "iiif") {
        Viewer.cleanupTransientUI();
        createIIIFUI();

        console.log("Loading from source: " + core.CONFIG.entity.metadata.sourceType);
        if (Viewer.iiifConfigURL.url !== "") {
          createIIIFDropdown(Viewer.iiifConfigURL);
          await Viewer.loadIIIFURL();
          core.CONFIG.entity.metadata.sourceType = "IIIF";
          await Viewer.setupIIIF(Viewer.iiifConfigURL.url);
        }
      } else {
        console.log("Custom metadata source:" + core.CONFIG.entity.metadata.sourceType);
        try {
          switch(core.CONFIG.entity.metadata.sourceType.substring(0, 6).toLowerCase()) {
            case "drupal":
              console.log("Loading from URL: " + core.CONFIG.entity.metadata.url);

              break;
            case "file": //TODO: add more sources
              break;
          }
          // Load model for custom metadata sources
          await Viewer.mainLoadModelWrapper();
        } catch (error) {
          Viewer.reportError(error, {
            context: core.isLightweight ? "Lightweight model load error" : "Custom metadata load error",
          });
        }
      }

      core.renderer.setPixelRatio(devicePixelRatio);
      const update = () => Viewer.updateSize();

      Viewer.bindEventListener(window, 'resize', update);

      Viewer.resizeObserver = new ResizeObserver(update);
      Viewer.resizeObserver.observe(Viewer.viewerWrapper);


      Viewer.bindEventListener(document, 'fullscreenchange', Viewer.onFullscreenChange);

      const onOrientationChange = () => setTimeout(update, 100);
      Viewer.bindEventListener(window, 'orientationchange', onOrientationChange);
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

window.Viewer = Viewer;

(async () => {
  try {
    await Viewer.MainInit();
  } catch (error) {
    Viewer.renderFatalError(error);
  }
})();

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

import { initClippingPlanes, reportViewerError, showToast, toastHelper, changeBackground } from './viewer-utils.js';

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

import { loadIIIFManifest, getAnnotations } from "./IIIF/iiif-api.js";
import { VIEWER_I18N } from "./i18n.js";
import { t } from "./i18n-utils.js";
import { clipping } from 'three/src/nodes/accessors/ClippingNode.js';

export const Viewer = {
  CONFIG: null,
  PRESENTATION_MODE: false,
  SANDBOX_MODE: false,
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
  mainMenuButton: null,
  fullscreenMode: null,
  themeMode: null,
  languageMode: null,
  editorToolbar: null,
  editorToolbarButtons: {},
  downloadModel: null,
  embedConfiguratorPanel: null,
  embedConfigInputs: null,
  embedConfigPreviewFrame: null,
  embedMissingSourceNotified: false,
  currentTheme: "dark",
  currentLanguage: "en",
  loadingLogMessageKeys: [
    "loadingLog.loadingAssets",
    "loadingLog.loadingModel",
    "loadingLog.loadingTextures",
    "loadingLog.preparingGeometry",
    "loadingLog.settingUpLighting",
    "loadingLog.settingUpMaterials",
    "loadingLog.compilingShaders",
    "loadingLog.fetchingMetadata",
    "loadingLog.modelLoaded",
  ],
  processingLoadingStepKeys: [
    "processingSteps.preparingModel",
    "processingSteps.convertingToTransmissionFormat",
    "processingSteps.renderingThumbnails",
    "processingSteps.savingEntity",
    "processingSteps.finalizing3dModel",
    "processingSteps.initializingViewer",
  ],
  THEME_STORAGE_KEY: "iiif-dark-mode",
  LANGUAGE_STORAGE_KEY: "viewer-language",
  I18N: VIEWER_I18N,
  SUPPORTED_EXTENSIONS: ['obj', 'dae', 'fbx', 'ply', 'ifc', 'stl', 'xyz', 'json', '3ds', 'pcd', 'gltf', 'glb', 'zip', 'rar', 'tar', 'xz', 'gz'],
  GESTURE: {handPx: 55, period: 5.5, rotate: false, active: false, target: new THREE.Vector3(), startTime: 0, baseAngle: 0, orbitAngle: THREE.MathUtils.degToRad(15), easeInTime: 2.25},
  lastTime: null,
  originalMetadata: [],
  spinnerContainer: null,
  spinnerElement: null,
  loadingLog: null,
  guiContainer: null,
  noticeContainer: null,
  statusNotice: null,
  statusNoticeTimer: null,
  statusNoticeHideTimer: null,
  statusNoticeQueue: [],
  statusNoticeActive: false,
  statusNoticeCurrent: null,
  pickingHint: null,
  clippingHint: null,
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
  annotationEntries: [],
  annotationDialog: null,
  annotationDialogHost: null,
  annotationDialogTitleInput: null,
  annotationDialogDescriptionInput: null,
  annotationTargetFaceKeys: [],
  annotationBatchGroupId: "",
  annotationPOIGroup: null,
  annotationPOIMarkers: [],
  annotationPOITooltip: null,
  annotationPOITooltipTitle: null,
  annotationPOITooltipTarget: null,
  annotationImportInput: null,
  pendingAnnotationsXml: "",
  pickingTexture: null,
  windowHalfX: null,
  windowHalfY: null,
  transformType: "",
  transformText: {
    "Transform 3D Object": "",
    "Transform Light": "",
    "Transform Mode": "local",
  },
  materialsPropertiesText: {
    "Edit material": "select by material",
  },
  pickingStats: {
    "Selected faces": 0,
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
  metadataFolder: null,
  materialsFolder: null,
  pickingModeController: null,
  distanceMeasurementController: null,
  clearSelectedFacesController: null,
  selectedFacesCountController: null,
  addAnnotationController: null,
  textMesh: null,
  textMeshDistance: null,
  ruler: [],
  rulerObject: null,
  lastPickedFace: { id: "", object: "", faceIndex: null, overlay: null },
  loadedTimes: 0,
  _ext: '',
  DFG_ASSETS: '',
  isLightweight: false,
  urlOptions: {
    model: null,
    id: null,
    theme: null,
    language: null,
    autoRotate: null,
    autoRotateSpeed: null,
    disableInteraction: false,
    hideUi: false,
    hideMetadata: false,
    cameraPosition: null,
    cameraTarget: null,
    cameraFov: null,
    presentationMode: false,
    sandboxMode: false,
  },
  keyboardStep: {
    rotate: THREE.MathUtils.degToRad(2.25),
    rotateFast: THREE.MathUtils.degToRad(6),
    panFactor: 0.04,
    zoomFactor: 1.08,
  },
  keyboardTweenDurationMs: 150,
  lastKeyboardHintAt: 0,
  keyboardHintCooldownMs: 45000,
  keyboardHintAfterFocusDelayMs: 1800,
  lastWindowFocusAt: 0,
  cleanupCallbacks: [],
  resizeObserver: null,
  i18nGui: {},
  showNotifications: true,

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
    if (this.languageModeDropdown) {
      this.languageModeDropdown.hidden = true;
    }
    this.updateEditorToolbarState();
  },

  stopHandMode() {
    const g = core.GESTURE;
    if (g) {
      g.rotate = false;
      g.active = false;
      g.baseAngle = null;
      g.target = null;
    }

    if (core.handHint) {
      core.handHint.hidden = true;
      core.handHint.classList.remove("hand-drag-animate");
    }

    if (core.controls) {
      core.controls.enabled = true;
      core.controls.update?.();
    }
  },

  getEditorToolbarIcon(icon) {
    const icons = {
      orbit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.5 2.75 21 3.5l-.75 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.25" fill="currentColor"/></svg>',
      move: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      rotate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6.5A7.5 7.5 0 1 1 5 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 3.5v3H5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      scale: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h8v8H8zM5 5h4M5 5v4M19 19h-4M19 19v-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      lightMove: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 13h5l-1 8 7-10h-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
      lightTarget: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      picking: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 3 8 8-4 1 2 5-2.5 1-2-5-3 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
      annotate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v10H9l-4 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 9h6M9 12h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      ruler: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16 8-8 8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 12 6.5 10.5M11 9l-1.5-1.5M14 12l-1.5-1.5M17 15l-1.5-1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      resetCamera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h4l2-2h4l2 2h4v10H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.25" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
      preview: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m8 14 2.5-3 2.5 2 2-3 3 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h11l3 3v13H5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 4v5h8M9 18h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      mainMenu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2 2.2 3-.2.8 2.9 2.6 1.4-1 2.8 1 2.8-2.6 1.4-.8 2.9-3-.2L12 21l-2-2.2-3 .2-.8-2.9-2.6-1.4 1-2.8-1-2.8 2.6-1.4.8-2.9 3 .2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
      advancedEditor: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M4 17h16M14 7h6M4 12h6M12 12h8M8 5v4M16 10v4M10 15v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      fullScreen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h5M4 4v5M20 4h-5M20 4v5M4 20h5M4 20v-5M20 20h-5M20 20v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      clippingPlanes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    };
    return icons[icon] || icons.advancedEditor;
  },

  createEditorToolbar() {
    if (!core.EDITOR || this.urlOptions.hideUi || this.editorToolbar || !core.container) return;

    const toolbar = document.createElement("div");
    toolbar.id = "viewerEditorToolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", t("toolbar.editor", "Editor tools"));
    toolbar.style.translate = "-50% 95%";

    const tools = [
      { key: "orbit", icon: "orbit", onClick: () => this.setObjectTransformMode("") },
      { key: "move", icon: "move", onClick: () => this.toggleObjectTransformMode("translate"), pressed: true },
      { key: "rotate", icon: "rotate", onClick: () => this.toggleObjectTransformMode("rotate"), pressed: true },
      { key: "scale", icon: "scale", onClick: () => this.toggleObjectTransformMode("scale"), pressed: true },
      { key: "lightMove", icon: "lightMove", onClick: () => this.toggleLightTransformMode("translate"), pressed: true },
      { key: "lightTarget", icon: "lightTarget", onClick: () => this.toggleLightTransformMode("rotate"), pressed: true },
      { key: "picking", icon: "picking", onClick: () => this.togglePickingMode(), pressed: true },
      { key: "annotate", icon: "annotate", onClick: () => this.openAnnotationDialogWithAutoPicking() },
      { key: "ruler", icon: "ruler", onClick: () => this.toggleDistanceMeasurement(), pressed: true },
      { key: "resetCamera", icon: "resetCamera", onClick: () => this.resetCamera() },
      { key: "advancedEditor", icon: "advancedEditor", onClick: () => this.toggleEditorAdvancedPanel(), pressed: true },
      { key: "fullScreen", icon: "fullScreen", onClick: () => this.toggleFullscreen(), pressed: true },
      { key: "clippingPlanes", icon: "clippingPlanes", onClick: () => this.toggleClippingPlanesPanel(), pressed: true },
    ];

    if (!core.isLightweight) {
      tools.splice(tools.length - 1, 0,
        { key: "preview", icon: "preview", onClick: () => this.takeScreenshot() },
        { key: "save", icon: "save", onClick: () => this.saveEditorMetadata() }
      );
    }

    this.editorToolbarButtons = {};

    tools.forEach((tool) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "viewer-editor-tool";
      button.dataset.tool = tool.key;
      button.dataset.pressed = tool.pressed ? "true" : "false";
      button.innerHTML = `
        <span class="viewer-editor-tool_icon" aria-hidden="true">${this.getEditorToolbarIcon(tool.icon)}</span>
        <span class="viewer-editor-tool_sr"></span>
      `;
      this.bindEventListener(button, "click", () => {
        this.stopHandMode();
        tool.onClick();
      });
      toolbar.appendChild(button);
      this.editorToolbarButtons[tool.key] = button;
    });

    if (this.actionMenu) {
      this.actionMenu.classList.add("viewer-action-menu_in-toolbar");
      toolbar.appendChild(this.actionMenu);
    }

    core.container.appendChild(toolbar);
    this.editorToolbar = toolbar;
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
  },

  updateEditorToolbarLabels() {
    if (!this.editorToolbarButtons) return;

    const labels = {
      orbit: t("toolbar.orbit", "Navigation mode"),
      move: t("gui.move", "Move"),
      rotate: t("gui.rotate", "Rotate"),
      scale: t("gui.scale", "Scale"),
      lightMove: t("toolbar.lightMove", "Move light"),
      lightTarget: t("toolbar.lightTarget", "Light target"),
      picking: this.pickingMode
        ? t("controls.disablePickingMode", "Disable picking mode")
        : t("controls.enablePickingMode", "Enable picking mode"),
      annotate: t("gui.addAnnotations", "Add annotations"),
      ruler: this.RULER_MODE
        ? t("controls.disableDistanceMeasurement", "Disable distance measurement")
        : t("controls.enableDistanceMeasurement", "Enable distance measurement"),
      resetCamera: t("gui.resetCameraPosition", "Reset camera position"),
      preview: t("gui.renderPreview", "Render preview"),
      save: t("gui.save", "Save"),
      advancedEditor: this.isEditorAdvancedPanelVisible()
        ? t("toolbar.hideAdvancedEditor", "Hide advanced editor")
        : t("toolbar.showAdvancedEditor", "Show advanced editor"),
      fullScreen: this.fullscreenMode
        ? t("fullscreen.enter", "Enter fullscreen")
        : t("fullscreen.exit", "Exit fullscreen"),
      clippingPlanes: this.clippingMode
        ? t("toolbar.disableClippingPlanesMode", "Disable clipping planes mode")
        : t("toolbar.enableClippingPlanesMode", "Enable clipping planes mode"),
    };

    Object.entries(this.editorToolbarButtons).forEach(([key, button]) => {
      const label = labels[key] || key;
      button.setAttribute("title", label);
      button.setAttribute("aria-label", label);
      const sr = button.querySelector(".viewer-editor-tool_sr");
      if (sr) sr.textContent = label;
    });

    this.editorToolbar?.setAttribute("aria-label", t("toolbar.editor", "Editor tools"));
  },

  isEditorAdvancedPanelVisible() {
    if (!this.editorFolder?.domElement) return false;
    return this.editorFolder.domElement.style.display !== "none";
  },

  setEditorAdvancedPanelVisible(visible) {
    if (!this.editorFolder) return;
    if (visible) this.editorFolder.show?.();
    else this.editorFolder.hide?.();
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
  },

  toggleEditorAdvancedPanel() {
    this.setEditorAdvancedPanelVisible(!this.isEditorAdvancedPanelVisible());
  },

  toggleMainMenu() {
    if (!this.actionMenuToggle) return;
    this.actionMenuToggle.checked = !this.actionMenuToggle.checked;
    if (!this.actionMenuToggle.checked && this.languageModeDropdown) {
      this.languageModeDropdown.hidden = true;
    }
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
  },

  setObjectTransformMode(mode = "") {
    const normalizedMode = ["translate", "rotate", "scale"].includes(mode) ? mode : "";
    if (normalizedMode && !core.helperObjects?.[0]) return;

    if (core.i18nGui.transformObjectController?.setValue) {
      core.i18nGui.transformObjectController.setValue(normalizedMode);
    } else {
      this.transformText["Transform 3D Object"] = normalizedMode;
    }
    this.updateEditorToolbarState();
  },

  toggleObjectTransformMode(mode = "") {
    const nextMode = this.transformText["Transform 3D Object"] === mode ? "" : mode;
    this.setObjectTransformMode(nextMode);
  },

  setLightTransformMode(mode = "") {
    const normalizedMode = ["translate", "rotate"].includes(mode) ? mode : "";

    if (core.i18nGui.transformLightController?.setValue) {
      core.i18nGui.transformLightController.setValue(normalizedMode);
    } else {
      this.transformText["Transform Light"] = normalizedMode;
    }
    this.updateEditorToolbarState();
  },

  toggleLightTransformMode(mode = "") {
    const nextMode = this.transformText["Transform Light"] === mode ? "" : mode;
    this.setLightTransformMode(nextMode);
  },

  togglePickingMode() {
    this.pickingMode = !this.pickingMode;
    toastHelper(this.pickingMode ? "facePickingEnabled" : "facePickingDisabled", {
      duration: 1400
    });
    if (!this.pickingMode) {
      this.restoreLastPickedFace();
      this.clearSelectedFaces();
    } else {
      this.RULER_MODE = false;
      this.updateDistanceMeasurementControllerLabel();
    }
    this.updatePickingModeControllerLabel();
    this.updatePickingControlsVisibility();
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
  },

  toggleDistanceMeasurement() {
    this.RULER_MODE = !this.RULER_MODE;
    if (this.RULER_MODE) {
      toastHelper("distanceEnabled", {
        duration: 2600
      });
      toastHelper("distanceHint", {
        duration: 5200
      });
    } else {
      toastHelper(this.RULER_MODE ? "distanceModeEnabled" : "distanceModeDisabled");
    }
    if (!this.RULER_MODE) {
      this.ruler.forEach((r) => {
        core.scene.remove(r);
      });
      this.rulerObject = new THREE.Object3D();
      this.ruler = [];
      this.linePoints = [];
    } else {
      this.pickingMode = false;
      this.restoreLastPickedFace();
      this.clearSelectedFaces();
      this.updatePickingModeControllerLabel();
      this.updatePickingControlsVisibility();
    }
    this.updateDistanceMeasurementControllerLabel();
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
  },

  toggleClippingPlanesPanel() {
    this.clippingMode = !this.clippingMode;
    if (this.clippingMode) {
      toastHelper("facePickingEnabled", {
        duration: 2600
      });
      toastHelper("clippingPlanes", {
        duration: 5200
      });
    } else {
      toastHelper("facePickingDisabled");
    }
    this.updateClippingPlanesControllerLabel();
    this.updateClippingPlanesControlsVisibility();
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
  },

  updateClippingPlanesControllerLabel() {
    if (core.i18nGui.clippingPlanesController?.name) {
      core.i18nGui.clippingPlanesController.name(this.clippingMode
        ? t("controls.disableClippingPlanesMode", "Disable clipping planes mode")
        : t("controls.enableClippingPlanesMode", "Enable clipping planes mode"));
    }
  },

  updateClippingPlanesControlsVisibility() {
    if (this.transformControlClippingPlaneX) {
      this.transformControlClippingPlaneX.visible = this.clippingMode;
    }
    if (this.transformControlClippingPlaneY) {
      this.transformControlClippingPlaneY.visible = this.clippingMode;
    }
    if (this.transformControlClippingPlaneZ) {
      this.transformControlClippingPlaneZ.visible = this.clippingMode;
    }
  },

  async saveEditorMetadata() {
    if (!core.EDITOR || core.isLightweight || !core.helperObjects?.[0]) return;

    const rotateMetadata = new THREE.Vector3(
      THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.x),
      THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.y),
      THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.z)
    );

    if (core.CONFIG.entity.proxyPath !== undefined) {
      core.CONFIG.metadataUrl = core.getProxyPath(core.CONFIG.metadataUrl);
    }

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

    this.originalMetadata = {
      ...this.originalMetadata,
      ...fetchedMetadata
    };

    const newMetadata = this.buildMetadata(this, rotateMetadata);

    try {
      const token = await fetch("/session/token").then((r) => r.text());

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
            this.archiveType !== ""
              ? core.fileObject.relativePath + core.fileObject.basename + core.loadedFile
              : core.fileObject.relativePath,
          content: JSON.stringify(newMetadata, null, "\t")
        })
      });

      toastHelper("settingsSaved", "success");
    } catch (err) {
      console.error(err);
      toastHelper("settingsSaveError", "error");
    }
  },

  updateEditorToolbarState() {
    if (!this.editorToolbarButtons) return;

    const activeMap = {
      orbit: this.transformText["Transform 3D Object"] === "",
      move: this.transformText["Transform 3D Object"] === "translate",
      rotate: this.transformText["Transform 3D Object"] === "rotate",
      scale: this.transformText["Transform 3D Object"] === "scale",
      lightMove: this.transformText["Transform Light"] === "translate",
      lightTarget: this.transformText["Transform Light"] === "rotate",
      picking: this.pickingMode === true,
      ruler: this.RULER_MODE === true,
      clippingPlanes: this.clippingMode === true,
      advancedEditor: this.isEditorAdvancedPanelVisible(),
      fullScreen: this.fullscreenMode === true,
    };

    Object.entries(this.editorToolbarButtons).forEach(([key, button]) => {
      const isActive = activeMap[key] === true;
      button.classList.toggle("is-active", isActive);
      if (button.dataset.pressed === "true") {
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      } else {
        button.removeAttribute("aria-pressed");
      }
    });
  },

  isEmbedModeActive() {
    return this.embedConfiguratorPanel?.hidden === false;
  },

  updateEmbedMenuEntryState() {
    if (!this.viewEntity) return;
    const isActive = this.isEmbedModeActive();
    const label = isActive ? t("menu.exitEmbed", "Exit embed") : t("menu.embed", "Embed");
    const iconClass = isActive ? "embed-exit-icon" : "embed-icon";
    this.viewEntity.innerHTML = `<span class="${iconClass}"></span><span>${label}</span>`;
    const a11yLabel = isActive
      ? t("menu.exitEmbedMode", "Exit embed mode")
      : t("menu.openEmbedOptions", "Open embed options");
    this.viewEntity.setAttribute("aria-label", a11yLabel);
    this.viewEntity.setAttribute("title", a11yLabel);
  },

  closeEmbedConfigurator() {
    if (this.embedConfiguratorPanel) {
      this.embedConfiguratorPanel.hidden = true;
    }
    this.updateEmbedMenuEntryState();
  },

  closeEmbedMode() {
    this.closeEmbedConfigurator();
  },

  getStoredTheme() {
    if (this.urlOptions?.theme === "light" || this.urlOptions?.theme === "dark") {
      return this.urlOptions.theme;
    }

    const storedTheme = window.localStorage.getItem(this.THEME_STORAGE_KEY);
    return storedTheme === "0" ? "light" : "dark";
  },

  normalizeLanguage(value) {
    if (value == null) return null;
    const normalizedValue = String(value).trim().toLowerCase();
    if (normalizedValue.startsWith("pl")) return "pl";
    if (normalizedValue.startsWith("de")) return "de";
    if (normalizedValue.startsWith("en")) return "en";
    return null;
  },

  getStoredLanguage() {
    const fromQuery = this.normalizeLanguage(this.urlOptions?.language);
    if (fromQuery) return fromQuery;

    const storedLanguage = this.normalizeLanguage(window.localStorage.getItem(this.LANGUAGE_STORAGE_KEY));
    if (storedLanguage) return storedLanguage;

    const browserLanguage = this.normalizeLanguage(navigator?.language || "en");
    return browserLanguage || "en";
  },

  tFormat(key, params = {}, fallback = "") {
    const template = t(key, fallback);
    return String(template).replace(/\{(\w+)\}/g, (_match, token) => {
      const replacement = params?.[token];
      return replacement == null ? "" : String(replacement);
    });
  },

  parseBooleanParam(value) {
    if (value == null) return null;
    const normalizedValue = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalizedValue)) return true;
    if (["0", "false", "no", "off"].includes(normalizedValue)) return false;
    return null;
  },

  parseFloatParam(value) {
    if (value == null || value === "") return null;
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  },

  parseVector2Param(value) {
    if  (value == null || value === "") return null;
    const cleaned = String(value).replace(/[\[\]()]/g, " ").trim();
    const parts = cleaned.split(/[\s,;|]+/).filter(Boolean);
    if (parts.length !== 2) return null;
    const x = Number.parseFloat(parts[0]);
    const y = Number.parseFloat(parts[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return new THREE.Vector2(x, y);
  },

  parseVector3Param(value) {
    if (value == null || value === "") return null;
    const cleaned = String(value).replace(/[\[\]()]/g, " ").trim();
    const parts = cleaned.split(/[\s,;|]+/).filter(Boolean);
    if (parts.length !== 3) return null;
    const x = Number.parseFloat(parts[0]);
    const y = Number.parseFloat(parts[1]);
    const z = Number.parseFloat(parts[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    return new THREE.Vector3(x, y, z);
  },

  formatVector3Param(vector) {
    if (!vector || typeof vector !== "object") return null;
    const x = Number(vector.x);
    const y = Number(vector.y);
    const z = Number(vector.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    return `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
  },

  parseUrlOptions() {
    const params = new URLSearchParams(window.location.search);
    const modelFromQuery = params.get("model") || params.get("src");
    const themeFromQuery = (params.get("theme") || "").trim().toLowerCase();
    const languageFromQuery = this.normalizeLanguage(params.get("lang") || params.get("language"));
    const autoRotateFromQuery = this.parseBooleanParam(params.get("autorotate"));
    const disableInteractionFromQuery = this.parseBooleanParam(params.get("disableInteraction"));
    const hideUiFromQuery = this.parseBooleanParam(params.get("hideUi"));
    const hideMetadataFromQuery = this.parseBooleanParam(params.get("hideMetadata"));
    const presentationModeFromQuery = this.parseBooleanParam(params.get("presentationMode"));
    const sandboxModeFromQuery = this.parseBooleanParam(params.get("sandbox"));
    if (presentationModeFromQuery !== null) {
      core.PRESENTATION_MODE = presentationModeFromQuery;
    }
    if (sandboxModeFromQuery !== null) {
      core.SANDBOX_MODE = sandboxModeFromQuery;
    }
    const showNotificationsFromQuery = this.parseBooleanParam(params.get("showNotifications"));

    this.urlOptions = {
      model: modelFromQuery || null,
      id: params.get("id") || null,
      theme: themeFromQuery === "light" || themeFromQuery === "dark" ? themeFromQuery : null,
      language: languageFromQuery,
      autoRotate: autoRotateFromQuery,
      autoRotateSpeed: this.parseFloatParam(params.get("autorotateSpeed")),
      disableInteraction: disableInteractionFromQuery === true,
      hideUi: hideUiFromQuery === true,
      hideMetadata: hideMetadataFromQuery === true,
      cameraPosition: this.parseVector3Param(params.get("camPos") || params.get("cameraPos")),
      cameraTarget: this.parseVector3Param(params.get("camTarget") || params.get("cameraTarget")),
      cameraFov: this.parseFloatParam(params.get("fov")),
      presentationMode: core.PRESENTATION_MODE === true,
      sandboxMode: core.SANDBOX_MODE === true,
      scale: this.parseVector2Param(params.get("scale")) || new THREE.Vector2(1, 1),
      showNotifications: showNotificationsFromQuery !== false
    };
  },

  updateThemeControlLabels() {
    const isDark = this.currentTheme === "dark";

    if (this.themeMode) {
      this.themeMode.innerHTML = `
        <span class="viewer-theme-icon" aria-hidden="true">${isDark ? "☀️" : "🌙"}</span>
        <span>${isDark ? t("theme.lightMode", "Light mode") : t("theme.darkMode", "Dark mode")}</span>
      `;
      const label = isDark
        ? t("theme.switchToLightMode", "Switch to light mode")
        : t("theme.switchToDarkMode", "Switch to dark mode");
      this.themeMode.setAttribute("aria-label", label);
      this.themeMode.setAttribute("title", label);
    }

    const exampleThemeToggle = document.getElementById("example-theme-toggle");
    if (exampleThemeToggle) {
      exampleThemeToggle.textContent = isDark ? "☀️" : "🌙";
      exampleThemeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
      exampleThemeToggle.hidden = true;
    }
  },

  applyTheme(theme, { persist = true } = {}) {
    const normalizedTheme = theme === "light" ? "light" : "dark";
    const isDark = normalizedTheme === "dark";

    this.currentTheme = normalizedTheme;
    document.documentElement.setAttribute("data-viewer-theme", normalizedTheme);
    document.body.setAttribute("data-viewer-theme", normalizedTheme);
    document.body.classList.toggle("iiif-dark", isDark);
    this.viewerWrapper?.setAttribute("data-viewer-theme", normalizedTheme);
    this.actionMenu?.setAttribute("data-viewer-theme", normalizedTheme);
    this.metadataContainer?.setAttribute("data-viewer-theme", normalizedTheme);
    core.guiContainer?.setAttribute("data-viewer-theme", normalizedTheme);
    document.getElementById("form-IIIF")?.setAttribute("data-viewer-theme", normalizedTheme);
    UltraLoader.panel?.setAttribute("data-viewer-theme", normalizedTheme);

    if (persist) {
      window.localStorage.setItem(this.THEME_STORAGE_KEY, isDark ? "1" : "0");
    }

    this.updateThemeControlLabels();
  },

  toggleTheme() {
    this.closeActionMenu();
    this.applyTheme(this.currentTheme === "dark" ? "light" : "dark");
  },

  updateLanguageControlLabels() {
    if (!this.languageMode) return;
    const languages = [
      { code: "en", label: "Language: EN"},
      { code: "pl", label: "Język: PL"},
      { code: "de", label: "Sprache: DE"}
    ];
    const currentLangLabel = languages.find(l => l.code === core.currentLanguage)?.label || "EN";
    this.languageMode.innerHTML = `
      <span class="viewer-action-icon language-icon" aria-hidden="true"></span>
      <span>${currentLangLabel}</span>
    `;
    this.languageMode.setAttribute("aria-label", t("language.label", "Language: EN"));
    this.languageMode.setAttribute("title", t("language.label", "Language: EN"));
    
    if (this.languageModeDropdown) {
      const items = this.languageModeDropdown.querySelectorAll(".language-dropdown-item");
      items.forEach(item => {
        item.classList.toggle("active", item.dataset.lang === core.currentLanguage);
      });
    }
  },

  updateActionMenuLabels() {
    if (!this.actionMenu) return;
    const actionMenuLabel = t("menu.mainMenu", "Main menu");

    const toggle = this.actionMenu.querySelector(".viewer-action-menu_toggle");
    toggle?.setAttribute("title", actionMenuLabel);
    const toggleCopy = toggle?.querySelector(".viewer-editor-tool_sr");
    if (toggleCopy) toggleCopy.textContent = actionMenuLabel;
    this.actionMenu.querySelector(".viewer-action-menu_panel")?.setAttribute("aria-label", actionMenuLabel);
  },

  updateDownloadMenuEntryLabel() {
    if (!this.downloadModel || this.downloadModel.hidden) return;
    this.downloadModel.innerHTML = `
      <span class="viewer-action-icon download-icon" aria-hidden="true"></span>
      <span>${t("menu.download", "Download")}</span>
    `;
  },

  updateLocalizedUI() {
    const lang = ["pl", "de"].includes(core.currentLanguage) ? core.currentLanguage : "en";
    document.documentElement.setAttribute("lang", lang);
    this.updateActionMenuLabels();
    this.updateLanguageControlLabels();
    this.updateThemeControlLabels();
    this.updateEmbedMenuEntryState();
    this.updateFullscreenButtonIcon();
    this.updateDownloadMenuEntryLabel();
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
    this.updatePickingModeControllerLabel();
    this.updateDistanceMeasurementControllerLabel();
    this.updateSelectedFacesControllerLabel();
    this.updateLilGuiLabels();
    this.updateLocalPreviewLabels();
    this.updateIIIFFormLabels();
    this.updateMetadataPanelLabels();
    this.refreshStatusNoticeLanguage();
    UltraLoader.updateHeader?.();
    if (this.pickingHint) this.pickingHint.textContent = t("hints.picking", "Shift + click to select multiple faces");
    if (this.clippingHint) this.clippingHint.textContent = t("hints.clipping", "Drag active clipping plane helper to adjust cut");

  },

  setGuiFolderTitle(folder, title) {
    if (!folder || !title) return;
    if (typeof folder.title === "function") {
      folder.title(title);
      return;
    }
    if (folder.$title) {
      folder.$title.textContent = title;
    }
    folder._title = title;
  },

  refreshOptionController(controller, optionsMap) {
    if (!controller || typeof controller.options !== "function") return;
    const currentValue = typeof controller.getValue === "function" ? controller.getValue() : undefined;
    controller.options(optionsMap);
    if (currentValue !== undefined && typeof controller.setValue === "function") {
      controller.setValue(currentValue);
    }
    if (typeof controller.updateDisplay === "function") {
      controller.updateDisplay();
    }
  },

  updateLilGuiLabels() {
    const g = core.i18nGui;
    if (!g) return;
    this.setGuiFolderTitle(core.gui, t("gui.controls", "Controls"));
    this.setGuiFolderTitle(g.editorFolder, t("gui.editor", "Editor"));
    this.setGuiFolderTitle(g.lightFolder, t("gui.directionalLight", "Directional Light"));
    this.setGuiFolderTitle(g.lightFolderAmbient, t("gui.ambientLight", "Ambient Light"));
    this.setGuiFolderTitle(g.lightFolderCamera, t("gui.cameraLight", "Camera Light"));
    this.setGuiFolderTitle(g.backgroundFolder, t("gui.backgroundColor", "Background Color"));
    this.setGuiFolderTitle(g.clippingFolder, t("gui.clippingFolder", "Clipping Planes"));
    this.setGuiFolderTitle(g.materialsFolder, t("gui.materials", "Materials"));
    this.setGuiFolderTitle(g.metadataFolder, t("gui.metadata", "Metadata"));
    this.setGuiFolderTitle(g.propertiesFolder, t("gui.saveProperties", "Save properties"));
    this.setGuiFolderTitle(g.hierarchyFolder, t("gui.hierarchy", "Hierarchy"));
    this.setGuiFolderTitle(g.statisticsFolder, t("gui.statistics", "Statistics"));

    // Update clipping controllers
    if (g.clippingFolder) {
      g.clippingFolder.controllers.forEach(controller => {
        switch (controller.property) {
          case 'displayHelperX':
            controller.name(t('gui.displayHelperX', 'Show X helper'));
            break;
          case 'displayHelperY':
            controller.name(t('gui.displayHelperY', 'Show Y helper'));
            break;
          case 'displayHelperZ':
            controller.name(t('gui.displayHelperZ', 'Show Z helper'));
            break;
          case 'constantX':
            controller.name(t('gui.constantX', 'Constant X'));
            break;
          case 'constantY':
            controller.name(t('gui.constantY', 'Constant Y'));
            break;
          case 'constantZ':
            controller.name(t('gui.constantZ', 'Constant Z'));
            break;
          case 'visible':
            controller.name(t('gui.visible', 'Visible'));
            break;
        }
      });
    }

    g.clearSelectedFacesController?.name?.(t("gui.clearSelectedFaces", "Clear selected faces"));
    g.transformObjectController?.name?.(t("gui.transform3dObject", "Transform 3D Object"));
    g.transformLightController?.name?.(t("gui.transformLight", "Transform Light"));
    g.transformModeController?.name?.(t("gui.transformMode", "Transform Mode"));
    g.backgroundTypeController?.name?.(t("gui.backgroundType", "Background Type"));
    g.backgroundColorController?.name?.(t("gui.backgroundColor", "Background Color"));
    g.backgroundColorOuterController?.name?.(t("gui.backgroundColorOuter", "Background Color Outer"));
    g.addAnnotationController?.name?.(t("gui.addAnnotations", "Add annotations"));
    g.exportAnnotationsController?.name?.(t("gui.exportAnnotationsXml", "Export annotations XML"));
    g.importAnnotationsController?.name?.(t("gui.importAnnotationsXml", "Import annotations XML"));
    g.resetCameraController?.name?.(t("gui.resetCameraPosition", "Reset camera position"));
    g.saveController?.name?.(t("gui.save", "Save"));
    g.renderPreviewController?.name?.(t("gui.renderPreview", "Render preview"));
    g.performanceController?.name?.(t("gui.performance", "Performance"));
    g.savePropPositionController?.name?.(t("gui.position", "Position"));
    g.savePropRotationController?.name?.(t("gui.rotation", "Rotation"));
    g.savePropScaleController?.name?.(t("gui.scale", "Scale"));
    g.savePropCameraController?.name?.(t("gui.camera", "Camera"));
    g.savePropDirectionalController?.name?.(t("gui.directionalLight", "Directional Light"));
    g.savePropAmbientController?.name?.(t("gui.ambientLight", "Ambient Light"));
    g.savePropCameraLightController?.name?.(t("gui.cameraLight", "Camera Light"));
    g.savePropBackgroundController?.name?.(t("gui.backgroundColor", "Background Color"));
    g.directionalLightColorController?.name?.(t("gui.color", "Color"));
    g.directionalLightIntensityController?.name?.(t("gui.intensity", "Intensity"));
    g.ambientLightColorController?.name?.(t("gui.color", "Color"));
    g.ambientLightIntensityController?.name?.(t("gui.intensity", "Intensity"));
    g.cameraLightColorController?.name?.(t("gui.color", "Color"));
    g.cameraLightIntensityController?.name?.(t("gui.intensity", "Intensity"));
    g.editMaterialsController?.name?.(t("gui.editMaterial", "Edit material"));

    this.refreshOptionController(g.transformObjectController, {
      [t("gui.none", "None")]: "",
      [t("gui.move", "Move")]: "translate",
      [t("gui.rotate", "Rotate")]: "rotate",
      [t("gui.scale", "Scale")]: "scale",
    });
    this.refreshOptionController(g.transformModeController, {
      [t("gui.local", "Local")]: "local",
      [t("gui.global", "Global")]: "global",
    });
    this.refreshOptionController(g.transformLightController, {
      [t("gui.none", "None")]: "",
      [t("gui.move", "Move")]: "translate",
      [t("gui.target", "Target")]: "rotate",
    });
    this.refreshOptionController(g.backgroundTypeController, {
      [t("gui.linear", "Linear")]: "linear",
      [t("gui.gradient", "Gradient")]: "gradient",
    });
    this.refreshOptionController(g.performanceController, {
      [t("gui.highPerformance", "High-performance")]: "high-performance",
      [t("gui.lowPower", "Low-power")]: "low-power",
      [t("gui.default", "Default")]: "default",
    });
    this.refreshOptionController(g.editMaterialsController, {
      [t("gui.selectByMaterial", "select by material")]: "select by material",
    });
  },

  updateLocalPreviewLabels() {
    const label = document.querySelector("#example-model-picker label[for='example-model-select']");
    if (label) {
      label.textContent = t("localPreview.loadExampleModel", "Load example model");
    }
  },

  updateIIIFFormLabels() {
    const form = document.getElementById("form-IIIF");
    if (!form) return;
    const title = form.querySelector(".form-IIIF-header .title");
    if (title) title.textContent = t("iiif.loader", "IIIF Loader");
    const collapseBtn = document.getElementById("iiif-toggle-collapse");
    if (collapseBtn) {
      const isCollapsed = form.classList.contains("collapsed");
      collapseBtn.title = isCollapsed
        ? t("iiif.expand", "Expand")
        : t("iiif.collapse", "Collapse");
    }
    const label = form.querySelector(".form-IIIF-label");
    if (label) label.textContent = t("iiif.manifest", "IIIF manifest");
    const select = document.getElementById("iiif-manifest-select");
    if (select) {
      const optionLabelByUrl = {
        "https://raw.githubusercontent.com/IIIF/3d/main/manifests/4_transform_and_position/model_transform_scale_position.json": t("iiif.optionModelPositionScale", "Model Position and Scale"),
        "https://raw.githubusercontent.com/IIIF/3d/main/manifests/1_basic_model_in_scene/model_origin.json": t("iiif.optionModelOrigin", "Model Origin"),
        "https://raw.githubusercontent.com/IIIF/3d/main/manifests/1_basic_model_in_scene/model_origin_bgcolor.json": t("iiif.optionModelOriginBg", "Model Origin with background color"),
        "https://raw.githubusercontent.com/IIIF/3d/main/manifests/4_transform_and_position/model_position.json": t("iiif.optionModelPosition", "Model Position"),
      };
      Array.from(select.options).forEach((option) => {
        const labelFromMap = optionLabelByUrl[option.value];
        if (labelFromMap) option.textContent = labelFromMap;
      });
    }
    const manifestUrl = document.getElementById("manifest-url");
    if (manifestUrl) manifestUrl.placeholder = t("iiif.manifestUrlPlaceholder", "https://example.org/iiif/manifest.json");
    const manifestText = document.getElementById("manifest-text");
    if (manifestText) manifestText.placeholder = t("iiif.manifestTextPlaceholder", "Paste IIIF manifest JSON here...");
    const loadFromUrlButton = document.getElementById("load-manifest-from-url");
    if (loadFromUrlButton) loadFromUrlButton.textContent = t("iiif.loadFromUrl", "Load from URL");
    const loadFromTextButton = document.getElementById("load-manifest-from-text");
    if (loadFromTextButton) loadFromTextButton.textContent = t("iiif.loadFromText", "Load from Text");
  },

  updateMetadataPanelLabels() {
    const metadataContainer = document.getElementById("metadata-container");
    if (!metadataContainer) return;
    metadataContainer.querySelectorAll("[data-i18n-key]").forEach((node) => {
      const key = node.getAttribute("data-i18n-key");
      if (!key) return;
      const needsColon = node.classList.contains("metadata-label");
      const text = t(key, node.textContent?.replace(/:\s*$/, "") || "");
      node.textContent = needsColon ? `${text}:` : text;
    });
  },

  applyLanguage({ persist = true } = {}) {
    if (persist) {
      window.localStorage.setItem(this.LANGUAGE_STORAGE_KEY, core.currentLanguage);
    }
    this.updateLocalizedUI();
  },

  toggleLanguage() {
    if (!this.languageModeDropdown) return;
    const isVisible = !this.languageModeDropdown.hidden;
    this.languageModeDropdown.hidden = isVisible;
  },

  selectLanguage(lang) {
    core.currentLanguage = lang;
    this.languageModeDropdown.hidden = true;
    this.closeActionMenu();
    this.applyLanguage();
  },

  updatePickingModeControllerLabel() {
    if (!this.pickingModeController?.name) return;
    this.pickingModeController.name(
      this.pickingMode
        ? t("controls.disablePickingMode", "Disable picking mode")
        : t("controls.enablePickingMode", "Enable picking mode")
    );
  },

  updateDistanceMeasurementControllerLabel() {
    if (!this.distanceMeasurementController?.name) return;
    this.distanceMeasurementController.name(
      this.RULER_MODE
        ? t("controls.disableDistanceMeasurement", "Disable distance measurement")
        : t("controls.enableDistanceMeasurement", "Enable distance measurement")
    );
  },

  getDistanceMeasurementScaleMeters() {
    const configuredScale = Number(core.CONFIG?.viewer?.measurement?.modelUnitInMeters);
    if (Number.isFinite(configuredScale) && configuredScale > 0) return configuredScale;
    return 1;
  },

  formatMeasuredDistance(rawDistanceInModelUnits) {
    const scaleMeters = this.getDistanceMeasurementScaleMeters();
    const meters = rawDistanceInModelUnits * scaleMeters;

    if (!Number.isFinite(meters)) {
      return { text: "0 mm", meters: 0, scaleMeters };
    }

    if (meters >= 1) {
      return { text: `${meters.toFixed(2)} m`, meters, scaleMeters };
    }

    if (meters >= 0.01) {
      return { text: `${(meters * 100).toFixed(1)} cm`, meters, scaleMeters };
    }

    return { text: `${(meters * 1000).toFixed(0)} mm`, meters, scaleMeters };
  },

  updateSelectedFacesControllerLabel() {
    if (!this.selectedFacesCountController?.name) return;
    this.selectedFacesCountController.name(t("controls.selectedFaces", "Selected faces"));
  },

  updatePickingHintVisibility() {
    if (!this.pickingHint) return;
    const hasSelectedFaces = Array.isArray(this.selectedFaces) && this.selectedFaces.length > 0;
    this.pickingHint.hidden = !this.pickingMode || hasSelectedFaces;
    this.updateClippingHintVisibility();
  },

  updateClippingHintVisibility() {
    if (!this.clippingHint) return;
    const clippingMode = this.planeParams?.clippingMode || {};
    const hasActiveClipping = Boolean(clippingMode.x || clippingMode.y || clippingMode.z);
    const pickingHintVisible = Boolean(this.pickingHint && this.pickingHint.hidden === false);
    this.clippingHint.hidden = !hasActiveClipping || pickingHintVisible;
  },

  updatePickingControlsVisibility() {
    const method = this.pickingMode ? "show" : "hide";
    this.clearSelectedFacesController?.[method]?.();
    this.selectedFacesCountController?.[method]?.();
    this.updateAddAnnotationControllerState();
    this.updatePickingHintVisibility();
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
  },

  updateAddAnnotationControllerState() {
    if (!this.addAnnotationController) return;
    this.addAnnotationController.enable?.();
  },

  getKeyboardShortcutsText() {
    return [
      t("shortcuts.mouse"),
      t("shortcuts.keyboard"),
      t("shortcuts.touch"),
      core.CONFIG?.viewer?.enableDragAndDrop === true ? t("shortcuts.dragAndDrop") : null
    ].join("\n");
  },

  getSupportedFormatsText() {
    return this.SUPPORTED_EXTENSIONS.map((extension) => extension.toUpperCase()).join(", ");
  },

  updateDragAndDropHint() {
    if (!this.dragAndDropHint) return;
    if (core.CONFIG?.viewer?.enableDragAndDrop === true) {
      this.dragAndDropHint.textContent = t("shortcuts.dragAndDrop", "You can also drag and drop a model file here to load it");
      this.dragAndDropHint.hidden = false;
    } else {
      this.dragAndDropHint.hidden = true;
    }

  },

  getLoadingLogMessages() {
    return this.loadingLogMessageKeys.map((key) => t(key));
  },

  getProcessingLoadingSteps() {
    return this.processingLoadingStepKeys.map((key) => t(key));
  },

  createModelLoadingProgress(shell) {
    shell.className = "model-loader";
    shell.hidden = true;
    shell.setAttribute("role", "status");
    shell.setAttribute("aria-live", "polite");

    const ring = document.createElement("div");
    ring.className = "model-loader__ring";
    ring.setAttribute("aria-hidden", "true");

    const percent = document.createElement("div");
    percent.className = "model-loader__percent";
    percent.textContent = "0%";
    ring.appendChild(percent);

    const content = document.createElement("div");
    content.className = "model-loader__content";


    const phase = document.createElement("div");
    phase.className = "model-loader__phase";
    phase.textContent = this.getLoadingLogMessages()[0] ?? t("loadingLog.loadingAssets", "Loading assets");

    const phaseViewport = document.createElement("div");
    phaseViewport.className = "model-loader__phase-viewport";

    const phaseList = document.createElement("div");
    phaseList.className = "model-loader__phase-list";

    phaseViewport.appendChild(phaseList);

    const messages = this.getLoadingLogMessages();
    const stageKeyToIndex = new Map(
      this.loadingLogMessageKeys.map((key, index) => [key, index])
    );
    const loadingModelKeyIndex = Math.max(
      0,
      stageKeyToIndex.get("loadingLog.loadingModel") ?? 0
    );
    let hideTimer = null;

    messages.forEach((msg) => {
      const item = document.createElement("div");
      item.className = "model-loader__phase-item";
      item.textContent = msg;
      phaseList.appendChild(item);
    });

    const clearHideTimer = () => {
      if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
      }
    };

    const updatePhase = (index) => {
      const itemHeight = phaseList.firstElementChild?.offsetHeight || 24;
      phaseList.style.transform = `translateY(-${index * itemHeight}px)`;
      phase.textContent = messages[index] || messages[loadingModelKeyIndex] || phase.textContent;
      Array.from(phaseList.children).forEach((item, itemIndex) => {
        item.toggleAttribute("data-active", itemIndex === index);
        item.toggleAttribute("data-near", itemIndex === index - 1 || itemIndex === index + 1);
      });
    };

    const track = document.createElement("div");
    track.className = "model-loader__track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", "0");
    content.append(phaseViewport, track);

    const bar = document.createElement("div");
    bar.className = "model-loader__bar";
    track.appendChild(bar);

    shell.replaceChildren(ring, content);

    const set = (value = 0, maxValue = 100) => {
      const safeMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 100;
      const normalized = Number.isFinite(value) ? Math.min(Math.max(value / safeMax, 0), 1) : 0;
      const progress = Math.round(normalized * 100);

      shell.style.setProperty("--model-loader-progress", String(progress));
      percent.textContent = `${progress}%`;
      bar.style.width = `${progress}%`;
      track.setAttribute("aria-valuenow", String(progress));
      updatePhase(loadingModelKeyIndex);
    };

    set(0, 100);

    return {
      getElement: () => shell,
      show: () => {
        clearHideTimer();
        shell.hidden = false;
        delete shell.dataset.complete;
        updatePhase(loadingModelKeyIndex);
      },
      hide: () => {
        clearHideTimer();
        shell.hidden = true;
        delete shell.dataset.complete;
      },
      setStage: (stageKey, progressValue = null) => {
        const index = stageKeyToIndex.get(stageKey);
        if (typeof index === "number") {
          updatePhase(index);
        }
        if (Number.isFinite(progressValue)) {
          const normalizedProgress = Math.max(0, Math.min(Math.round(progressValue), 100));
          shell.style.setProperty("--model-loader-progress", String(normalizedProgress));
          percent.textContent = `${normalizedProgress}%`;
          bar.style.width = `${normalizedProgress}%`;
          track.setAttribute("aria-valuenow", String(normalizedProgress));
        }
      },
      complete: (delayMs = 2400) => {
        clearHideTimer();
        updatePhase(stageKeyToIndex.get("loadingLog.modelLoaded") ?? messages.length - 1);
        shell.style.setProperty("--model-loader-progress", "100");
        percent.textContent = "100%";
        bar.style.width = "100%";
        track.setAttribute("aria-valuenow", "100");
        shell.dataset.complete = "true";
        hideTimer = window.setTimeout(() => {
          hideTimer = null;
          delete shell.dataset.complete;
          shell.hidden = true;
        }, delayMs);
      },
      set,
      reset: (maxValue = 100) => {
        clearHideTimer();
        delete shell.dataset.complete;
        set(0, maxValue);
      },
    };
  },

  createLoadingLog() {
    const shell = document.createElement("div");
    shell.id = "loading-log";
    shell.setAttribute("aria-live", "polite");
    shell.hidden = true;
    shell.style.setProperty("bottom", "-55px");

    const collapsedToggle = document.createElement("button");
    collapsedToggle.type = "button";
    collapsedToggle.className = "loading-log__collapsed-toggle";
    collapsedToggle.setAttribute("aria-label", t("loadingLog.title", "Loading process log"));
    collapsedToggle.setAttribute("aria-expanded", "false");
    shell.appendChild(collapsedToggle);

    const header = document.createElement("button");
    header.type = "button";
    header.className = "loading-log__header";
    header.setAttribute("aria-expanded", "false");

    const headerTitle = document.createElement("span");
    headerTitle.className = "loading-log__title";
    headerTitle.textContent = t("loadingLog.title", "Loading process log");

    const headerSummary = document.createElement("span");
    headerSummary.className = "loading-log__summary";

    header.append(headerTitle, headerSummary);
    shell.appendChild(header);

    const body = document.createElement("div");
    body.className = "loading-log__body";

    const list = document.createElement("div");
    list.className = "loading-log__messages";

    const progress = document.createElement("div");
    progress.className = "loading-log__progress";
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "100");
    progress.setAttribute("aria-valuenow", "0");

    const progressBar = document.createElement("div");
    progressBar.className = "loading-log__progress-bar";
    progress.appendChild(progressBar);

    body.append(list, progress);
    shell.appendChild(body);
    core.container.appendChild(shell);

    let timer = null;
    let messageIndex = 0;
    let visibleCount = 0;
    let currentProgress = 0;
    let startedAt = 0;
    let hideTimer = null;
    let progressUpdated = false;
    const minVisibleMs = 900;
    const loadingMessages = this.getLoadingLogMessages();
    const loadingStageKeyToIndex = new Map(
      this.loadingLogMessageKeys.map((key, index) => [key, index])
    );
    const loadingModelMessageIndex = Math.max(
      0,
      loadingStageKeyToIndex.get("loadingLog.loadingModel") ?? 0
    );
    let isExpanded = false;

    const setExpanded = (expanded) => {
      isExpanded = expanded;
      shell.dataset.expanded = expanded ? "true" : "false";
      header.setAttribute("aria-expanded", expanded ? "true" : "false");
      collapsedToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    };

    const updateSummary = () => {
      const activeMessage = loadingMessages[messageIndex] || loadingMessages[loadingModelMessageIndex] || "";
      headerSummary.textContent = `${currentProgress}% • ${activeMessage}`;
    };

    header.addEventListener("click", () => {
      if (shell.hidden) return;
      setExpanded(!isExpanded);
    });

    collapsedToggle.addEventListener("click", () => {
      if (shell.hidden) return;
      setExpanded(!isExpanded);
    });

    const renderMessages = (allDone = false) => {
      const messages = loadingMessages
        .slice(Math.max(0, messageIndex - visibleCount + 1), messageIndex + 1);
      list.replaceChildren(...messages.map((message, index) => {
        const row = document.createElement("div");
        row.className = "loading-log__message";
        if (allDone) {
          row.classList.add("loading-log__message--done");
        } else if (index === messages.length - 1) {
          row.classList.add("loading-log__message--active");
        }
        row.textContent = message;
        return row;
      }));
    };

    const setProgress = (value) => {
      const normalizedValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
      currentProgress = Math.max(currentProgress, Math.round(normalizedValue));
      progressBar.style.width = `${currentProgress}%`;
      progress.setAttribute("aria-valuenow", String(currentProgress));
      updateSummary();
    };

    const tick = () => {
      visibleCount = Math.min(4, visibleCount + 1);
      if (!progressUpdated) {
        messageIndex = loadingModelMessageIndex;
        setProgress(Math.min(currentProgress + 8, 12));
      }
      renderMessages();
    };

    const stop = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const clearHideTimer = () => {
      if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
      }
    };

    const collapseLog = () => {
      shell.classList.remove("loading-log--done");
      shell.classList.remove("loading-log--error");
      setExpanded(false);
      hideTimer = null;
    };

    return {
      start: () => {
        stop();
        clearHideTimer();
        progressUpdated = false;
        startedAt = performance.now();
        shell.hidden = false;
        setExpanded(false);
        shell.classList.remove("loading-log--done", "loading-log--error");
        messageIndex = loadingModelMessageIndex;
        visibleCount = 1;
        currentProgress = 0;
        renderMessages();
        setProgress(6);
        timer = window.setInterval(tick, 520);
      },
      update: (value) => {
        if (shell.hidden) return;
        progressUpdated = true;
        const normalized = Number.isFinite(value) ? value : 0;
        messageIndex = loadingModelMessageIndex;
        visibleCount = Math.min(4, Math.max(visibleCount, 2));
        renderMessages();
        setProgress(Math.min(normalized, 99));
      },
      setStage: (stageKey, progressValue = null) => {
        if (shell.hidden) return;
        const stageIndex = loadingStageKeyToIndex.get(stageKey);
        if (typeof stageIndex === "number") {
          messageIndex = stageIndex;
          visibleCount = Math.min(4, Math.max(visibleCount, 2));
          renderMessages();
          updateSummary();
        }
        if (Number.isFinite(progressValue)) {
          setProgress(progressValue);
        }
      },
      finish: () => {
        if (shell.hidden) return;
        stop();
        const messageCount = loadingMessages.length;
        messageIndex = messageCount - 1;
        visibleCount = messageCount;
        renderMessages(true);
        setProgress(100);
        updateSummary();
        shell.classList.add("loading-log--done");
        const visibleFor = performance.now() - startedAt;
        const hideDelay = Math.max(1200, minVisibleMs - visibleFor + 800);
        clearHideTimer();
        hideTimer = window.setTimeout(() => {
          collapseLog();
        }, hideDelay);
      },
      fail: () => {
        if (shell.hidden) return;
        stop();
        clearHideTimer();
        setExpanded(true);
        shell.classList.add("loading-log--error");
        hideTimer = window.setTimeout(() => {
          shell.classList.remove("loading-log--error");
          setExpanded(false);
          hideTimer = null;
        }, 2000);
      }
    };
  },

  showStatusNotice(message, duration = 2600, options = {}) {
    this.enqueueStatusNotice({ message, duration, tone: "info", ...options });
  },

  localizeStatusNotice(notice) {
    if (!notice) return notice;
    const i18nKey = String(notice.i18nKey || "");
    const detailI18nKey = String(notice.detailI18nKey || "");
    return {
      ...notice,
      message: i18nKey ? t(i18nKey, notice.i18nVars || {}, notice.message) : notice.message,
      detail: detailI18nKey ? t(detailI18nKey, notice.detailI18nVars || {}, notice.detail) : notice.detail,
    };
  },

  renderStatusNoticeContent(notice) {
    if (!this.statusNotice || !notice) return;
    const message = String(notice.message ?? "");
    const detail = String(notice.detail ?? "");

    this.statusNotice.textContent = "";

    const messageNode = document.createElement("span");
    messageNode.className = "viewer-notice-message";
    messageNode.textContent = message;
    this.statusNotice.appendChild(messageNode);

    if (detail) {
      const detailNode = document.createElement("span");
      detailNode.className = "viewer-notice-detail";
      detailNode.textContent = detail;
      this.statusNotice.appendChild(detailNode);
    }
  },

  getStatusNoticeText(notice) {
    return [notice?.message, notice?.detail].filter(Boolean).join(" ");
  },

  refreshStatusNoticeLanguage() {
    if (Array.isArray(this.statusNoticeQueue)) {
      this.statusNoticeQueue = this.statusNoticeQueue.map((notice) => this.localizeStatusNotice(notice));
    }

    if (!this.statusNoticeCurrent) return;
    this.statusNoticeCurrent = this.localizeStatusNotice(this.statusNoticeCurrent);
    this.renderStatusNoticeContent(this.statusNoticeCurrent);
  },

  showStatusNoticeNow(notice) {
    if (!this.statusNotice || !notice) return;
    notice = this.localizeStatusNotice(notice);

    if (this.statusNoticeHideTimer) {
      clearTimeout(this.statusNoticeHideTimer);
      this.statusNoticeHideTimer = null;
    }

    this.statusNoticeActive = true;
    this.statusNoticeCurrent = notice;
    this.statusNotice.hidden = false;
    this.renderStatusNoticeContent(notice);
    this.statusNotice.dataset.tone = notice.tone || "info";
    if (notice.variant) {
      this.statusNotice.dataset.variant = notice.variant;
    } else {
      delete this.statusNotice.dataset.variant;
    }
    this.noticeContainer?.classList.toggle("viewer-notice-container--sandbox", notice.variant === "sandbox");
    this.statusNotice.classList.remove("is-hiding");
    this.statusNotice.classList.add("is-visible");

    if (this.statusNoticeTimer) {
      clearTimeout(this.statusNoticeTimer);
      this.statusNoticeTimer = null;
    }

    if (notice.persistent) {
      return;
    }

    this.statusNoticeTimer = setTimeout(() => {
      if (this.statusNotice) {
        this.statusNotice.classList.remove("is-visible");
        this.statusNotice.classList.add("is-hiding");
      }

      this.statusNoticeHideTimer = setTimeout(() => {
        if (this.statusNotice) {
          this.statusNotice.hidden = true;
          this.statusNotice.classList.remove("is-hiding");
          delete this.statusNotice.dataset.variant;
        }
        this.noticeContainer?.classList.remove("viewer-notice-container--sandbox");
        this.statusNoticeActive = false;
        this.statusNoticeCurrent = null;
        this.statusNoticeTimer = null;
        this.statusNoticeHideTimer = null;
        this.processStatusNoticeQueue();
      }, 220);
    }, notice.duration);
  },

  dismissStatusNotice(key = "") {
    const normalizedKey = String(key || "");
    this.statusNoticeQueue = this.statusNoticeQueue.filter(
      (entry) => normalizedKey && (entry?.key || "") !== normalizedKey
    );

    if (
      normalizedKey &&
      (!this.statusNoticeCurrent || (this.statusNoticeCurrent.key || "") !== normalizedKey)
    ) {
      return;
    }

    if (this.statusNoticeTimer) {
      clearTimeout(this.statusNoticeTimer);
      this.statusNoticeTimer = null;
    }
    if (this.statusNoticeHideTimer) {
      clearTimeout(this.statusNoticeHideTimer);
      this.statusNoticeHideTimer = null;
    }

    if (this.statusNotice) {
      this.statusNotice.hidden = true;
      this.statusNotice.classList.remove("is-visible", "is-hiding");
      delete this.statusNotice.dataset.variant;
    }
    this.noticeContainer?.classList.remove("viewer-notice-container--sandbox");

    this.statusNoticeActive = false;
    this.statusNoticeCurrent = null;
    this.processStatusNoticeQueue();
  },

  enqueueStatusNotice({
    message,
    duration = 2600,
    tone = "info",
    key = "",
    replace = false,
    persistent = false,
    variant = "",
    i18nKey = "",
    i18nVars = {},
    detail = "",
    detailI18nKey = "",
    detailI18nVars = {},
  } = {}) {
    const text = String(message ?? "");
    if (!text) return;

    const nextNotice = {
      message: text,
      tone,
      duration: Number.isFinite(duration) ? duration : 2600,
      key: String(key || ""),
      persistent,
      variant: String(variant || ""),
      i18nKey: String(i18nKey || ""),
      i18nVars: i18nVars && typeof i18nVars === "object" ? { ...i18nVars } : {},
      detail: String(detail || ""),
      detailI18nKey: String(detailI18nKey || ""),
      detailI18nVars: detailI18nVars && typeof detailI18nVars === "object" ? { ...detailI18nVars } : {},
    };

    if (
      this.statusNoticeActive &&
      this.getStatusNoticeText(this.statusNoticeCurrent) === this.getStatusNoticeText(nextNotice) &&
      (this.statusNoticeCurrent?.tone || "info") === nextNotice.tone &&
      (this.statusNoticeCurrent?.key || "") === nextNotice.key
    ) {
      return;
    }

    if (nextNotice.key) {
      this.statusNoticeQueue = this.statusNoticeQueue.filter(
        (entry) => (entry?.key || "") !== nextNotice.key
      );
    }

    if (
      replace &&
      this.statusNoticeActive &&
      (!nextNotice.key || (this.statusNoticeCurrent?.key || "") === nextNotice.key)
    ) {
      this.showStatusNoticeNow(nextNotice);
      return;
    }

    const isDuplicateQueued = this.statusNoticeQueue.some(
      (entry) =>
        this.getStatusNoticeText(entry) === this.getStatusNoticeText(nextNotice) &&
        entry?.tone === nextNotice.tone &&
        (entry?.key || "") === nextNotice.key
    );
    if (isDuplicateQueued) return;

    const priorityMap = {
      error: 0,
      warning: 1,
      info: 2,
      success: 3,
    };
    const nextPriority = priorityMap[nextNotice.tone] ?? 2;
    const insertAt = this.statusNoticeQueue.findIndex((entry) => {
      const entryPriority = priorityMap[entry?.tone] ?? 2;
      return nextPriority < entryPriority;
    });

    if (insertAt === -1) {
      this.statusNoticeQueue.push(nextNotice);
    } else {
      this.statusNoticeQueue.splice(insertAt, 0, nextNotice);
    }

    this.processStatusNoticeQueue();
  },

  processStatusNoticeQueue() {
    if (this.statusNoticeActive) return;
    if (!this.statusNotice) return;
    if (!Array.isArray(this.statusNoticeQueue) || this.statusNoticeQueue.length === 0) return;

    const nextNotice = this.statusNoticeQueue.shift();
    if (!nextNotice) return;
    this.showStatusNoticeNow(nextNotice);
  },

  maybeShowKeyboardHint() {
    try {
      if (window.localStorage.getItem("viewerHintSeen") !== "1") return;
    } catch (_err) {
      // If storage is unavailable, keep previous behavior.
    }
    if (document.visibilityState !== "visible" || !document.hasFocus()) return;
    const now = Date.now();
    if (now - this.lastWindowFocusAt < this.keyboardHintAfterFocusDelayMs) return;
    if (this.pickingMode) return;
    const clippingMode = this.planeParams?.clippingMode || {};
    if (clippingMode.x || clippingMode.y || clippingMode.z) return;
    if (!core.handHint?.hidden || core.GESTURE?.active) return;
    if (now - this.lastKeyboardHintAt < this.keyboardHintCooldownMs) return;
    this.lastKeyboardHintAt = now;
    this.showStatusNotice(this.getKeyboardShortcutsText(), 7400);
  },

  isInteractiveTextInput(element) {
    if (!element || typeof element.closest !== "function") return false;
    return Boolean(
      element.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']")
    );
  },

  isViewerKeyboardActive(event) {
    if (this.isInteractiveTextInput(event?.target)) return false;
    if (!core.renderer?.domElement) return false;
    const active = document.activeElement;
    return active === core.renderer.domElement || core.renderer.domElement.contains(active);
  },

  isPointerDirectlyOverCanvas(event) {
    if (!core.renderer?.domElement || !event) return false;
    const x = Number(event.clientX);
    const y = Number(event.clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const topElement = document.elementFromPoint(x, y);
    if (!topElement) return false;
    return topElement === core.renderer.domElement;
  },

  animateKeyboardCameraTo(nextCameraPosition, nextTarget) {
    if (!core.camera || !core.controls || !nextCameraPosition || !nextTarget) return;

    const startCamera = core.camera.position.clone();
    const startTarget = core.controls.target.clone();
    const targetCamera = nextCameraPosition.clone();
    const targetControls = nextTarget.clone();
    const duration = this.keyboardTweenDurationMs;

    core.cameraTween?.stop?.();
    core.targetTween?.stop?.();

    core.cameraTween = new TWEEN.Tween(startCamera)
      .to(targetCamera, duration)
      .easing(TWEEN.Easing.Quadratic.Out)
      .onUpdate(() => {
        core.camera.position.copy(startCamera);
        core.cameraLight?.position.copy(startCamera);
        core.camera.updateProjectionMatrix();
      })
      .onComplete(() => {
        core.camera.position.copy(targetCamera);
        core.cameraLight?.position.copy(targetCamera);
        core.camera.updateProjectionMatrix();
      });

    core.targetTween = new TWEEN.Tween(startTarget)
      .to(targetControls, duration)
      .easing(TWEEN.Easing.Quadratic.Out)
      .onUpdate(() => {
        core.controls.target.copy(startTarget);
        core.controls.update();
      })
      .onComplete(() => {
        core.controls.target.copy(targetControls);
        core.controls.update();
      });

    core.cameraTween.start();
    core.targetTween.start();
  },

  rotateCameraByKeyboard(deltaTheta = 0, deltaPhi = 0) {
    if (!core.camera || !core.controls) return;

    const target = core.controls.target.clone();
    const offset = core.camera.position.clone().sub(target);
    if (offset.lengthSq() === 0) return;

    const spherical = new THREE.Spherical().setFromVector3(offset);
    const minPolar = 0.05;
    const maxPolar = Math.PI - 0.05;
    spherical.theta += deltaTheta;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + deltaPhi, minPolar, maxPolar);

    offset.setFromSpherical(spherical);
    const nextCamera = target.clone().add(offset);
    this.animateKeyboardCameraTo(nextCamera, target);
  },

  panCameraByKeyboard(directionX = 0, directionY = 0) {
    if (!core.camera || !core.controls) return;
    const distance = core.camera.position.distanceTo(core.controls.target) || 1;
    const panStep = distance * this.keyboardStep.panFactor;

    const forward = core.controls.target.clone().sub(core.camera.position).normalize();
    const right = new THREE.Vector3().crossVectors(forward, core.camera.up).normalize();
    const up = core.camera.up.clone().normalize();

    const panOffset = right.multiplyScalar(directionX * panStep).add(up.multiplyScalar(directionY * panStep));
    const nextCamera = core.camera.position.clone().add(panOffset);
    const nextTarget = core.controls.target.clone().add(panOffset);
    this.animateKeyboardCameraTo(nextCamera, nextTarget);
  },

  zoomCameraByKeyboard(zoomIn = true) {
    if (!core.camera || !core.controls) return;
    const factor = zoomIn ? 1 / this.keyboardStep.zoomFactor : this.keyboardStep.zoomFactor;
    const offset = core.camera.position.clone().sub(core.controls.target);
    let nextDistance = offset.length() * factor;

    if (Number.isFinite(core.controls.minDistance)) {
      nextDistance = Math.max(core.controls.minDistance, nextDistance);
    }
    if (Number.isFinite(core.controls.maxDistance) && core.controls.maxDistance > 0) {
      nextDistance = Math.min(core.controls.maxDistance, nextDistance);
    }
    if (nextDistance <= 0) return;

    offset.setLength(nextDistance);
    const nextTarget = core.controls.target.clone();
    const nextCamera = nextTarget.clone().add(offset);
    this.animateKeyboardCameraTo(nextCamera, nextTarget);
  },

  toggleAutoRotateByKeyboard() {
    if (!core.controls) return;
    core.controls.autoRotate = !core.controls.autoRotate;
    this.showStatusNotice(
      core.controls.autoRotate ? "Auto-rotate enabled" : "Auto-rotate disabled",
      1400
    );
    this.updateEmbedConfiguratorPreview();
  },

  onViewerKeyDown(event) {
    if (!Viewer.isViewerKeyboardActive(event)) return;

    const isFast = event.shiftKey;
    const rotateStep = isFast ? Viewer.keyboardStep.rotateFast : Viewer.keyboardStep.rotate;
    const isPanMode = event.ctrlKey || event.metaKey;
    let handled = false;

    switch (event.key) {
      case "ArrowLeft":
        if (isPanMode) Viewer.panCameraByKeyboard(-1, 0);
        else Viewer.rotateCameraByKeyboard(-rotateStep, 0);
        handled = true;
        break;
      case "ArrowRight":
        if (isPanMode) Viewer.panCameraByKeyboard(1, 0);
        else Viewer.rotateCameraByKeyboard(rotateStep, 0);
        handled = true;
        break;
      case "ArrowUp":
        if (isPanMode) Viewer.panCameraByKeyboard(0, 1);
        else Viewer.rotateCameraByKeyboard(0, -rotateStep);
        handled = true;
        break;
      case "ArrowDown":
        if (isPanMode) Viewer.panCameraByKeyboard(0, -1);
        else Viewer.rotateCameraByKeyboard(0, rotateStep);
        handled = true;
        break;
      case "+":
      case "=":
        Viewer.zoomCameraByKeyboard(true);
        handled = true;
        break;
      case "-":
      case "_":
        Viewer.zoomCameraByKeyboard(false);
        handled = true;
        break;
      case " ":
      case "Spacebar":
        Viewer.toggleAutoRotateByKeyboard();
        handled = true;
        break;
      default:
        break;
    }

    if (handled) {
      Viewer.maybeShowKeyboardHint();
      event.preventDefault();
      event.stopPropagation();
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

  async copyTextToClipboard(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const tempInput = document.createElement("textarea");
    tempInput.value = value;
    tempInput.setAttribute("readonly", "true");
    tempInput.style.position = "absolute";
    tempInput.style.left = "-9999px";
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    tempInput.remove();
  },

  getCurrentEmbedOptions({ includeCamera = false } = {}) {
    const entityId = core.CONFIG?.entity?.id;
    const modelPath = core.fileObject?.originalPath || core.container?.getAttribute("3d") || "";
    const options = {
      model: modelPath || null,
      id: entityId || null,
      theme: this.currentTheme === "light" ? "light" : null,
      autorotate: core.controls?.autoRotate === true,
      autorotateSpeed: Number.isFinite(core.controls?.autoRotateSpeed) ? core.controls.autoRotateSpeed : null,
      disableInteraction: this.urlOptions?.disableInteraction === true,
      hideUi: this.urlOptions?.hideUi === true,
      hideMetadata: this.urlOptions?.hideMetadata === true,
      presentationMode: core.PRESENTATION_MODE === true,
      sandboxMode: core.SANDBOX_MODE === true,
      cameraPosition: null,
      cameraTarget: null,
      fov: null,
    };

    if (includeCamera) {
      options.cameraPosition = this.formatVector3Param(core.camera?.position);
      options.cameraTarget = this.formatVector3Param(core.controls?.target);
      options.fov = Number.isFinite(core.camera?.fov) ? core.camera.fov : null;
    }

    return options;
  },

  applyEmbedOptionsToInputs(options = {}) {
    if (!this.embedConfigInputs) return;
    this.embedConfigInputs.model.value = options.model ?? "";
    this.embedConfigInputs.id.value = options.id ?? "";
    this.embedConfigInputs.theme.value = options.theme === "light" ? "light" : "dark";
    this.embedConfigInputs.autorotate.checked = options.autorotate === true;
    this.embedConfigInputs.autorotateSpeed.value = Number.isFinite(options.autorotateSpeed) ? String(options.autorotateSpeed) : "";
    this.embedConfigInputs.disableInteraction.checked = options.disableInteraction === true;
    this.embedConfigInputs.hideUi.checked = options.hideUi === true;
    this.embedConfigInputs.hideMetadata.checked = options.hideMetadata === true;
    this.embedConfigInputs.presentationMode.checked = options.presentationMode === true;
    this.embedConfigInputs.camPos.value = options.cameraPosition ?? "";
    this.embedConfigInputs.camTarget.value = options.cameraTarget ?? "";
    this.embedConfigInputs.fov.value = Number.isFinite(options.fov) ? String(options.fov) : "";
  },

  setEmbedInputError(input, hasError, message = "") {
    if (!input) return;
    input.classList.toggle("embed-input-invalid", hasError);
    if (hasError && message) {
      input.setAttribute("title", message);
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("title");
      input.removeAttribute("aria-invalid");
    }
  },

  validateEmbedInputFields() {
    if (!this.embedConfigInputs) return true;
    const { camPos, camTarget, fov } = this.embedConfigInputs;
    const camPosRaw = camPos.value.trim();
    const camTargetRaw = camTarget.value.trim();
    const fovRaw = fov.value.trim();

    const camPosOk = camPosRaw === "" || this.parseVector3Param(camPosRaw) !== null;
    const camTargetOk = camTargetRaw === "" || this.parseVector3Param(camTargetRaw) !== null;
    const parsedFov = this.parseFloatParam(fovRaw);
    const fovOk = fovRaw === "" || (Number.isFinite(parsedFov) && parsedFov >= 1 && parsedFov <= 179);

    this.setEmbedInputError(camPos, !camPosOk, "Use format: x,y,z (for example 1.2,0.8,2.5)");
    this.setEmbedInputError(camTarget, !camTargetOk, "Use format: x,y,z (for example 0,0,0)");
    this.setEmbedInputError(fov, !fovOk, "FOV must be a number from 1 to 179");

    return camPosOk && camTargetOk && fovOk;
  },

  buildEmbedPayload(options = {}) {
    const embedUrl = this.getEmbedPageUrl();
    const params = new URLSearchParams();

    if (options.model) {
      params.set("model", options.model);
    } else if (options.id) {
      params.set("id", options.id);
    }

    if (options.theme === "light") {
      params.set("theme", options.theme);
    }

    if (options.autorotate === true) {
      params.set("autorotate", "1");
      if (Number.isFinite(options.autorotateSpeed)) {
        params.set("autorotateSpeed", String(options.autorotateSpeed));
      }
    }

    if (options.disableInteraction) {
      params.set("disableInteraction", "1");
    }
    if (options.hideUi) {
      params.set("hideUi", "1");
    }
    if (options.hideMetadata) {
      params.set("hideMetadata", "1");
    }
    if (options.presentationMode) {
      params.set("presentationMode", "1");
    }
    if (options.sandboxMode) {
      params.set("sandbox", "1");
    }
    if (options.cameraPosition) {
      params.set("camPos", options.cameraPosition);
    }
    if (options.cameraTarget) {
      params.set("camTarget", options.cameraTarget);
    }
    if (Number.isFinite(options.fov)) {
      params.set("fov", String(options.fov));
    }

    embedUrl.search = params.toString();

    return {
      url: embedUrl.toString(),
      code: `<iframe src="${embedUrl.toString()}" title="DFG 3D Viewer" loading="lazy" allow="fullscreen; xr-spatial-tracking" referrerpolicy="strict-origin-when-cross-origin" style="width:100%; aspect-ratio: 16 / 9; border: 0;"></iframe>`,
    };
  },

  getSharePayload() {
    return this.buildEmbedPayload(this.getCurrentEmbedOptions({ includeCamera: true }));
  },

  collectEmbedConfiguratorOptions() {
    const inputs = this.embedConfigInputs;
    if (!inputs) return this.getCurrentEmbedOptions({ includeCamera: true });
    const parsedCamPos = this.parseVector3Param(inputs.camPos.value);
    const parsedCamTarget = this.parseVector3Param(inputs.camTarget.value);
    const parsedFov = this.parseFloatParam(inputs.fov.value);
    const normalizedFov = Number.isFinite(parsedFov) ? Math.min(179, Math.max(1, parsedFov)) : null;
    return {
      model: inputs.model.value.trim() || null,
      id: inputs.id.value.trim() || null,
      theme: inputs.theme.value === "light" ? "light" : null,
      autorotate: inputs.autorotate.checked,
      autorotateSpeed: this.parseFloatParam(inputs.autorotateSpeed.value),
      disableInteraction: inputs.disableInteraction.checked,
      hideUi: inputs.hideUi.checked,
      hideMetadata: inputs.hideMetadata.checked,
      presentationMode: inputs.presentationMode.checked,
      cameraPosition: this.formatVector3Param(parsedCamPos),
      cameraTarget: this.formatVector3Param(parsedCamTarget),
      fov: normalizedFov,
    };
  },

  hasEmbedSourceSelection(options = {}) {
    return Boolean(options.model || options.id);
  },

  notifyMissingEmbedSource({ force = false } = {}) {
    if (!force && this.embedMissingSourceNotified) return;
    toastHelper("embedSourceMissing", "warning");
    this.embedMissingSourceNotified = true;
  },

  updateEmbedConfiguratorPreview() {
    if (!this.embedConfigInputs) return;
    this.validateEmbedInputFields();
    const options = this.collectEmbedConfiguratorOptions();
    if (!this.hasEmbedSourceSelection(options)) {
      this.notifyMissingEmbedSource();
    } else {
      this.embedMissingSourceNotified = false;
    }
    const payload = this.buildEmbedPayload(options);
    this.embedConfigInputs.url.value = payload.url;
    this.embedConfigInputs.iframe.value = payload.code;
    if (this.embedConfigPreviewFrame) {
      this.embedConfigPreviewFrame.src = payload.url;
    }
  },

  fillConfiguratorWithCurrentCamera() {
    if (!this.embedConfigInputs) return;
    this.embedConfigInputs.camPos.value = this.formatVector3Param(core.camera?.position) || "";
    this.embedConfigInputs.camTarget.value = this.formatVector3Param(core.controls?.target) || "";
    this.embedConfigInputs.fov.value = Number.isFinite(core.camera?.fov) ? String(core.camera.fov) : "";
    this.updateEmbedConfiguratorPreview();
  },

  resetEmbedConfiguratorFromViewerState() {
    if (!this.embedConfigInputs) return;
    this.applyEmbedOptionsToInputs(this.getCurrentEmbedOptions({ includeCamera: true }));
    this.updateEmbedConfiguratorPreview();
  },

  toggleEmbedConfigurator(event) {
    event?.preventDefault?.();
    this.closeActionMenu();
    if (!this.embedConfiguratorPanel) return;
    const willShow = this.embedConfiguratorPanel.hidden === true;
    this.embedConfiguratorPanel.hidden = !willShow;
    if (willShow) {
      this.updateEmbedConfiguratorPreview();
    }
    this.updateEmbedMenuEntryState();
  },

  openEmbedConfiguratorFromMenu(event) {
    this.toggleEmbedConfigurator(event);
  },

  createEmbedConfiguratorPanel() {
    if (!core.container || this.embedConfiguratorPanel) return;

    const defaults = this.getCurrentEmbedOptions({ includeCamera: true });
    const panel = document.createElement("div");
    panel.id = "embedConfiguratorPanel";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="embed-config-header">
        <span>Embed options</span>
        <button id="embedClosePanel" type="button" aria-label="Close embed options">X</button>
      </div>
      <div class="embed-config-layout">
        <div class="embed-config-main">
          <div class="embed-config-grid">
            <label>Model URL<input id="embedModelInput" type="text" placeholder="/examples/box.glb" value="${defaults.model ?? ""}" /></label>
            <label>Entity ID<input id="embedIdInput" type="text" value="${defaults.id ?? ""}" /></label>
            <label>Theme
              <select id="embedThemeInput">
                <option value="dark">Dark</option>
                <option value="light"${defaults.theme === "light" ? " selected" : ""}>Light</option>
              </select>
            </label>
            <label>Auto-rotate speed<input id="embedAutorotateSpeedInput" type="number" step="0.1" value="${Number.isFinite(defaults.autorotateSpeed) ? defaults.autorotateSpeed : ""}" /></label>
            <label>Camera position<input id="embedCamPosInput" type="text" placeholder="x,y,z" value="${defaults.cameraPosition ?? ""}" /></label>
            <label>Camera target<input id="embedCamTargetInput" type="text" placeholder="x,y,z" value="${defaults.cameraTarget ?? ""}" /></label>
            <label>FOV<input id="embedFovInput" type="number" step="1" min="1" max="179" value="${Number.isFinite(defaults.fov) ? defaults.fov : ""}" /></label>
          </div>
          <div class="embed-config-checks">
            <label><input id="embedAutorotateInput" type="checkbox"${defaults.autorotate ? " checked" : ""} /> Auto-rotate</label>
            <label><input id="embedDisableInteractionInput" type="checkbox"${defaults.disableInteraction ? " checked" : ""} /> Disable interaction</label>
            <label><input id="embedHideUiInput" type="checkbox"${defaults.hideUi ? " checked" : ""} /> Hide action menu</label>
            <label><input id="embedHideMetadataInput" type="checkbox"${defaults.hideMetadata ? " checked" : ""} /> Hide metadata</label>
            <label><input id="embedPresentationModeInput" type="checkbox"${defaults.presentationMode ? " checked" : ""} /> Presentation mode</label>
          </div>
          <div class="embed-config-actions">
            <button id="embedUseCurrentCamera" type="button">Use Current Camera</button>
            <button id="embedResetFromViewer" type="button">Reset From Viewer</button>
            <button id="embedCopyUrl" type="button">Copy URL</button>
            <button id="embedCopyIframe" type="button">Copy Iframe</button>
          </div>
          <label class="embed-config-field">Embed URL<textarea id="embedUrlOutput" readonly></textarea></label>
          <label class="embed-config-field">Iframe code<textarea id="embedIframeOutput" readonly></textarea></label>
        </div>
        <div class="embed-config-preview-side">
          <span>Preview</span>
          <iframe id="embedPreviewFrame" title="Embed preview" loading="lazy"></iframe>
        </div>
      </div>
    `;

    core.container.appendChild(panel);
    this.embedConfiguratorPanel = panel;
    this.embedConfigInputs = {
      model: panel.querySelector("#embedModelInput"),
      id: panel.querySelector("#embedIdInput"),
      theme: panel.querySelector("#embedThemeInput"),
      autorotate: panel.querySelector("#embedAutorotateInput"),
      autorotateSpeed: panel.querySelector("#embedAutorotateSpeedInput"),
      disableInteraction: panel.querySelector("#embedDisableInteractionInput"),
      hideUi: panel.querySelector("#embedHideUiInput"),
      hideMetadata: panel.querySelector("#embedHideMetadataInput"),
      presentationMode: panel.querySelector("#embedPresentationModeInput"),
      camPos: panel.querySelector("#embedCamPosInput"),
      camTarget: panel.querySelector("#embedCamTargetInput"),
      fov: panel.querySelector("#embedFovInput"),
      url: panel.querySelector("#embedUrlOutput"),
      iframe: panel.querySelector("#embedIframeOutput"),
    };
    this.embedConfigPreviewFrame = panel.querySelector("#embedPreviewFrame");

    const watchedInputs = [
      this.embedConfigInputs.model,
      this.embedConfigInputs.id,
      this.embedConfigInputs.theme,
      this.embedConfigInputs.autorotate,
      this.embedConfigInputs.autorotateSpeed,
      this.embedConfigInputs.disableInteraction,
      this.embedConfigInputs.hideUi,
      this.embedConfigInputs.hideMetadata,
      this.embedConfigInputs.presentationMode,
      this.embedConfigInputs.camPos,
      this.embedConfigInputs.camTarget,
      this.embedConfigInputs.fov,
    ];
    watchedInputs.forEach((input) => {
      if (!input) return;
      const eventName = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
      this.bindEventListener(input, eventName, () => this.updateEmbedConfiguratorPreview());
    });

    const useCurrentCameraButton = panel.querySelector("#embedUseCurrentCamera");
    const resetFromViewerButton = panel.querySelector("#embedResetFromViewer");
    const copyUrlButton = panel.querySelector("#embedCopyUrl");
    const copyIframeButton = panel.querySelector("#embedCopyIframe");
    const closePanelButton = panel.querySelector("#embedClosePanel");

    this.bindEventListener(useCurrentCameraButton, "click", () => this.fillConfiguratorWithCurrentCamera());
    this.bindEventListener(resetFromViewerButton, "click", () => this.resetEmbedConfiguratorFromViewerState());
    this.bindEventListener(closePanelButton, "click", () => {
      this.closeEmbedConfigurator();
    });
    this.bindEventListener(copyUrlButton, "click", async () => {
      try {
        const options = this.collectEmbedConfiguratorOptions();
        if (!this.hasEmbedSourceSelection(options)) {
          this.notifyMissingEmbedSource({ force: true });
          return;
        }
        const payload = this.buildEmbedPayload(options);
        await this.copyTextToClipboard(payload.url);
        toastHelper("embedUrlCopied", "success");
      } catch (error) {
        this.reportError(error, { context: "Copy embed URL failed" });
        toastHelper("embedUrlCopyError", "error");
      }
    });
    this.bindEventListener(copyIframeButton, "click", async () => {
      try {
        const options = this.collectEmbedConfiguratorOptions();
        if (!this.hasEmbedSourceSelection(options)) {
          this.notifyMissingEmbedSource({ force: true });
          return;
        }
        const payload = this.buildEmbedPayload(options);
        await this.copyTextToClipboard(payload.code);
        toastHelper("embedIframeCopied", "success");
      } catch (error) {
        this.reportError(error, { context: "Copy embed iframe failed" });
        toastHelper("embedIframeCopyError", "error");
      }
    });

    this.updateEmbedConfiguratorPreview();
  },

  async copyEmbedCode(event) {
    event?.preventDefault?.();
    Viewer.closeActionMenu();

    try {
      const { code } = Viewer.getSharePayload();
      await Viewer.copyTextToClipboard(code);
      toastHelper("embedCodeCopied", "success");
    } catch (error) {
      Viewer.reportError(error, { context: "Copy embed code failed" });
      toastHelper("embedCodeCopyError", "error");
    }
  },

  updateFullscreenButtonIcon() {
    if (this.editorToolbar) {
      if (this.fullscreenMode) {
        this.editorToolbar.classList.add("with-fullscreen");
      } else {
        this.editorToolbar.classList.remove("with-fullscreen");
      }
    }    
    if (!this.fullscreenMode) return;

    const isFullscreen = !!document.fullscreenElement;
    const label = isFullscreen
      ? t("fullscreen.exitMode", "Exit fullscreen mode")
      : t("fullscreen.mode", "Fullscreen mode");

    this.fullscreenMode.innerHTML = `
      <span class="viewer-action-icon ${isFullscreen ? "fullscreen-exit-icon" : "fullscreen-icon"}" aria-hidden="true"></span>
      <span>${isFullscreen ? t("fullscreen.exit", "Exit fullscreen") : t("fullscreen.enter", "Fullscreen")}</span>
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

  disposeFaceOverlay(entry) {
    if (!entry?.overlay) return;
    entry.overlay.removeFromParent();
    Viewer.disposeObjectResources(entry.overlay);
  },

  resetLoadedModelState() {
    Viewer.restoreLastPickedFace();
    Viewer.clearSelectedFaces();
    Viewer.closeAnnotationDialog();
    Viewer.annotationEntries.length = 0;
    Viewer.pendingAnnotationsXml = "";
    Viewer.clearAnnotationPOIs();
    core.transformControl?.detach?.();
    core.transformControlLight?.detach?.();
    core.transformControlLightTarget?.detach?.();
    Viewer.transformText["Transform 3D Object"] = "";
    Viewer.transformText["Transform Light"] = "";
    Viewer.pickingMode = false;
    Viewer.RULER_MODE = false;
    Viewer.updateEditorToolbarLabels();
    Viewer.updateEditorToolbarState();

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
    Viewer.updateSelectedFacesCount();
    Viewer.lastPickedFace = { id: "", object: "", faceIndex: null, overlay: null };
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
    const moduleUrl = new URL(import.meta.url);
    const settingsPath = moduleUrl.pathname.includes('/assets/')
      ? '../viewer-settings.json'
      : './viewer-settings.json';
    const url = new URL(settingsPath, moduleUrl);

    //Setup core variables first to make them available in the loaders and utils
    setCore('viewEntity', this.viewEntity);
    setCore('CONFIG', this.CONFIG);
    setCore('loadedFile', this.loadedFile);
    setCore('stats', this.stats);
    setCore('guiContainer', this.guiContainer);
    setCore('lilGui', this.lilGui);
    setCore('gui', this.gui);
    setCore('i18nGui', this.i18nGui);
    setCore('enqueueStatusNotice', this.enqueueStatusNotice.bind(this));
    setCore('dismissStatusNotice', this.dismissStatusNotice.bind(this));
    setCore('updateClippingHintVisibility', this.updateClippingHintVisibility.bind(this));

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
          presentationMode: "false",
          sandboxMode: "false",
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
          },
          measurement: {
            modelUnitInMeters: 1,
          }
        },
      };
    }

    this.isLightweight = Boolean(core.CONFIG.viewer.lightweight);
    setCore('isLightweight', this.isLightweight);
  
    this.EDITOR = Boolean(core.CONFIG.viewer.editor);
    setCore('EDITOR', this.EDITOR);

    const presentationModeFromConfig = this.parseBooleanParam(core.CONFIG.viewer.presentationMode);
    this.PRESENTATION_MODE = presentationModeFromConfig ?? Boolean(core.CONFIG.viewer.presentationMode);
    setCore('PRESENTATION_MODE', this.PRESENTATION_MODE);

    const sandboxModeFromConfig = this.parseBooleanParam(core.CONFIG.viewer.sandboxMode);
    this.SANDBOX_MODE = sandboxModeFromConfig ?? Boolean(core.CONFIG.viewer.sandboxMode);
    setCore('SANDBOX_MODE', this.SANDBOX_MODE);
    console.log(`Presentation mode: ${this.PRESENTATION_MODE ? "ON" : "OFF"}`);
    console.log(`Sandbox mode: ${this.SANDBOX_MODE ? "ON" : "OFF"}`);

    console.log(`AIM 3D-Viewer ${this.isLightweight ? '🪶 LIGHTWEIGHT' : '💪 FULL'} mode`);
    console.log(`Powered by Three.js (v${THREE.REVISION})`);
    
    if (!core.CONFIG.entity.metadata.sourceType) { 
      core.CONFIG.entity.metadata.sourceType = SOURCE;
      console.log(`Metadata source: ${core.CONFIG.entity.metadata.sourceType}`);
    }

    this.container = document.getElementById(core.CONFIG.viewer.container);
    if (!this.container) throw new Error("Container not found");
    setCore('container', this.container);
    document.body.classList.toggle("viewer-embed-page", this.isEmbedMode());

    this.parseUrlOptions();
    console.log(`Presentation mode: ${core.PRESENTATION_MODE ? "ON" : "OFF"}`);
    console.log(`Sandbox mode: ${core.SANDBOX_MODE ? "ON" : "OFF"}`);
    this.currentLanguage = this.getStoredLanguage();
    setCore('currentLanguage', this.currentLanguage);
    setCore('showNotifications', this.showNotifications);
    core.showNotifications = this.urlOptions.showNotifications;

    if (this.urlOptions.model) {
      this.container.setAttribute("3d", this.urlOptions.model);
    }
    if (this.shouldIgnoreLegacyEmbedDefaultModel()) {
      this.container.removeAttribute("3d");
    }

    this.scrollTop = window.scrollY || document.documentElement.scrollTop;
    this.rect = core.container.getBoundingClientRect();
    const e2eModel = this.getE2EModelOverride();
    if (e2eModel) {
      core.container.setAttribute("3d", e2eModel);
    }

    this.fileObject.originalPath = this.normalizeFileUrl(core.container.getAttribute("3d"));
    setCore('fileObject', this.fileObject);
    if (this.urlOptions.scale !== undefined && this.urlOptions.scale !== null) {
      core.CONFIG.viewer.scaleContainer.x = this.urlOptions.scale.x;
      core.CONFIG.viewer.scaleContainer.y = this.urlOptions.scale.y;
    }
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
      if (this.urlOptions.id) {
        core.CONFIG.entity.id = this.urlOptions.id;
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

    this.noticeContainer = document.createElement("div");
    this.noticeContainer.id = "viewerNoticeContainer";
    core.container.appendChild(this.noticeContainer);
    setCore("noticeContainer", this.noticeContainer);

    this.statusNotice = document.createElement("div");
    this.statusNotice.id = "viewerStatusNotice";
    this.statusNotice.className = "viewer-notice viewer-notice-status";
    this.statusNotice.hidden = true;
    this.statusNotice.setAttribute("role", "status");
    this.statusNotice.setAttribute("aria-live", "polite");
    this.noticeContainer.appendChild(this.statusNotice);
    setCore("statusNotice", this.statusNotice);
    this.statusNoticeQueue = [];
    this.statusNoticeActive = false;
    if (this.statusNoticeTimer) {
      clearTimeout(this.statusNoticeTimer);
      this.statusNoticeTimer = null;
    }

    if (!core.PRESENTATION_MODE) {
      this.handHint = document.createElement("div");
      this.handHint.id = "handHint";
      this.handHint.hidden = true;
      core.container.appendChild(this.handHint);
      setCore('handHint', this.handHint);

      this.pickingHint = document.createElement("div");
      this.pickingHint.id = "pickingHint";
      this.pickingHint.className = "viewer-notice viewer-notice-hint";
      this.pickingHint.textContent = "Shift + click to select multiple faces";
      this.pickingHint.hidden = true;
      this.noticeContainer.appendChild(this.pickingHint);
      setCore("pickingHint", this.pickingHint);

      this.clippingHint = document.createElement("div");
      this.clippingHint.id = "clippingHint";
      this.clippingHint.className = "viewer-notice viewer-notice-hint";
      this.clippingHint.textContent = "Drag active clipping plane helper to adjust cut";
      this.clippingHint.hidden = true;
      this.noticeContainer.appendChild(this.clippingHint);
      setCore("clippingHint", this.clippingHint);

      core.guiContainer = document.createElement("div");
      core.guiContainer.id = "guiContainer";
      core.guiContainer.className = "guiContainer";
      core.guiContainer.hidden = core.SANDBOX_MODE === true;
      core.container.appendChild(core.guiContainer);

      core.gui  = new GUI({ container: core.guiContainer });

      this.metadataContainer = document.createElement("div");
      this.metadataContainer.setAttribute("id", "metadata-container");
      this.metadataContainer.style.top = -this.metadataContainer.getBoundingClientRect().top + "px";
      if (this.urlOptions.hideMetadata) {
        this.metadataContainer.style.display = "none";
      }
      setCore('metadataContainer', this.metadataContainer);
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
      setCore('selectedObjects', this.selectedObjects);
    }

    this.spinnerContainer = document.createElement("div");
    this.spinnerContainer.id = "spinnerContainer";
    this.spinnerElement = document.createElement("div");
    this.spinnerElement.id = "spinner";
    this.spinnerContainer.appendChild(this.spinnerElement);
    core.container.appendChild(this.spinnerContainer);

    this.circle = this.createModelLoadingProgress(this.spinnerElement);
    setCore('circle', this.circle);
    if (!core.PRESENTATION_MODE) {
      this.loadingLog = this.createLoadingLog();
      setCore('loadingLog', this.loadingLog);
    }

    this.rect = core.container.getBoundingClientRect();

    this.clock = new THREE.Timer();

    Viewer.init();
    if (!core.PRESENTATION_MODE) {
      Viewer.prepareStats();
    }
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

  normalizeArchiveModelPath(path) {
    if (!path || typeof path !== "string") {
      return path;
    }

    const injectGltfSegment = (pathname) => pathname.replace(
      /\/([^/]+_(ZIP|RAR|TAR|XZ|GZ))\/([^/]+\.(glb|gltf))$/i,
      "/$1/gltf/$3"
    );

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
  },

  setModelPaths() {
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
    core.fileObject.relativePath = Viewer.normalizeDrupalFilesPath(core.fileObject.uri);
  },

  // Disable interaction hint on first interaction
 disableInteractionHint() {
    if (core.PRESENTATION_MODE) return;
    core.handHint.hidden = true;
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

    //core.handHint.classList.remove("hand-drag-animate");
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
    const loader = new FontLoader();
    const bevelSize = _scale / 10;

    loader.load(`${core.DFG_ASSETS}/fonts/helvetiker_regular.typeface.json`, (font) => {

      const baseOptions = {
        font: font,
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

      Viewer.rulerObject.add(group);
    });
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
      const normalizedHost = host.toLowerCase();
      const hasBadHost = host.includes("_") || normalizedHost === "default" || normalizedHost === "dfg_3dviewer";

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
    } catch (e) {
      if (url.startsWith("/sites/default/files/")) {
        return `${base}${url}`;
      }
      return url;
    }
  },

  normalizeFileUrl(rawUrl) {
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
      const hasBadHost =
        host === "default" ||
        host === "dfg_3dviewer" ||
        host.includes("_");

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
  },

  shouldIgnoreLegacyEmbedDefaultModel() {
    if (!this.isEmbedMode()) return false;
    if (this.urlOptions?.model || this.urlOptions?.id) return false;

    const sourceType = String(core.CONFIG?.entity?.metadata?.sourceType || "").toLowerCase();
    if (!sourceType.startsWith("drupal")) return false;

    const currentModelAttr = String(this.container?.getAttribute("3d") || "").trim();
    if (!currentModelAttr) return false;

    return /^(?:\.{1,2}\/)?examples\/box\.stl(?:\?.*)?$/i.test(currentModelAttr);
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

  createTriangleGeometry(intersection) {
    const position = intersection?.object?.geometry?.attributes?.position;
    const face = intersection?.face;

    if (!position || !face) return null;

    const trianglePositions = new Float32Array([
      position.getX(face.a), position.getY(face.a), position.getZ(face.a),
      position.getX(face.b), position.getY(face.b), position.getZ(face.b),
      position.getX(face.c), position.getY(face.c), position.getZ(face.c),
    ]);

    const triangleGeometry = new THREE.BufferGeometry();
    triangleGeometry.setAttribute("position", new THREE.BufferAttribute(trianglePositions, 3));
    triangleGeometry.computeVertexNormals();

    return triangleGeometry;
  },

  createPickingFaceOverlay(intersection, options = {}) {
    const triangleGeometry = Viewer.createTriangleGeometry(intersection);
    if (!triangleGeometry) return null;

    const fillColor = options.fillColor ?? 0xff0000;
    const lineColor = options.lineColor ?? 0xffffff;
    const opacity = options.opacity ?? 0.65;

    const overlayMaterial = new THREE.MeshBasicMaterial({
      color: fillColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
      toneMapped: false,
    });

    const fillMesh = new THREE.Mesh(triangleGeometry, overlayMaterial);
    fillMesh.renderOrder = 999;

    const lineGeometry = new THREE.EdgesGeometry(triangleGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: lineColor,
      transparent: true,
      opacity: Math.min(opacity + 0.2, 1),
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
    lineSegments.renderOrder = 1000;

    const overlayGroup = new THREE.Group();
    overlayGroup.name = "picking-face-overlay";
    overlayGroup.userData.isPickingOverlay = true;
    fillMesh.userData.isPickingOverlay = true;
    lineSegments.userData.isPickingOverlay = true;
    overlayGroup.add(fillMesh);
    overlayGroup.add(lineSegments);

    return overlayGroup;
  },

  isPickingOverlayObject(object) {
    let current = object;

    while (current) {
      if (current.userData?.isPickingOverlay === true || current.name === "picking-face-overlay") {
        return true;
      }
      current = current.parent;
    }

    return false;
  },

  getPrimaryIntersection(intersections) {
    if (!Array.isArray(intersections) || intersections.length === 0) return null;

    return intersections.find((entry) => !Viewer.isPickingOverlayObject(entry?.object)) ?? null;
  },

  getFaceSelectionKey(targetId, faceIndex) {
    if (!targetId || faceIndex === null || faceIndex === undefined) return "";
    return `${targetId}:${faceIndex}`;
  },

  findSelectedFaceIndex(targetId, faceIndex) {
    const key = Viewer.getFaceSelectionKey(targetId, faceIndex);
    return Viewer.selectedFaces.findIndex((entry) => entry.key === key);
  },

  updateSelectedFacesCount() {
    Viewer.pickingStats["Selected faces"] = Array.isArray(Viewer.selectedFaces)
      ? Viewer.selectedFaces.length
      : 0;
    const selectedFacesCount = Array.isArray(Viewer.selectedFaces) ? Viewer.selectedFaces.length : 0;
    if (selectedFacesCount < 1 && Viewer.annotationDialog && Viewer.annotationDialog.hidden === false) {
      Viewer.closeAnnotationDialog();
    }
    Viewer.updateAddAnnotationControllerState();
    Viewer.updatePickingHintVisibility();
  },

  toStableIdToken(value) {
    const normalized = String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return normalized || "target";
  },

  getSelectionRootObject(object) {
    let current = object;
    while (current?.parent && current.parent !== core.scene) {
      current = current.parent;
    }
    return current || object;
  },

  getSelectionRootSlot(rootObject) {
    if (!rootObject || !Array.isArray(core.mainObject)) return -1;
    return core.mainObject.findIndex((entry) => {
      if (entry === rootObject) return true;
      return Array.isArray(entry) && entry.includes(rootObject);
    });
  },

  getObjectHierarchyPath(object, rootObject) {
    if (!object || !rootObject) return "";
    const path = [];
    let current = object;
    while (current && current !== rootObject) {
      const parent = current.parent;
      if (!parent) break;
      const index = parent.children.indexOf(current);
      path.push(index >= 0 ? String(index) : "x");
      current = parent;
    }
    return path.reverse().join(".") || "root";
  },

  resolveFaceTargetId(object) {
    if (!object) return "";

    const explicitId = object.userData?.annotationTargetId || object.userData?.id;
    if (explicitId) return String(explicitId);

    const rootObject = Viewer.getSelectionRootObject(object);
    const rootSlot = Viewer.getSelectionRootSlot(rootObject);
    const path = Viewer.getObjectHierarchyPath(object, rootObject);
    let rootTag = rootSlot >= 0 ? `m${rootSlot}` : "m0";
    if (rootSlot >= 0 && Array.isArray(core.mainObject?.[rootSlot])) {
      const rootIndex = core.mainObject[rootSlot].indexOf(rootObject);
      if (rootIndex >= 0) {
        rootTag = `${rootTag}.${rootIndex}`;
      }
    }
    const targetId = `${rootTag}:${path}`;

    object.userData ??= {};
    object.userData.annotationTargetId = targetId;
    return targetId;
  },

  resolveObjectByTargetId(targetId) {
    const raw = String(targetId || "").trim();
    const match = raw.match(/^m(\d+)(?:\.(\d+))?:(.+)$/);
    if (!match) return null;

    const slot = Number.parseInt(match[1], 10);
    const rootIndex = Number.parseInt(match[2] || "0", 10);
    const path = match[3] || "root";
    if (!Number.isInteger(slot) || slot < 0) return null;

    const entry = core.mainObject?.[slot];
    if (!entry) return null;
    let rootObject = Array.isArray(entry) ? entry[rootIndex] : entry;
    if (!rootObject) return null;

    if (path === "root") return rootObject;
    const segments = path.split(".").filter(Boolean);
    for (const segment of segments) {
      const childIndex = Number.parseInt(segment, 10);
      if (!Number.isInteger(childIndex) || childIndex < 0) return null;
      rootObject = rootObject.children?.[childIndex];
      if (!rootObject) return null;
    }

    return rootObject;
  },

  getFaceCentroidWorld(object, faceIndex) {
    const geometry = object?.geometry;
    if (!geometry || !geometry.getAttribute) return null;
    const position = geometry.getAttribute("position");
    if (!position) return null;
    const face = Number(faceIndex);
    if (!Number.isInteger(face) || face < 0) return null;

    let ia = face * 3;
    let ib = ia + 1;
    let ic = ia + 2;
    const index = geometry.getIndex?.() || geometry.index || null;
    if (index?.array) {
      const arr = index.array;
      if (ic >= arr.length) return null;
      ia = arr[ia];
      ib = arr[ib];
      ic = arr[ic];
    } else if (ic >= position.count) {
      return null;
    }

    const va = new THREE.Vector3().fromBufferAttribute(position, ia);
    const vb = new THREE.Vector3().fromBufferAttribute(position, ib);
    const vc = new THREE.Vector3().fromBufferAttribute(position, ic);
    const center = va.add(vb).add(vc).multiplyScalar(1 / 3);
    object.updateMatrixWorld?.(true);
    center.applyMatrix4(object.matrixWorld);
    return center;
  },

  clearAnnotationPOIs() {
    this.closeAnnotationPOITooltip();
    if (!this.annotationPOIGroup) {
      this.annotationPOIMarkers = [];
      return;
    }

    this.annotationPOIGroup.children.slice().forEach((child) => {
      this.removeAndDisposeFromScene(child);
    });
    this.annotationPOIGroup.clear();
    this.annotationPOIMarkers = [];
    this.annotationPOIGroup.visible = false;
  },

  ensureAnnotationPOIGroup() {
    if (this.annotationPOIGroup) return this.annotationPOIGroup;
    const group = new THREE.Group();
    group.name = "annotation-poi-group";
    group.visible = false;
    core.scene?.add?.(group);
    this.annotationPOIGroup = group;
    return group;
  },

  createNumberTexture(text) {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 64px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return texture;
  },

  createAnnotationPOIMarker(entry, position, index = 1) {
    const radius = Math.max((this.gridSize || core.gridSize || 1) / 15, 0.005);

    const texture = Viewer.createNumberTexture(index.toString());

    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    const sprite = new THREE.Sprite(spriteMaterial);

    sprite.scale.set(radius, radius, 1);

    sprite.position.copy(position);

    sprite.userData.isAnnotationPOI = true;
    sprite.userData.annotationId = entry.id;
    sprite.userData.groupId = entry.groupId || "";
    sprite.userData.key = entry.key || "";
    sprite.userData.targetId = entry.targetId;
    sprite.userData.faceIndex = entry.faceIndex;
    sprite.userData.title = entry.title || "";

    return sprite;
  },

  ensureAnnotationPOITooltip() {
    if (this.annotationPOITooltip) return this.annotationPOITooltip;
    const tooltip = document.createElement("div");
    tooltip.id = "annotationPOITooltip";
    tooltip.className = "annotation-poi-tooltip";
    tooltip.hidden = true;
    tooltip.innerHTML = `
      <div class="annotation-poi-tooltip__panel" role="status" aria-live="polite" aria-atomic="true">
        <div class="annotation-poi-tooltip__title" id="annotationPOITooltipTitle"></div>
      </div>
    `;
    document.body.appendChild(tooltip);
    this.annotationPOITooltip = tooltip;
    this.annotationPOITooltipTitle = tooltip.querySelector("#annotationPOITooltipTitle");
    return tooltip;
  },

  openAnnotationPOITooltip(marker) {
    if (!marker?.userData?.isAnnotationPOI) {
      this.closeAnnotationPOITooltip();
      return false;
    }

    const tooltip = this.ensureAnnotationPOITooltip();
    if (!tooltip) return false;

    this.annotationPOITooltipTarget = marker;
    const titleText = String(marker.userData?.title || "").trim();
    if (this.annotationPOITooltipTitle) {
      this.annotationPOITooltipTitle.textContent = titleText || "Annotation";
    }

    tooltip.hidden = false;
    tooltip.style.visibility = "visible";
    this.updateAnnotationPOITooltipPosition();
    return true;
  },

  getAnnotationEntriesForPOIMarker(marker) {
    if (!marker?.userData?.isAnnotationPOI) return [];
    const markerId = String(marker.userData?.annotationId || "").trim();
    const markerGroupId = String(marker.userData?.groupId || "").trim();
    const markerKey = String(marker.userData?.key || "").trim();

    let baseEntry = null;
    if (markerId) {
      baseEntry = this.annotationEntries.find((entry) => String(entry?.id || "") === markerId) || null;
    }
    if (!baseEntry && markerKey) {
      baseEntry = this.annotationEntries.find((entry) => String(entry?.key || "") === markerKey) || null;
    }

    const effectiveGroupId = String(baseEntry?.groupId || markerGroupId || "").trim();
    if (effectiveGroupId) {
      const groupedEntries = this.annotationEntries.filter(
        (entry) => String(entry?.groupId || "").trim() === effectiveGroupId
      );
      if (groupedEntries.length > 0) return groupedEntries;
    }

    if (baseEntry) return [baseEntry];

    const fallbackTargetId = String(marker.userData?.targetId || "").trim();
    const fallbackFaceIndex = Number(marker.userData?.faceIndex);
    if (!fallbackTargetId || !Number.isInteger(fallbackFaceIndex) || fallbackFaceIndex < 0) return [];
    return [{
      id: markerId || "",
      key: this.getFaceSelectionKey(fallbackTargetId, fallbackFaceIndex),
      targetId: fallbackTargetId,
      object: fallbackTargetId,
      faceIndex: fallbackFaceIndex,
      title: String(marker.userData?.title || "").trim(),
      description: "",
      groupId: effectiveGroupId,
    }];
  },

  openAnnotationDialogFromPOIMarker(marker) {
    const entries = this.getAnnotationEntriesForPOIMarker(marker);
    if (!entries.length) {
      toastHelper("annotationDataMissing", "warning");
      return false;
    }

    this.buildAnnotationDialog();
    if (!this.annotationDialog) return false;

    const keys = entries
      .map((entry) => String(entry?.key || "").trim())
      .filter(Boolean);
    this.annotationTargetFaceKeys = Array.from(new Set(keys));

    const existingGroupIds = Array.from(
      new Set(entries.map((entry) => String(entry?.groupId || "").trim()).filter(Boolean))
    );
    this.annotationBatchGroupId = existingGroupIds.length === 1
      ? existingGroupIds[0]
      : `anno-group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const uniqueTitles = Array.from(
      new Set(entries.map((entry) => String(entry?.title || "").trim()))
    );
    const uniqueDescriptions = Array.from(
      new Set(entries.map((entry) => String(entry?.description || "").trim()))
    );
    this.annotationDialogTitleInput.value = uniqueTitles.length === 1 ? uniqueTitles[0] : "";
    this.annotationDialogDescriptionInput.value =
      uniqueDescriptions.length === 1 ? uniqueDescriptions[0] : "";

    this.updateAnnotationDialogBounds();
    this.annotationDialog.hidden = false;
    this.closeAnnotationPOITooltip();
    this.closeActionMenu();
    this.annotationDialogTitleInput?.focus();
    this.annotationDialogTitleInput?.select();
    return true;
  },

  closeAnnotationPOITooltip() {
    this.annotationPOITooltipTarget = null;
    if (!this.annotationPOITooltip) return;
    this.annotationPOITooltip.hidden = true;
    this.annotationPOITooltip.style.visibility = "hidden";
  },

  updateAnnotationPOITooltipPosition() {
    const tooltip = this.annotationPOITooltip;
    const marker = this.annotationPOITooltipTarget;
    if (!tooltip || tooltip.hidden || !marker || !core.camera) return;

    const rect =
      Viewer.mainCanvas?.getBoundingClientRect?.() ||
      core.container?.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    const worldPosition = new THREE.Vector3();
    marker.getWorldPosition(worldPosition);
    const projected = worldPosition.clone().project(core.camera);
    const withinDepth = projected.z >= -1 && projected.z <= 1;
    const screenX = rect.left + ((projected.x + 1) / 2) * rect.width;
    const screenY = rect.top + ((-projected.y + 1) / 2) * rect.height;
    const withinHorizontal = screenX >= rect.left && screenX <= rect.right;
    const withinVertical = screenY >= rect.top && screenY <= rect.bottom;
    if (!withinDepth || !withinHorizontal || !withinVertical) {
      tooltip.style.visibility = "hidden";
      return;
    }

    tooltip.style.left = `${Math.round(screenX)}px`;
    tooltip.style.top = `${Math.round(screenY)}px`;
    tooltip.style.visibility = "visible";
  },

  refreshAnnotationPOIs() {
    this.clearAnnotationPOIs();
    const entries = this.getAnnotationEntriesForPersistence();
    if (!entries.length) return 0;

    const group = this.ensureAnnotationPOIGroup();
    let added = 0;
    entries.forEach((entry) => {
      const object = this.resolveObjectByTargetId(entry.targetId);
      if (!object) return;
      const point = this.getFaceCentroidWorld(object, entry.faceIndex);
      if (!point) return;
      const marker = this.createAnnotationPOIMarker(entry, point, entries.indexOf(entry) + 1);
      group.add(marker);
      this.annotationPOIMarkers.push(marker);
      added += 1;
    });

    group.visible = added > 0;
    return added;
  },

  buildAnnotationDialog() {
    if (!core.container || this.annotationDialog) return;

    const dialog = document.createElement("div");
    dialog.id = "annotationDialog";
    dialog.className = "annotation-dialog";
    dialog.hidden = true;
    dialog.innerHTML = `
      <div class="annotation-dialog__backdrop" data-annotation-dismiss="true"></div>
      <div class="annotation-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="annotationDialogTitle">
        <div class="annotation-dialog__header">
          <h3 id="annotationDialogTitle">Add annotation</h3>
          <button type="button" class="annotation-dialog__close" data-annotation-dismiss="true" aria-label="Close annotation dialog">&times;</button>
        </div>
        <form id="annotationDialogForm" class="annotation-dialog__form">
          <label>
            <span>Title</span>
            <input id="annotationTitleInput" name="title" type="text" maxlength="120" required />
          </label>
          <label>
            <span>Description</span>
            <textarea id="annotationDescriptionInput" name="description" rows="5" maxlength="4000"></textarea>
          </label>
          <div class="annotation-dialog__actions">
            <button type="submit">Save annotation</button>
            <button type="button" data-annotation-dismiss="true">Cancel</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(dialog);
    this.annotationDialog = dialog;
    this.annotationDialogHost = document.body;
    this.annotationDialogTitleInput = dialog.querySelector("#annotationTitleInput");
    this.annotationDialogDescriptionInput = dialog.querySelector("#annotationDescriptionInput");
    const form = dialog.querySelector("#annotationDialogForm");

    this.bindEventListener(dialog, "click", (event) => {
      const dismissTrigger = event.target?.closest?.("[data-annotation-dismiss='true']");
      if (dismissTrigger) {
        this.closeAnnotationDialog();
      }
    });

    this.bindEventListener(document, "keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!this.annotationDialog || this.annotationDialog.hidden) return;
      event.preventDefault();
      this.closeAnnotationDialog();
    });

    this.bindEventListener(form, "submit", (event) => {
      event.preventDefault();
      this.saveAnnotationFromDialog();
    });

    this.bindEventListener(window, "resize", () => this.updateAnnotationDialogBounds());
    this.bindEventListener(window, "scroll", () => this.updateAnnotationDialogBounds(), true);
    this.bindEventListener(document, "fullscreenchange", () => this.updateAnnotationDialogBounds());
  },

  updateAnnotationDialogBounds() {
    if (!this.annotationDialog) return;
    const targetRect =
      Viewer.mainCanvas?.getBoundingClientRect?.() ||
      core.container?.getBoundingClientRect?.();
    if (!targetRect) return;

    const left = Math.max(0, Math.round(targetRect.left));
    const top = Math.max(0, Math.round(targetRect.top));
    const width = Math.max(0, Math.round(targetRect.width));
    const height = Math.max(0, Math.round(targetRect.height));

    this.annotationDialog.style.left = `${left}px`;
    this.annotationDialog.style.top = `${top}px`;
    this.annotationDialog.style.width = `${width}px`;
    this.annotationDialog.style.height = `${height}px`;
  },

  openAnnotationDialog() {
    if (!Array.isArray(this.selectedFaces) || this.selectedFaces.length === 0) {
      toastHelper("selectFaceRequired", "warning");
      return;
    }

    this.buildAnnotationDialog();
    if (!this.annotationDialog) return;

    const selectedKeys = this.selectedFaces
      .map((entry) => String(entry?.key || "").trim())
      .filter(Boolean);
    this.annotationTargetFaceKeys = selectedKeys;
    const existingGroupIds = Array.from(
      new Set(
        selectedKeys
          .map((key) => this.annotationEntries.find((entry) => entry.key === key)?.groupId || "")
          .map((value) => String(value).trim())
          .filter(Boolean)
      )
    );
    this.annotationBatchGroupId = existingGroupIds.length === 1
      ? existingGroupIds[0]
      : `anno-group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const existingEntries = selectedKeys
      .map((key) => this.annotationEntries.find((entry) => entry.key === key))
      .filter(Boolean);
    const uniqueTitles = Array.from(
      new Set(existingEntries.map((entry) => String(entry.title || "").trim()))
    );
    const uniqueDescriptions = Array.from(
      new Set(existingEntries.map((entry) => String(entry.description || "").trim()))
    );
    this.annotationDialogTitleInput.value = uniqueTitles.length === 1 ? uniqueTitles[0] : "";
    this.annotationDialogDescriptionInput.value =
      uniqueDescriptions.length === 1 ? uniqueDescriptions[0] : "";
    this.updateAnnotationDialogBounds();
    this.annotationDialog.hidden = false;
    this.closeAnnotationPOITooltip();
    this.closeActionMenu();
    this.annotationDialogTitleInput?.focus();
    this.annotationDialogTitleInput?.select();
  },

  openAnnotationDialogWithAutoPicking() {
    if (!this.pickingMode) {
      this.pickingMode = true;
      this.RULER_MODE = false;
      this.updateDistanceMeasurementControllerLabel();
      this.updatePickingModeControllerLabel();
      this.updatePickingControlsVisibility();
      toastHelper("featureToggle", "info", {
        feature: "Face picking",
        state: "enabled"
      });
    }

    if (!Array.isArray(this.selectedFaces) || this.selectedFaces.length === 0) {
      toastHelper("selectFaceRequiredAgain", "warning");
      return;
    }

    this.openAnnotationDialog();
  },

  closeAnnotationDialog() {
    if (!this.annotationDialog) return;
    this.annotationDialog.hidden = true;
    this.annotationTargetFaceKeys = [];
    this.annotationBatchGroupId = "";
  },

  saveAnnotationFromDialog() {
    if (!Array.isArray(this.annotationTargetFaceKeys) || this.annotationTargetFaceKeys.length === 0) {
      toastHelper("noFacesSelected", "warning");
      this.closeAnnotationDialog();
      return;
    }

    const title = String(this.annotationDialogTitleInput?.value || "").trim();
    const description = String(this.annotationDialogDescriptionInput?.value || "").trim();

    if (!title) {
      toastHelper("titleRequired", "warning");
      this.annotationDialogTitleInput?.focus();
      return;
    }

    const selectedFaces = this.annotationTargetFaceKeys
      .map((key) => {
        const selected = this.selectedFaces.find((entry) => entry.key === key);
        if (selected) return selected;
        const existingEntry = this.annotationEntries.find((entry) => entry.key === key);
        if (!existingEntry) return null;
        return {
          key: existingEntry.key,
          targetId: existingEntry.targetId || existingEntry.object || "",
          object: existingEntry.object || existingEntry.targetId || "",
          faceIndex: existingEntry.faceIndex,
        };
      })
      .filter(Boolean);
    if (selectedFaces.length === 0) {
      toastHelper("facesInactive", "warning");
      this.closeAnnotationDialog();
      return;
    }

    const nowIso = new Date().toISOString();
    const groupId = String(this.annotationBatchGroupId || `anno-group-${Date.now()}`);
    let updatedCount = 0;
    let addedCount = 0;

    selectedFaces.forEach((selectedFace) => {
      const faceNumber = Number(selectedFace.faceIndex);
      const normalizedFaceNumber = Number.isInteger(faceNumber) ? faceNumber : -1;
      const annotationTargetId = selectedFace.targetId || selectedFace.object || "";
      const stableTargetToken = Viewer.toStableIdToken(annotationTargetId);
      const existingIndex = this.annotationEntries.findIndex(
        (entry) => entry.key === selectedFace.key
      );
      if (!annotationTargetId || normalizedFaceNumber < 0) return;

      const annotationPayload = {
        id: existingIndex >= 0
          ? this.annotationEntries[existingIndex].id
          : `anno-${stableTargetToken}-f${normalizedFaceNumber}`,
        groupId,
        key: selectedFace.key,
        object: annotationTargetId,
        targetId: annotationTargetId,
        faceIndex: normalizedFaceNumber,
        faceNumbers: [normalizedFaceNumber],
        target: {
          id: annotationTargetId,
          faces: [normalizedFaceNumber],
        },
        title,
        description,
        updatedAt: nowIso,
      };

      if (existingIndex >= 0) {
        annotationPayload.createdAt = this.annotationEntries[existingIndex].createdAt || nowIso;
        this.annotationEntries.splice(existingIndex, 1, annotationPayload);
        updatedCount += 1;
      } else {
        annotationPayload.createdAt = nowIso;
        this.annotationEntries.push(annotationPayload);
        addedCount += 1;
      }
    });

    const totalChanged = updatedCount + addedCount;
    if (totalChanged > 0) {
      toastHelper("annotationsSaved", "success", {
        count: totalChanged,
        plural: totalChanged === 1 ? "" : "s"
      });
    }

    this.refreshAnnotationPOIs();
    this.closeAnnotationDialog();
  },

  getAnnotationEntriesForPersistence() {
    if (!Array.isArray(this.annotationEntries)) return [];

    return this.annotationEntries
      .map((entry, index) => {
        if (!entry || typeof entry !== "object") return null;
        const targetId = String(entry.targetId || entry.object || "").trim();
        const faceNumbersRaw = Array.isArray(entry.faceNumbers)
          ? entry.faceNumbers
          : [entry.faceIndex];
        const faceNumbers = faceNumbersRaw
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value >= 0);
        const faceIndex = faceNumbers[0] ?? Number(entry.faceIndex);
        const normalizedFaceIndex = Number.isInteger(faceIndex) && faceIndex >= 0 ? faceIndex : -1;
        if (!targetId || normalizedFaceIndex < 0) return null;

        const key = this.getFaceSelectionKey(targetId, normalizedFaceIndex);
        const fallbackId = `anno-${this.toStableIdToken(targetId)}-f${normalizedFaceIndex}`;

        return {
          id: String(entry.id || fallbackId),
          groupId: entry.groupId ? String(entry.groupId) : "",
          key,
          object: targetId,
          targetId,
          faceIndex: normalizedFaceIndex,
          faceNumbers: faceNumbers.length > 0 ? faceNumbers : [normalizedFaceIndex],
          target: {
            id: targetId,
            faces: faceNumbers.length > 0 ? faceNumbers : [normalizedFaceIndex],
          },
          title: String(entry.title || "").trim(),
          description: String(entry.description || "").trim(),
          createdAt: entry.createdAt ? String(entry.createdAt) : "",
          updatedAt: entry.updatedAt ? String(entry.updatedAt) : "",
        };
      })
      .filter(Boolean);
  },

  exportAnnotationsToIIIFXml() {
    const entries = this.getAnnotationEntriesForPersistence();
    const doc = document.implementation.createDocument("", "", null);
    const root = doc.createElement("iiif:annotations");
    root.setAttribute("xmlns:iiif", "http://iiif.io/api/presentation/3#");
    root.setAttribute("version", "3.0");
    root.setAttribute("generatedAt", new Date().toISOString());
    doc.appendChild(root);

    entries.forEach((entry) => {
      const annotation = doc.createElement("iiif:annotation");
      annotation.setAttribute("id", entry.id);
      annotation.setAttribute("type", "Annotation");
      annotation.setAttribute("motivation", "commenting");
      if (entry.groupId) {
        annotation.setAttribute("groupId", String(entry.groupId));
      }

      const body = doc.createElement("iiif:body");
      body.setAttribute("type", "TextualBody");
      body.setAttribute("format", "text/plain");

      const titleNode = doc.createElement("iiif:title");
      titleNode.textContent = entry.title || "";
      body.appendChild(titleNode);

      const descriptionNode = doc.createElement("iiif:description");
      descriptionNode.textContent = entry.description || "";
      body.appendChild(descriptionNode);
      annotation.appendChild(body);

      const targetNode = doc.createElement("iiif:target");
      targetNode.setAttribute("id", entry.targetId);
      targetNode.setAttribute("faces", entry.faceNumbers.join(","));
      annotation.appendChild(targetNode);

      root.appendChild(annotation);
    });

    return new XMLSerializer().serializeToString(doc);
  },

  downloadAnnotationsXmlFile() {
    const xml = this.exportAnnotationsToIIIFXml();
    if (!xml) {
      toastHelper("noAnnotationsToExport", "warning");
      return false;
    }

    const defaultBaseName = core.fileObject?.basename || "annotations";
    const safeBaseName = String(defaultBaseName).replace(/[^a-zA-Z0-9._-]+/g, "_");
    const fileName = `${safeBaseName || "annotations"}-iiif-annotations.xml`;
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    toastHelper("annotationsExported", "success");
    return true;
  },

  ensureAnnotationImportInput() {
    if (this.annotationImportInput) return this.annotationImportInput;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xml,text/xml,application/xml";
    input.hidden = true;
    this.bindEventListener(input, "change", async (event) => {
      const target = event?.target;
      const file = target?.files?.[0];
      if (!file) return;

      try {
        const xmlText = await file.text();
        const imported = this.importAnnotationsFromIIIFXml(xmlText);
        if (imported > 0) {
          toastHelper("annotationsImported", "success", {
            count: imported,
            plural: imported === 1 ? "" : "s"
          });
        } else {
          toastHelper("noValidAnnotations", "warning");
        }
      } catch (error) {
        console.error(error);
        toastHelper("annotationsImportError", "error");
      } finally {
        target.value = "";
      }
    });
    document.body.appendChild(input);
    this.annotationImportInput = input;
    return input;
  },

  triggerAnnotationsXmlImport() {
    const input = this.ensureAnnotationImportInput();
    if (!input) return false;
    input.click();
    return true;
  },

  importAnnotationsFromIIIFXml(xmlText) {
    const xml = String(xmlText || "").trim();
    if (!xml) {
      this.annotationEntries = [];
      return 0;
    }

    let doc;
    try {
      doc = new DOMParser().parseFromString(xml, "application/xml");
    } catch (_error) {
      return 0;
    }

    if (!doc || doc.querySelector("parsererror")) {
      return 0;
    }

    const annotations = Array.from(
      doc.querySelectorAll("annotation, iiif\\:annotation")
    );
    const importedEntries = [];

    annotations.forEach((node, index) => {
      const rawId = node.getAttribute("id") || "";
      const rawGroupId = node.getAttribute("groupId") || "";
      const targetNode =
        node.querySelector("target, iiif\\:target") ||
        node.getElementsByTagName("target")[0] ||
        node.getElementsByTagName("iiif:target")[0];
      const targetId = String(targetNode?.getAttribute?.("id") || "").trim();
      const facesAttr = String(targetNode?.getAttribute?.("faces") || "").trim();
      const faceNumbers = facesAttr
        .split(/[,\s;|]+/)
        .filter(Boolean)
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0);
      const faceIndex = faceNumbers[0];
      if (!targetId || !Number.isInteger(faceIndex)) return;

      const titleNode =
        node.querySelector("title, iiif\\:title, label, iiif\\:label") ||
        node.getElementsByTagName("title")[0] ||
        node.getElementsByTagName("iiif:title")[0];
      const descriptionNode =
        node.querySelector("description, iiif\\:description, value, iiif\\:value") ||
        node.getElementsByTagName("description")[0] ||
        node.getElementsByTagName("iiif:description")[0];

      const key = this.getFaceSelectionKey(targetId, faceIndex);
      importedEntries.push({
        id: rawId || `anno-${this.toStableIdToken(targetId)}-f${faceIndex}-${index}`,
        groupId: rawGroupId ? String(rawGroupId) : "",
        key,
        object: targetId,
        targetId,
        faceIndex,
        faceNumbers: faceNumbers.length > 0 ? faceNumbers : [faceIndex],
        target: {
          id: targetId,
          faces: faceNumbers.length > 0 ? faceNumbers : [faceIndex],
        },
        title: String(titleNode?.textContent || "").trim(),
        description: String(descriptionNode?.textContent || "").trim(),
      });
    });

    this.annotationEntries = importedEntries;
    this.refreshAnnotationPOIs();
    return importedEntries.length;
  },

  hydrateAnnotationsFromMetadataPayload(payload) {
    if (!payload || typeof payload !== "object") {
      this.annotationEntries = [];
      this.refreshAnnotationPOIs();
      return 0;
    }

    const xmlCandidate = payload.iiifAnnotationsXml
      || payload.iiif_annotations_xml
      || payload.annotationsXml
      || payload.annotations_xml
      || "";
    if (typeof xmlCandidate === "string" && xmlCandidate.trim() !== "") {
      return this.importAnnotationsFromIIIFXml(xmlCandidate);
    }

    if (Array.isArray(payload.annotationEntries)) {
      this.annotationEntries = payload.annotationEntries
        .map((entry, index) => {
          const targetId = String(entry?.targetId || entry?.object || entry?.target?.id || "").trim();
          const faceNumbers = Array.isArray(entry?.faceNumbers)
            ? entry.faceNumbers
            : Array.isArray(entry?.target?.faces)
              ? entry.target.faces
              : [entry?.faceIndex];
          const normalizedFaces = faceNumbers
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 0);
          const faceIndex = normalizedFaces[0];
          if (!targetId || !Number.isInteger(faceIndex)) return null;
          return {
            id: String(entry?.id || `anno-${this.toStableIdToken(targetId)}-f${faceIndex}-${index}`),
            groupId: entry?.groupId ? String(entry.groupId) : "",
            key: this.getFaceSelectionKey(targetId, faceIndex),
            object: targetId,
            targetId,
            faceIndex,
            faceNumbers: normalizedFaces.length > 0 ? normalizedFaces : [faceIndex],
            target: {
              id: targetId,
              faces: normalizedFaces.length > 0 ? normalizedFaces : [faceIndex],
            },
            title: String(entry?.title || "").trim(),
            description: String(entry?.description || "").trim(),
            createdAt: entry?.createdAt ? String(entry.createdAt) : "",
            updatedAt: entry?.updatedAt ? String(entry.updatedAt) : "",
          };
        })
        .filter(Boolean);
      this.refreshAnnotationPOIs();
      return this.annotationEntries.length;
    }

    this.annotationEntries = [];
    this.refreshAnnotationPOIs();
    return 0;
  },

  extractAnnotationsXmlFromExportDocument(doc) {
    if (!doc) return "";
    const node =
      doc.querySelector("iiif\\:annotations, annotations, iiif_annotations, iiif_annotations_xml") ||
      doc.getElementsByTagName("iiif:annotations")[0] ||
      doc.getElementsByTagName("annotations")[0] ||
      doc.getElementsByTagName("iiif_annotations")[0] ||
      doc.getElementsByTagName("iiif_annotations_xml")[0];
    if (!node) return "";

    if (node.tagName === "iiif_annotations_xml") {
      return String(node.textContent || "").trim();
    }

    try {
      return new XMLSerializer().serializeToString(node);
    } catch (_error) {
      return "";
    }
  },

  applyPendingAnnotationsIfAny() {
    const pendingXml = String(this.pendingAnnotationsXml || "").trim();
    if (!pendingXml) return 0;
    const imported = this.importAnnotationsFromIIIFXml(pendingXml);
    this.pendingAnnotationsXml = "";
    return imported;
  },

  clearSelectedFaces() {
    if (!Array.isArray(Viewer.selectedFaces) || Viewer.selectedFaces.length === 0) {
      Viewer.updateSelectedFacesCount();
      return;
    }

    Viewer.selectedFaces.forEach((entry) => {
      Viewer.disposeFaceOverlay(entry);
    });
    Viewer.selectedFaces.length = 0;
    Viewer.updateSelectedFacesCount();
  },

  restoreLastPickedFace() {
    if (!Viewer.lastPickedFace.overlay) {
      Viewer.lastPickedFace = { id: "", object: "", faceIndex: null, overlay: null };
      return;
    }

    Viewer.disposeFaceOverlay(Viewer.lastPickedFace);

    Viewer.lastPickedFace = { id: "", object: "", faceIndex: null, overlay: null };
  },

  pickFaces(_id) {
    const hoveredObjectId = _id?.object?.id ?? "";
    const hoveredFaceIndex = _id?.faceIndex ?? null;
    if (!hoveredObjectId) {
      Viewer.restoreLastPickedFace();
      return;
    }

    if (
      Viewer.lastPickedFace.object === hoveredObjectId &&
      Viewer.lastPickedFace.faceIndex === hoveredFaceIndex
    ) {
      return;
    }

    Viewer.restoreLastPickedFace();
    const overlay = Viewer.createPickingFaceOverlay(_id, {
      fillColor: 0xff3b30,
      lineColor: 0xffffff,
      opacity: 0.4,
    });
    if (!overlay) return;

    Viewer.lastPickedFace = {
      id: hoveredObjectId,
      object: hoveredObjectId,
      faceIndex: hoveredFaceIndex,
      overlay,
    };

    _id.object.add(overlay);
  },

  toggleSelectedFace(intersection, options = {}) {
    const targetId = Viewer.resolveFaceTargetId(intersection?.object);
    const runtimeObjectId = intersection?.object?.id ?? "";
    const faceIndex = intersection?.faceIndex ?? null;
    if (!targetId || faceIndex === null) return;

    const multiSelect = options.multiSelect === true;
    const selectedFaceIndex = Viewer.findSelectedFaceIndex(targetId, faceIndex);

    if (!multiSelect) {
      const clickedFaceKey = Viewer.getFaceSelectionKey(targetId, faceIndex);
      const clickedFaceAlreadySelected =
        selectedFaceIndex >= 0 && Viewer.selectedFaces.length === 1 &&
        Viewer.selectedFaces[0]?.key === clickedFaceKey;

      Viewer.clearSelectedFaces();

      if (clickedFaceAlreadySelected) {
        return;
      }
    }

    if (selectedFaceIndex >= 0) {
      const [selectedFace] = Viewer.selectedFaces.splice(selectedFaceIndex, 1);
      Viewer.disposeFaceOverlay(selectedFace);
      Viewer.updateSelectedFacesCount();
      return;
    }

    const overlay = Viewer.createPickingFaceOverlay(intersection, {
      fillColor: 0x00c853,
      lineColor: 0xe8ffe8,
      opacity: 0.5,
    });
    if (!overlay) return;

    intersection.object.add(overlay);
    Viewer.selectedFaces.push({
      key: Viewer.getFaceSelectionKey(targetId, faceIndex),
      targetId,
      object: targetId,
      runtimeObjectId,
      faceIndex,
      overlay,
    });
    Viewer.updateSelectedFacesCount();
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
      const measuredDistance = Viewer.formatMeasuredDistance(distancePoints);

      //var distancePoints = distanceBetweenPoints(Viewer.linePoints[Viewer.linePoints.length-2], newPoint);
      var halfwayPoints = halfwayBetweenPoints(
        Viewer.linePoints[Viewer.linePoints.length - 2],
        newPoint
      );
      Viewer.addTextPoint(measuredDistance.text, textScale, halfwayPoints);
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

    if (!core.guiContainer.hidden) {
      const guiWidth =
        core.lilGui?.[0]?.getBoundingClientRect().width ||
        core.guiContainer.getBoundingClientRect().width;
      if (guiWidth > 0) {
        core.guiContainer.style.left = (widthCSS - guiWidth) + 'px';
      }
    }

    Viewer.mainCanvas.width = widthDev;
    Viewer.mainCanvas.height = heightDev;

    if (Viewer.actionMenu) {
      if (Viewer.actionMenu.classList.contains("viewer-action-menu_in-toolbar")) {
        Viewer.actionMenu.style.top = "";
        Viewer.actionMenu.style.right = "";
        Viewer.actionMenu.style.bottom = "";
      } else {
        const menuMargin = 16;
        const toggleSize = Viewer.actionMenu.querySelector(".viewer-action-menu_toggle")?.getBoundingClientRect().height || 45;
        Viewer.actionMenu.style.top = (heightCSS - toggleSize - menuMargin) + "px";
        Viewer.actionMenu.style.right = menuMargin + "px";
        Viewer.actionMenu.style.bottom = "auto";
      }
    }

    if (core.handHint)
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
    core.handHint?.style.setProperty(
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
    if (!core.handHint) return;
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
    const delta = Viewer.clock.getDelta();

    if (!core.PRESENTATION_MODE) {

      // =========================
      // GESTURE LIFECYCLE
      // =========================
      const canGesture =
        !window.__E2E__ &&
        !core.handHint?.hidden;

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

      core.controls?.update();

      if (Viewer.textMesh !== null) {
        Viewer.textMesh.lookAt(core.camera.position);
      }

      if (Viewer.ruler?.length) {
        Viewer.ruler.forEach((rulerObject) => {
          rulerObject?.traverse?.((child) => {
            if (child?.userData?.isDistanceLabel === true) {
              child.lookAt(core.camera.position);
            }
          });
        });
      }
      Viewer.updateAnnotationPOITooltipPosition();
    }
    if (!core.GESTURE?.active || core.PRESENTATION_MODE) {
      core.controls?.update();
    }

    if ((core.PRESENTATION_MODE ||core.handHint?.hidden) && !core.GESTURE?.active) {
      core.cameraTween?.update(time);
      core.targetTween?.update(time);
    }

    // =========================
    // LOOP UPDATE
    // =========================
    
    if (Viewer.mixer) {
      Viewer.mixer.update(delta);
    }

    core.renderer?.clear();
    core.renderer?.render(core.scene, core.camera);
    core.stats?.update();
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
        if (!Viewer.pickingMode && !Viewer.RULER_MODE) {
          const poiIntersects = Viewer.raycaster.intersectObjects(
            Viewer.annotationPOIMarkers || [],
            true
          );
          const poiHit = poiIntersects.find(
            (entry) => entry?.object?.userData?.isAnnotationPOI === true
          );
          if (poiHit?.object) {
            Viewer.openAnnotationDialogFromPOIMarker(poiHit.object);
            return;
          }
          Viewer.closeAnnotationPOITooltip();
        }

        let intersects = [];
        let primaryIntersection = null;

        if (Viewer.pickingMode || Viewer.RULER_MODE) {
          if (core.mainObject.length > 1) {
            for (let ii = 0; ii < core.mainObject.length; ii++) {
              intersects.push(
                ...Viewer.raycaster.intersectObjects(
                  core.mainObject[ii].children,
                  true
                )
              );
            }
            if (intersects.length <= 0) {
              intersects = Viewer.raycaster.intersectObjects(core.mainObject, true);
            }
          } else {
            intersects = Viewer.raycaster.intersectObject(core.mainObject[0], true);
          }
          primaryIntersection = Viewer.getPrimaryIntersection(intersects);
          if (primaryIntersection) {
            if (Viewer.RULER_MODE) Viewer.buildRuler(primaryIntersection);
            else if (Viewer.pickingMode) {
              Viewer.toggleSelectedFace(primaryIntersection, {
                multiSelect: e.shiftKey,
              });
            }
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
      Viewer.closeAnnotationPOITooltip();
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
      if (!Viewer.pickingMode && !Viewer.RULER_MODE) {
        if (Viewer.annotationDialog && Viewer.annotationDialog.hidden === false) {
          Viewer.closeAnnotationPOITooltip();
        } else {
          Viewer.raycaster.setFromCamera(Viewer.pointer, core.camera);
          const poiIntersects = Viewer.raycaster.intersectObjects(
            Viewer.annotationPOIMarkers || [],
            true
          );
          const poiHit = poiIntersects.find(
            (entry) => entry?.object?.userData?.isAnnotationPOI === true
          );
          if (poiHit?.object) {
            Viewer.openAnnotationPOITooltip(poiHit.object);
          } else {
            Viewer.closeAnnotationPOITooltip();
          }
        }
      }
      if (Viewer.pickingMode) {
        Viewer.raycaster.setFromCamera(Viewer.pointer, core.camera);
        let intersects = [];
        if (core.mainObject.length > 1) {
          for (let ii = 0; ii < core.mainObject.length; ii++) {
            intersects.push(
              ...Viewer.raycaster.intersectObjects(
                core.mainObject[ii].children,
                true
              )
            );
          }
          if (intersects.length <= 0) {
            intersects = Viewer.raycaster.intersectObjects(core.mainObject, true);
          }
        } else {
          intersects = Viewer.raycaster.intersectObject(core.mainObject[0], true);
        }
        const primaryIntersection = Viewer.getPrimaryIntersection(intersects);
        if (primaryIntersection) {
          Viewer.pickFaces(primaryIntersection);
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

  showSandboxGuiAfterModelLoad() {
    if (!core.guiContainer) return;

    core.guiContainer.hidden = false;
    core.lilGui = document.getElementsByClassName("lil-gui root");

    const updateAfterLayout = () => {
      Viewer.updateSize();
      requestAnimationFrame(() => Viewer.updateSize());
    };

    requestAnimationFrame(updateAfterLayout);
  },

  async onDrop(e) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const extension = file.name.split('.').pop().toLowerCase();
      
      if (Viewer.SUPPORTED_EXTENSIONS.includes(extension)) {
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
        if (core.SANDBOX_MODE) {
          Viewer.showSandboxGuiAfterModelLoad();
          Viewer.dismissStatusNotice("sandbox-drop-model");
        }        
        toastHelper("modelLoadedSimple", "success");
      } else {
        toastHelper("unsupportedFormat", "error");
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

  syncOutlineClippingTransform() {
    const outline = core.outlineClipping;
    const object = core.helperObjects?.[0];
    if (!outline || !object) return;
    outline.position.copy(object.position);
    outline.quaternion.copy(object.quaternion);
    outline.scale.copy(object.scale);
    outline.updateMatrixWorld(true);
  },

  async calculateObjectScale() {
    if (core.renderer) {
      core.renderer.localClippingEnabled = true;
    }
    Viewer.syncOutlineClippingTransform();
    const boundingBox = new THREE.Box3();
    if (Array.isArray(core.helperObjects[0])) {
      for (let i = 0; i < core.helperObjects[0].length; i++) {
        const box = new THREE.Box3().setFromObject(core.helperObjects[0][i], true);
        boundingBox.union(box);
      }
    } else {
      boundingBox.setFromObject(core.helperObjects[0], true);
    }

    if (boundingBox.isEmpty()) return;

    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    const _distance = new THREE.Vector3(
      Math.max(Math.abs(boundingBox.max.x), Math.abs(boundingBox.min.x)),
      Math.max(Math.abs(boundingBox.max.y), Math.abs(boundingBox.min.y)),
      Math.max(Math.abs(boundingBox.max.z), Math.abs(boundingBox.min.z))
    );

    Viewer.distanceGeometry = _distance;
    setCore("distanceGeometry", Viewer.distanceGeometry);

    if (core.clippingPlanes?.length >= 3) {
      core.clippingPlanes[0].constant = _distance.x;
      core.clippingPlanes[1].constant = _distance.y;
      core.clippingPlanes[2].constant = _distance.z;
    }

    Viewer.planeParams.planeX.constantX = _distance.x;
    Viewer.planeParams.planeY.constantY = _distance.y;
    Viewer.planeParams.planeZ.constantZ = _distance.z;

    if (core.clippingFolder?.controllers?.[1]) {
      core.clippingFolder.controllers[1]._max = _distance.x;
      core.clippingFolder.controllers[1]._min = -_distance.x;
      core.clippingFolder.controllers[1].setValue(_distance.x);
      core.clippingFolder.controllers[1].updateDisplay();
    }
    if (core.clippingFolder?.controllers?.[3]) {
      core.clippingFolder.controllers[3]._max = _distance.y;
      core.clippingFolder.controllers[3]._min = -_distance.y;
      core.clippingFolder.controllers[3].setValue(_distance.y);
      core.clippingFolder.controllers[3].updateDisplay();
    }
    if (core.clippingFolder?.controllers?.[5]) {
      core.clippingFolder.controllers[5]._max = _distance.z;
      core.clippingFolder.controllers[5]._min = -_distance.z;
      core.clippingFolder.controllers[5].setValue(_distance.z);
      core.clippingFolder.controllers[5].updateDisplay();
    }

    if (Viewer.planeHelpers?.length >= 3 && core.clippingPlanes?.length >= 3) {
      for (let i = 0; i < 3; i++) {
        const helper = Viewer.planeHelpers[i];
        const plane = core.clippingPlanes[i];
        if (!helper || !plane) continue;
        helper.position.copy(plane.normal).multiplyScalar(-plane.constant);
        if (i === 0 || i === 2) {
          helper.userData.clippingCenterY = center.y;
          helper.updateMatrixWorld(true);
        }
      }
    }

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
      core.autoPath = Viewer.normalizeFileUrl(core.autoPath);
      core.autoPath = Viewer.normalizeArchiveModelPath(core.autoPath);
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
    Viewer.applyPendingAnnotationsIfAny();
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

    this.applyCameraOverridesFromUrl();
  },

  prepareSandboxScene() {
    if (core.mainObject?.length) {
      core.mainObject.forEach((obj) => Viewer.removeAndDisposeFromScene(obj));
      core.mainObject.length = 0;
    }

    if (core.loadingLog) {
      core.loadingLog.finish?.();
    }
    if (core.circle) {
      core.circle.set?.(0, 100);
      core.circle.complete();
    }

    if (core.mainCanvas && core.CONFIG?.viewer?.background) {
      core.mainCanvas.style.setProperty("background", core.CONFIG.viewer.background);
    }

    core.camera?.position.set(0, 60, 180);
    core.controls?.target.set(0, 0, 0);
    core.controls?.update();
    this.applyCameraOverridesFromUrl();

    if (window.viewer) {
      window.viewer.modelLoaded = false;
    }

    toastHelper("sandboxDropModel", "info", {
      formats: this.getSupportedFormatsText(),
      detailI18nKey: "toasts.supportedFormats",
      key: "sandbox-drop-model",
      replace: true,
      persistent: true,
      variant: "sandbox",
    });
  },

  applyCameraOverridesFromUrl() {
    if (!core.camera) return;

    const cameraPosition = this.urlOptions?.cameraPosition;
    const cameraTarget = this.urlOptions?.cameraTarget;
    const cameraFov = this.urlOptions?.cameraFov;
    const hasPosition = cameraPosition && Number.isFinite(cameraPosition.x) && Number.isFinite(cameraPosition.y) && Number.isFinite(cameraPosition.z);
    const hasTarget = cameraTarget && Number.isFinite(cameraTarget.x) && Number.isFinite(cameraTarget.y) && Number.isFinite(cameraTarget.z);
    const hasFov = Number.isFinite(cameraFov);
    if (!hasPosition && !hasTarget && !hasFov) return;

    if (hasPosition) {
      core.camera.position.copy(cameraPosition);
      core.cameraLight?.position.copy(cameraPosition);
    }
    if (hasTarget) {
      core.controls?.target.copy(cameraTarget);
      core.camera.lookAt(cameraTarget);
    }
    if (hasFov) {
      const normalizedFov = Math.min(179, Math.max(1, Number(cameraFov)));
      core.camera.fov = normalizedFov;
      if (this.embedConfigInputs?.fov && this.embedConfigInputs.fov.value === "") {
        this.embedConfigInputs.fov.value = String(normalizedFov);
      }
    }

    core.camera.updateProjectionMatrix();
    core.controls?.update();
  },

  createClippingPlaneAxis(_number, axis = "z") {
    var tempClippingControl = new TransformControls(core.camera, core.renderer.domElement);
    tempClippingControl.space = "world";
    tempClippingControl.setMode("translate");
    tempClippingControl.showX = axis === "x";
    tempClippingControl.showY = axis === "y";
    tempClippingControl.showZ = axis === "z";
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
          core.planeHelpers[0].position.copy(core.clippingPlanes[0].normal).multiplyScalar(-newConstant);
          break;
        case 1:
          newConstant = event.target.worldPositionStart.y + event.target.pointEnd.y;
          core.clippingPlanes[_number].constant = newConstant;
          core.planeParams.planeY.constantY = newConstant;
          if (core.clippingFolder.controllers[3]) {
            core.clippingFolder.controllers[3].setValue(newConstant);
          }
          core.planeHelpers[1].position.copy(core.clippingPlanes[1].normal).multiplyScalar(-newConstant);
          break;
        case 2:
          newConstant = event.target.worldPositionStart.z + event.target.pointEnd.z;
          core.clippingPlanes[_number].constant = newConstant;
          core.planeParams.planeZ.constantZ = newConstant;
          if (core.clippingFolder.controllers[5]) {
            core.clippingFolder.controllers[5].setValue(newConstant);
          }
          core.planeHelpers[2].position.copy(core.clippingPlanes[2].normal).multiplyScalar(-newConstant);
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
    //const targetDistance = startTarget.distanceTo(targetControls);
    const startDir = startTarget.clone().sub(startCam).normalize();
    const endDir = targetControls.clone().sub(targetCamera).normalize();

    const angle = startDir.angleTo(endDir);
    const rotationFactor = 2.0;
    const rotationDistance = angle * rotationFactor;

    const linearDistance = Math.max(
      startCam.distanceTo(targetCamera),
      startTarget.distanceTo(targetControls)
    );

    const distance = Math.max(linearDistance, rotationDistance);

    const speed = 1.25;
    const duration = THREE.MathUtils.clamp((distance / speed) * 1000, 300, 3000);

    core.cameraTween = new TWEEN.Tween(startCam)
      .to(targetCamera, duration)
      .easing(TWEEN.Easing.Cubic.Out)
      .onUpdate(() => {
        core.camera.position.copy(startCam);
        core.cameraLight.position.copy(startCam);
        core.camera.updateProjectionMatrix();
      });

    core.targetTween = new TWEEN.Tween(startTarget)
      .to(targetControls, duration)
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

    const persistedAnnotations = Viewer.getAnnotationEntriesForPersistence();
    M.annotationEntries = persistedAnnotations;
    M.iiifAnnotationsXml = Viewer.exportAnnotationsToIIIFXml();

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

    Viewer.editorFolder = core.gui.addFolder(t("gui.editor", "Editor")).close();
    Viewer.editorFolder.domElement?.classList.add("viewer-gui-main-folder");
    Viewer.editorFolder.domElement?.setAttribute("data-gui-main-folder", "editor");
    core.i18nGui.editorFolder = Viewer.editorFolder;
    const showTransformHintToast = (mode) => {
      const hints = {
        translate: t("toasts.transformMove", "Move: drag axis arrows to reposition the object."),
        rotate: t("toasts.transformRotate", "Rotate: drag rotation rings to rotate the object."),
        scale: t("toasts.transformScale", "Scale: drag axis handles to resize the object."),
      };
      const message = hints[mode];
      if (!message) return;
        showToast(message, {
          duration: 5200
        });
    };

    const showTransformLightHintToast = (mode) => {
      const hints = {
        translate: t("toasts.transformLightMove", "Transform Light - Move: drag axis arrows to move the directional light."),
        rotate: t("toasts.transformLightTarget", "Transform Light - Target: drag axis arrows to reposition the light target."),
      };
      const message = hints[mode];
      if (!message) return;
        showToast(message, {
          duration: 5200
        });
    };

    core.i18nGui.transformObjectController = Viewer.editorFolder
      .add(Viewer.transformText, "Transform 3D Object", {
        [t("gui.none", "None")]: "",
        [t("gui.move", "Move")]: "translate",
        [t("gui.rotate", "Rotate")]: "rotate",
        [t("gui.scale", "Scale")]: "scale",
      })
      .name(t("gui.transform3dObject", "Transform 3D Object"))
      .onChange(function (value) {
        if (value === "") {
          core.transformControl.detach();
          core.axesHelper.visible = false;
          core.renderer.localClippingEnabled = true;
        } else {
          const object = core.helperObjects?.[0];

          if (!object) {
            return;
          }
          core.axesHelper.visible = true;
          core.renderer.localClippingEnabled = true;

          core.transformControl.setMode(value);
          core.transformControl.attach(object);
          showTransformHintToast(value);

        }
        Viewer.updateEditorToolbarState();
      });
    core.i18nGui.transformModeController = Viewer.editorFolder
      .add(Viewer.transformText, "Transform Mode", {
        [t("gui.local", "Local")]: "local",
        [t("gui.global", "Global")]: "global",
      })
      .name(t("gui.transformMode", "Transform Mode"))
      .onChange(function (value) {
        core.transformControl.space = value;
        Viewer.updateEditorToolbarState();
      });
    const lightFolder = Viewer.editorFolder.addFolder(t("gui.directionalLight", "Directional Light")).close();
    core.i18nGui.lightFolder = lightFolder;
    core.i18nGui.transformLightController = lightFolder
      .add(Viewer.transformText, "Transform Light", {
        [t("gui.none", "None")]: "",
        [t("gui.move", "Move")]: "translate",
        [t("gui.target", "Target")]: "rotate",
      })
      .name(t("gui.transformLight", "Transform Light"))
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
            showTransformLightHintToast("translate");
          } else {
            core.transformControlLightTarget.setMode("translate");
            core.transformControlLightTarget.attach(core.dirLightTarget);
            core.transformControlLight.detach();
            showTransformLightHintToast("rotate");
          }
        }
        Viewer.updateEditorToolbarState();
      });
    core.i18nGui.directionalLightColorController = lightFolder
      .addColor(Viewer.colors, "DirectionalLight")
      .name(t("gui.color", "Color"))
      .onChange(function (value) {
        core.lightObjects[0].color = new THREE.Color(value);
      })
      .listen();
    core.i18nGui.directionalLightIntensityController = lightFolder
      .add(Viewer.intensity, "startIntensityDir", 0, 10)
      .name(t("gui.intensity", "Intensity"))
      .onChange(function (value) {
        core.lightObjects[0].intensity = value;
      })
      .listen();

    const lightFolderAmbient = Viewer.editorFolder.addFolder(t("gui.ambientLight", "Ambient Light")).close();
    core.i18nGui.lightFolderAmbient = lightFolderAmbient;
    core.i18nGui.ambientLightColorController = lightFolderAmbient
      .addColor(Viewer.colors, "AmbientLight")
      .name(t("gui.color", "Color"))
      .onChange(function (value) {
        Viewer.ambientLight.color = new THREE.Color(value);
      })
      .listen();
    core.i18nGui.ambientLightIntensityController = lightFolderAmbient
      .add(Viewer.intensity, "startIntensityAmbient", 0, 10)
      .name(t("gui.intensity", "Intensity"))
      .onChange(function (value) {
        Viewer.ambientLight.intensity = value;
      })
      .listen();

    const lightFolderCamera = Viewer.editorFolder.addFolder(t("gui.cameraLight", "Camera Light")).close();
    core.i18nGui.lightFolderCamera = lightFolderCamera;
    core.i18nGui.cameraLightColorController = lightFolderCamera
      .addColor(Viewer.colors, "CameraLight")
      .name(t("gui.color", "Color"))
      .onChange(function (value) {
        Viewer.cameraLight.color = new THREE.Color(value);
      })
      .listen();
    core.i18nGui.cameraLightIntensityController = lightFolderCamera
      .add(Viewer.intensity, "startIntensityCamera", 0, 10)
      .name(t("gui.intensity", "Intensity"))
      .onChange(function (value) {
        Viewer.cameraLight.intensity = value;
      })
      .listen();

    const backgroundFolder = Viewer.editorFolder.addFolder(t("gui.backgroundColor", "Background Color")).close();
    core.i18nGui.backgroundFolder = backgroundFolder;
    core.i18nGui.backgroundColorController = backgroundFolder
      .addColor(Viewer.colors, "BackgroundColor")
      .name(t("gui.backgroundColor", "Background Color"))
      .onChange(function (value) {
        changeBackground(
          Viewer.backgroundType["Background Type"],
          value,
          Viewer.colors["BackgroundColorOuter"]
        );
      })
      .listen();
    core.i18nGui.backgroundColorOuterController = backgroundFolder
      .addColor(Viewer.colors, "BackgroundColorOuter")
      .name(t("gui.backgroundColorOuter", "Background Color Outer"))
      .onChange(function (value) {
        changeBackground(
          Viewer.backgroundType["Background Type"],
          Viewer.colors["BackgroundColor"],
          value
        );
      })
      .listen();
    core.i18nGui.backgroundTypeController = backgroundFolder
      .add(Viewer.backgroundType, "Background Type", {
        [t("gui.linear", "Linear")]: "linear",
        [t("gui.gradient", "Gradient")]: "gradient",
      })
      .name(t("gui.backgroundType", "Background Type"))
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
      core.clippingFolder = Viewer.editorFolder.addFolder(t("gui.clippingFolder", "Clipping Planes")).close();
      core.i18nGui.clippingFolder = core.clippingFolder;
      
      core.materialsFolder = Viewer.editorFolder.addFolder(t("gui.materials", "Materials")).close();
      core.i18nGui.materialsFolder = core.materialsFolder;
      setCore("materialsFolder", core.materialsFolder);

      Viewer.pickingModeController = Viewer.editorFolder.add(
        {
          togglePickingMode() {
            Viewer.togglePickingMode();
          },
        },
        "togglePickingMode"
      );
      Viewer.updatePickingModeControllerLabel();

      Viewer.clearSelectedFacesController = Viewer.editorFolder.add(
        {
          [t("gui.clearSelectedFaces", "Clear selected faces")]() {
            Viewer.clearSelectedFaces();
            Viewer.restoreLastPickedFace();
          },
        },
        t("gui.clearSelectedFaces", "Clear selected faces")
      );
      core.i18nGui.clearSelectedFacesController = Viewer.clearSelectedFacesController;

      Viewer.selectedFacesCountController = Viewer.editorFolder
        .add(Viewer.pickingStats, "Selected faces")
        .listen();
      Viewer.updateSelectedFacesControllerLabel();
      Viewer.selectedFacesCountController.disable();

      Viewer.metadataFolder = core.gui.addFolder(t("gui.metadata", "Metadata")).close();
      Viewer.metadataFolder.domElement?.classList.add("viewer-gui-main-folder");
      Viewer.metadataFolder.domElement?.setAttribute("data-gui-main-folder", "metadata");
      core.i18nGui.metadataFolder = Viewer.metadataFolder;

      Viewer.addAnnotationController = Viewer.metadataFolder.add(
        {
          [t("gui.addAnnotations", "Add annotations")]() {
            Viewer.openAnnotationDialogWithAutoPicking();
          },
        },
        t("gui.addAnnotations", "Add annotations")
      );
      core.i18nGui.addAnnotationController = Viewer.addAnnotationController;
      core.i18nGui.exportAnnotationsController = Viewer.metadataFolder.add(
        {
          [t("gui.exportAnnotationsXml", "Export annotations XML")]() {
            Viewer.downloadAnnotationsXmlFile();
          },
        },
        t("gui.exportAnnotationsXml", "Export annotations XML")
      );
      core.i18nGui.importAnnotationsController = Viewer.metadataFolder.add(
        {
          [t("gui.importAnnotationsXml", "Import annotations XML")]() {
            Viewer.triggerAnnotationsXmlImport();
          },
        },
        t("gui.importAnnotationsXml", "Import annotations XML")
      );
      Viewer.updatePickingControlsVisibility();

      Viewer.distanceMeasurementController = Viewer.editorFolder.add(
        {
          toggleDistanceMeasurement() {
            Viewer.toggleDistanceMeasurement();
          },
        },
        "toggleDistanceMeasurement"
      );
      Viewer.updateDistanceMeasurementControllerLabel();

      core.i18nGui.resetCameraController = Viewer.editorFolder.add(
        {
          [t("gui.resetCameraPosition", "Reset camera position")]() {
            Viewer.resetCamera();
          },
        },
        t("gui.resetCameraPosition", "Reset camera position")
      );
    }

    if (!core.isLightweight) {
      Viewer.propertiesFolder = Viewer.editorFolder.addFolder(t("gui.saveProperties", "Save properties")).close();
      core.i18nGui.propertiesFolder = Viewer.propertiesFolder;
      core.i18nGui.savePropPositionController = Viewer.propertiesFolder.add(Viewer.saveProperties, "Position").name(t("gui.position", "Position"));
      core.i18nGui.savePropRotationController = Viewer.propertiesFolder.add(Viewer.saveProperties, "Rotation").name(t("gui.rotation", "Rotation"));
      core.i18nGui.savePropScaleController = Viewer.propertiesFolder.add(Viewer.saveProperties, "Scale").name(t("gui.scale", "Scale"));
      core.i18nGui.savePropCameraController = Viewer.propertiesFolder.add(Viewer.saveProperties, "Camera").name(t("gui.camera", "Camera"));
      core.i18nGui.savePropDirectionalController = Viewer.propertiesFolder.add(Viewer.saveProperties, "DirectionalLight").name(t("gui.directionalLight", "Directional Light"));
      core.i18nGui.savePropAmbientController = Viewer.propertiesFolder.add(Viewer.saveProperties, "AmbientLight").name(t("gui.ambientLight", "Ambient Light"));
      core.i18nGui.savePropCameraLightController = Viewer.propertiesFolder.add(Viewer.saveProperties, "CameraLight").name(t("gui.cameraLight", "Camera Light"));
      core.i18nGui.savePropBackgroundController = Viewer.propertiesFolder.add(Viewer.saveProperties, "BackgroundColor").name(t("gui.backgroundColor", "Background Color"));
    }

    if (core.EDITOR && !core.isLightweight) {
      core.i18nGui.saveController = Viewer.editorFolder.add(
        {
          [t("gui.save", "Save")]() {
            Viewer.saveEditorMetadata();
          }
        },
        t("gui.save", "Save")
      );
      core.i18nGui.renderPreviewController = Viewer.editorFolder.add(
        {
          [t("gui.renderPreview", "Render preview")]() {
            Viewer.takeScreenshot();
          },
        },
        t("gui.renderPreview", "Render preview")
      );
    }

    if (core.EDITOR) {
      Viewer.createEditorToolbar();
      Viewer.setEditorAdvancedPanelVisible(false);
    }

    Viewer.updateLocalizedUI();
  },

  async startModelProcessing() {
    /*const r = await fetch("/api/model/create", {method:"POST" });

    const data = await r.json();

    const id = data.entity_id;*/

    const _id = core.CONFIG.entity.id;

    localStorage.setItem("processing_model_id", _id);

    let loadingMap = this.getProcessingLoadingSteps();

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
      showToast(t("toasts.noIiiifModelFallback", "No 3D model found in IIIF manifest, loading example model."));
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
    form?.setAttribute("data-viewer-theme", Viewer.currentTheme);
    Viewer.updateIIIFFormLabels();

    Viewer.bindEventListener(collapseBtn, "click", () => {
      form.classList.toggle("collapsed");
      collapseBtn.textContent = form.classList.contains("collapsed") ? "▸" : "▾";
      collapseBtn.title = form.classList.contains("collapsed")
        ? t("iiif.expand", "Expand")
        : t("iiif.collapse", "Collapse");
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
        showToast("iiif.invalidUrl", "warning");
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
          showToast("iiif.invalidJson", "warning");
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

      const hostname = window.location.hostname;
      const isLocal = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
      const isLocalNetwork = hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.endsWith('.local');
      const isCodeSandbox = hostname.includes('codesandbox.io') || hostname.includes('csb.app');
      this.isLocalPreview = isLocal || isLocalNetwork || isCodeSandbox;
      setCore('isLocalPreview', this.isLocalPreview);
      console.info('Running on', window.location.hostname, '- Local preview mode:', core.isLocalPreview);

      if (!core.PRESENTATION_MODE && !core.SANDBOX_MODE) {
        Viewer.startModelProcessing();
      }

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

      core.renderer.domElement.tabIndex = 0;
      core.renderer.domElement.setAttribute("aria-label", "3D viewer canvas");

      if (!core.PRESENTATION_MODE) {

        Viewer.bindEventListener(core.renderer.domElement, "pointerdown", Viewer.onPointerDown);
        Viewer.bindEventListener(core.renderer.domElement, "pointerup", Viewer.onPointerUp);
        Viewer.bindEventListener(core.renderer.domElement, "pointermove", Viewer.onPointerMove);
        Viewer.bindEventListener(core.renderer.domElement, "mouseenter", (event) => {
          if (!Viewer.isPointerDirectlyOverCanvas(event)) return;
          Viewer.maybeShowKeyboardHint();
        });
        Viewer.lastWindowFocusAt = Date.now();
        Viewer.bindEventListener(window, "focus", () => {
          Viewer.lastWindowFocusAt = Date.now();
        });
        Viewer.bindEventListener(document, "visibilitychange", () => {
          if (document.visibilityState === "visible") {
            Viewer.lastWindowFocusAt = Date.now();
          }
        });

        Viewer.bindEventListener(core.renderer.domElement, "pointerdown", () => {
          core.renderer.domElement.focus();
        });
        Viewer.bindEventListener(core.renderer.domElement, "keydown", Viewer.onViewerKeyDown);

        if (core.isLocalPreview || core.SANDBOX_MODE) {
          Viewer.bindEventListener(core.renderer.domElement, "dragover", Viewer.onDragOver);
          Viewer.bindEventListener(core.renderer.domElement, "drop", Viewer.onDrop);
        }
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

      Viewer.viewerWrapper = core.container.closest('.viewer-wrapper');

      if (!Viewer.viewerWrapper) {
        Viewer.viewerWrapper = core.container.parentElement;
        Viewer.viewerWrapper.classList.add('viewer-wrapper');
      }

      core.camera.aspect = core.CONFIG.viewer.canvasDimensions.x / core.CONFIG.viewer.canvasDimensions.y;
      core.camera.updateProjectionMatrix();

      setCore('mainCanvas', Viewer.mainCanvas);
      if (!core.PRESENTATION_MODE) {
        const scriptUrl = document.currentScript?.src || import.meta.url;
        Viewer.DFG_ASSETS = scriptUrl.replace(/\/[^\/]*$/, '');

        setCore('DFG_ASSETS', Viewer.DFG_ASSETS);
        getModuleAssetBasePath();

        Viewer.actionMenu = document.createElement("div");
        Viewer.actionMenu.setAttribute("id", "viewerActionMenu");
        Viewer.actionMenu.innerHTML = `
          <input
            id="viewerActionMenuToggle"
            class="viewer-action-menu_checkbox"
            type="checkbox"
            aria-label="Open main menu"
          />
          <label
            for="viewerActionMenuToggle"
            class="viewer-action-menu_toggle"
            aria-label="Open main menu"
            title="Main menu"
          >
            <span class="viewer-action-menu_settings-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2 2.2 3-.2.8 2.9 2.6 1.4-1 2.8 1 2.8-2.6 1.4-.8 2.9-3-.2L12 21l-2-2.2-3 .2-.8-2.9-2.6-1.4 1-2.8-1-2.8 2.6-1.4.8-2.9 3 .2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
            </span>
            <b class="viewer-editor-tool_sr">Main menu</b>
          </label>
          <div class="viewer-action-menu_panel" aria-label="Main menu"></div>
        `;
        core.container.appendChild(Viewer.actionMenu);

        Viewer.actionMenuToggle = Viewer.actionMenu.querySelector("#viewerActionMenuToggle");
        Viewer.actionMenuPanel = Viewer.actionMenu.querySelector(".viewer-action-menu_panel");
        Viewer.applyTheme(Viewer.getStoredTheme(), { persist: false });

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

        Viewer.themeMode = document.createElement("button");
        Viewer.themeMode.setAttribute("id", "viewerThemeMode");
        Viewer.themeMode.setAttribute("type", "button");
        
        // Create language mode container and dropdown
        Viewer.languageModeContainer = document.createElement("div");
        Viewer.languageModeContainer.setAttribute("id", "viewerLanguageModeContainer");
        Viewer.languageModeContainer.className = "language-mode-container";
        
        Viewer.languageMode = document.createElement("button");
        Viewer.languageMode.setAttribute("id", "viewerLanguageMode");
        Viewer.languageMode.setAttribute("type", "button");
        
        Viewer.languageModeDropdown = document.createElement("div");
        Viewer.languageModeDropdown.setAttribute("id", "viewerLanguageModeDropdown");
        Viewer.languageModeDropdown.className = "language-mode-dropdown";
        Viewer.languageModeDropdown.hidden = true;
        
        const languages = [
          { code: "en", label: "EN", class: "language-dropdown-item-english" },
          { code: "pl", label: "PL", class: "language-dropdown-item-polish" },
          { code: "de", label: "DE", class: "language-dropdown-item-german" }
        ];
        
        languages.forEach(lang => {
          const item = document.createElement("div");
          item.className = `language-dropdown-item ${lang.class}`;
          item.dataset.lang = lang.code;
          item.textContent = lang.label;
          item.setAttribute("role", "option");
          item.setAttribute("aria-selected", core.currentLanguage === lang.code ? "true" : "false");
          Viewer.bindEventListener(item, "click", () => Viewer.selectLanguage(lang.code));
          Viewer.languageModeDropdown.appendChild(item);
        });
        
        Viewer.languageModeContainer.appendChild(Viewer.languageMode);
        Viewer.languageModeContainer.appendChild(Viewer.languageModeDropdown);
        
        Viewer.updateThemeControlLabels();
        Viewer.updateLanguageControlLabels();

        Viewer.actionMenuPanel.appendChild(Viewer.languageModeContainer);
        Viewer.actionMenuPanel.appendChild(Viewer.themeMode);
        Viewer.actionMenuPanel.appendChild(Viewer.viewEntity);
        Viewer.actionMenuPanel.appendChild(Viewer.downloadModel);
        Viewer.actionMenuPanel.appendChild(Viewer.fullscreenMode);
        if (Viewer.urlOptions.hideUi) {
          Viewer.actionMenu.hidden = true;
        }
        Viewer.createEmbedConfiguratorPanel();

        setCore('viewEntity', Viewer.viewEntity);
        Viewer.bindEventListener(Viewer.languageMode, "click", Viewer.toggleLanguage.bind(Viewer));
        Viewer.bindEventListener(Viewer.themeMode, "click", Viewer.toggleTheme.bind(Viewer));
        Viewer.bindEventListener(Viewer.fullscreenMode, "click", Viewer.toggleFullscreen, false);
        Viewer.bindEventListener(Viewer.viewEntity, "click", Viewer.openEmbedConfiguratorFromMenu.bind(Viewer));
        Viewer.updateEmbedMenuEntryState();
        Viewer.applyLanguage({ persist: false });
        Viewer.bindEventListener(Viewer.downloadModel, "click", () => Viewer.closeActionMenu());
        Viewer.bindEventListener(document, "click", (event) => {
          if (
            !Viewer.actionMenu?.contains(event.target) &&
            !Viewer.embedConfiguratorPanel?.contains(event.target)
          ) {
            Viewer.closeActionMenu();
          }
        });

        Viewer.handHint.innerHTML = `<img src="${core.DFG_ASSETS}/img/hand-hint.png" alt="Hand hint" width=48 height=48 title="Hand hint animation"/>`;
        
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
      }

      Viewer.controls = new OrbitControls(core.camera, core.renderer.domElement);
      Viewer.controls.target.set(0, 100, 0);
      Viewer.controls.enableDamping = true;
      Viewer.controls.dampingFactor = 0.05;
      Viewer.controls.enableRotate = true;

      if (core.PRESENTATION_MODE) {
        //TODO
        Viewer.controls.autoRotate = true;
        Viewer.controls.autoRotateSpeed = 1.5; // in seconds
        document.body.classList.add("presentation-mode");
        document.documentElement.classList.add("presentation-mode");
        core.renderer.setClearColor(0x000000, 0);
      }
      if (typeof Viewer.urlOptions.autoRotate === "boolean") {
        Viewer.controls.autoRotate = Viewer.urlOptions.autoRotate;
      }
      if (Number.isFinite(Viewer.urlOptions.autoRotateSpeed)) {
        Viewer.controls.autoRotateSpeed = Viewer.urlOptions.autoRotateSpeed;
      }
      if (Viewer.urlOptions.disableInteraction || core.PRESENTATION_MODE) {
        Viewer.controls.enabled = false;
        Viewer.controls.enableRotate = false;
        Viewer.controls.enablePan = false;
        Viewer.controls.enableZoom = false;
      }
      Viewer.controls.update();
      setCore('controls', Viewer.controls);
      setCore('GESTURE', Viewer.GESTURE);
      setCore('lastTime', Viewer.lastTime);
      setCore('helperObjects', Viewer.helperObjects);

      if (!core.PRESENTATION_MODE) {
        Viewer.transformControl = new TransformControls(core.camera, core.renderer.domElement);
        Viewer.transformControl.rotationSnap = THREE.MathUtils.degToRad(5);
        Viewer.transformControl.space = "local";
        Viewer.transformControl.addEventListener("change", Viewer.render);
        Viewer.transformControl.addEventListener("objectChange", () => {
          Viewer.changeScale();
          Viewer.syncOutlineClippingTransform();
        });
        Viewer.transformControl.addEventListener("mouseUp", () => {
          Viewer.syncOutlineClippingTransform();
          Viewer.calculateObjectScale();
        });
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

      }

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

      if (core.isLocalPreview && !core.PRESENTATION_MODE && !core.SANDBOX_MODE) {
        const picker = document.getElementById('example-model-picker');
        const selectModel = document.getElementById('example-model-select');
        const themeToggle = document.getElementById('example-theme-toggle');
        const viewerElement = document.getElementById('DFG_3DViewer');
        if (picker && selectModel && viewerElement) {
          Viewer.updateLocalPreviewLabels();
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
          if (themeToggle) {
            themeToggle.hidden = true;
          }

          selectModel.addEventListener('change', () => {
            core.autoPath = selectModel.value;
            window.localStorage.setItem('dfg3dviewer-example-model', selectModel.value);
            this.resetLoadedModelState();
            this.mainLoadModelWrapper();
          });
        }
      }

      if (core.SANDBOX_MODE) {
        Viewer.prepareSandboxScene();
      } else if (!core.PRESENTATION_MODE) {
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
              Viewer.pendingAnnotationsXml = Viewer.extractAnnotationsXmlFromExportDocument(doc);

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
      } else {
        await Viewer.mainLoadModelWrapper();
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

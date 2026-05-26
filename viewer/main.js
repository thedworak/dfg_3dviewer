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
  normalizeColor,
} from "./utils.js";

import { initClippingPlanes, reportViewerError, showToast, toastHelper, changeBackground } from './viewer-utils.js';
import { attachEmbedConfigurator } from "./ui/embed-configurator.js";
import { buildThumbnailGallery } from "./ui/thumbnail-gallery.js";
import { attachLocalizationTheme } from "./ui/localization-theme.js";
import { attachLoadingStatus } from "./ui/loading-status.js";
import { attachMaterialsEditor } from "./editor/materials-editor.js";
import { buildEditorMetadata, saveEditorMetadata as persistEditorMetadata } from "./editor/metadata-persistence.js";
import { attachAnnotations } from "./editor/annotations.js";
import { attachMeasurement } from "./editor/measurement.js";
import { attachPicking } from "./editor/picking.js";
import { captureAndUploadThumbnail } from "./editor/thumbnail-capture.js";

import { loadModel, outlineClipping, getModuleAssetBasePath, syncSceneEnvironment } from "./loaders.js";
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

//custom libraries
import Stats from "stats.js";
import { GUI } from "./js/external_libs/lil-gui.esm.min.js";
import { objectsConfig, setObjectsConfig } from "./object-settings.js";

import { loadIIIFManifest, getAnnotations } from "./IIIF/iiif-api.js";
import {
  attachEditorToolbar,
  createEditorToolbar,
  getEditorToolbarIcon,
  getEditorToolbarHost,
  syncEditorToolbarSecondaryTrayWidth,
  toggleToolbarExpanded as toggleEditorToolbarExpanded,
  updateClippingPlanesSubmenuState,
  updateEditorToolbarLabels as syncEditorToolbarLabels,
  updateEditorToolbarState as syncEditorToolbarState,
  updateHierarchySubmenuState,
  updateLightsSubmenuState,
  updateStatisticsSubmenuState,
} from "./editor-toolbar.js";
import { VIEWER_I18N } from "./i18n.js";
import { t } from "./i18n-utils.js";
import { loadDroppedArchive } from "./extract-helper.js";
import { loadDroppedModel } from "./sandbox.js";
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

export const Viewer = {
  CONFIG: null,
  PRESENTATION_MODE: false,
  SANDBOX_MODE: false,
  SUPPORTED_EXTENSIONS: ['glb', 'gltf', 'obj', 'dae', 'fbx', 'ply', 'ifc', 'stl', 'xyz', 'json', '3ds', 'pcd'],
  SUPPORTED_ARCHIVES: ['zip', 'rar', 'tar', 'xz', 'gz'],
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
  isToolbarExpanded: false,
  editorSecondaryKeys: [],
  downloadModel: null,
  embedConfiguratorPanel: null,
  embedConfigInputs: null,
  embedConfigPreviewFrame: null,
  embedMissingSourceNotified: false,
  wireframeMode: false,
  environmentMapEnabled: true,
  currentTheme: "dark",
  currentLanguage: "en",
  loadingLog: null,
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
  materialsDialog: null,
  materialsDialogSelect: null,
  materialsDialogInputs: null,
  materialsDialogPosition: null,
  materialsDialogDragging: false,
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
    "Edit material": "",
  },
  materialsEditorObject: null,
  materialsList: [],
  selectedMaterialUuid: null,
  materialSelectionController: null,
  materialGuiControls: null,
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
    return getEditorToolbarIcon(icon);
  },

  toggleToolbarExpanded() {
    return toggleEditorToolbarExpanded(this);
  },

  syncEditorToolbarSecondaryTrayWidth() {
    return syncEditorToolbarSecondaryTrayWidth(this);
  },

  getEditorToolbarHost() {
    return getEditorToolbarHost(this);
  },

  attachEditorToolbar() {
    return attachEditorToolbar(this);
  },

  createEditorToolbar() {
    return createEditorToolbar(this);
  },

  updateEditorToolbarLabels() {
    return syncEditorToolbarLabels(this);
  },

  isEditorAdvancedPanelVisible() {
    if (!this.editorFolder?.domElement) return false;
    return this.editorFolder.domElement.style.display !== "none";
  },

  setEditorAdvancedPanelVisible(visible) {
    if (!this.editorFolder) return;
    if (visible) {
      if (core.guiContainer) {
        core.guiContainer.hidden = false;
      }
      if (core.gui?.domElement?.style) {
        core.gui.domElement.style.visibility = "visible";
      }
      this.editorFolder.show?.();
    } else {
      this.editorFolder.hide?.();
    }
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
  },

  toggleEditorAdvancedPanel() {
    this.setEditorAdvancedPanelVisible(!this.isEditorAdvancedPanelVisible());
  },

  toggleCameraProjection () {
    if (!core.camera) return;
    const isPerspective = core.camera.isPerspectiveCamera === true;
    Viewer.setCameraProjection(isPerspective ? "orthographic" : "perspective");
  },

  updateOrthoFrustum(camera, width, height) {
    const target = core.controls?.target || new THREE.Vector3(0, 0, 0);
    const distance = core.camera.position.distanceTo(target);
    const aspect = width / height;

    const frustumHeight = distance;
    const frustumWidth = frustumHeight * aspect;

    camera.left = -frustumWidth / 2;
    camera.right = frustumWidth / 2;
    camera.top = frustumHeight / 2;
    camera.bottom = -frustumHeight / 2;

    camera.updateProjectionMatrix();
  },

  setCameraProjection(projection) {
    if (!core.camera) return;

    const currentProjection = core.camera.isPerspectiveCamera
      ? "perspective"
      : "orthographic";

    if (projection === currentProjection) return;

    const aspect =
      core.CONFIG.viewer.canvasDimensions.x /
      core.CONFIG.viewer.canvasDimensions.y;

    const target = core.controls?.target || new THREE.Vector3(0, 0, 0);

    const distance = core.camera.position.distanceTo(target);

    let newCamera;

    if (projection === "orthographic") {
      const fov = THREE.MathUtils.degToRad(core.camera.fov);

      const viewHeight = 2 * distance * Math.tan(fov / 2);
      const viewWidth = viewHeight * aspect;

      newCamera = new THREE.OrthographicCamera(
        -viewWidth / 2,
        viewWidth / 2,
        viewHeight / 2,
        -viewHeight / 2,
        0.1,
        2000
      );
      newCamera.zoom = 1;
    } else {
      newCamera = new THREE.PerspectiveCamera(
        50,
        aspect,
        0.1,
        2000
      );
    }

    newCamera.position.copy(core.camera.position);
    newCamera.quaternion.copy(core.camera.quaternion);
    newCamera.up.copy(core.camera.up);

    newCamera.updateProjectionMatrix();

    core.camera = newCamera;

    if (core.controls) {
      core.controls.object = core.camera;
      core.controls.update();
    }

    this.updateCamera();
    this.updateFullscreenButtonIcon();
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
  },

  updateCamera () {
    if (!core.camera || !core.controls) return;
    core.controls.object = core.camera;
    core.controls.update();
  },

  toggleWireframeMode() {
    if (typeof core.scene === "undefined") return;
    const isEnabled = !core.scene.traverse((child) => {
      if (child.material) {
        child.material.wireframe = !child.material.wireframe;
        child.material.needsUpdate = true;
      }
    });
    this.wireframeMode = isEnabled;
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
  },

  async setEnvironmentMapEnabled(enabled) {
    this.environmentMapEnabled = enabled !== false;
    setCore("environmentMapEnabled", this.environmentMapEnabled);
    await syncSceneEnvironment(this.environmentMapEnabled);
    this.updateEditorToolbarState();
  },

  async toggleEnvironmentMap() {
    await this.setEnvironmentMapEnabled(!this.environmentMapEnabled);
  },

  addHierarchySubmenuItem(name, meshId) {
    if (!this.hierarchySubmenu) return;
    
    const subButton = document.createElement("button");
    subButton.type = "button";
    subButton.className = "viewer-editor-tool viewer-editor-tool_submenu-button viewer-editor-hierarchy-item";
    subButton.dataset.tool = `hierarchy-item-${meshId}`;
    subButton.innerHTML = `<span class="viewer-editor-tool_sr">${name}</span>`;
    subButton.setAttribute("title", name);
    subButton.setAttribute("aria-label", name);
    
    const textLabel = document.createElement("span");
    textLabel.className = "viewer-editor-hierarchy-submenu-label";
    textLabel.style.marginLeft = "8px";
    textLabel.style.marginRight = "8px";
    textLabel.textContent = name;
    textLabel.style.maxWidth = "120px";
    textLabel.style.overflow = "hidden";
    textLabel.style.textOverflow = "ellipsis";
    textLabel.style.whiteSpace = "nowrap";
    textLabel.style.display = "inline-block";
    subButton.appendChild(textLabel);
    
    this.bindEventListener(subButton, "click", (event) => {
      event.stopPropagation();
      Viewer.selectObjectHierarchy(meshId, core.container);
    });
    
    this.hierarchySubmenuList.appendChild(subButton);
    this.hierarchySubmenuButtons[meshId] = subButton;
    this.updateHierarchySubmenuState();
  },

  clearHierarchySubmenu() {
    if (!this.hierarchySubmenuList) return;
    this.hierarchySubmenuList.innerHTML = "";
    this.hierarchySubmenuButtons = {};
    this.updateHierarchySubmenuState();
  },

  updateHierarchySubmenuState() {
    return updateHierarchySubmenuState(this);
  },

  clearHierarchySelection() {
    if (!Array.isArray(core.selectedObjects) || core.selectedObjects.length === 0) {
      Viewer.updateHierarchySubmenuState();
      return;
    }

    core.selectedObjects.forEach((item) => {
      const object = core.scene?.getObjectById?.(item.id);
      if (!object || !item?.originalMaterial) return;
      object.material = item.originalMaterial;
      object.material.needsUpdate = true;
    });

    core.selectedObjects.length = 0;
    Viewer.updateHierarchySubmenuState();
  },

  toggleStatsVisibility() {
    if (typeof core.stats === "undefined" || !core.stats?.dom) return;
    const isVisible = core.stats.dom.style.visibility !== "visible";
    core.stats.dom.style.visibility = isVisible ? "visible" : "hidden";
    this.updateEditorToolbarState();
  },

  setPerformanceMode(value) {
    if (typeof core.renderer !== "undefined") {
      core.renderer.powerPreference = value;
    }
    if (!core.CONFIG.viewer) {
      core.CONFIG.viewer = {};
    }
    core.CONFIG.viewer.performanceMode = value;
    this.updateEditorToolbarState();
  },

  updateStatisticsSubmenuState() {
    return updateStatisticsSubmenuState(this);
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

  openLightFolder(name) {
    this.setEditorAdvancedPanelVisible(true);
    const folder = core.i18nGui?.[name];
    if (folder?.open) {
      folder.open();
    }
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
      if (core.planeHelpers?.length >= 3) {
        core.planeHelpers.forEach((helper) => {
          if (helper) helper.visible = false;
        });
      }
      core.planeParams.clippingMode.x = false;
      core.planeParams.clippingMode.y = false;
      core.planeParams.clippingMode.z = false;
      if (core.outlineClipping) {
        core.outlineClipping.visible = false;
      }
      if (this.transformControlClippingPlaneX) {
        this.transformControlClippingPlaneX.detach();
      }
      if (this.transformControlClippingPlaneY) {
        this.transformControlClippingPlaneY.detach();
      }
      if (this.transformControlClippingPlaneZ) {
        this.transformControlClippingPlaneZ.detach();
      }
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

  toggleClippingPlaneHelper(axis) {
    const axisIndex = { x: 0, y: 1, z: 2 }[axis];
    const planeHelper = core.planeHelpers?.[axisIndex];
    const control = this[`transformControlClippingPlane${axis.toUpperCase()}`];
    if (!planeHelper) return;

    const active = !Boolean(core.planeParams.clippingMode?.[axis]);
    core.planeParams.clippingMode[axis] = planeHelper.visible = active;

    if (active) {
      control?.attach?.(planeHelper);
      if (core.planeParams.outline.visible) core.outlineClipping.visible = true;
    } else {
      control?.detach?.();
      if (
        !core.planeParams.clippingMode.x &&
        !core.planeParams.clippingMode.y &&
        !core.planeParams.clippingMode.z &&
        !core.planeParams.outline.visible
      ) {
        core.outlineClipping.visible = false;
      }
    }

    toastHelper("clippingHelperToggle", "info", {
      axis: axis.toUpperCase(),
      state: active,
    });
    this.refreshClippingHintVisibility();
    this.updateClippingPlanesSubmenuState();
  },

  toggleClippingPlaneVisible() {
    const visible = !Boolean(core.planeParams.outline.visible);
    core.planeParams.outline.visible = visible;
    if (core.outlineClipping) core.outlineClipping.visible = visible;
    this.updateClippingPlanesSubmenuState();
  },

  refreshClippingHintVisibility() {
    const clippingMode = core.planeParams?.clippingMode || {};
    if (this.clippingHint) {
      this.clippingHint.hidden = !(clippingMode.x || clippingMode.y || clippingMode.z);
    }
  },

  updateClippingPlanesSubmenuState() {
    return updateClippingPlanesSubmenuState(this);
  },

  updateAnnotateSubmenuState() {
    if (!this.annotateSubmenuButtons) return;

  },

  updateLightsSubmenuState() {
    return updateLightsSubmenuState(this);
  },

  async saveEditorMetadata() {
    return persistEditorMetadata(this);
  },

  updateEditorToolbarState() {
    return syncEditorToolbarState(this);
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
      scale: this.parseVector2Param(params.get("scale")) ?? null,
      showNotifications: showNotificationsFromQuery !== false
    };
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

  updatePickingModeControllerLabel() {
    if (!this.pickingModeController?.name) return;
    this.pickingModeController.name(
      this.pickingMode
        ? t("controls.disablePickingMode", "Disable picking mode")
        : t("controls.enablePickingMode", "Enable picking mode")
    );
  },

  updateMaterialControllerLabel() {
    if (!this.materialController?.name) return;
    this.materialController.name(
      this.materialMode
        ? t("controls.disableMaterialMode", "Disable material mode")
        : t("controls.enableMaterialMode", "Enable material mode")
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
    return core.SUPPORTED_EXTENSIONS.map((extension) => extension.toUpperCase()).join(", ");
  },

  getSupportedArchiveFormatsText() {
    return core.SUPPORTED_ARCHIVES.map((extension) => extension.toUpperCase()).join(", ");
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

  updateFullscreenButtonIcon() {
    if (core.editorToolbar) {
      if (Viewer.FULLSCREEN) {
        core.editorToolbar.classList.add("with-fullscreen");
      } else {
        core.editorToolbar.classList.remove("with-fullscreen");
      }
    }
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
    setCore('SUPPORTED_EXTENSIONS', this.SUPPORTED_EXTENSIONS);
    setCore('SUPPORTED_ARCHIVES', this.SUPPORTED_ARCHIVES);
    setCore('enqueueStatusNotice', this.enqueueStatusNotice.bind(this));
    setCore('dismissStatusNotice', this.dismissStatusNotice.bind(this));
    setCore('updateClippingHintVisibility', this.updateClippingHintVisibility.bind(this));
    setCore('editorToolbar', this.editorToolbar);

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
          exportViewer: "field_df",
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
            buildFake: false,
            testImages: [],
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
    this.baseContainerRect = { width: this.rect.width, height: this.rect.height };
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
      core.gui.domElement.style.visibility = "hidden";

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
      setCore('environmentMapEnabled', this.environmentMapEnabled);
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
      return "";
    }

    const injectGltfSegment = (pathname) => {
      if (!/\/[^/]+_(ZIP|RAR|TAR|XZ|GZ)\//i.test(pathname) || /\/gltf\//i.test(pathname)) {
        return pathname;
      }
      return pathname.replace(
        /^(.*\/[^/]+_(ZIP|RAR|TAR|XZ|GZ))(\/?)(.*)$/i,
        "$1/gltf/$4"
      );
    };

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
    Viewer.updateHierarchySubmenuState();
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

  buildGallery() {
    return buildThumbnailGallery(this);
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

  /* picking and measurement moved to viewer/editor modules */

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

        core.editorToolbar.style.bottom = -heightCSS*0.95 + 'px';
    } else {
        scale = {x: Number(core.CONFIG.viewer.scaleContainer?.x || 1), y: Number(core.CONFIG.viewer.scaleContainer?.y || 1)};
        const wrapper = Viewer.viewerWrapper || core.container;
        if (!wrapper) {
          return;
        }
        rect = wrapper.getBoundingClientRect();
        widthCSS = rect.width || 800;
        heightCSS = rect.height || 600;

        const widthCSSScaled = widthCSS * scale.x;
        const heightCSSScaled = heightCSS * scale.y;

        widthDev = widthCSSScaled * devicePixelRatio;
        heightDev = heightCSSScaled * devicePixelRatio;

        Viewer.mainCanvas.style.width = widthCSSScaled + 'px';
        Viewer.mainCanvas.style.height = heightCSSScaled + 'px';

        core.metadataContainer.style.width = '100%';
        core.metadataContainer.style.height = '100%';

        core.editorToolbar.style.bottom = -heightCSSScaled + 'px';

        if (Viewer.fileElement && Viewer.fileElement.length > 0) {
          Viewer.fileElement[0].style.height = (heightCSSScaled * 1.1) + 'px';
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

    if (core.camera.isOrthographicCamera) {
      this.updateOrthoFrustum(
        core.camera,
        widthCSS,
        heightCSS
      );
    } else {
      core.camera.aspect = widthCSS / heightCSS;
      core.camera.updateProjectionMatrix();
    }

    const effectiveWidth = widthCSS * scale.x;
    const effectiveHeight = heightCSS * scale.y;

    Viewer.mainCanvas.width = effectiveWidth * devicePixelRatio;
    Viewer.mainCanvas.height = effectiveHeight * devicePixelRatio;

    if (Viewer.actionMenu) {
      if (Viewer.actionMenu.classList.contains("viewer-action-menu_in-toolbar")) {
        Viewer.actionMenu.style.top = "";
        Viewer.actionMenu.style.right = "";
        Viewer.actionMenu.style.bottom = "";
      } else {
        const menuMargin = 16;
        const toggleSize = Viewer.actionMenu.querySelector(".viewer-action-menu_toggle")?.getBoundingClientRect().height || 45;
        Viewer.actionMenu.style.top = (effectiveHeight - toggleSize - menuMargin) + "px";
        Viewer.actionMenu.style.right = menuMargin + "px";
        Viewer.actionMenu.style.bottom = "auto";
      }
    }

    if (core.handHint)
    core.handHint.style.top = (effectiveHeight - 150) + 'px';
   
    core.renderer.setPixelRatio(devicePixelRatio);
    core.renderer.setSize(effectiveWidth, effectiveHeight, false);
    core.camera.aspect = effectiveWidth / effectiveHeight;
    core.camera.updateProjectionMatrix();
    core.controls?.update();
    core.CONFIG.viewer.canvasDimensions = { x: effectiveWidth, y: effectiveHeight };
  },


  async toggleFullscreen() {
    Viewer.closeActionMenu();
    try {
      if (!document.fullscreenElement) {
        await core.container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
      Viewer.updateSize();
      Viewer.updateFullscreenButtonIcon();
      Viewer.updateEditorToolbarLabels();
      Viewer.updateEditorToolbarState();
    } catch (err) {
      Viewer.reportError(err, {
        context: "Fullscreen error",
        toast: false,
        e2e: false,
      });
    }
  },

  onFullscreenChange () {
    // Layout (ESC + click)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        Viewer.updateSize();
        Viewer.updateEditorToolbarLabels();
        Viewer.updateEditorToolbarState();
      });
    });

    Viewer.updateFullscreenButtonIcon();
    Viewer.closeActionMenu();
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

    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];

    const extension = file.name
      .split('.')
      .pop()
      .toLowerCase();

    if (core.SUPPORTED_EXTENSIONS.includes(extension)) {
      await loadDroppedModel(file);
      return;
    }

    if (Viewer.SUPPORTED_ARCHIVES.includes(extension)) {
      await loadDroppedArchive(file);
      return;
    }

    toastHelper("unsupportedFormat", "error");
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
    return captureAndUploadThumbnail(this);
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
    } else if (Viewer.SUPPORTED_ARCHIVES.includes(Viewer._ext)) {
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
      archives: this.getSupportedArchiveFormatsText(),
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

  buildMetadata(rotateMetadata) {
    return buildEditorMetadata(this, rotateMetadata);
  },

  prepareStats () {
    // stats
    core.stats = new Stats();
    core.stats.domElement.classList.add("viewer-stats");
    if (typeof core.guiContainer !== "undefined" && core.stats?.dom) {
      core.guiContainer.appendChild(core.stats.dom);
      core.stats.dom.style.left = (core.guiContainer.getBoundingClientRect().width - core.stats.domElement.getBoundingClientRect().width + 10) + 'px';
      core.stats.dom.style.visibility = 'hidden';
    }

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

      //Viewer.metadataFolder = core.gui.addFolder(t("gui.metadata", "Metadata")).close();
      //Viewer.metadataFolder.domElement?.classList.add("viewer-gui-main-folder");
      //Viewer.metadataFolder.domElement?.setAttribute("data-gui-main-folder", "metadata");
      //core.i18nGui.metadataFolder = Viewer.metadataFolder;

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

      Viewer.attachEditorToolbar();

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
        if (Viewer.urlOptions.hideUi) {
          Viewer.actionMenu.hidden = true;
        }
        Viewer.createEmbedConfiguratorPanel();

        setCore('viewEntity', Viewer.viewEntity);
        Viewer.bindEventListener(Viewer.languageMode, "click", Viewer.toggleLanguage.bind(Viewer));
        Viewer.bindEventListener(Viewer.themeMode, "click", Viewer.toggleTheme.bind(Viewer));
        //Viewer.bindEventListener(Viewer.fullscreenMode, "click", Viewer.toggleFullscreen, false);
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
        if (Viewer.viewerWrapper === core.container && core.CONFIG.viewer?.scaleContainer) {
          const scale = {
            x: Number(core.CONFIG.viewer.scaleContainer.x || 1),
            y: Number(core.CONFIG.viewer.scaleContainer.y || 1),
          };
          Viewer.baseContainerRect = {
            width: Viewer.rect.width / scale.x,
            height: Viewer.rect.height / scale.y,
          };
        }
        core.guiContainer.style.maxHeight = `${Viewer.rect.height - 20}px`;
        //core.lilGui = document.getElementsByClassName("lil-gui root");

        Viewer.fileElement = document.getElementsByClassName("field--type-file");
        if (Viewer.fileElement.length > 0) {
          Viewer.fileElement[0].style.height = core.CONFIG.viewer.canvasDimensions.y * 1.1 + "px";
        }

        if (core.CONFIG.viewer.gallery?.build === true && !core.SANDBOX_MODE) {
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
      if (Viewer.SUPPORTED_ARCHIVES.includes(Viewer._ext)) {
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

attachEmbedConfigurator(Viewer);
attachLocalizationTheme(Viewer);
attachLoadingStatus(Viewer);
attachMaterialsEditor(Viewer);
attachAnnotations(Viewer);
attachPicking(Viewer);
attachMeasurement(Viewer);


export async function expectWebGL(page, showToast) {
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const canvas = document.querySelector('canvas');

        if (!canvas) return false;

        return !!(
          canvas.getContext('webgl2') ||
          canvas.getContext('webgl')
        );
      });
    }, {
      timeout: 5000,
      message: 'WebGL context not available',
    })
    .toBeTruthy();
}

window.Viewer = Viewer;

(async () => {
  try {
    await Viewer.MainInit();
  } catch (error) {
    Viewer.renderFatalError(error);
  }
})();

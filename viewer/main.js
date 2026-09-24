/*
DFG 3D-Viewer
Copyright (C) 2026 - Daniel Dworak

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

//Supported file formats: OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, PCD, glTF, USD/USDZ, 3MF, AMF, WRL, KMZ, VOX, LWO

const SOURCE = (typeof __BUILD_SOURCE__ !== 'undefined') ? __BUILD_SOURCE__ : "";
const BUILD = (typeof __BUILD__ !== 'undefined') ? __BUILD__ : "";
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
  normalizeColor,
} from "./utils.js";

import { initClippingPlanes, updateActiveClippingPlanes, reportViewerError, showToast, toastHelper, changeBackground } from './viewer-utils.js';
import { attachEmbedConfigurator } from "./ui/embed-configurator.js";
import { attachUploadPanel } from "./ui/upload-panel.js";
import { attachModelsPanel } from "./ui/models-panel.js";
import { attachAdminPanel } from "./ui/admin-panel.js";
import { attachLoginPanel } from "./ui/login-panel.js";
import { buildThumbnailGallery } from "./ui/thumbnail-gallery.js";
import { attachLocalizationTheme } from "./ui/localization-theme.js";
import { attachLoadingStatus } from "./ui/loading-status.js";
import { attachMaterialsEditor } from "./editor/materials-editor.js";
import { attachShadingEditor } from "./editor/shading.js";
import { buildEditorMetadata, saveEditorMetadata as persistEditorMetadata } from "./editor/metadata-persistence.js";
import { attachAnnotations } from "./editor/annotations.js";
import { attachMeasurement } from "./editor/measurement.js";
import { attachAnimations } from "./animations.js";
import { attachViewHelper } from "./ui/view-helper.js";
import { attachClipping } from "./editor/clipping.js";
import { attachPicking } from "./editor/picking.js";
import { captureAndUploadThumbnail } from "./editor/thumbnail-capture.js";
import { attachWindowControls } from "./ui/window-controls.js";

import { loadModel, outlineClipping, getModuleAssetBasePath, syncSceneEnvironment } from "./loaders.js";
import { createIIIFDropdown, createManifestUI, createManifestSourceSwitch, createAIM3IFDropdown, resetModelSettings } from "./metadata.js";
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
import { loadAIM3IFManifest, applyManifestConfig, applyManifestSettings, applyManifestBootstrapSettings, getManifestWindowState } from "./manifesto/manifesto-api.js";
import { isAIM3DManifest } from "./manifesto/aim3dviewer-validation.js";
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
  updateShadingSubmenuState,
  updateStatisticsSubmenuState,
} from "./editor-toolbar.js";
import { VIEWER_DEFAULTS } from "./viewer-defaults.js";
import {
  parseBooleanParam,
  parseFloatParam,
  parseVector2Param,
  parseVector3Param,
  formatVector3Param,
  parseProjectionParam,
  parseClippingModeParam,
  formatClippingModeParam,
  normalizeLanguage,
} from "./viewer-param-utils.js";
import {
  normalizeDrupalFilesPath,
  normalizeArchiveModelPath,
  setModelPaths,
  disableInteractionHint,
  addTextWatermark,
  addTextPoint,
  selectObjectHierarchy,
  recreateBoundingBox,
  normalizeFileUrl,
  shouldIgnoreLegacyEmbedDefaultModel,
  buildGallery,
  renderModelGalleryImages,
  toHexColor,
  toThreeColor,
  getWrapperSize,
} from "./viewer-helpers.js";
import { t } from "./i18n-utils.js";
import { loadDroppedArchive } from "./extract-helper.js";
import { loadDroppedModel, createCreditsElement } from "./sandbox.js";
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

// Small inline icons for the keyboard-shortcuts hint (see
// getKeyboardShortcutsDetailHtml() below) - inline SVG rather than image
// assets so they pick up the notice's `currentColor` in both themes without
// separate light/dark files.
const SHORTCUT_ICONS = {
  mouse: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="19" rx="6"/><line x1="12" y1="2" x2="12" y2="10"/><circle cx="12" cy="6" r="1" fill="currentColor" stroke="none"/></svg>',
  keyboard: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><rect x="5" y="9.5" width="1.6" height="1.6" fill="currentColor" stroke="none"/><rect x="9.2" y="9.5" width="1.6" height="1.6" fill="currentColor" stroke="none"/><rect x="13.4" y="9.5" width="1.6" height="1.6" fill="currentColor" stroke="none"/><rect x="17.4" y="9.5" width="1.6" height="1.6" fill="currentColor" stroke="none"/><rect x="6" y="13.2" width="12" height="1.6" fill="currentColor" stroke="none"/></svg>',
  touch: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="7" stroke-dasharray="1.5 3"/></svg>',
  dragAndDrop: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="3" x2="12" y2="13"/><polyline points="8 9 12 13 16 9"/><line x1="4" y1="19" x2="20" y2="19"/></svg>',
};

export const Viewer = {
  ...VIEWER_DEFAULTS,

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

  syncEditorToolbarFullscreenHost() {
    if (!core.editorToolbar || !core.container) return;

    const host = document.fullscreenElement === core.container
      ? core.container
      : this.getEditorToolbarHost();

    if (host && core.editorToolbar.parentElement !== host) {
      host.appendChild(core.editorToolbar);
    }
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

    const size = core.boundingSphere ? core.boundingSphere.radius : core.camera.position.distanceTo(core.controls?.target) || 100;
    const near = Math.max(size / 1000, 0.01);
    const far = distance + size * 100;
    // core.camera.fov is undefined on an OrthographicCamera, so fall back to a sane default
    const fovDeg = Number.isFinite(core.camera.fov) ? core.camera.fov : 45;
    const fovRad = THREE.MathUtils.degToRad(fovDeg);

    if (projection === "orthographic") {
      const visibleHeight = 2 * distance * Math.tan(fovRad / 2);

      newCamera = new THREE.OrthographicCamera(
          -visibleHeight * aspect / 2,
          visibleHeight * aspect / 2,
          visibleHeight / 2,
          -visibleHeight / 2,
          near,
          far
      );

      newCamera.zoom = 1;
    } else {
      newCamera = new THREE.PerspectiveCamera(
        fovDeg,
        aspect,
        near,
        far
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
    core.wireframeMode = !core.wireframeMode;
    core.scene.traverse((child) => {
      if (child.material) {
        child.material.wireframe = core.wireframeMode;
        child.material.needsUpdate = true;
        child.material.wireframeLinewidth = 1;
      }
    });    
    this.updateEditorToolbarLabels();
    this.updateEditorToolbarState();
  },

  async setEnvironmentMapEnabled(enabled) {
    this.environmentMapEnabled = enabled !== false;
    setCore("environmentMapEnabled", this.environmentMapEnabled);
    await syncSceneEnvironment(this.environmentMapEnabled);
    this.updateEditorToolbarState();
  },

  async setEnvironmentMapPreset(preset) {
    this.environmentMapPreset = preset || "studio";
    setCore("environmentMapPreset", this.environmentMapPreset);
    // If environment is enabled, sync with the new preset
    const isEnabled = (core.scene?.environmentIntensity ?? 0) > 0;
    if (isEnabled) {
      await syncSceneEnvironment(true, this.environmentMapPreset);
    }
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
    showToast("toasts.performanceModeSet", { mode: value }, 2000);
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
      if (this.measurementMode === "distance") {
        toastHelper("distanceEnabled", {
          duration: 2600
        });
      }
      this.showMeasurementHint();
    } else {
      toastHelper(this.RULER_MODE ? "distanceModeEnabled" : "distanceModeDisabled");
    }
    if (!this.RULER_MODE) {
      this.clearMeasurements();
    } else {
      this.pickingMode = false;
      this.restoreLastPickedFace();
      this.clearSelectedFaces();
      this.updatePickingModeControllerLabel();
      this.updatePickingControlsVisibility();
    }
    this.updateDistanceMeasurementControllerLabel();
    this.updateMeasurementReadout();
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

  updateShadingSubmenuState() {
    return updateShadingSubmenuState(this);
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
    return parseBooleanParam(value);
  },

  parseFloatParam(value) {
    return parseFloatParam(value);
  },

  parseVector2Param(value) {
    return parseVector2Param(value);
  },

  parseVector3Param(value) {
    return parseVector3Param(value);
  },

  formatVector3Param(vector) {
    return formatVector3Param(vector);
  },

  parseProjectionParam(value) {
    return parseProjectionParam(value);
  },

  parseClippingModeParam(value) {
    return parseClippingModeParam(value);
  },

  formatClippingModeParam(mode) {
    return formatClippingModeParam(mode);
  },

  normalizeLanguage(value) {
    return normalizeLanguage(value);
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
      cameraProjection: this.parseProjectionParam(params.get("projection") || params.get("cameraProjection") || params.get("proj")),
      cameraZoom: this.parseFloatParam(params.get("zoom") || params.get("cameraZoom")),
      clippingMode: this.parseClippingModeParam(params.get("clip") || params.get("clippingMode")),
      clippingConstants: this.parseVector3Param(params.get("clipConst") || params.get("clipConstants")),
      clippingOutline: this.parseBooleanParam(params.get("clipOutline")),
      clippingNegated: (() => {
        const flipped = params.get("clipFlip");
        if (flipped == null) return null;
        return this.parseClippingModeParam(flipped) || { x: false, y: false, z: false };
      })(),
      // Keep these null when the query param is absent (parseBooleanParam's
      // own "not specified" value) rather than coercing to a hard boolean -
      // the config-driven fallback below (`sandboxModeFromConfig ?? ...`)
      // only runs when this is not itself a boolean, so a coerced `false`
      // here would permanently shadow viewer-settings.json's own value.
      presentationMode: presentationModeFromQuery,
      sandboxMode: sandboxModeFromQuery,
      scale: this.parseVector2Param(params.get("scale")) ?? null,
      showNotifications: this.parseBooleanParam(params.get("showNotifications")),
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

  getKeyboardShortcutsRows() {
    const rows = [
      { icon: "mouse", text: t("shortcuts.mouse") },
      { icon: "keyboard", text: t("shortcuts.keyboard") },
      { icon: "touch", text: t("shortcuts.touch") },
    ];
    if (core.CONFIG?.viewer?.enableDragAndDrop === true) {
      rows.push({ icon: "dragAndDrop", text: t("shortcuts.dragAndDrop") });
    }
    return rows;
  },

  // One <span class="viewer-notice-detail"> per row (see
  // renderStatusNoticeContent() in ui/loading-status.js, which splits the
  // `detail` option on newlines and inserts each line via innerHTML) - lets
  // every shortcut line carry its own icon instead of one dense text block.
  getKeyboardShortcutsDetailHtml() {
    return this.getKeyboardShortcutsRows()
      .map(({ icon, text }) => `<span class="viewer-shortcut-row">${SHORTCUT_ICONS[icon]}<span>${text}</span></span>`)
      .join("\n");
  },

  showKeyboardShortcutsHint({ manual = false } = {}) {
    const isHintCurrentlyShown =
      this.statusNoticeActive === true && this.statusNoticeCurrent?.key === "keyboard-shortcuts-hint";
    if (manual && isHintCurrentlyShown) {
      this.dismissStatusNotice("keyboard-shortcuts-hint");
      return;
    }

    const duration = manual || !this.keyboardHintShownOnce
      ? this.keyboardHintFirstDurationMs
      : this.keyboardHintDurationMs;
    this.keyboardHintShownOnce = true;
    this.lastKeyboardHintAt = Date.now();
    this.showStatusNotice(t("shortcuts.title", "Controls"), duration, {
      detail: this.getKeyboardShortcutsDetailHtml(),
      variant: "shortcuts",
      key: "keyboard-shortcuts-hint",
      dismissible: true,
    });
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
    this.showKeyboardShortcutsHint();
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

  applyTransformSnapFromShift() {
    const control = core.transformControl;
    if (!control) return;

    const mode = control.getMode?.() || "";
    const useSnap = Viewer.shiftSnapActive === true;

    control.rotationSnap = useSnap && mode === "rotate" ? Viewer.transformSnap.rotate : null;
    control.scaleSnap = useSnap && mode === "scale" ? Viewer.transformSnap.scale : null;
  },

  onTransformSnapKeyDown(event) {
    if (event?.key !== "Shift") return;
    if (Viewer.shiftSnapActive) return;
    Viewer.shiftSnapActive = true;
    Viewer.applyTransformSnapFromShift();
  },

  onTransformSnapKeyUp(event) {
    if (event?.key !== "Shift") return;
    if (!Viewer.shiftSnapActive) return;
    Viewer.shiftSnapActive = false;
    Viewer.applyTransformSnapFromShift();
  },

  onTransformSnapBlur() {
    if (!Viewer.shiftSnapActive) return;
    Viewer.shiftSnapActive = false;
    Viewer.applyTransformSnapFromShift();
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
      case "Enter":
        if (Viewer.RULER_MODE && Viewer.measurementDraft) {
          Viewer.finishMeasurementDraft();
          handled = true;
        }
        break;
      case "Escape":
        if (Viewer.RULER_MODE) handled = Viewer.cancelMeasurementDraft();
        break;
      case "k":
      case "K":
        handled = Viewer.toggleAnimationPlayback();
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
    const manifestoForm = document.getElementById("form-manifesto");
    if (manifestoForm) {
      manifestoForm.remove();
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
    Viewer.disposeAnimations();
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
    // Section planes stay as they are; refreshClippingForModel() fits them
    // to the next model.
    Viewer.cancelClippingDrag();
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

    Viewer.clearMeasurements();
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
    
    this.noticeContainer.style.bottom = "50%";
    if (!container) {
      showToast("toasts.containerNotFound", "error", { duration: 5000 });
      return;
    }

    showToast("toasts.missingFiles", "error", { duration: 5000 });
  },

  async loadRequiredJson(url) {
    let response;

    try {
      response = await fetch(url, { cache: "no-store" });
    } catch (err) {
      throw new Error(
        `Cannot access required file "${url.href}". ${err.message}`
      );
    }

    if (!response.ok) {
      const errorText = [
        `Required configuration file is missing: ${url.href} (HTTP ${response.status})`,
        'The viewer cannot start without "viewer-settings.json".',
        'Please verify that the file was copied during the build/deployment.'
      ].join('\n');
      toastHelper("missingJsonSettings", "error", { duration: 5000, url: url.href, status: response.status });
      //throw new Error(errorText);
    }

    try {
      return await response.json();
    } catch (err) {
      toastHelper("invalidJSON", "error", { duration: 5000, error: err.message });
      throw new Error(
        `File "${url.href}" contains invalid JSON. ${err.message}`
      );
    }
  },

  // viewer.lightweight / editor / sandbox / presentationMode decide how the UI
  // is built, so the AIM3D manifest configured in viewer-settings.json is
  // peeked at before that happens. This deliberately uses the *configured*
  // source type, not the build's forced one (the dev build always loads IIIF
  // models) - the manifest is the settings carrier, e.g. for the Docker
  // profiles. Any failure (no manifest, network error, invalid JSON) silently
  // keeps the viewer-settings.json values.
  async applyBootstrapSettingsFromManifest() {
    const metadata = core.CONFIG?.entity?.metadata;
    const sourceType = String(metadata?.sourceType || SOURCE).toLowerCase();
    if (sourceType !== "aim3if" || !metadata?.url) return;

    try {
      const manifest = await this.getManifestJson(metadata.url, "url");
      if (isAIM3DManifest(manifest)) {
        applyManifestBootstrapSettings(manifest, core.CONFIG);
        applyManifestSettings(manifest, core.CONFIG);
      }
    } catch (err) {
      console.warn("Could not read settings from AIM3D manifest; using viewer-settings.json.", err);
    }
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
    let moduleUrl = new URL(import.meta.url);
    if (moduleUrl.protocol !== 'http:' && moduleUrl.protocol !== 'https:') {
      // Some dev bundlers (Parcel's dev server, at least as of 2.16) don't
      // resolve import.meta.url to the module's real served URL when it's
      // used for a dynamically-constructed path like this one - they hand
      // back a non-fetchable placeholder (e.g. a "file:" URL) instead. Fall
      // back to the page's own URL so viewer-settings.json still resolves
      // relative to the site root, matching where every built target
      // (dist/test, dist/dev, dist/prod, dist/drupal) co-locates it with the
      // bundled module.
      moduleUrl = new URL(window.location.href);
    }
    const settingsPath = moduleUrl.pathname.includes('/assets/')
      ? '../viewer-settings.json'
      : './viewer-settings.json';

    //Setup core variables first to make them available in the loaders and utils
    setCore('viewEntity', this.viewEntity);
    setCore('CONFIG', this.CONFIG);
    setCore('loadedFile', this.loadedFile);
    setCore('stats', this.stats);
    setCore('guiContainer', this.guiContainer);
    setCore('gui', this.gui);
    setCore('i18nGui', this.i18nGui);
    setCore('SUPPORTED_EXTENSIONS', this.SUPPORTED_EXTENSIONS);
    setCore('SUPPORTED_ARCHIVES', this.SUPPORTED_ARCHIVES);
    setCore('enqueueStatusNotice', this.enqueueStatusNotice.bind(this));
    setCore('dismissStatusNotice', this.dismissStatusNotice.bind(this));
    setCore('updateClippingHintVisibility', this.updateClippingHintVisibility.bind(this));
    setCore('editorToolbar', this.editorToolbar);
    setCore('wireframeMode', this.wireframeMode);
    setCore('boundingBox', this.boundingBox);
    this.noticeContainer = document.createElement("div");
    this.noticeContainer.id = "viewerNoticeContainer";
    this.statusNotice = document.createElement("div");
    this.statusNotice.id = "viewerStatusNotice";
    this.statusNotice.className = "viewer-notice viewer-notice-status";
    this.statusNotice.hidden = true;
    this.statusNotice.setAttribute("role", "status");
    this.statusNotice.setAttribute("aria-live", "polite");
    this.noticeContainer.appendChild(this.statusNotice);
    // Mount early so startup errors can be shown before viewer container is resolved.
    if (!this.noticeContainer.parentNode) {
      document.body.appendChild(this.noticeContainer);
    }
    setCore("statusNotice", this.statusNotice);
    this.parseUrlOptions();
    setCore('showNotifications', this.showNotifications);
  
    this.statusNoticeQueue = [];
    this.statusNoticeActive = false;
    if (this.statusNoticeTimer) {
      clearTimeout(this.statusNoticeTimer);
      this.statusNoticeTimer = null;
    }
    if (this.urlOptions.showNotifications !== undefined && this.urlOptions.showNotifications !== null) {
      core.showNotifications = this.urlOptions.showNotifications;
    }

    core.CONFIG = await this.loadRequiredJson(new URL(settingsPath, moduleUrl));
    console.log("Loaded viewer-settings.json", core.CONFIG.viewer);

    if (Object.keys(core.CONFIG).length === 0) {
      core.CONFIG = {
        mainUrl: "https://dfg-repository.wisski.cloud",
        baseNamespace: "https://dfg-repository.wisski.cloud",
        metadataUrl: "https://dfg-repository.wisski.cloud",
        api: {
          thumbnailUploadEndpoint: "/api/editor/upload-thumbnail",
        },
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
          editorToolbar: {
            enabled: true,
            position: {
              x: 0,
              y: 0
            }
          },
          measurement: {
            modelUnitInMeters: 1,
          }
        },
      };
    }

    await this.applyBootstrapSettingsFromManifest();

    this.isLightweight = Boolean(core.CONFIG.viewer.lightweight);
    setCore('isLightweight', this.isLightweight);
  
    this.EDITOR = Boolean(core.CONFIG.viewer.editor);
    setCore('EDITOR', this.EDITOR);

    const presentationModeFromConfig = this.parseBooleanParam(core.CONFIG.viewer.presentationMode);
    const presentationModeFromUrl = this.urlOptions?.presentationMode;
    this.PRESENTATION_MODE = typeof presentationModeFromUrl === "boolean"
      ? presentationModeFromUrl
      : (presentationModeFromConfig ?? Boolean(core.CONFIG.viewer.presentationMode));
    setCore('PRESENTATION_MODE', this.PRESENTATION_MODE);

    const sandboxModeFromConfig = this.parseBooleanParam(core.CONFIG.viewer.sandboxMode);
    const sandboxModeFromUrl = this.urlOptions?.sandboxMode;
    this.SANDBOX_MODE = typeof sandboxModeFromUrl === "boolean"
      ? sandboxModeFromUrl
      : (sandboxModeFromConfig ?? Boolean(core.CONFIG.viewer.sandboxMode));
    setCore('SANDBOX_MODE', this.SANDBOX_MODE);
    console.log(`Presentation mode: ${this.PRESENTATION_MODE ? "ON" : "OFF"}`);
    console.log(`Sandbox mode: ${this.SANDBOX_MODE ? "ON" : "OFF"}`);

    console.log(`AIM 3D-Viewer ${this.isLightweight ? '🪶 LIGHTWEIGHT' : '💪 FULL'} mode`);
    console.log(`Powered by Three.js (v${THREE.REVISION})`);
    
    if (BUILD === "dev" && SOURCE) {
      core.CONFIG.entity.metadata.sourceType = SOURCE;
      console.log(`Dev build manifest source: ${core.CONFIG.entity.metadata.sourceType}`);
    } else if (!core.CONFIG.entity.metadata.sourceType) {
      core.CONFIG.entity.metadata.sourceType = SOURCE;
      console.log(`Metadata source: ${core.CONFIG.entity.metadata.sourceType}`);
    }

    this.container = document.getElementById(core.CONFIG.viewer.container);

    if (!this.container) {
      document.body.appendChild(this.noticeContainer);
      this.noticeContainer.style.bottom = "50%";
      showToast("toasts.containerNotFound", "error", { duration: 5000 });
      return;
    }
    setCore('container', this.container);
    document.body.classList.toggle("viewer-embed-page", this.isEmbedMode());

    core.container?.appendChild(this.noticeContainer);
    setCore("noticeContainer", this.noticeContainer);
    
    console.log(`Presentation mode: ${core.PRESENTATION_MODE ? "ON" : "OFF"}`);
    console.log(`Sandbox mode: ${core.SANDBOX_MODE ? "ON" : "OFF"}`);
    this.currentLanguage = this.getStoredLanguage();
    setCore('currentLanguage', this.currentLanguage);

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
    Viewer.setupWindowControls(core.container);

    if (core.container.hasAttribute("basePath")) {
      core.CONFIG.baseModulePath = core.container.getAttribute("basePath");
    }

    this.setModelPaths();

    core.CONFIG.viewer.exportPath = "/api/editor/xml-export/";    
    this.loadedFile = `${core.fileObject.basename}.${core.fileObject.extension}`;

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

      core.gui  = new GUI({ container: core.guiContainer, width: 300, autoPlace: false, injectStyles: true });
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
      setCore('environmentMapIntensity', this.environmentMapIntensity);
      setCore('environmentMapPreset', this.environmentMapPreset);
      this.clippingPlanes = this.core;
      setCore("clippingPlanes", this.clippingPlanes);
      setCore('helperObjects', this.helperObjects);
      setCore('lightHelper', this.lightHelper);
      setCore('selectedObjects', this.selectedObjects);
      core.showNotifications = true;
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
    // Ignore the time spent in a hidden tab instead of jumping animations forward.
    this.clock.connect?.(document);

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
    return normalizeDrupalFilesPath(path);
  },

  normalizeArchiveModelPath(path) {
    return normalizeArchiveModelPath(path);
  },

  setModelPaths() {
    return setModelPaths(this);
  },

  disableInteractionHint() {
    return disableInteractionHint(this);
  },

  addTextWatermark(_text, _scale) {
    return addTextWatermark(this, _text, _scale);
  },

  addTextPoint(_text, _scale, _point) {
    return addTextPoint(this, _text, _scale, _point);
  },

  selectObjectHierarchy(_id) {
    return selectObjectHierarchy(this, _id);
  },

  recreateBoundingBox(object) {
    return recreateBoundingBox(object);
  },

  normalizeFileUrl(rawUrl) {
    return normalizeFileUrl(this, rawUrl);
  },

  shouldIgnoreLegacyEmbedDefaultModel() {
    return shouldIgnoreLegacyEmbedDefaultModel(this);
  },

  buildGallery() {
    return buildGallery(this);
  },

  renderModelGalleryImages(imageUrls) {
    return renderModelGalleryImages(this, imageUrls);
  },

  // Mirrors the static #example-model-picker markup in this repo's own
  // index.html, for pages (Drupal/WissKI, etc.) that embed the viewer
  // without that markup - see the forceLocalPreview handling above.
  createExampleModelPicker() {
    const picker = document.createElement("div");
    picker.id = "example-model-picker";

    const label = document.createElement("label");
    label.setAttribute("for", "example-model-select");
    label.textContent = "Load example model";
    picker.appendChild(label);

    const select = document.createElement("select");
    select.id = "example-model-select";
    [
      ["./examples/box.dae", "DAE"],
      ["./examples/box.stl", "STL"],
      ["./examples/box.ply", "PLY"],
      ["./examples/box.obj", "OBJ"],
      ["./examples/box.xyz", "XYZ"],
      ["./examples/box.pcd", "PCD"],
      ["./examples/box.3ds", "3DS"],
      ["./examples/box.ifc", "IFC"],
      ["./examples/box.fbx", "FBX"],
      ["./examples/box.glb", "GLB"],
      ["./examples/box.usdz", "USDZ"],
      ["./examples/box.usda", "USDA"],
      ["./examples/box.3mf", "3MF"],
      ["./examples/box.amf", "AMF"],
      ["./examples/box.wrl", "WRL (VRML)"],
      ["./examples/box.kmz", "KMZ"],
      ["./examples/box.vox", "VOX"],
      ["./examples/box-missing-mtl.obj", "OBJ (missing MTL)"],
      ["./examples/broken.glb", "Broken GLB"],
      ["./examples/WolpaSynagogue.glb", "Wolpa Synagogue"],
    ].forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.appendChild(option);
    });
    picker.appendChild(select);

    const themeToggle = document.createElement("button");
    themeToggle.type = "button";
    themeToggle.id = "example-theme-toggle";
    themeToggle.title = "Toggle dark mode";
    themeToggle.textContent = "🌙";
    picker.appendChild(themeToggle);

    const loginButton = document.createElement("button");
    loginButton.type = "button";
    loginButton.id = "loginButton";
    loginButton.hidden = true;
    picker.appendChild(loginButton);

    const uploadModel = document.createElement("button");
    uploadModel.type = "button";
    uploadModel.id = "uploadModel";
    picker.appendChild(uploadModel);

    const browseModels = document.createElement("button");
    browseModels.type = "button";
    browseModels.id = "browseModelsButton";
    picker.appendChild(browseModels);

    const manageUsers = document.createElement("button");
    manageUsers.type = "button";
    manageUsers.id = "manageUsersButton";
    manageUsers.hidden = true;
    picker.appendChild(manageUsers);

    return picker;
  },

  toHexColor(input) {
    return toHexColor(input);
  },

  toThreeColor(input) {
    return toThreeColor(input);
  },

  getWrapperSize() {
    return getWrapperSize(this);
  },

  /* picking and measurement moved to viewer/editor modules */
  updateSize() {
    const isFullscreen = !!document.fullscreenElement;
    Viewer.FULLSCREEN = isFullscreen;

    if (
      !core.mainCanvas ||
      !Viewer.fullscreenMode ||
      !core.guiContainer
    ) {
      return;
    }

    let widthCSS;
    let heightCSS;

    const hasWindowControls = core.container.classList.contains("viewer-window-controls-enabled");
    const isManuallyResized = !!Viewer.manuallyResized;
    let scale = { x: 1, y: 1 };

    const rect = hasWindowControls
      ? core.container.getBoundingClientRect()
      : Viewer.getWrapperSize();

    if (isFullscreen) {
      widthCSS = window.innerWidth;
      heightCSS = window.innerHeight;
    } else {
      if (!isManuallyResized) {
        scale = {
          x: Number(
            core.CONFIG.viewer.scaleContainer?.x || 1
          ),
          y: Number(
            core.CONFIG.viewer.scaleContainer?.y || 1
          ),
        };
      }

      widthCSS = rect.width || 800;
      heightCSS = rect.height || 600;
    }

    // final visual size
    const effectiveWidth = widthCSS * scale.x;
    const effectiveHeight = heightCSS * scale.y;

    // CSS size only
    core.mainCanvas.style.width = `${effectiveWidth}px`;
    core.mainCanvas.style.height = `${effectiveHeight}px`;

    const canvasRect = core.mainCanvas.getBoundingClientRect();
    const parentRect = core.container.getBoundingClientRect();

    const bottom = parentRect.bottom - canvasRect.bottom + 12 || 24;

    if (isFullscreen) {
      core.mainCanvas.style.width = "100vw";
      core.mainCanvas.style.height = "100vh";
      core.editorToolbar.style.bottom = `${bottom}px`;
    } else {
      if (core.editorToolbar) {
        core.editorToolbar.style.bottom = `${bottom}px`;
      }
      if (Viewer.creditsWrapper) {
        // #credits is a normal-flow block below core.container (see
        // viewer/css/credits.css and the appendChild call in this file) -
        // no position/left/right/bottom math needed, it's simply the next
        // thing in the document after the viewer. Just reveal it - it was
        // created hidden (see createCreditsElement in sandbox.js) only to
        // avoid a flash of unstyled content while its own fonts/logo load.
        Viewer.creditsWrapper.style.visibility = "visible";
      }
    }

    core.guiContainer.style.right = (-core.guiContainer.getBoundingClientRect().width + 10) + 'px !important';

    // metadata overlay
    if (core.metadataContainer) {
      core.metadataContainer.style.width = "100%";
      core.metadataContainer.style.height = "100%";
    }

    // optional wrapper sync
    if (
      Viewer.fileElement && Viewer.fileElement.length > 0
    ) {
      Viewer.fileElement[0].style.height = `${effectiveHeight * 1.1}px`;
    }

    // camera
    if (core.camera.isOrthographicCamera) {
      this.updateOrthoFrustum(
        core.camera,
        effectiveWidth,
        effectiveHeight
      );
    } else {
      core.camera.aspect =
        effectiveWidth / effectiveHeight;

      core.camera.updateProjectionMatrix();
    }

    // renderer
    core.renderer.setPixelRatio(window.devicePixelRatio || 1);

    core.renderer.setSize( effectiveWidth, effectiveHeight, false);

    // action menu
    if (Viewer.actionMenu) {
      if (
        Viewer.actionMenu.classList.contains(
          "viewer-action-menu_in-toolbar"
        )
      ) {
        Viewer.actionMenu.style.top = "";
        Viewer.actionMenu.style.right = "";
        Viewer.actionMenu.style.bottom = "";
      } else {
        const menuMargin = 16;

        const toggleSize =
          Viewer.actionMenu
            .querySelector(
              ".viewer-action-menu_toggle"
            )
            ?.getBoundingClientRect().height || 45;

        Viewer.actionMenu.style.top =
          `${effectiveHeight - toggleSize - menuMargin}px`;

        Viewer.actionMenu.style.right =
          `${menuMargin}px`;

        Viewer.actionMenu.style.bottom = "auto";
      }
    }

    // hand hint
    if (core.handHint) {
      // handHint is appended to core.container and positioned relative to it,
      // so its offset must be measured against core.container's own rect
      // (parentRect) - NOT effectiveHeight, which is the canvas's logical
      // render size and can differ from the container's actual box (e.g. via
      // scaleContainer or letterboxing), leading to a wrongly placed hint.
      const containerHeight = parentRect.height || effectiveHeight;

      // Default vertical offset from the container bottom, but pushed further
      // up when the editor toolbar is visible and would otherwise sit under
      // it - the toolbar's height/position vary (drag position, embed scale),
      // so this is measured live rather than assumed.
      let handHintOffset = 150;
      if (
        core.editorToolbar &&
        !core.editorToolbar.classList.contains("editorToolbar-hidden")
      ) {
        const toolbarRect = core.editorToolbar.getBoundingClientRect();
        const toolbarTopFromContainerTop = toolbarRect.top - parentRect.top;
        const handHintHeight =
          core.handHint.getBoundingClientRect().height || 48;
        const clearanceMargin = 16;
        const requiredOffset =
          containerHeight -
          toolbarTopFromContainerTop +
          handHintHeight +
          clearanceMargin;
        handHintOffset = Math.max(handHintOffset, requiredOffset);
      }
      // #handHint's base CSS is `inset: 0; margin: auto;` (for default
      // centering). Setting only `top` here leaves `bottom: 0` from that
      // `inset` in place too, over-constraining the vertical position: with
      // top/height/bottom all non-auto and auto margins, the spec splits the
      // leftover space evenly between the margins instead of honoring `top`
      // as-is, so the element renders noticeably off from the intended spot.
      // Clearing `bottom` removes that over-constraint.
      core.handHint.style.bottom = "auto";
      core.handHint.style.top =
        `${containerHeight - handHintOffset}px`;
    }

    core.controls?.update();

    core.CONFIG.viewer.canvasDimensions = {
      x: effectiveWidth,
      y: effectiveHeight,
    };
  },


  async toggleFullscreen() {
    Viewer.closeActionMenu();
    try {
      if (!document.fullscreenElement) {
        await core.container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
      Viewer.syncEditorToolbarFullscreenHost();
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
    Viewer.syncEditorToolbarFullscreenHost();

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
    // THREE.Timer only advances on update(); without it getDelta() stays 0.
    Viewer.clock.update(time);
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
      Viewer.updateMeasurementLabels();
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
      Viewer.updateAnimationTimeline();
    }

    core.renderer?.clear();
    core.renderer?.render(core.scene, core.camera);
    Viewer.renderViewHelper(delta);
    core.stats?.update();
  },

  onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  },

  showSandboxGuiAfterModelLoad() {
    if (!core.guiContainer) return;

    core.guiContainer.hidden = false;

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

    var _maxDistance = Math.max(_distance.x, _distance.y, _distance.z);

    core.boundingSphere = new THREE.Sphere(center, _maxDistance);
    core.boundingSphere.center.copy(center);
    // Keep the section planes at the same relative place on the moved model.
    Viewer.refreshClippingForModel();
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

  applyCameraOverridesFromUrl({ skipProjection = false } = {}) {
    if (!core.camera) return;

    const requestedProjection = this.urlOptions?.cameraProjection;
    if (!skipProjection && (requestedProjection === "orthographic" || requestedProjection === "perspective")) {
      this.setCameraProjection(requestedProjection);
    }

    const cameraPosition = this.urlOptions?.cameraPosition;
    const cameraTarget = this.urlOptions?.cameraTarget;
    const cameraFov = this.urlOptions?.cameraFov;
    const cameraZoom = this.urlOptions?.cameraZoom;
    const hasPosition = cameraPosition && Number.isFinite(cameraPosition.x) && Number.isFinite(cameraPosition.y) && Number.isFinite(cameraPosition.z);
    const hasTarget = cameraTarget && Number.isFinite(cameraTarget.x) && Number.isFinite(cameraTarget.y) && Number.isFinite(cameraTarget.z);
    const hasFov = Number.isFinite(cameraFov) && core.camera.isPerspectiveCamera === true;
    const hasZoom = Number.isFinite(cameraZoom) && core.camera.isOrthographicCamera === true;
  
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
    if (hasZoom) {
      core.camera.zoom = Math.max(0.001, Number(cameraZoom));
    }

    core.camera.updateProjectionMatrix();
    if (hasPosition) {
      core.controls?.object?.position.copy(core.camera.position);
    }
    core.controls?.update();

    this.applyClippingOverridesFromUrl();

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

  async resetModelSettings() {
    await resetModelSettings();
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
      core.guiContainer.style.right = (-core.guiContainer.getBoundingClientRect().width) + 'px !important';
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
        rotate: t("toasts.transformRotate", "Rotate: drag rotation rings to rotate the object. Hold Shift to snap angle."),
        scale: t("toasts.transformScale", "Scale: drag axis handles to resize the object. Hold Shift to snap scale."),
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
          Viewer.applyTransformSnapFromShift();
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

    /*const lightFolderCamera = Viewer.editorFolder.addFolder(t("gui.cameraLight", "Camera Light")).close();
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
      .listen();*/

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

    if (!_id) {
      console.info("Skipping model-status polling: no entity ID is available.");
      return;
    }

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
  async setupManifesto(newUrlOrJson, type="url", manifestType = "iiif") {
    const manifestJson = await Viewer.getManifestJson(newUrlOrJson, type);
    const resolvedManifestType = isAIM3DManifest(manifestJson) ? "aim3if" : "iiif";
    const isAim3ifManifest = resolvedManifestType === "aim3if";

    if (resolvedManifestType !== manifestType) {
      console.info(`Detected ${isAim3ifManifest ? "AIM3D" : "IIIF"} manifest; using its matching loader.`);
    }

    // fetchSettings() only applies the loaded model's position/rotation/scale
    // (and other per-model config) when sourceType reads "IIIF" - keep it in
    // sync with what actually got loaded, regardless of how setupManifesto
    // was invoked, so it doesn't silently lag behind the UI's source switch.
    core.CONFIG.entity.metadata.sourceType = isAim3ifManifest ? "AIM3IF" : "IIIF";

    if (isAim3ifManifest) {
      if (type !== "text") {
        core.CONFIG.entity.metadata.url = newUrlOrJson;
      }
    } else if (type === "text") {
      Viewer.iiifConfigURL.url = "";
    } else {
      Viewer.iiifConfigURL.url = newUrlOrJson;
    }
    const loadedManifest = isAim3ifManifest
      ? await loadAIM3IFManifest(manifestJson)
      : await loadIIIFManifest(manifestJson);
    if (isAim3ifManifest) {
      // Manifest settings take precedence over viewer-settings.json, which
      // remains the fallback for anything the manifest doesn't define.
      applyManifestSettings(loadedManifest.manifest, core.CONFIG);
      Viewer.applyWindowState?.(getManifestWindowState(loadedManifest.manifest));
    }
    if (loadedManifest.modelUrls.length === 0) { // no 3D model found, use example model
      loadedManifest.modelUrls.push('https://raw.githubusercontent.com/IIIF/3d/main/assets/astronaut/astronaut.glb');
      showToast(t("toasts.noIiiifModelFallback", "No 3D model found in IIIF manifest, loading example model."));
    }
    // reset scene and release GPU resources from the previous model batch
    Viewer.resetLoadedModelState();
    // A previous AIM3D manifest may have left the camera in orthographic mode.
    // Always start from perspective; AIM3D's own camera config (applied below)
    // switches back to orthographic only if it explicitly asks for it.
    Viewer.setCameraProjection("perspective");
    // A previous manifest's viewer.backgroundColor sets an opaque THREE.Color
    // on the scene, which is never cleared - it would otherwise paint over
    // this manifest's own (possibly unset) background on every future load.
    if (core.scene) core.scene.background = null;
    core.objectsConfig.setupIndex = 0;
    core.axesHelper.visible = false;
    console.log("TOTAL Annotations: " + loadedManifest.annotations.length);
    if (loadedManifest.annotations.length !== loadedManifest.modelUrls.length) {
      //console.warn("Number of annotations does not match number of model URLs, adding testing model...");
        const diff = loadedManifest.annotations.length - loadedManifest.modelUrls.length;
        if (diff > 0) {
          // Need more model URLs → push empty strings (or null)
          for (let i = 0; i < diff; i++) {
            loadedManifest.modelUrls.push(Viewer.testModelURL);
            core.objectsConfig.models.push({name: "Test Model", url: Viewer.testModelURL});
          }
        }
    }

    for (const [i, url] of loadedManifest.modelUrls?.entries()) {
      core.objectsConfig.index = i;
      const modelConfig = core.objectsConfig.models[i] ??= {
        name: `Manifest model ${i + 1}`,
      };
      // A previous AIM3D manifest may have supplied a transform. Do not let
      // it carry over to a newly selected IIIF model.
      modelConfig.url = url;
      modelConfig.position = { x: 0, y: 0, z: 0 };
      modelConfig.rotation = { x: 0, y: 0, z: 0 };
      modelConfig.scale = { x: 1, y: 1, z: 1 };
      core.fileObject.originalPath = loadedManifest.modelUrl = url;
      //fileObject.originalPath = loadedManifest.modelUrl;
      Viewer.setModelPaths();
      isAim3ifManifest
        ? await applyManifestConfig(loadedManifest, core.objectsConfig)
        : await getAnnotations(loadedManifest, core.objectsConfig);
      if (loadedManifest.scenes && loadedManifest.scenes.length > 0) {
        core.objectsConfig.scenes = loadedManifest.scenes;
      }
      Viewer._ext = core.fileObject.extension.toLowerCase();
      await Viewer.mainLoadModel();

      if (isAim3ifManifest && i === loadedManifest.modelUrls.length - 1) {
        Viewer.import3IFManifest?.(loadedManifest.manifest);
      }
    }
  },

  async getManifestJson(manifestUrlOrJson, type) {
    if (type === "text") {
      return JSON.parse(manifestUrlOrJson);
    }

    if (manifestUrlOrJson && typeof manifestUrlOrJson === "object") {
      return manifestUrlOrJson;
    }

    const response = await fetch(manifestUrlOrJson);
    if (!response.ok) {
      throw new Error(`Unable to load manifest: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  async setupManifestSource(type, { loadInitialManifest = true } = {}) {
    const manifestType = type === "aim3if" ? "aim3if" : "iiif";
    const metadata = core.CONFIG.entity.metadata;

    Viewer.cleanupTransientUI();
    createManifestUI(manifestType);
    createManifestSourceSwitch(manifestType);

    if (manifestType === "iiif") {
      createIIIFDropdown(Viewer.iiifConfigURL);
    } else {
      createAIM3IFDropdown(metadata.url);
    }

    await Viewer.loadManifestoURL(manifestType);
    metadata.sourceType = manifestType === "iiif" ? "IIIF" : "AIM3IF";

    const initialUrl = manifestType === "iiif" ? Viewer.iiifConfigURL.url : metadata.url;
    if (loadInitialManifest && initialUrl) {
      await Viewer.setupManifesto(initialUrl, "url", manifestType);
    }
  },

  async loadManifestoURL(type = "iiif") {
    // Load IIIF URL
    const className = type === "iiif" ? "IIIF" : "AIM3IF";
    const titleKey = type === "iiif" ? "iiif" : "aim3if";
    const form = document.getElementById("form-manifesto");
    const collapseBtn = document.getElementById("manifesto-toggle-collapse");
    const sourceSwitch = document.getElementById("manifesto-source-switch");
    form?.setAttribute("data-viewer-theme", Viewer.currentTheme);
    Viewer.updateIIIFFormLabels();

    sourceSwitch?.addEventListener("change", async (ev) => {
      const nextType = ev.target.checked ? "aim3if" : "iiif";
      if (nextType === type) return;

      try {
        await Viewer.setupManifestSource(nextType);
      } catch (err) {
        Viewer.reportError(err, { context: "Error switching manifest source" });
      }
    });

    Viewer.bindEventListener(collapseBtn, "click", () => {
      form.classList.toggle("collapsed");
      collapseBtn.textContent = form.classList.contains("collapsed") ? "▸" : "▾";
      collapseBtn.title = form.classList.contains("collapsed")
        ? t("${titleKey}.expand", "Expand")
        : t("${titleKey}.collapse", "Collapse");
    });
    // create a small dropdown to switch iiif manifests at runtime
    Viewer.bindEventListener(document.getElementById("manifesto-manifest-select"), "change", async (ev) => {
      try {
        if (ev.target.value !== Viewer.iiifConfigURL.url) {
          core.objectsConfig.setupIndex = 0;
          await Viewer.setupManifesto(ev.target.value, "url", type);
        }
      } catch (err) {
        Viewer.reportError(err, {
          context: "Error loading ${className} manifest",
        });
      }
      });

    Viewer.bindEventListener(document.getElementById("load-manifesto-from-url"), "click", async (ev) => {
      try {
        const inputElement = document.getElementById("manifesto-manifest-url");
        if (inputElement.value === "" || !Viewer.isUrlFlexible(inputElement.value)) {
        inputElement.style.border = "2px solid red";
        showToast("manifesto.invalidUrl", "warning");
        return;
      } else {
        inputElement.style.border = "2px solid green";
        core.objectsConfig.setupIndex = 0;
          console.log("Loading ${className} manifest from URL: " + inputElement.value);
          await Viewer.setupManifesto(inputElement.value, "url", type);
        }
      } catch (err) {
        Viewer.reportError(err, {
          context: "Error loading ${className} manifest",
        });
      }
      });

    Viewer.bindEventListener(document.getElementById("load-manifesto-from-text"), "click", async (ev) => {
      try {
        const inputElement = document.getElementById("manifesto-manifest-text");
        if (inputElement.value === "" || !Viewer.isValidJsonObject(inputElement.value)) {
          inputElement.style.border = "2px solid red";
          showToast("manifesto.invalidJson", "warning");
        return;
      } else {
        inputElement.style.border = "2px solid green";
        core.objectsConfig.setupIndex = 0;
          console.log("Loading ${className} manifest from privided text");
          if (type === "iiif") {
            await Viewer.setupManifesto(inputElement.value, "text", type);
          } else {
            await Viewer.setupManifesto(inputElement.value, "text", type);
          }
        }
      } catch (err) {
        Viewer.reportError(err, {
          context: "Error loading ${className} manifest",
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
      setCore('embedCamera', Viewer.embedCamera);
      setCore('mainObject', Viewer.mainObject);

      Viewer.scene = new THREE.Scene();
      setCore('scene', Viewer.scene);
      setCore('activeScene', Viewer.activeScene);

      const hostname = window.location.hostname;
      const isLocal = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
      const isLocalNetwork = hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.endsWith('.local');
      const isCodeSandbox = hostname.includes('codesandbox.io') || hostname.includes('csb.app');
      const autoDetectedLocalPreview = isLocal || isLocalNetwork || isCodeSandbox;
      // viewer.forceLocalPreview lets a real deployment opt into the local-
      // preview UI (example-model picker, credits placement, etc.) even
      // though its hostname is never localhost/LAN/CodeSandbox - or opt out
      // of it on a machine that would otherwise auto-detect as local. Only
      // an explicit boolean overrides the hostname check; anything else
      // (unset, non-boolean) keeps the previous auto-detection behavior.
      const localPreviewOverride = core.CONFIG?.viewer?.forceLocalPreview;
      this.isLocalPreview = typeof localPreviewOverride === 'boolean'
        ? localPreviewOverride
        : autoDetectedLocalPreview;
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

      try {
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
      } catch (err) {
        console.warn("WebGL context could not be created:", err);
        showToast("toasts.webglUnavailable", "error", { duration: 10000 });
        return;
      }
      
      core.renderer.localClippingEnabled = true;

      setCore('renderer', core.renderer);

      core.renderer.domElement.id = "MainCanvas";
      Viewer.mainCanvas = document.getElementById("MainCanvas") || core.renderer.domElement;
      setCore('mainCanvas', Viewer.mainCanvas);

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
        Viewer.bindEventListener(window, "keydown", Viewer.onTransformSnapKeyDown);
        Viewer.bindEventListener(window, "keyup", Viewer.onTransformSnapKeyUp);
        Viewer.bindEventListener(window, "blur", Viewer.onTransformSnapBlur);

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
      core.mainCanvas.classList.add("mainCanvas");

      Viewer.viewerWrapper = core.container.closest('.viewer-wrapper');
      setCore('viewerWrapper', Viewer.viewerWrapper);

      if (!core.viewerWrapper) {
        core.viewerWrapper = core.container.parentElement;
        core.viewerWrapper.classList.add('viewer-wrapper');
      }

      Viewer.attachEditorToolbar();

      core.camera.aspect = core.CONFIG.viewer.canvasDimensions.x / core.CONFIG.viewer.canvasDimensions.y;
      core.camera.updateProjectionMatrix();

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

        Viewer.shareView = document.createElement("button");
        Viewer.shareView.setAttribute("id", "shareView");
        Viewer.shareView.setAttribute("type", "button");
        Viewer.shareView.hidden = true;

        Viewer.downloadModelElement = document.createElement("a");
        setCore('downloadModel', Viewer.downloadModel);
        setCore('downloadModelElement', Viewer.downloadModelElement);
        core.downloadModelElement.setAttribute("id", "downloadModel");
        core.downloadModelElement.hidden = true;

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
        Viewer.actionMenuPanel.appendChild(Viewer.shareView);
        Viewer.actionMenuPanel.appendChild(Viewer.viewEntity);
        //Viewer.actionMenuPanel.appendChild(Viewer.downloadModelElement);
        if (Viewer.urlOptions.hideUi) {
          Viewer.actionMenu.hidden = true;
        }

        setCore('viewEntity', Viewer.viewEntity);
        Viewer.bindEventListener(Viewer.languageMode, "click", Viewer.toggleLanguage.bind(Viewer));
        Viewer.bindEventListener(Viewer.themeMode, "click", Viewer.toggleTheme.bind(Viewer));
        Viewer.bindEventListener(Viewer.shareView, "click", Viewer.copyShareViewUrl.bind(Viewer));
        Viewer.bindEventListener(Viewer.viewEntity, "click", Viewer.openEmbedConfiguratorFromMenu.bind(Viewer));
        Viewer.updateShareMenuEntryState();
        Viewer.updateEmbedMenuEntryState();
        Viewer.applyLanguage({ persist: false });
        //Viewer.bindEventListener(Viewer.downloadModelElement, "click", () => Viewer.closeActionMenu());
        Viewer.bindEventListener(document, "click", (event) => {
          if (
            !Viewer.actionMenu?.contains(event.target) &&
            !Viewer.embedConfiguratorPanel?.contains(event.target)
          ) {
            Viewer.closeActionMenu();
          }
        });
        Viewer.bindEventListener(document, "click", (event) => {
          if (Viewer.statusNoticeCurrent?.key !== "keyboard-shortcuts-hint") return;
          if (Viewer.statusNotice?.contains(event.target)) return;
          if (Viewer.editorToolbarButtons?.help?.contains(event.target)) return;
          Viewer.dismissStatusNotice("keyboard-shortcuts-hint");
        });

        Viewer.handHint.innerHTML = `<img src="${core.DFG_ASSETS}/img/hand-hint.png" alt="Hand hint" width=48 height=48 title="Hand hint animation"/>`;
        
        Viewer.rect = core.container.getBoundingClientRect();
        if (core.viewerWrapper === core.container && core.CONFIG.viewer?.scaleContainer) {
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

        Viewer.fileElement = document.getElementsByClassName("field--type-file");
        if (Viewer.fileElement.length > 0) {
          Viewer.fileElement[0].style.height = core.CONFIG.viewer.canvasDimensions.y * 1.1 + "px";
        }

        // Gallery is (re)built once the initial model load below has
        // actually finished - see the buildGallery() call after that
        // if/else chain. Building it here instead would run before
        // core.fileObject holds anything (it's still the empty default
        // from viewer-defaults.js at this point), so the per-model
        // thumbnails in thumbnail-gallery.js would resolve against the
        // wrong - empty - model and show mismatched/dummy content on the
        // very first page load, never getting corrected afterwards since
        // nothing else called buildGallery() again.
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
      Viewer.initViewHelper();
      setCore('GESTURE', Viewer.GESTURE);
      setCore('lastTime', Viewer.lastTime);
      setCore('helperObjects', Viewer.helperObjects);

      if (!core.PRESENTATION_MODE) {
        Viewer.transformControl = new TransformControls(core.camera, core.renderer.domElement);
        Viewer.transformControl.rotationSnap = null;
        Viewer.transformControl.scaleSnap = null;
        Viewer.transformControl.space = "local";
        Viewer.transformControl.addEventListener("change", Viewer.render);
        Viewer.transformControl.addEventListener("objectChange", () => {
          Viewer.changeScale();
          Viewer.syncOutlineClippingTransform();
          Viewer.calculateObjectScale();
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
        const viewerElement = document.getElementById('DFG_3DViewer');
        // #example-model-picker/#example-model-select only exist as static
        // markup in this repo's own index.html. A real deployment (Drupal/
        // WissKI) renders its own page template, which never includes them -
        // so on forceLocalPreview:true there, document.getElementById found
        // nothing and this whole block silently no-opped. Build the same
        // markup on the fly when it's missing, so local-preview mode works
        // regardless of which page embeds the viewer.
        let picker = document.getElementById('example-model-picker');
        let selectModel = document.getElementById('example-model-select');
        let themeToggle = document.getElementById('example-theme-toggle');
        let uploadModelButton = document.getElementById('uploadModel');
        let loginButton = document.getElementById('loginButton');
        let browseModelsButton = document.getElementById('browseModelsButton');
        let manageUsersButton = document.getElementById('manageUsersButton');
        if (!picker && !selectModel && viewerElement) {
          picker = Viewer.createExampleModelPicker();
          selectModel = picker.querySelector('#example-model-select');
          themeToggle = picker.querySelector('#example-theme-toggle');
          uploadModelButton = picker.querySelector('#uploadModel');
          loginButton = picker.querySelector('#loginButton');
          browseModelsButton = picker.querySelector('#browseModelsButton');
          manageUsersButton = picker.querySelector('#manageUsersButton');
          viewerElement.parentNode.insertBefore(picker, viewerElement);
        }
        if (loginButton) {
          Viewer.loginButton = loginButton;
          Viewer.updateLoginMenuEntryState();
          Viewer.bindEventListener(loginButton, "click", Viewer.openLoginPanel.bind(Viewer));
        }
        if (manageUsersButton) {
          Viewer.manageUsersButton = manageUsersButton;
          Viewer.updateAdminMenuEntryState();
          Viewer.bindEventListener(manageUsersButton, "click", Viewer.openAdminPanel.bind(Viewer));
        }
        if (uploadModelButton) {
          Viewer.uploadModel = uploadModelButton;
          Viewer.updateUploadMenuEntryState();
          Viewer.bindEventListener(uploadModelButton, "click", Viewer.openUploadPanel.bind(Viewer));
        }
        if (browseModelsButton) {
          browseModelsButton.innerHTML = '<span class="browse-models-icon" aria-hidden="true"></span>';
          const browseModelsLabel = t("menu.openModelsPanel", "Browse previously generated models");
          browseModelsButton.setAttribute("aria-label", browseModelsLabel);
          browseModelsButton.setAttribute("title", browseModelsLabel);
          Viewer.bindEventListener(browseModelsButton, "click", Viewer.openModelsPanel.bind(Viewer));
        }
        // updateAdminMenuEntryState() above only ran against Viewer.authState
        // as it stood before any auth check - undefined on a fresh load - so
        // "Manage users" stayed hidden even for an already-logged-in admin
        // until something else (opening the upload panel, logging in)
        // happened to call refreshAuthState() first. Do that once up front so
        // an admin's session is recognized, and the button shown, right away.
        Viewer.refreshAuthState?.();
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

          selectModel.addEventListener('change', async () => {
            // core.fileObject is a single shared, mutable object: a second
            // switch mutates it synchronously (at the top of
            // mainLoadModelWrapper) before this first switch's own load
            // finishes awaiting. Without this token, the first switch's
            // slower-to-resolve buildGallery() call could run after the
            // second switch's, reading fileObject values that no longer
            // match the model actually on screen - stamp+check a generation
            // number so a superseded switch skips rebuilding the gallery.
            const switchGeneration = (this.exampleModelSwitchGeneration ?? 0) + 1;
            this.exampleModelSwitchGeneration = switchGeneration;
            core.autoPath = selectModel.value;
            window.localStorage.setItem('dfg3dviewer-example-model', selectModel.value);
            this.resetLoadedModelState();
            await this.mainLoadModelWrapper();
            if (switchGeneration !== this.exampleModelSwitchGeneration) return;
            // Rebuild the gallery after the switch so it picks up the newly
            // loaded model's own thumbnails (see thumbnail-gallery.js) -
            // otherwise it keeps showing whatever was built for the example
            // loaded at page startup until a manual refresh.
            const galleryCfg = core.CONFIG.viewer?.gallery;
            if ((galleryCfg?.build === true || galleryCfg?.buildFake === true) && !core.SANDBOX_MODE && !this.isEmbedMode()) {
              this.buildGallery();
            }
          });
        }
      }
      if ((core.isLocalPreview || core.SANDBOX_MODE) && !core.PRESENTATION_MODE) {
        Viewer.creditsWrapper = await createCreditsElement();
        if (Viewer.creditsWrapper) {
          // Appended as the last child of the wrapper, after core.container
          // - #credits is normal-flow (see viewer/css/credits.css), so this
          // renders it as its own block directly below the viewer rather
          // than overlapping it. core.container is also the fullscreen
          // target (.mainContainer.fullscreen gets z-index: 9999 - see
          // viewer/css/main.css); living outside it here means credits
          // (like core.editorToolbar - see getEditorToolbarHost() in
          // editor-toolbar.js) isn't part of that fullscreen overlay.
          (core.viewerWrapper || core.container).appendChild(Viewer.creditsWrapper);
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
        } else if (sourceType === "iiif" || sourceType === "aim3if") {
          console.log("Loading from source: " + core.CONFIG.entity.metadata.sourceType);
          await Viewer.setupManifestSource(sourceType);
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

      // gallery.build gates the real Drupal-field-based gallery; it's
      // forced false for the test/dev rollup targets since there's no
      // Drupal DOM to scrape there (see rollup.config.js). buildFake is
      // the separate, dedicated opt-in for the local-testing fallback
      // (see thumbnail-gallery.js), so it must still reach buildGallery()
      // even when the real gallery is switched off. This runs here, after
      // the initial load above has settled core.fileObject, so the very
      // first page load shows thumbnails matching whatever actually ended
      // up on screen instead of momentarily-correct-then-stale content.
      const initialGalleryCfg = core.CONFIG.viewer.gallery;
      if ((initialGalleryCfg?.build === true || initialGalleryCfg?.buildFake === true) && !core.SANDBOX_MODE && !this.isEmbedMode()) {
        Viewer.buildGallery();
      }

      core.renderer.setPixelRatio(devicePixelRatio);
      const update = () => Viewer.updateSize();

      Viewer.bindEventListener(window, 'resize', update);

      Viewer.resizeObserver = new ResizeObserver(update);
      Viewer.resizeObserver.observe(core.viewerWrapper);


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

attachLocalizationTheme(Viewer);
attachLoadingStatus(Viewer);
attachMaterialsEditor(Viewer);
attachShadingEditor(Viewer);
attachAnnotations(Viewer);
attachPicking(Viewer);
attachMeasurement(Viewer);
attachAnimations(Viewer);
attachViewHelper(Viewer);
attachClipping(Viewer);
attachEmbedConfigurator(Viewer);
attachLoginPanel(Viewer);
attachUploadPanel(Viewer);
attachModelsPanel(Viewer);
attachAdminPanel(Viewer);
attachWindowControls(Viewer);


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

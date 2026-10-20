import THREE from "../init.js";
import { core } from "../core.js";
import { toastHelper } from "../viewer-utils.js";
import { getUpAxis } from "../up-axis.js";
import { apiUrl, appRequestHeaders } from "../remote.js";
import { workerJobId, workerSettingsUrl } from "../worker-model.js";

const BUILD = (typeof __BUILD__ !== "undefined") ? __BUILD__ : "";

function pickMetadataValue(save, current, original) {
  return save ? current : original;
}

export function buildEditorMetadata(viewer, rotateMetadata) {
  const originalMetadata = viewer.originalMetadata;
  const saveProperties = viewer.saveProperties;
  const metadata = {};

  metadata.objPosition = pickMetadataValue(
    saveProperties.Position,
    [
      core.helperObjects[0].position.x,
      core.helperObjects[0].position.y,
      core.helperObjects[0].position.z
    ],
    originalMetadata.objPosition
  );

  metadata.objRotation = pickMetadataValue(
    saveProperties.Rotation,
    [rotateMetadata.x, rotateMetadata.y, rotateMetadata.z],
    originalMetadata.objRotation
  );

  // Which axis of the file is up (up-axis.js): part of the orientation.
  metadata.upAxis = pickMetadataValue(
    saveProperties.Rotation,
    getUpAxis(core.helperObjects[0]),
    originalMetadata.upAxis
  );

  metadata.objScale = pickMetadataValue(
    saveProperties.Scale,
    [
      core.helperObjects[0].scale.x,
      core.helperObjects[0].scale.y,
      core.helperObjects[0].scale.z
    ],
    originalMetadata.objScale
  );

  metadata.cameraPosition = pickMetadataValue(
    saveProperties.Camera,
    [
      core.camera.position.x,
      core.camera.position.y,
      core.camera.position.z
    ],
    originalMetadata.cameraPosition
  );

  metadata.controlsTarget = pickMetadataValue(
    saveProperties.Camera,
    [
      core.controls.target.x,
      core.controls.target.y,
      core.controls.target.z
    ],
    originalMetadata.controlsTarget
  );

  metadata.controlsZoom = pickMetadataValue(
    saveProperties.Camera,
    [
      core.camera.position.distanceTo(core.controls.target)
    ],
    originalMetadata.controlsZoom
  );

  metadata.lightPosition = pickMetadataValue(
    saveProperties.DirectionalLight,
    [
      core.dirLight.position.x,
      core.dirLight.position.y,
      core.dirLight.position.z
    ],
    originalMetadata.lightPosition
  );

  metadata.lightTarget = pickMetadataValue(
    saveProperties.DirectionalLight,
    [
      core.dirLight.rotation._x,
      core.dirLight.rotation._y,
      core.dirLight.rotation._z
    ],
    originalMetadata.lightTarget
  );

  metadata.lightColor = pickMetadataValue(
    saveProperties.DirectionalLight,
    ["#" + core.dirLight.color.getHexString().toUpperCase()],
    originalMetadata.lightColor
  );

  metadata.lightIntensity = pickMetadataValue(
    saveProperties.DirectionalLight,
    [core.dirLight.intensity],
    originalMetadata.lightIntensity
  );

  metadata.lightAmbientColor = pickMetadataValue(
    saveProperties.AmbientLight,
    ["#" + core.ambientLight.color.getHexString().toUpperCase()],
    originalMetadata.lightAmbientColor
  );

  metadata.lightAmbientIntensity = pickMetadataValue(
    saveProperties.AmbientLight,
    [core.ambientLight.intensity],
    originalMetadata.lightAmbientIntensity
  );

  metadata.lightCameraColor = pickMetadataValue(
    saveProperties.CameraLight,
    ["#" + core.cameraLight.color.getHexString().toUpperCase()],
    originalMetadata.lightCameraColor
  );

  metadata.lightCameraIntensity = pickMetadataValue(
    saveProperties.CameraLight,
    [core.cameraLight.intensity],
    originalMetadata.lightCameraIntensity
  );

  metadata.background = saveProperties.BackgroundColor
    ? [window.getComputedStyle(viewer.mainCanvas).background]
    : originalMetadata.background;

  metadata.annotationEntries = viewer.getAnnotationEntriesForPersistence();
  metadata.iiifAnnotationsXml = viewer.exportAnnotationsToIIIFXml();

  return metadata;
}

function currentRotationDegrees() {
  return new THREE.Vector3(
    THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.x),
    THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.y),
    THREE.MathUtils.radToDeg(core.helperObjects[0].rotation.z)
  );
}

// The settings saved before, so that what is not ticked keeps its value.
async function mergeSavedMetadata(viewer, url) {
  let fetchedMetadata = {};
  try {
    if (url) {
      const response = await fetch(url, { cache: "no-cache" });
      if (response.ok) {
        fetchedMetadata = await response.json();
      }
    }
  } catch (err) {
    console.warn("Metadata fetch failed, continuing with save", err);
  }
  viewer.originalMetadata = {
    ...viewer.originalMetadata,
    ...fetchedMetadata
  };
}

// Docker/standalone and the app: the worker keeps the settings of the models
// uploaded to it (POST /api/model/settings), for their uploader or an admin.
async function saveToWorker(viewer) {
  if (!workerJobId(core.fileObject.path)) {
    toastHelper("settingsNotUploaded", "info");
    return;
  }
  await mergeSavedMetadata(viewer, workerSettingsUrl());
  const newMetadata = buildEditorMetadata(viewer, currentRotationDegrees());
  try {
    const response = await fetch(apiUrl("/api/model/settings"), {
      method: "POST",
      credentials: "same-origin",
      headers: { ...appRequestHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        path: core.fileObject.path,
        filename: core.fileObject.filename,
        content: newMetadata
      })
    });
    if (response.status === 401 || response.status === 403) {
      toastHelper("settingsNotOwner", "warning");
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    toastHelper("settingsSaved", "success");
  } catch (err) {
    console.error(err);
    toastHelper("settingsSaveError", "error");
  }
}

export async function saveEditorMetadata(viewer) {
  if (!core.EDITOR || !core.helperObjects?.[0]) return;
  if (BUILD !== "drupal") {
    await saveToWorker(viewer);
    return;
  }
  if (core.isLightweight) return;

  if (core.CONFIG.entity.proxyPath !== undefined) {
    core.CONFIG.metadataUrl = core.getProxyPath(core.CONFIG.metadataUrl);
  }
  await mergeSavedMetadata(viewer, core.CONFIG?.metadataUrl);

  const newMetadata = buildEditorMetadata(viewer, currentRotationDegrees());

  try {
    const token = await fetch("/session/token").then((response) => response.text());

    const response = await fetch(core.CONFIG.mainUrl + "/api/editor/save-metadata", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": token
      },
      body: JSON.stringify({
        filename: core.fileObject.filename,
        path:
          viewer.archiveType !== ""
            ? core.fileObject.relativePath + core.fileObject.basename + core.loadedFile
            : core.fileObject.relativePath,
        content: JSON.stringify(newMetadata, null, "\t")
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    toastHelper("settingsSaved", "success");
  } catch (err) {
    console.error(err);
    toastHelper("settingsSaveError", "error");
  }
}

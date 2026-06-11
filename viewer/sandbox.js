import { core, setCore } from "./core.js";
import { toastHelper } from './viewer-utils.js';

export async function loadDroppedModel (file) {
  const extension = file.name.split('.').pop().toLowerCase();

  clearCurrentModel();

  const url = URL.createObjectURL(file);

  core.fileObject.originalPath = url;
  core.fileObject.filename = url;
  core.fileObject.basename = file.name.substring(0, file.name.lastIndexOf('.'));
  core.fileObject.extension = extension;
  core.fileObject.path = '';
  core.fileObject.uri = url;
  core.fileObject.relativePath = url;

  Viewer._ext = extension;

  setCore('fileObject', core.fileObject);

  core.autoPath = '';

  await Viewer.mainLoadModel();

  if (core.SANDBOX_MODE) {
    Viewer.showSandboxGuiAfterModelLoad();
    Viewer.dismissStatusNotice("sandbox-drop-model");
  }

  toastHelper("modelLoadedSimple", "success");
};

function clearCurrentModel () {
  if (!core.mainObject || core.mainObject.length === 0) {
    return;
  }

  core.mainObject.forEach(obj => {
    core.scene.remove(obj);
  });

  core.mainObject = [];
};
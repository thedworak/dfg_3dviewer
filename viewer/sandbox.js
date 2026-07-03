import { core, setCore } from "./core.js";
import { toastHelper } from './viewer-utils.js';

export async function createCreditsElement() {
  const credits = core.CONFIG?.viewer?.credits;

  if (!credits?.visible) {
    return null;
  }

  const creditsDiv = document.createElement("div");
  creditsDiv.id = "credits";

  let html = "";

  if (credits.logo?.src) {
    html += `
      <div class="credits-header">
        ${credits.logo.url ? `<a href="${credits.logo.url}" target="_blank" rel="noopener noreferrer">` : ""}
          <img src="${credits.logo.src}" class="credits-main-logo" alt="Logo">
        ${credits.logo.url ? "</a>" : ""}
      </div>
    `;
  }

  html += `<div class="credits-items">`;

  for (const item of credits.items ?? []) {
    html += `
      <div class="credits-item">

        <div class="credits-label">
          ${item.label}
        </div>

        ${
          item.logo?.src
            ? `
              <div class="credits-logo-wrapper">
                ${item.logo.url ? `<a href="${item.logo.url}" target="_blank" rel="noopener noreferrer">` : ""}
                  <img class="credits-logo" src="${item.logo.src}" alt="">
                ${item.logo.url ? "</a>" : ""}
              </div>
            `
            : ""
        }

        ${
          item.url
            ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer" class="credits-link">${item.text}</a>`
            : `<div class="credits-text">${item.text}</div>`
        }

      </div>
    `;
  }

  html += `</div>`;

  creditsDiv.innerHTML = html;

  return creditsDiv;
}

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
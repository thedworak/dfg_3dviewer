import { appMode } from "./api.js";

// The admin pages opened inside the app (ui/admin-panel.js shows them in
// a frame over the viewer): closing them and opening a model go to the
// app's viewer as messages; opened on their own, they navigate.

export const embedded = appMode && window.parent !== window;

function post(message) {
  window.parent.postMessage({ source: "exadmin", ...message }, location.origin);
}

export function closePanel() {
  if (embedded) post({ type: "close" });
  else location.href = appMode ? "../index.html" : "../";
}

// A model of the repository, opened in the viewer the way its own model
// list opens it ({id, modelUrl, imageUrls}).
export function openModel(job) {
  if (embedded) post({ type: "open-model", job: { id: job.id, modelUrl: job.modelUrl, imageUrls: job.imageUrls || [] } });
}

// A link to a model: in the app a button that hands it to the viewer, on
// the web the viewer's address in a new tab.
export function modelLink(job, text) {
  if (appMode) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.disabled = !embedded;
    button.addEventListener("click", () => openModel(job));
    return button;
  }
  const link = document.createElement("a");
  link.href = `../?model=${encodeURIComponent(job.modelUrl)}`;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = text;
  return link;
}

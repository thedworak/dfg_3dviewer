import { isAppBuild } from "../remote.js";

// The scenes (the example manifests, ui/examples-panel.js) are the main
// content, so the button that leads to them pulses until they have been
// opened once - on a page the scenes button, in the app the "Models"
// button (it opens on the scenes, ui/models-source.js), and on a phone also
// the button of the folded header row (ui/page-header-fold.js). Nothing
// opens by itself.
const SEEN_KEY = "dfg3dviewer-scenes-seen";
const PULSE_CLASS = "scenes-pulse";

function seen() {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // No storage: no way to remember, so no pulse at all.
    return true;
  }
}

function targets() {
  return [
    isAppBuild() ? "#openLocalFileButton" : "#browseManifestsButton",
    "body.viewer-page-header-folds #viewer-page-header-toggle",
  ].map((selector) => document.querySelector(selector)).filter(Boolean);
}

// Once the header is built (main.js).
export function showScenesHint() {
  if (seen()) return;
  targets().forEach((element) => element.classList.add(PULSE_CLASS));
}

// The scenes were opened (examples-panel.js): no more pulsing.
export function markScenesSeen() {
  document.querySelectorAll(`.${PULSE_CLASS}`).forEach((element) => element.classList.remove(PULSE_CLASS));
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Not remembered: pulses again on the next start.
  }
}

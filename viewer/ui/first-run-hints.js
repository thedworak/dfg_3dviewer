import { isAppBuild } from "../remote.js";

// The app only: the first time it starts, the buttons worth knowing about
// pulse one after another - models on the device, the repository, then the
// rest of the tools. A tap on the pulsing button (or its time running out)
// moves on to the next one. Once per install: the flag is set as soon as the
// hints start, so an app closed half-way does not show them again.
const FIRST_RUN_KEY = "dfg3dviewer-first-run-hints";
const TARGETS = ["#openLocalFileButton", "#browseModelsButton", "#viewerEditorToolbar .viewer-editor-expand"];
// After the loader card has faded out (core.circle.complete(2600)).
const START_DELAY_MS = 2800;
const PULSE_MS = 3600;

function isVisible(element) {
  return Boolean(element && !element.hidden && element.getClientRects().length > 0);
}

export function maybeShowFirstRunHints() {
  if (!isAppBuild()) return;
  try {
    if (window.localStorage.getItem(FIRST_RUN_KEY) === "1") return;
    window.localStorage.setItem(FIRST_RUN_KEY, "1");
  } catch {
    // No storage: no way to tell the first run from the others, so skip.
    return;
  }

  window.setTimeout(() => {
    const targets = TARGETS.map((selector) => document.querySelector(selector)).filter(isVisible);
    const next = (index) => {
      const target = targets[index];
      if (!target) return;
      target.classList.add("first-run-pulse");
      let timer = null;
      const done = () => {
        window.clearTimeout(timer);
        target.removeEventListener("pointerdown", done);
        target.classList.remove("first-run-pulse");
        next(index + 1);
      };
      target.addEventListener("pointerdown", done, { once: true });
      timer = window.setTimeout(done, PULSE_MS);
    };
    next(0);
  }, START_DELAY_MS);
}

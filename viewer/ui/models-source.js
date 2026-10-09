import { isAppBuild } from "../remote.js";
import { t } from "../i18n-utils.js";
import { toastHelper } from "../viewer-utils.js";
import { hasFeature } from "../app-features.js";
import { createLockIcon } from "./lock-icon.js";

// The app has one "Models" button instead of two: it opens the models on the
// device (library-panel.js), those in the repository (models-panel.js) or the
// example manifests (examples-panel.js), whichever was used last, and each
// panel carries a toggle between them.
// The repository's models can be locked in the app (hasFeature() in
// app-features.js): "Remote" then carries a lock.
const SOURCE_KEY = "dfg3dviewer-models-source";

function storedSource() {
  try {
    const source = window.localStorage.getItem(SOURCE_KEY);
    return source === "remote" || source === "examples" ? source : "local";
  } catch {
    return "local";
  }
}

export function attachModelsSource(Viewer) {
  Object.assign(Viewer, {
    // The header button in the app: closes whichever panel is open, or
    // opens the one used last.
    toggleModelsSource(event) {
      event?.preventDefault?.();
      const open = this.libraryPanel?.hidden === false || this.modelsPanel?.hidden === false ||
        this.examplesPanel?.hidden === false;
      if (open) {
        this.closeLibraryPanel?.();
        this.closeModelsPanel?.();
        this.closeExamplesPanel?.();
        return;
      }
      const source = storedSource();
      this.showModelsSource(source === "remote" && !hasFeature("remoteModels") ? "local" : source);
    },

    showModelsSource(source) {
      if (source === "remote" && !hasFeature("remoteModels")) {
        toastHelper("planLocked", "info", { key: "plan-locked", replace: true });
        this.showLockedFeature?.("remoteModels");
        return;
      }
      try {
        window.localStorage.setItem(SOURCE_KEY, source);
      } catch {
        // Not remembered - the next open starts on the device again.
      }
      this.closeActionMenu?.();
      if (source !== "examples") this.closeExamplesPanel?.();
      if (source === "examples") {
        this.closeLibraryPanel?.();
        this.closeModelsPanel?.();
        this.createExamplesPanel();
        if (!this.examplesPanel) return;
        this.examplesPanel.hidden = false;
        this.loadExamplesList();
      } else if (source === "remote") {
        this.closeLibraryPanel?.();
        this.createModelsPanel();
        if (!this.modelsPanel) return;
        this.modelsPanel.hidden = false;
        this.loadModelsList();
      } else {
        this.closeModelsPanel?.();
        this.createLibraryPanel();
        if (!this.libraryPanel) return;
        this.libraryPanel.hidden = false;
        this.loadLibraryList();
      }
    },

    // Placed under a panel's header; `active` is the panel it sits in.
    createModelsSourceToggle(active) {
      if (!isAppBuild()) return null;
      const toggle = document.createElement("div");
      toggle.className = "models-source-toggle";
      toggle.setAttribute("role", "group");
      toggle.setAttribute("aria-label", t("modelsSource.aria", "Where the models come from"));
      [
        ["local", t("modelsSource.local", "On this device")],
        ["remote", t("modelsSource.remote", "Remote")],
        ["examples", t("modelsSource.examples", "Examples")],
      ].forEach(([source, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset.source = source;
        button.setAttribute("aria-pressed", source === active ? "true" : "false");
        if (source !== active) {
          this.bindEventListener(button, "click", () => this.showModelsSource(source));
        }
        toggle.appendChild(button);
      });
      this.updateModelsSourceLock(toggle);
      return toggle;
    },

    // The lock on "Remote"; called for every toggle when the plan changes.
    updateModelsSourceLock(toggle) {
      const button = toggle.querySelector('[data-source="remote"]');
      if (!button) return;
      const locked = !hasFeature("remoteModels");
      button.classList.toggle("plan-locked", locked);
      button.querySelector(".plan-lock-icon")?.remove();
      if (locked) button.appendChild(createLockIcon());
    },

    applyModelsSourceLocks() {
      document.querySelectorAll(".models-source-toggle").forEach((toggle) => this.updateModelsSourceLock(toggle));
      // The plan no longer includes it: back to the models on the device.
      if (!hasFeature("remoteModels") && this.modelsPanel?.hidden === false) this.showModelsSource("local");
    },
  });
}

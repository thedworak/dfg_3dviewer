import { isAppBuild } from "../remote.js";
import { t } from "../i18n-utils.js";

// The app has one "Models" button instead of two: it opens the models on the
// device (library-panel.js) or those in the repository (models-panel.js),
// whichever was used last, and both panels carry a toggle between the two.
const SOURCE_KEY = "dfg3dviewer-models-source";

function storedSource() {
  try {
    return window.localStorage.getItem(SOURCE_KEY) === "remote" ? "remote" : "local";
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
      const open = this.libraryPanel?.hidden === false || this.modelsPanel?.hidden === false;
      if (open) {
        this.closeLibraryPanel?.();
        this.closeModelsPanel?.();
        return;
      }
      this.showModelsSource(storedSource());
    },

    showModelsSource(source) {
      try {
        window.localStorage.setItem(SOURCE_KEY, source);
      } catch {
        // Not remembered - the next open starts on the device again.
      }
      this.closeActionMenu?.();
      if (source === "remote") {
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
      ].forEach(([source, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.setAttribute("aria-pressed", source === active ? "true" : "false");
        if (source !== active) {
          this.bindEventListener(button, "click", () => this.showModelsSource(source));
        }
        toggle.appendChild(button);
      });
      return toggle;
    },
  });
}

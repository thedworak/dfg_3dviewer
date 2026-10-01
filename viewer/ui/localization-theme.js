import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { UltraLoader } from "../ultra-loader.js";
import { relocalizeManifestTree } from "../manifesto/manifest-tree-editor.js";
import { normalizeLanguage } from "../viewer-param-utils.js";

export function attachLocalizationTheme(viewer) {
  Object.assign(viewer, {
    getStoredTheme() {
      if (this.urlOptions?.theme === "light" || this.urlOptions?.theme === "dark") {
        return this.urlOptions.theme;
      }

      const storedTheme = window.localStorage.getItem(this.THEME_STORAGE_KEY);
      return storedTheme === "0" ? "light" : "dark";
    },

    normalizeLanguage,

    getStoredLanguage() {
      const fromQuery = this.normalizeLanguage(this.urlOptions?.language);
      if (fromQuery) return fromQuery;

      const storedLanguage = this.normalizeLanguage(window.localStorage.getItem(this.LANGUAGE_STORAGE_KEY));
      if (storedLanguage) return storedLanguage;

      const browserLanguage = this.normalizeLanguage(navigator?.language || "en");
      return browserLanguage || "en";
    },

    updateThemeControlLabels() {
      const isDark = this.currentTheme === "dark";

      if (this.themeMode) {
        this.themeMode.innerHTML = `
          <span class="viewer-theme-icon" aria-hidden="true">${isDark ? "☀️" : "🌙"}</span>
          <span>${isDark ? t("theme.lightMode", "Light mode") : t("theme.darkMode", "Dark mode")}</span>
        `;
        const label = isDark
          ? t("theme.switchToLightMode", "Switch to light mode")
          : t("theme.switchToDarkMode", "Switch to dark mode");
        this.themeMode.setAttribute("aria-label", label);
        this.themeMode.setAttribute("title", label);
      }

      const exampleThemeToggle = document.getElementById("example-theme-toggle");
      if (exampleThemeToggle) {
        exampleThemeToggle.textContent = isDark ? "☀️" : "🌙";
        exampleThemeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
        exampleThemeToggle.hidden = true;
      }
    },

    applyTheme(theme, { persist = true } = {}) {
      const normalizedTheme = theme === "light" ? "light" : "dark";
      const isDark = normalizedTheme === "dark";

      this.currentTheme = normalizedTheme;
      document.documentElement.setAttribute("data-viewer-theme", normalizedTheme);
      document.body.setAttribute("data-viewer-theme", normalizedTheme);
      document.body.classList.toggle("iiif-dark", isDark);
      this.viewerWrapper?.setAttribute("data-viewer-theme", normalizedTheme);
      this.actionMenu?.setAttribute("data-viewer-theme", normalizedTheme);
      this.metadataContainer?.setAttribute("data-viewer-theme", normalizedTheme);
      core.guiContainer?.setAttribute("data-viewer-theme", normalizedTheme);
      document.getElementById("form-manifesto")?.setAttribute("data-viewer-theme", normalizedTheme);
      UltraLoader.panel?.setAttribute("data-viewer-theme", normalizedTheme);

      if (persist) {
        window.localStorage.setItem(this.THEME_STORAGE_KEY, isDark ? "1" : "0");
      }

      this.updateThemeControlLabels();
    },

    toggleTheme() {
      this.closeActionMenu();
      this.applyTheme(this.currentTheme === "dark" ? "light" : "dark");
    },

    updateLanguageControlLabels() {
      if (!this.languageMode) return;
      const languages = [
        { code: "en", label: "Language: EN"},
        { code: "pl", label: "Język: PL"},
        { code: "de", label: "Sprache: DE"}
      ];
      const currentLangLabel = languages.find((language) => language.code === core.currentLanguage)?.label || "EN";
      this.languageMode.innerHTML = `
        <span class="viewer-action-icon language-icon" aria-hidden="true"></span>
        <span>${currentLangLabel}</span>
      `;
      this.languageMode.setAttribute("aria-label", t("language.label", "Language: EN"));
      this.languageMode.setAttribute("title", t("language.label", "Language: EN"));

      if (this.languageModeDropdown) {
        const items = this.languageModeDropdown.querySelectorAll(".language-dropdown-item");
        items.forEach((item) => {
          item.classList.toggle("active", item.dataset.lang === core.currentLanguage);
        });
      }
    },

    updateActionMenuLabels() {
      if (!this.actionMenu) return;
      const actionMenuLabel = t("gui.mainMenu", "Main menu");

      const toggle = this.actionMenu.querySelector(".viewer-action-menu_toggle");
      toggle?.setAttribute("title", actionMenuLabel);
      const toggleCopy = toggle?.querySelector(".viewer-editor-tool_sr");
      if (toggleCopy) toggleCopy.textContent = actionMenuLabel;
      this.actionMenu.querySelector(".viewer-action-menu_panel")?.setAttribute("aria-label", actionMenuLabel);
    },

    updateDownloadMenuEntryLabel() {
      if (!this.downloadModelElement || this.downloadModelElement.hidden) return;
      this.downloadModelElement.innerHTML = `
        <span class="viewer-action-icon download-icon" aria-hidden="true"></span>
        <span>${t("menu.download", "Download")}</span>
      `;
    },

    updateLocalizedUI() {
      const lang = ["pl", "de"].includes(core.currentLanguage) ? core.currentLanguage : "en";
      document.documentElement.setAttribute("lang", lang);
      this.updateActionMenuLabels();
      this.updateLanguageControlLabels();
      this.updateThemeControlLabels();
      this.updateShareMenuEntryState?.();
      this.updateEmbedMenuEntryState();
      this.updateUploadMenuEntryState?.();
      this.updateFullscreenButtonIcon();
      this.updateDownloadMenuEntryLabel();
      this.updateEditorToolbarLabels();
      this.updateAnimationPlayerLabels?.();
      this.updateTourLabels?.();
      this.syncPointCloudPanel?.();
      this.renderUploadLimits?.();
      this.updateClippingGuiLabels?.();
      this.updateClippingPanel?.();
      this.updateEditorToolbarState();
      this.updatePickingModeControllerLabel();
      this.updateDistanceMeasurementControllerLabel();
      this.updateSelectedFacesControllerLabel();
      this.updateLocalPreviewLabels();
      this.updateIIIFFormLabels();
      this.updateMetadataPanelLabels();
      this.updateMaterialsDialogLabels();
      this.refreshStatusNoticeLanguage();
      UltraLoader.relocalize?.();
      this.circle?.relocalize?.();
      this.loadingLog?.relocalize?.();
      this.updatePickingHintVisibility?.();
      if (this.clippingHint) this.clippingHint.textContent = t("hints.clipping", "Drag active clipping plane helper to adjust cut");
    },

    updateLocalPreviewLabels() {
      const label = document.querySelector("#example-model-picker label[for='example-model-select']");
      if (label) {
        label.textContent = t("localPreview.loadExampleModel", "Load example model");
      }
    },

    updateIIIFFormLabels() {
      const form = document.getElementById("form-manifesto");
      if (!form) return;
      // Elements of the manifest form carry their i18n keys (see
      // createManifestUI() in metadata.js); the current text is the fallback.
      form.querySelectorAll("[data-i18n]").forEach((node) => {
        node.textContent = t(node.dataset.i18n, node.textContent);
      });
      form.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
        node.placeholder = t(node.dataset.i18nPlaceholder, node.placeholder);
      });
      form.querySelectorAll("[data-i18n-title]").forEach((node) => {
        node.title = t(node.dataset.i18nTitle, node.title);
      });
      form.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
        node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel, node.getAttribute("aria-label") || ""));
      });
      relocalizeManifestTree();
    },

    updateMetadataPanelLabels() {
      const metadataContainer = document.getElementById("metadata-container");
      if (!metadataContainer) return;
      metadataContainer.querySelectorAll("[data-i18n-key]").forEach((node) => {
        const key = node.getAttribute("data-i18n-key");
        if (!key) return;
        node.textContent = t(key, node.textContent?.replace(/:\s*$/, "") || "");
      });
      // Counts and the header's summary in the new language's number format.
      this.updateMetadataCounts?.(metadataContainer);
    },

    applyLanguage({ persist = true } = {}) {
      if (persist) {
        window.localStorage.setItem(this.LANGUAGE_STORAGE_KEY, core.currentLanguage);
      }
      this.updateLocalizedUI();
      // Annotations written in several languages follow the viewer's.
      this.applyAnnotationLanguage?.();
      // The Level of Certainty legend and dialog field name their levels.
      this.applyCertaintyLanguage?.();
    },

    toggleLanguage() {
      if (!this.languageModeDropdown) return;
      const isVisible = !this.languageModeDropdown.hidden;
      this.languageModeDropdown.hidden = isVisible;
    },

    selectLanguage(lang) {
      core.currentLanguage = lang;
      this.languageModeDropdown.hidden = true;
      this.closeActionMenu();
      this.applyLanguage();
    },
  });
}

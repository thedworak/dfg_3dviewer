import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { UltraLoader } from "../ultra-loader.js";

export function attachLocalizationTheme(viewer) {
  Object.assign(viewer, {
    getStoredTheme() {
      if (this.urlOptions?.theme === "light" || this.urlOptions?.theme === "dark") {
        return this.urlOptions.theme;
      }

      const storedTheme = window.localStorage.getItem(this.THEME_STORAGE_KEY);
      return storedTheme === "0" ? "light" : "dark";
    },

    normalizeLanguage(value) {
      if (value == null) return null;
      const normalizedValue = String(value).trim().toLowerCase();
      if (normalizedValue.startsWith("pl")) return "pl";
      if (normalizedValue.startsWith("de")) return "de";
      if (normalizedValue.startsWith("en")) return "en";
      return null;
    },

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
      document.getElementById("form-IIIF")?.setAttribute("data-viewer-theme", normalizedTheme);
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
      const actionMenuLabel = t("menu.mainMenu", "Main menu");

      const toggle = this.actionMenu.querySelector(".viewer-action-menu_toggle");
      toggle?.setAttribute("title", actionMenuLabel);
      const toggleCopy = toggle?.querySelector(".viewer-editor-tool_sr");
      if (toggleCopy) toggleCopy.textContent = actionMenuLabel;
      this.actionMenu.querySelector(".viewer-action-menu_panel")?.setAttribute("aria-label", actionMenuLabel);
    },

    updateDownloadMenuEntryLabel() {
      if (!this.downloadModel || this.downloadModel.hidden) return;
      this.downloadModel.innerHTML = `
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
      this.updateEmbedMenuEntryState();
      this.updateFullscreenButtonIcon();
      this.updateDownloadMenuEntryLabel();
      this.updateEditorToolbarLabels();
      this.updateEditorToolbarState();
      this.updatePickingModeControllerLabel();
      this.updateDistanceMeasurementControllerLabel();
      this.updateSelectedFacesControllerLabel();
      this.updateLocalPreviewLabels();
      this.updateIIIFFormLabels();
      this.updateMetadataPanelLabels();
      this.updateMaterialsDialogLabels();
      this.refreshStatusNoticeLanguage();
      UltraLoader.updateHeader?.();
      if (this.pickingHint) this.pickingHint.textContent = t("hints.picking", "Shift + click to select multiple faces");
      if (this.clippingHint) this.clippingHint.textContent = t("hints.clipping", "Drag active clipping plane helper to adjust cut");
    },

    updateLocalPreviewLabels() {
      const label = document.querySelector("#example-model-picker label[for='example-model-select']");
      if (label) {
        label.textContent = t("localPreview.loadExampleModel", "Load example model");
      }
    },

    updateIIIFFormLabels() {
      const form = document.getElementById("form-IIIF");
      if (!form) return;
      const title = form.querySelector(".form-IIIF-header .title");
      if (title) title.textContent = t("iiif.loader", "IIIF Loader");
      const collapseBtn = document.getElementById("iiif-toggle-collapse");
      if (collapseBtn) {
        const isCollapsed = form.classList.contains("collapsed");
        collapseBtn.title = isCollapsed
          ? t("iiif.expand", "Expand")
          : t("iiif.collapse", "Collapse");
      }
      const label = form.querySelector(".form-IIIF-label");
      if (label) label.textContent = t("iiif.manifest", "IIIF manifest");
      const select = document.getElementById("iiif-manifest-select");
      if (select) {
        const optionLabelByUrl = {
          "https://raw.githubusercontent.com/IIIF/3d/main/manifests/4_transform_and_position/model_transform_scale_position.json": t("iiif.optionModelPositionScale", "Model Position and Scale"),
          "https://raw.githubusercontent.com/IIIF/3d/main/manifests/1_basic_model_in_scene/model_origin.json": t("iiif.optionModelOrigin", "Model Origin"),
          "https://raw.githubusercontent.com/IIIF/3d/main/manifests/1_basic_model_in_scene/model_origin_bgcolor.json": t("iiif.optionModelOriginBg", "Model Origin with background color"),
          "https://raw.githubusercontent.com/IIIF/3d/main/manifests/4_transform_and_position/model_position.json": t("iiif.optionModelPosition", "Model Position"),
        };
        Array.from(select.options).forEach((option) => {
          const labelFromMap = optionLabelByUrl[option.value];
          if (labelFromMap) option.textContent = labelFromMap;
        });
      }
      const manifestUrl = document.getElementById("manifest-url");
      if (manifestUrl) manifestUrl.placeholder = t("iiif.manifestUrlPlaceholder", "https://example.org/iiif/manifest.json");
      const manifestText = document.getElementById("manifest-text");
      if (manifestText) manifestText.placeholder = t("iiif.manifestTextPlaceholder", "Paste IIIF manifest JSON here...");
      const loadFromUrlButton = document.getElementById("load-manifest-from-url");
      if (loadFromUrlButton) loadFromUrlButton.textContent = t("iiif.loadFromUrl", "Load from URL");
      const loadFromTextButton = document.getElementById("load-manifest-from-text");
      if (loadFromTextButton) loadFromTextButton.textContent = t("iiif.loadFromText", "Load from Text");
    },

    updateMetadataPanelLabels() {
      const metadataContainer = document.getElementById("metadata-container");
      if (!metadataContainer) return;
      metadataContainer.querySelectorAll("[data-i18n-key]").forEach((node) => {
        const key = node.getAttribute("data-i18n-key");
        if (!key) return;
        const needsColon = node.classList.contains("metadata-label");
        const text = t(key, node.textContent?.replace(/:\s*$/, "") || "");
        node.textContent = needsColon ? `${text}:` : text;
      });
    },

    applyLanguage({ persist = true } = {}) {
      if (persist) {
        window.localStorage.setItem(this.LANGUAGE_STORAGE_KEY, core.currentLanguage);
      }
      this.updateLocalizedUI();
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

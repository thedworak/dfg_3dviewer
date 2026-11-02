import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { toastHelper } from "../viewer-utils.js";
import { ManifestTreeEditor } from "../manifesto/manifest-tree-editor.js";
import { makePanelWindow } from "./panel-window.js";

// The manifest preview (toolbar: File > Preview manifest): the manifest the
// viewer would export now (build3IFManifest - IIIF Presentation 4 plus the
// AIM3DViewer block), shown like a loaded IIIF/AIM3D manifest in the
// manifest form: as a tree of collapsible nodes (manifest-tree-editor.js)
// or as pretty-printed JSON. Built again on opening and on ↻; edits made in
// the tree change only what is copied or downloaded from here.

export function attachManifestPreview(Viewer) {
  Object.assign(Viewer, {
    manifestPreviewMode: "tree",

    isManifestPreviewOpen() {
      return Boolean(this.manifestPreviewPanel && !this.manifestPreviewPanel.hidden);
    },

    closeManifestPreview() {
      if (this.manifestPreviewPanel) this.manifestPreviewPanel.hidden = true;
      this.updateEditorToolbarState?.();
    },

    toggleManifestPreview() {
      if (this.isManifestPreviewOpen()) {
        this.closeManifestPreview();
        return;
      }
      this.createManifestPreviewPanel();
      if (!this.manifestPreviewPanel) return;
      this.manifestPreviewPanel.hidden = false;
      this.openToolbarMenu?.(null);
      this.refreshManifestPreview();
      this.updateEditorToolbarState?.();
    },

    createManifestPreviewPanel() {
      if (!core.container || this.manifestPreviewPanel) return;
      const panel = document.createElement("div");
      panel.id = "manifestPreviewPanel";
      panel.hidden = true;
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-labelledby", "manifestPreviewTitle");
      panel.innerHTML = `
        <div class="upload-panel-header">
          <span id="manifestPreviewTitle"></span>
          <span class="validation-report-actions">
            <button type="button" data-action="copy"></button>
            <button type="button" data-action="download"></button>
            <button type="button" data-action="refresh"></button>
            <button type="button" data-action="close"></button>
          </span>
        </div>
        <div class="manifesto-view-toolbar">
          <div class="manifesto-view-toggle" role="group">
            <button type="button" data-mode="tree"></button>
            <button type="button" data-mode="json"></button>
          </div>
          <button type="button" class="manifesto-tree-tool" data-action="expand"></button>
          <button type="button" class="manifesto-tree-tool" data-action="collapse"></button>
        </div>
        <p class="manifest-preview-empty" hidden></p>
        <div class="manifesto-manifest-tree"></div>
        <pre class="manifest-preview-json" hidden></pre>
      `;
      core.container.appendChild(panel);
      this.manifestPreviewPanel = panel;
      const json = panel.querySelector(".manifest-preview-json");
      this.manifestPreviewTree = new ManifestTreeEditor(panel.querySelector(".manifesto-manifest-tree"), {
        onChange: (data) => { json.textContent = JSON.stringify(data, null, 2); },
      });
      const on = (selector, handler) => this.bindEventListener(panel.querySelector(selector), "click", handler);
      on('[data-action="close"]', () => this.closeManifestPreview());
      on('[data-action="refresh"]', () => this.refreshManifestPreview());
      on('[data-action="copy"]', () => this.copyManifestPreview());
      on('[data-action="download"]', () => this.downloadManifestPreview());
      on('[data-action="expand"]', () => this.manifestPreviewTree.setAllOpen(true));
      on('[data-action="collapse"]', () => this.manifestPreviewTree.setAllOpen(false));
      on('[data-mode="tree"]', () => this.setManifestPreviewMode("tree"));
      on('[data-mode="json"]', () => this.setManifestPreviewMode("json"));
      makePanelWindow(this, panel, panel.querySelector(".upload-panel-header"), () => this.closeManifestPreview());
      this.localizeManifestPreview();
    },

    localizeManifestPreview() {
      const panel = this.manifestPreviewPanel;
      if (!panel) return;
      panel.querySelector("#manifestPreviewTitle").textContent = t("manifestPreview.title", "Manifest preview");
      [
        ["copy", t("manifestPreview.copy", "Copy the JSON"), "⧉"],
        ["download", t("gui.IIIFexport", "Export to IIIF"), "⤓"],
        ["refresh", t("manifestPreview.refresh", "Build again from the current state"), "↻"],
        ["close", t("validationReport.close", "Close"), "X"],
      ].forEach(([action, label, glyph]) => {
        const button = panel.querySelector(`[data-action="${action}"]`);
        button.title = label;
        button.setAttribute("aria-label", label);
        button.textContent = glyph;
      });
      panel.querySelector('[data-mode="tree"]').textContent = t("manifesto.treeView", "Tree");
      panel.querySelector('[data-mode="json"]').textContent = t("manifesto.jsonView", "JSON");
      panel.querySelector('[data-action="expand"]').textContent = t("manifesto.expandAll", "Expand all");
      panel.querySelector('[data-action="collapse"]').textContent = t("manifesto.collapseAll", "Collapse all");
      panel.querySelector(".manifest-preview-empty").textContent =
        t("manifestPreview.noModel", "Open a model to see its manifest.");
      this.manifestPreviewTree?.relocalize();
    },

    setManifestPreviewMode(mode) {
      this.manifestPreviewMode = mode === "json" ? "json" : "tree";
      const panel = this.manifestPreviewPanel;
      if (!panel) return;
      const empty = this.manifestPreviewTree?.data === undefined;
      const tree = this.manifestPreviewMode === "tree";
      panel.querySelector(".manifesto-manifest-tree").hidden = empty || !tree;
      panel.querySelector(".manifest-preview-json").hidden = empty || tree;
      panel.querySelector(".manifest-preview-empty").hidden = !empty;
      panel.querySelectorAll(".manifesto-tree-tool").forEach((button) => { button.hidden = empty || !tree; });
      panel.querySelectorAll("[data-mode]").forEach((button) => {
        const active = button.dataset.mode === this.manifestPreviewMode;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    },

    refreshManifestPreview() {
      if (!this.manifestPreviewPanel) return;
      let manifest;
      try {
        manifest = core.fileObject?.originalPath ? this.build3IFManifest() : null;
      } catch (error) {
        this.reportError?.(error, { context: "Failed to build the manifest for the preview", toast: false });
        manifest = null;
      }
      // The tree edits its own copy.
      const data = manifest ? JSON.parse(JSON.stringify(manifest)) : undefined;
      this.manifestPreviewTree.render(data);
      this.manifestPreviewPanel.querySelector(".manifest-preview-json").textContent =
        data ? JSON.stringify(data, null, 2) : "";
      this.setManifestPreviewMode(this.manifestPreviewMode);
    },

    manifestPreviewText() {
      const data = this.manifestPreviewTree?.data;
      return data === undefined ? "" : JSON.stringify(data, null, 2);
    },

    async copyManifestPreview() {
      const text = this.manifestPreviewText();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        toastHelper("manifestCopied", "success");
      } catch (error) {
        this.reportError?.(error, { context: "Failed to copy the manifest", toast: false });
        toastHelper("manifestCopyFailed", "warning");
      }
    },

    // The previewed manifest, with any edits made in the tree.
    downloadManifestPreview() {
      const text = this.manifestPreviewText();
      if (!text) return;
      const baseName = String(core.fileObject?.basename || "manifest").replace(/[^a-zA-Z0-9._-]+/g, "_");
      const objectUrl = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${baseName || "manifest"}-iiif-manifest.json`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      toastHelper("iiifManifestGenerated", "success");
    },
  });
}

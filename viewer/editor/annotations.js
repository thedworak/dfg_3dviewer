import { core } from "../core.js";
import { toastHelper, showToast } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import THREE from "../init.js";

export function attachAnnotations(Viewer) {
  Object.assign(Viewer, {
    clearAnnotationPOIs() {
      this.closeAnnotationPOITooltip();
      if (!this.annotationPOIGroup) {
        this.annotationPOIMarkers = [];
        return;
      }

      this.annotationPOIGroup.children.slice().forEach((child) => {
        this.removeAndDisposeFromScene(child);
      });
      this.annotationPOIGroup.clear();
      this.annotationPOIMarkers = [];
      this.annotationPOIGroup.visible = false;
    },

    ensureAnnotationPOIGroup() {
      if (this.annotationPOIGroup) return this.annotationPOIGroup;
      const group = new THREE.Group();
      group.name = "annotation-poi-group";
      group.visible = false;
      core.scene?.add?.(group);
      this.annotationPOIGroup = group;
      return group;
    },

    createNumberTexture(text) {
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = "bold 64px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, size / 2, size / 2);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;

      return texture;
    },

    createAnnotationPOIMarker(entry, position, index = 1) {
      const radius = Math.max((this.gridSize || core.gridSize || 1) / 15, 0.005);

      const texture = Viewer.createNumberTexture(index.toString());

      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      });

      const sprite = new THREE.Sprite(spriteMaterial);

      sprite.scale.set(radius, radius, 1);

      sprite.position.copy(position);

      sprite.userData.isAnnotationPOI = true;
      sprite.userData.annotationId = entry.id;
      sprite.userData.groupId = entry.groupId || "";
      sprite.userData.key = entry.key || "";
      sprite.userData.targetId = entry.targetId;
      sprite.userData.faceIndex = entry.faceIndex;
      sprite.userData.title = entry.title || "";

      return sprite;
    },

    ensureAnnotationPOITooltip() {
      if (this.annotationPOITooltip) return this.annotationPOITooltip;
      const tooltip = document.createElement("div");
      tooltip.id = "annotationPOITooltip";
      tooltip.className = "annotation-poi-tooltip";
      tooltip.hidden = true;
      tooltip.innerHTML = `
        <div class="annotation-poi-tooltip__panel" role="status" aria-live="polite" aria-atomic="true">
          <div class="annotation-poi-tooltip__title" id="annotationPOITooltipTitle"></div>
        </div>
      `;
      document.body.appendChild(tooltip);
      this.annotationPOITooltip = tooltip;
      this.annotationPOITooltipTitle = tooltip.querySelector("#annotationPOITooltipTitle");
      return tooltip;
    },

    openAnnotationPOITooltip(marker) {
      if (!marker?.userData?.isAnnotationPOI) {
        this.closeAnnotationPOITooltip();
        return false;
      }

      const tooltip = this.ensureAnnotationPOITooltip();
      if (!tooltip) return false;

      this.annotationPOITooltipTarget = marker;
      const titleText = String(marker.userData?.title || "").trim();
      if (this.annotationPOITooltipTitle) {
        this.annotationPOITooltipTitle.textContent = titleText || "Annotation";
      }

      tooltip.hidden = false;
      tooltip.style.visibility = "visible";
      this.updateAnnotationPOITooltipPosition();
      return true;
    },

    getAnnotationEntriesForPOIMarker(marker) {
      if (!marker?.userData?.isAnnotationPOI) return [];
      const markerId = String(marker.userData?.annotationId || "").trim();
      const markerGroupId = String(marker.userData?.groupId || "").trim();
      const markerKey = String(marker.userData?.key || "").trim();

      let baseEntry = null;
      if (markerId) {
        baseEntry = this.annotationEntries.find((entry) => String(entry?.id || "") === markerId) || null;
      }
      if (!baseEntry && markerKey) {
        baseEntry = this.annotationEntries.find((entry) => String(entry?.key || "") === markerKey) || null;
      }

      const effectiveGroupId = String(baseEntry?.groupId || markerGroupId || "").trim();
      if (effectiveGroupId) {
        const groupedEntries = this.annotationEntries.filter(
          (entry) => String(entry?.groupId || "").trim() === effectiveGroupId
        );
        if (groupedEntries.length > 0) return groupedEntries;
      }

      if (baseEntry) return [baseEntry];

      const fallbackTargetId = String(marker.userData?.targetId || "").trim();
      const fallbackFaceIndex = Number(marker.userData?.faceIndex);
      if (!fallbackTargetId || !Number.isInteger(fallbackFaceIndex) || fallbackFaceIndex < 0) return [];
      return [{
        id: markerId || "",
        key: this.getFaceSelectionKey(fallbackTargetId, fallbackFaceIndex),
        targetId: fallbackTargetId,
        object: fallbackTargetId,
        faceIndex: fallbackFaceIndex,
        title: String(marker.userData?.title || "").trim(),
        description: "",
        groupId: effectiveGroupId,
      }];
    },

    openAnnotationDialogFromPOIMarker(marker) {
      const entries = this.getAnnotationEntriesForPOIMarker(marker);
      if (!entries.length) {
        toastHelper("annotationDataMissing", "warning");
        return false;
      }

      this.buildAnnotationDialog();
      if (!this.annotationDialog) return false;

      const keys = entries
        .map((entry) => String(entry?.key || "").trim())
        .filter(Boolean);
      this.annotationTargetFaceKeys = Array.from(new Set(keys));

      const existingGroupIds = Array.from(
        new Set(entries.map((entry) => String(entry?.groupId || "").trim()).filter(Boolean))
      );
      this.annotationBatchGroupId = existingGroupIds.length === 1
        ? existingGroupIds[0]
        : `anno-group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const uniqueTitles = Array.from(
        new Set(entries.map((entry) => String(entry?.title || "").trim()))
      );
      const uniqueDescriptions = Array.from(
        new Set(entries.map((entry) => String(entry?.description || "").trim()))
      );
      this.annotationDialogTitleInput.value = uniqueTitles.length === 1 ? uniqueTitles[0] : "";
      this.annotationDialogDescriptionInput.value =
        uniqueDescriptions.length === 1 ? uniqueDescriptions[0] : "";

      this.updateAnnotationDialogBounds();
      this.annotationDialog.hidden = false;
      this.closeAnnotationPOITooltip();
      this.closeActionMenu();
      this.annotationDialogTitleInput?.focus();
      this.annotationDialogTitleInput?.select();
      return true;
    },

    closeAnnotationPOITooltip() {
      this.annotationPOITooltipTarget = null;
      if (!this.annotationPOITooltip) return;
      this.annotationPOITooltip.hidden = true;
      this.annotationPOITooltip.style.visibility = "hidden";
    },

    updateAnnotationPOITooltipPosition() {
      const tooltip = this.annotationPOITooltip;
      const marker = this.annotationPOITooltipTarget;
      if (!tooltip || tooltip.hidden || !marker || !core.camera) return;

      const rect =
        Viewer.mainCanvas?.getBoundingClientRect?.() ||
        core.container?.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;

      const worldPosition = new THREE.Vector3();
      marker.getWorldPosition(worldPosition);
      const projected = worldPosition.clone().project(core.camera);
      const withinDepth = projected.z >= -1 && projected.z <= 1;
      const screenX = rect.left + ((projected.x + 1) / 2) * rect.width;
      const screenY = rect.top + ((-projected.y + 1) / 2) * rect.height;
      const withinHorizontal = screenX >= rect.left && screenX <= rect.right;
      const withinVertical = screenY >= rect.top && screenY <= rect.bottom;
      if (!withinDepth || !withinHorizontal || !withinVertical) {
        tooltip.style.visibility = "hidden";
        return;
      }

      tooltip.style.left = `${Math.round(screenX)}px`;
      tooltip.style.top = `${Math.round(screenY)}px`;
      tooltip.style.visibility = "visible";
    },

    refreshAnnotationPOIs() {
      this.clearAnnotationPOIs();
      const entries = this.getAnnotationEntriesForPersistence();
      if (!entries.length) return 0;

      const group = this.ensureAnnotationPOIGroup();
      let added = 0;
      entries.forEach((entry) => {
        const object = this.resolveObjectByTargetId(entry.targetId);
        if (!object) return;
        const point = this.getFaceCentroidWorld(object, entry.faceIndex);
        if (!point) return;
        const marker = this.createAnnotationPOIMarker(entry, point, entries.indexOf(entry) + 1);
        group.add(marker);
        this.annotationPOIMarkers.push(marker);
        added += 1;
      });

      group.visible = added > 0;
      return added;
    },

    buildAnnotationDialog() {
      if (!core.container || this.annotationDialog) return;

      const dialog = document.createElement("div");
      dialog.id = "annotationDialog";
      dialog.className = "annotation-dialog";
      dialog.hidden = true;
      dialog.innerHTML = `
        <div class="annotation-dialog__backdrop" data-annotation-dismiss="true"></div>
        <div class="annotation-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="annotationDialogTitle">
          <div class="annotation-dialog__header">
            <h3 id="annotationDialogTitle">Add annotation</h3>
            <button type="button" class="annotation-dialog__close" data-annotation-dismiss="true" aria-label="Close annotation dialog">&times;</button>
          </div>
          <form id="annotationDialogForm" class="annotation-dialog__form">
            <label>
              <span>Title</span>
              <input id="annotationTitleInput" name="title" type="text" maxlength="120" required />
            </label>
            <label>
              <span>Description</span>
              <textarea id="annotationDescriptionInput" name="description" rows="5" maxlength="4000"></textarea>
            </label>
            <div class="annotation-dialog__actions">
              <button type="submit">Save annotation</button>
              <button type="button" data-annotation-dismiss="true">Cancel</button>
            </div>
          </form>
        </div>
      `;

      document.body.appendChild(dialog);
      this.annotationDialog = dialog;
      this.annotationDialogHost = document.body;
      this.annotationDialogTitleInput = dialog.querySelector("#annotationTitleInput");
      this.annotationDialogDescriptionInput = dialog.querySelector("#annotationDescriptionInput");
      const form = dialog.querySelector("#annotationDialogForm");

      this.bindEventListener(dialog, "click", (event) => {
        const dismissTrigger = event.target?.closest?.("[data-annotation-dismiss='true']");
        if (dismissTrigger) {
          this.closeAnnotationDialog();
        }
      });

      this.bindEventListener(document, "keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!this.annotationDialog || this.annotationDialog.hidden) return;
        event.preventDefault();
        this.closeAnnotationDialog();
      });

      this.bindEventListener(form, "submit", (event) => {
        event.preventDefault();
        this.saveAnnotationFromDialog();
      });

      this.bindEventListener(window, "resize", () => this.updateAnnotationDialogBounds());
      this.bindEventListener(window, "scroll", () => this.updateAnnotationDialogBounds(), true);
      this.bindEventListener(document, "fullscreenchange", () => this.updateAnnotationDialogBounds());
    },

    updateAnnotationDialogBounds() {
      if (!this.annotationDialog) return;
      const targetRect =
        Viewer.mainCanvas?.getBoundingClientRect?.() ||
        core.container?.getBoundingClientRect?.();
      if (!targetRect) return;

      const left = Math.max(0, Math.round(targetRect.left));
      const top = Math.max(0, Math.round(targetRect.top));
      const width = Math.max(0, Math.round(targetRect.width));
      const height = Math.max(0, Math.round(targetRect.height));

      this.annotationDialog.style.left = `${left}px`;
      this.annotationDialog.style.top = `${top}px`;
      this.annotationDialog.style.width = `${width}px`;
      this.annotationDialog.style.height = `${height}px`;
    },

    openAnnotationDialog() {
      if (!Array.isArray(this.selectedFaces) || this.selectedFaces.length === 0) {
        toastHelper("selectFaceRequired", "warning");
        return;
      }

      this.buildAnnotationDialog();
      if (!this.annotationDialog) return;

      const selectedKeys = this.selectedFaces
        .map((entry) => String(entry?.key || "").trim())
        .filter(Boolean);
      this.annotationTargetFaceKeys = selectedKeys;
      const existingGroupIds = Array.from(
        new Set(
          selectedKeys
            .map((key) => this.annotationEntries.find((entry) => entry.key === key)?.groupId || "")
            .map((value) => String(value).trim())
            .filter(Boolean)
        )
      );
      this.annotationBatchGroupId = existingGroupIds.length === 1
        ? existingGroupIds[0]
        : `anno-group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const existingEntries = selectedKeys
        .map((key) => this.annotationEntries.find((entry) => entry.key === key))
        .filter(Boolean);
      const uniqueTitles = Array.from(
        new Set(existingEntries.map((entry) => String(entry.title || "").trim()))
      );
      const uniqueDescriptions = Array.from(
        new Set(existingEntries.map((entry) => String(entry.description || "").trim()))
      );
      this.annotationDialogTitleInput.value = uniqueTitles.length === 1 ? uniqueTitles[0] : "";
      this.annotationDialogDescriptionInput.value =
        uniqueDescriptions.length === 1 ? uniqueDescriptions[0] : "";
      this.updateAnnotationDialogBounds();
      this.annotationDialog.hidden = false;
      this.closeAnnotationPOITooltip();
      this.closeActionMenu();
      this.annotationDialogTitleInput?.focus();
      this.annotationDialogTitleInput?.select();
    },

    openAnnotationDialogWithAutoPicking() {
      if (!this.pickingMode) {
        this.pickingMode = true;
        this.RULER_MODE = false;
        this.updateDistanceMeasurementControllerLabel();
        this.updatePickingModeControllerLabel();
        this.updatePickingControlsVisibility();
        toastHelper("featureToggle", "info", {
          feature: "Face picking",
          state: "enabled"
        });
      }

      if (!Array.isArray(this.selectedFaces) || this.selectedFaces.length === 0) {
        toastHelper("selectFaceRequiredAgain", "warning");
        return;
      }

      this.openAnnotationDialog();
    },

    closeAnnotationDialog() {
      if (!this.annotationDialog) return;
      this.annotationDialog.hidden = true;
      this.annotationTargetFaceKeys = [];
      this.annotationBatchGroupId = "";
    },

    saveAnnotationFromDialog() {
      if (!Array.isArray(this.annotationTargetFaceKeys) || this.annotationTargetFaceKeys.length === 0) {
        toastHelper("noFacesSelected", "warning");
        this.closeAnnotationDialog();
        return;
      }

      const title = String(this.annotationDialogTitleInput?.value || "").trim();
      const description = String(this.annotationDialogDescriptionInput?.value || "").trim();

      if (!title) {
        toastHelper("titleRequired", "warning");
        this.annotationDialogTitleInput?.focus();
        return;
      }

      const selectedFaces = this.annotationTargetFaceKeys
        .map((key) => {
          const selected = this.selectedFaces.find((entry) => entry.key === key);
          if (selected) return selected;
          const existingEntry = this.annotationEntries.find((entry) => entry.key === key);
          if (!existingEntry) return null;
          return {
            key: existingEntry.key,
            targetId: existingEntry.targetId || existingEntry.object || "",
            object: existingEntry.object || existingEntry.targetId || "",
            faceIndex: existingEntry.faceIndex,
          };
        })
        .filter(Boolean);
      if (selectedFaces.length === 0) {
        toastHelper("facesInactive", "warning");
        this.closeAnnotationDialog();
        return;
      }

      const nowIso = new Date().toISOString();
      const groupId = String(this.annotationBatchGroupId || `anno-group-${Date.now()}`);
      let updatedCount = 0;
      let addedCount = 0;

      selectedFaces.forEach((selectedFace) => {
        const faceNumber = Number(selectedFace.faceIndex);
        const normalizedFaceNumber = Number.isInteger(faceNumber) ? faceNumber : -1;
        const annotationTargetId = selectedFace.targetId || selectedFace.object || "";
        const stableTargetToken = Viewer.toStableIdToken(annotationTargetId);
        const existingIndex = this.annotationEntries.findIndex(
          (entry) => entry.key === selectedFace.key
        );
        if (!annotationTargetId || normalizedFaceNumber < 0) return;

        const annotationPayload = {
          id: existingIndex >= 0
            ? this.annotationEntries[existingIndex].id
            : `anno-${stableTargetToken}-f${normalizedFaceNumber}`,
          groupId,
          key: selectedFace.key,
          object: annotationTargetId,
          targetId: annotationTargetId,
          faceIndex: normalizedFaceNumber,
          faceNumbers: [normalizedFaceNumber],
          target: {
            id: annotationTargetId,
            faces: [normalizedFaceNumber],
          },
          title,
          description,
          updatedAt: nowIso,
        };

        if (existingIndex >= 0) {
          annotationPayload.createdAt = this.annotationEntries[existingIndex].createdAt || nowIso;
          this.annotationEntries.splice(existingIndex, 1, annotationPayload);
          updatedCount += 1;
        } else {
          annotationPayload.createdAt = nowIso;
          this.annotationEntries.push(annotationPayload);
          addedCount += 1;
        }
      });

      const totalChanged = updatedCount + addedCount;
      if (totalChanged > 0) {
        toastHelper("annotationsSaved", "success", {
          count: totalChanged,
          plural: totalChanged === 1 ? "" : "s"
        });
      }

      this.refreshAnnotationPOIs();
      this.closeAnnotationDialog();
    },

    getAnnotationEntriesForPersistence() {
      if (!Array.isArray(this.annotationEntries)) return [];

      return this.annotationEntries
        .map((entry, index) => {
          if (!entry || typeof entry !== "object") return null;
          const targetId = String(entry.targetId || entry.object || "").trim();
          const faceNumbersRaw = Array.isArray(entry.faceNumbers)
            ? entry.faceNumbers
            : [entry.faceIndex];
          const faceNumbers = faceNumbersRaw
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 0);
          const faceIndex = faceNumbers[0] ?? Number(entry.faceIndex);
          const normalizedFaceIndex = Number.isInteger(faceIndex) && faceIndex >= 0 ? faceIndex : -1;
          if (!targetId || normalizedFaceIndex < 0) return null;

          const key = this.getFaceSelectionKey(targetId, normalizedFaceIndex);
          const fallbackId = `anno-${this.toStableIdToken(targetId)}-f${normalizedFaceIndex}`;

          return {
            id: String(entry.id || fallbackId),
            groupId: entry.groupId ? String(entry.groupId) : "",
            key,
            object: targetId,
            targetId,
            faceIndex: normalizedFaceIndex,
            faceNumbers: faceNumbers.length > 0 ? faceNumbers : [normalizedFaceIndex],
            target: {
              id: targetId,
              faces: faceNumbers.length > 0 ? faceNumbers : [normalizedFaceIndex],
            },
            title: String(entry.title || "").trim(),
            description: String(entry.description || "").trim(),
            createdAt: entry.createdAt ? String(entry.createdAt) : "",
            updatedAt: entry.updatedAt ? String(entry.updatedAt) : "",
          };
        })
        .filter(Boolean);
    },

    exportAnnotationsToIIIFXml() {
      const entries = this.getAnnotationEntriesForPersistence();
      const doc = document.implementation.createDocument("", "", null);
      const root = doc.createElement("iiif:annotations");
      root.setAttribute("xmlns:iiif", "http://iiif.io/api/presentation/3#");
      root.setAttribute("version", "3.0");
      root.setAttribute("generatedAt", new Date().toISOString());
      doc.appendChild(root);

      entries.forEach((entry) => {
        const annotation = doc.createElement("iiif:annotation");
        annotation.setAttribute("id", entry.id);
        annotation.setAttribute("type", "Annotation");
        annotation.setAttribute("motivation", "commenting");
        if (entry.groupId) {
          annotation.setAttribute("groupId", String(entry.groupId));
        }

        const body = doc.createElement("iiif:body");
        body.setAttribute("type", "TextualBody");
        body.setAttribute("format", "text/plain");

        const titleNode = doc.createElement("iiif:title");
        titleNode.textContent = entry.title || "";
        body.appendChild(titleNode);

        const descriptionNode = doc.createElement("iiif:description");
        descriptionNode.textContent = entry.description || "";
        body.appendChild(descriptionNode);
        annotation.appendChild(body);

        const targetNode = doc.createElement("iiif:target");
        targetNode.setAttribute("id", entry.targetId);
        targetNode.setAttribute("faces", entry.faceNumbers.join(","));
        annotation.appendChild(targetNode);

        root.appendChild(annotation);
      });

      return new XMLSerializer().serializeToString(doc);
    },

    downloadAnnotationsXmlFile() {
      const xml = this.exportAnnotationsToIIIFXml();
      if (!xml) {
        toastHelper("noAnnotationsToExport", "warning");
        return false;
      }

      const defaultBaseName = core.fileObject?.basename || "annotations";
      const safeBaseName = String(defaultBaseName).replace(/[^a-zA-Z0-9._-]+/g, "_");
      const fileName = `${safeBaseName || "annotations"}-iiif-annotations.xml`;
      const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      toastHelper("annotationsExported", "success");
      return true;
    },

    ensureAnnotationImportInput() {
      if (this.annotationImportInput) return this.annotationImportInput;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".xml,text/xml,application/xml";
      input.hidden = true;
      this.bindEventListener(input, "change", async (event) => {
        const target = event?.target;
        const file = target?.files?.[0];
        if (!file) return;

        try {
          const xmlText = await file.text();
          const imported = this.importAnnotationsFromIIIFXml(xmlText);
          if (imported > 0) {
            toastHelper("annotationsImported", "success", {
              count: imported,
              plural: imported === 1 ? "" : "s"
            });
          } else {
            toastHelper("noValidAnnotations", "warning");
          }
        } catch (error) {
          console.error(error);
          toastHelper("annotationsImportError", "error");
        } finally {
          target.value = "";
        }
      });
      document.body.appendChild(input);
      this.annotationImportInput = input;
      return input;
    },

    triggerAnnotationsXmlImport() {
      const input = this.ensureAnnotationImportInput();
      if (!input) return false;
      input.click();
      return true;
    },

    importAnnotationsFromIIIFXml(xmlText) {
      const xml = String(xmlText || "").trim();
      if (!xml) {
        this.annotationEntries = [];
        return 0;
      }

      let doc;
      try {
        doc = new DOMParser().parseFromString(xml, "application/xml");
      } catch (_error) {
        return 0;
      }

      if (!doc || doc.querySelector("parsererror")) {
        return 0;
      }

      const annotations = Array.from(
        doc.querySelectorAll("annotation, iiif\\:annotation")
      );
      const importedEntries = [];

      annotations.forEach((node, index) => {
        const rawId = node.getAttribute("id") || "";
        const rawGroupId = node.getAttribute("groupId") || "";
        const targetNode =
          node.querySelector("target, iiif\\:target") ||
          node.getElementsByTagName("target")[0] ||
          node.getElementsByTagName("iiif:target")[0];
        const targetId = String(targetNode?.getAttribute?.("id") || "").trim();
        const facesAttr = String(targetNode?.getAttribute?.("faces") || "").trim();
        const faceNumbers = facesAttr
          .split(/[,\s;|]+/)
          .filter(Boolean)
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value >= 0);
        const faceIndex = faceNumbers[0];
        if (!targetId || !Number.isInteger(faceIndex)) return;

        const titleNode =
          node.querySelector("title, iiif\\:title, label, iiif\\:label") ||
          node.getElementsByTagName("title")[0] ||
          node.getElementsByTagName("iiif:title")[0];
        const descriptionNode =
          node.querySelector("description, iiif\\:description, value, iiif\\:value") ||
          node.getElementsByTagName("description")[0] ||
          node.getElementsByTagName("iiif:description")[0];

        const key = this.getFaceSelectionKey(targetId, faceIndex);
        importedEntries.push({
          id: rawId || `anno-${this.toStableIdToken(targetId)}-f${faceIndex}-${index}`,
          groupId: rawGroupId ? String(rawGroupId) : "",
          key,
          object: targetId,
          targetId,
          faceIndex,
          faceNumbers: faceNumbers.length > 0 ? faceNumbers : [faceIndex],
          target: {
            id: targetId,
            faces: faceNumbers.length > 0 ? faceNumbers : [faceIndex],
          },
          title: String(titleNode?.textContent || "").trim(),
          description: String(descriptionNode?.textContent || "").trim(),
        });
      });

      this.annotationEntries = importedEntries;
      this.refreshAnnotationPOIs();
      return importedEntries.length;
    },

    hydrateAnnotationsFromMetadataPayload(payload) {
      if (!payload || typeof payload !== "object") {
        this.annotationEntries = [];
        this.refreshAnnotationPOIs();
        return 0;
      }

      const xmlCandidate = payload.iiifAnnotationsXml
        || payload.iiif_annotations_xml
        || payload.annotationsXml
        || payload.annotations_xml
        || "";
      if (typeof xmlCandidate === "string" && xmlCandidate.trim() !== "") {
        return this.importAnnotationsFromIIIFXml(xmlCandidate);
      }

      if (Array.isArray(payload.annotationEntries)) {
        this.annotationEntries = payload.annotationEntries
          .map((entry, index) => {
            const targetId = String(entry?.targetId || entry?.object || entry?.target?.id || "").trim();
            const faceNumbers = Array.isArray(entry?.faceNumbers)
              ? entry.faceNumbers
              : Array.isArray(entry?.target?.faces)
                ? entry.target.faces
                : [entry?.faceIndex];
            const normalizedFaces = faceNumbers
              .map((value) => Number(value))
              .filter((value) => Number.isInteger(value) && value >= 0);
            const faceIndex = normalizedFaces[0];
            if (!targetId || !Number.isInteger(faceIndex)) return null;
            return {
              id: String(entry?.id || `anno-${this.toStableIdToken(targetId)}-f${faceIndex}-${index}`),
              groupId: entry?.groupId ? String(entry.groupId) : "",
              key: this.getFaceSelectionKey(targetId, faceIndex),
              object: targetId,
              targetId,
              faceIndex,
              faceNumbers: normalizedFaces.length > 0 ? normalizedFaces : [faceIndex],
              target: {
                id: targetId,
                faces: normalizedFaces.length > 0 ? normalizedFaces : [faceIndex],
              },
              title: String(entry?.title || "").trim(),
              description: String(entry?.description || "").trim(),
              createdAt: entry?.createdAt ? String(entry.createdAt) : "",
              updatedAt: entry?.updatedAt ? String(entry.updatedAt) : "",
            };
          })
          .filter(Boolean);
        this.refreshAnnotationPOIs();
        return this.annotationEntries.length;
      }

      this.annotationEntries = [];
      this.refreshAnnotationPOIs();
      return 0;
    },

    extractAnnotationsXmlFromExportDocument(doc) {
      if (!doc) return "";
      const node =
        doc.querySelector("iiif\\:annotations, annotations, iiif_annotations, iiif_annotations_xml") ||
        doc.getElementsByTagName("iiif:annotations")[0] ||
        doc.getElementsByTagName("annotations")[0] ||
        doc.getElementsByTagName("iiif_annotations")[0] ||
        doc.getElementsByTagName("iiif_annotations_xml")[0];
      if (!node) return "";

      if (node.tagName === "iiif_annotations_xml") {
        return String(node.textContent || "").trim();
      }

      try {
        return new XMLSerializer().serializeToString(node);
      } catch (_error) {
        return "";
      }
    },

    applyPendingAnnotationsIfAny() {
      const pendingXml = String(this.pendingAnnotationsXml || "").trim();
      if (!pendingXml) return 0;
      const imported = this.importAnnotationsFromIIIFXml(pendingXml);
      this.pendingAnnotationsXml = "";
      return imported;
    },
  });
}

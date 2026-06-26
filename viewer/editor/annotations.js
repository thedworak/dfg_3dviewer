import { core } from "../core.js";
import { toastHelper, showToast } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import THREE from "../init.js";
import { EnvironmentNode } from "three/src/nodes/Nodes.js";

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

    selectAnnotationEntriesFaces(entries) {
      if (!Array.isArray(entries) || entries.length === 0) {
        return;
      }
      this.clearSelectedFaces();
      entries.forEach((entry) => {
        const object = this.resolveObjectByTargetId(entry.targetId);
        if (!object) return;

        const faces = Array.isArray(entry.faceNumbers)
          ? entry.faceNumbers
          : [entry.faceIndex];

        faces.forEach((faceIndex) => {
          this.toggleSelectedFace(
            {
              object,
              faceIndex,
            },
            {
              multiSelect: true,
            }
          );
        });
      });

      this.updateSelectedFacesCount();
    },

    openAnnotationDialogFromPOIMarker(marker) {
      const entries = this.getAnnotationEntriesForPOIMarker(marker);
      if (!entries.length) {
        toastHelper("annotationDataMissing", "warning");
        return false;
      }

      this.selectAnnotationEntriesFaces(entries);
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
        const center = new THREE.Vector3();
        entry.faceNumbers.forEach(faceIndex => {
          const point = this.getFaceCentroidWorld(object, faceIndex);
          if (point) center.add(point);
        });
        center.divideScalar(entry.faceNumbers.length);
        const marker = this.createAnnotationPOIMarker(entry, center, entries.indexOf(entry) + 1);
        group.add(marker);
        this.annotationPOIMarkers.push(marker);
        added += 1;
      });

      group.visible = added > 0;
      return added;
    },

    findAnnotationByFaceKey(key) {
      if (!key) return null;

      return this.annotationEntries.find((annotation) => {
        const targetId = String(
          annotation.targetId ||
          annotation.object ||
          annotation.target?.id ||
          ""
        ).trim();

        if (!targetId) return false;

        const faceNumbers = Array.isArray(annotation.faceNumbers)
          ? annotation.faceNumbers
          : [annotation.faceIndex];

        return faceNumbers.some((faceIndex) => {
          const annotationKey = this.getFaceSelectionKey(
            targetId,
            Number(faceIndex)
          );

          return annotationKey === key;
        });
      }) || null;
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
          const existingEntry = this.findAnnotationByFaceKey(key);
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
      //const groupId = String(this.annotationBatchGroupId || `anno-group-${Date.now()}`);
      let updatedCount = 0;
      let addedCount = 0;

      const targetId = selectedFaces[0].targetId;

      const faceNumbers = selectedFaces
        .map(f => Number(f.faceIndex))
        .filter(Number.isInteger);

      const annotationPayload = {
        id: this.annotationBatchGroupId || `anno-${Date.now()}`,
        targetId,
        object: targetId,

        faceNumbers,
        faceIndex: faceNumbers[0],

        target: {
          id: targetId,
          faces: faceNumbers
        },

        title,
        description,
        updatedAt: nowIso,
        createdAt: nowIso
      };

      const existingIndex = this.annotationEntries.findIndex(
        entry => entry.id === annotationPayload.id
      );

      if (existingIndex >= 0) {
        this.annotationEntries.splice(
          existingIndex,
          1,
          annotationPayload
        );
        updatedCount++;
      } else {
        this.annotationEntries.push(annotationPayload);
        addedCount++;
      }

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
      const groups = new Map();

      entries.forEach((entry) => {
        const key = entry.groupId || entry.id;

        if (!groups.has(key)) {
          groups.set(key, {
            ...entry,
            faceNumbers: [],
          });
        }

        groups.get(key).faceNumbers.push(...entry.faceNumbers);
      });

      const doc = document.implementation.createDocument("", "", null);
      const root = doc.createElement("iiif:annotations");
      root.setAttribute("xmlns:iiif", "http://iiif.io/api/presentation/3#");
      root.setAttribute("version", "3.0");
      root.setAttribute("generatedAt", new Date().toISOString());
      doc.appendChild(root);

      groups.forEach((entry) => {
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

    exportIIIFManifest() { // Added a new method to export the IIIF manifest
      const iiifUrl = core.fileObject?.originalPath || ""; 
      if (!iiifUrl) {
        toastHelper("iiifUrlMissing", "warning");
        return false;
      }
      // Generate the IIIF manifest and log it to the console 
      const sceneId = `${iiifUrl}/scene`;

      const manifest = {
        "@context": "http://iiif.io/api/presentation/4/context.json",

        id: `${iiifUrl}/manifest.json`,
        type: "Manifest",

        label: {
          en: [core.fileObject?.basename || "Model"]
        },

        items: [
          {
            id: sceneId,
            type: "Scene",

            label: {
              en: [core.fileObject?.basename || "Model"]
            },

            backgroundColor: core.scene?.background
              ? `#${core.scene.background.getHexString()}`
              : "#000000",

            items: [
              {
                id: `${sceneId}/page/model`,
                type: "AnnotationPage",

                items: [
                  {
                    id: `${sceneId}/annotation/model`,
                    type: "Annotation",

                    motivation: ["painting"],

                    body: {
                      id: core.fileObject.originalPath,
                      type: "Model",
                      format: core.fileObject.mimeType || undefined
                    },

                    target: {
                      id: sceneId,
                      type: "Scene"
                    }
                  }
                ]
              }
            ],

            annotations: [
              {
                id: `${sceneId}/page/annotations`,
                type: "AnnotationPage",

                items: this.getAnnotationEntriesForPersistence().map((entry) => ({
                  id: String(entry.id),
                  type: "Annotation",

                  motivation: ["commenting"],

                  label: {
                    en: [String(entry.title || "").trim()]
                  },

                  created: entry.createdAt || undefined,
                  modified: entry.updatedAt || undefined,

                  target: {
                    source: core.fileObject.originalPath,

                    selector: {
                      type: "JsonSelector",

                      value: {
                        targetId: entry.targetId,
                        faceIndex: entry.faceIndex,
                        faceNumbers: entry.faceNumbers || [],
                        selectorId: entry.selectorId
                      }
                    }
                  },

                  body: {
                    type: "TextualBody",
                    value: String(entry.description || "").trim()
                  },

                  AIM3DViewer: {
                    groupId: entry.groupId || "",
                    key: entry.key || "",
                    object: entry.object || ""
                  }
                }))
              }
            ]
          }
        ],

        AIM3DViewer: {
          version: "1.0",

          generatedAt: new Date().toISOString(),

          camera: {
            position: core.camera.position.toArray(),

            target: core.controls?.target
              ? core.controls.target.toArray()
              : [0, 0, 0],

            up: core.camera.up.toArray(),

            fov: core.camera.fov,

            zoom:
              typeof core.controls?.zoom === "number"
                ? core.controls.zoom
                : undefined,
            distance:
              core.camera.position.distanceTo(
                core.controls.target
              ),
            perspectiveMode: core.camera.isPerspectiveCamera ? "orthographic" : "perspective",
          },

          viewer: {
            container: core.CONFIG?.viewer?.container || "DLF_AIM_3DViewer",
            mailUrl: core.CONFIG.mainUrl || "https://localhost",
            baseNamespace: "https://localhost",
            metadataUrl: "https://localhost",

            backgroundColor: core.scene?.background?.isColor
              ? `#${core.scene.background.getHexString()}`
              : undefined,
            environmentMap: {
              intensity: core.environmentMapIntensity || 0.5,
              preset: core.environmentMapPreset || "neutral",
              enabled: core.environmentMapEnabled || true
            },
            presentationMode: core.PRESENTATION_MODE || false,
            sandbox: core.SANDBOX_MODE || false,
            scale: core.CONFIG.viewer.scaleContainer || new Vector2(1,1),
            performance: core.CONFIG.viewer.performanceMode || "high-performance",
            units: core.CONFIG?.viewer?.measurement?.modelUnitInMeters,
            gallery: {
              build: core.CONFIG.viewer.gallery?.build || false,
              container: core.CONFIG.viewer.gallery?.container || "AIM3DViewerContainer",
              imageClass: core.CONFIG.viewer.gallery?.imageClass || "AIM3DViewerGalleryImage",
              imageId: core.CONFIG.viewer.gallery?.imageId || "AIM3DViewerGalleryImage",
              buildFake: true,
              testImages: [undefined],
            }
          },

          integration: {
            type: core.CONFIG.entity ? "drupal" : "none",
            bundle: core.CONFIG.entity?.bundle || "bd3d7baa74856d141bcff7b4193fa128",
            fieldDf: core.CONFIG.entity?.fieldDf || "field_df",
            exportViewer: core.CONFIG.entity?.exportViewer || "field_df",
            idUri: core.CONFIG.entity?.idUri || "/wisski/navigate/(.*)/view",
            viewEntityPath: core.CONFIG.entity?.viewEntityPath || "/wisski/navigate/",
            attributeId: core.CONFIG.entity?.attributeId || "wisski_id",
            metadata: {
              source: core.CONFIG.entity?.metadata?.source || "",
            },
            fileUpload: core.CONFIG.viewer.fileUpload || "fbf95bddee5160d515b982b3fd2e05f7",
            fileName: core.CONFIG.viewer.fileName || "faa602a0be629324806aef22892cdbe5",
            imageGeneration: core.CONFIG.viewer.imageGeneration || "f605dc6b727a1099b9e52b3ccbdf5673",
          },

          lights: (core.scene?.children || [])
            .filter((child) =>
              [
                "DirectionalLight",
                "SpotLight",
                "PointLight",
                "AmbientLight"
              ].includes(child.type)
            )
            .map((light) => ({
              type: light.type,

              position: light.position?.toArray?.() || [0, 0, 0],

              target:
                light.target?.position?.toArray?.() || undefined,

              color: `#${light.color.getHexString()}`,

              intensity: light.intensity
            })),

          modelTransform: {
            position:
              core.mainObject?.position?.toArray?.() ||
              [0, 0, 0],

            rotation: core.mainObject?.rotation
              ? {
                  x: core.mainObject.rotation.x,
                  y: core.mainObject.rotation.y,
                  z: core.mainObject.rotation.z,
                  order: core.mainObject.rotation.order
                }
              : {
                  x: 0,
                  y: 0,
                  z: 0,
                  order: "XYZ"
                },

            scale:
              core.mainObject?.scale?.toArray?.() ||
              [1, 1, 1],
            
            wireframe: core.wireframeMode || false,
          }
        },
        modified: new Date().toISOString(),
      };

      manifest.AIM3DViewer.generatedAt = new Date().toISOString();
      core.fileObject?.iiifUrl && (manifest.id = `${core.fileObject?.basename}_manifest.json`);
      const defaultBaseName = core.fileObject?.basename || "manifest";
      const safeBaseName = String(defaultBaseName).replace(/[^a-zA-Z0-9._-]+/g, "_");
      const fileName = `${safeBaseName || "manifest"}-iiif-manifest.json`;
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      
      toastHelper("iiifManifestGenerated", "success");
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

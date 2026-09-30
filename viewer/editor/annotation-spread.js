import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";

// Spread annotations (toggled from the guided tour panel): every annotation
// opens as a card around the model - its number, title and description -
// joined by a line to its point. The cards form a column on each side of the
// model's on-screen box, each on the side its point is on, stacked in the
// order of their points' height so the lines do not cross. Recomputed every
// frame, so the layout follows the camera. Lines start at the edge of the
// POI's number badge, so they run out from under it. Cards whose point faces away from
// the camera are dimmed; the current tour step is highlighted. Clicking a
// card goes to its tour step. Leader lines and spread cards are exclusive.

const MARGIN = 12; // from the canvas edges
const GAP = 8; // between stacked cards
const MODEL_GAP = 24; // between a column and the model's box
const ELBOW = 14; // horizontal run of the line into the card
const SIDE_HYSTERESIS = 0.08; // of the model's screen width
const BADGE_RADIUS = 0.42; // of a POI marker's scale, ring included

export function attachAnnotationSpread(Viewer) {
  Object.assign(Viewer, {
    annotationSpread: false,
    annotationSpreadState: null,

    setAnnotationSpread(enabled) {
      const next = enabled === true;
      if (next && !Viewer.getTourSteps?.().length) return false;
      Viewer.annotationSpread = next;
      if (next && Viewer.annotationLeaderLines) Viewer.setAnnotationLeaderLines(false);
      if (next) {
        Viewer.closeAnnotationPOITooltip?.();
        Viewer.rebuildAnnotationSpread();
      } else {
        Viewer.disposeAnnotationSpread();
      }
      Viewer.syncTourSpreadToggle?.();
      return true;
    },

    toggleAnnotationSpread() {
      return Viewer.setAnnotationSpread(!Viewer.annotationSpread);
    },

    getAnnotationSpreadLayer() {
      const current = Viewer.annotationSpreadState?.layer;
      if (current?.isConnected) return current;
      const canvas = core.renderer?.domElement;
      const host = canvas?.parentElement;
      if (!host) return null;
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      const layer = document.createElement("div");
      layer.className = "annotation-spread-layer";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.classList.add("annotation-spread-lines");
      svg.setAttribute("aria-hidden", "true");
      layer.appendChild(svg);
      host.appendChild(layer);
      return layer;
    },

    disposeAnnotationSpread() {
      Viewer.annotationSpreadState?.layer?.remove();
      Viewer.annotationSpreadState = null;
    },

    // (Re)creates the cards from the current annotations. Called when the
    // spread is switched on, when annotations change and on language change.
    rebuildAnnotationSpread() {
      if (!Viewer.annotationSpread) return;
      const steps = Viewer.getTourSteps?.() || [];
      if (!steps.length) {
        Viewer.annotationSpread = false;
        Viewer.disposeAnnotationSpread();
        Viewer.syncTourSpreadToggle?.();
        return;
      }

      const previousSides = new Map(
        (Viewer.annotationSpreadState?.items || []).map((item) => [item.id, item.side])
      );
      Viewer.disposeAnnotationSpread();
      const layer = Viewer.getAnnotationSpreadLayer();
      if (!layer) return;
      const svg = layer.querySelector(".annotation-spread-lines");
      layer.setAttribute("aria-label", t("tour.spreadLayer", "Annotations"));
      layer.setAttribute("role", "list");

      const items = steps.map(({ entry, markerNumber }, index) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "annotation-spread-card";
        card.setAttribute("role", "listitem");
        const badge = document.createElement("span");
        badge.className = "annotation-spread-card_number";
        badge.textContent = String(markerNumber);
        const title = document.createElement("span");
        title.className = "annotation-spread-card_title";
        title.textContent = entry.title || t("tour.untitled", "Untitled annotation");
        const header = document.createElement("span");
        header.className = "annotation-spread-card_header";
        header.append(badge, title);
        card.appendChild(header);
        if (entry.description) {
          const description = document.createElement("span");
          description.className = "annotation-spread-card_description";
          description.textContent = entry.description;
          card.appendChild(description);
        }
        card.title = entry.description ? `${title.textContent}\n\n${entry.description}` : title.textContent;
        card.addEventListener("pointerdown", (event) => event.stopPropagation());
        card.addEventListener("click", () => Viewer.goToAnnotationSpreadStep(index));
        layer.appendChild(card);

        const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        line.classList.add("annotation-spread-line");
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.classList.add("annotation-spread-dot");
        dot.setAttribute("r", "3.5");
        svg.append(line, dot);

        return {
          id: String(entry.id),
          anchor: Viewer.getAnnotationEntryCenter(entry),
          normal: Viewer.getAnnotationEntryNormal?.(entry) || null,
          card,
          line,
          dot,
          side: previousSides.get(String(entry.id)) || null,
          width: 0,
          height: 0,
          fullHeight: 0,
          compactHeight: 0,
          compact: false,
          shown: true,
          dimmed: false,
          current: false,
        };
      });

      Viewer.annotationSpreadState = {
        layer,
        svg,
        items,
        box: Viewer.getAnnotationSpreadModelBox(),
        measuredWidth: 0,
      };
      Viewer.updateAnnotationSpread();
    },

    getAnnotationSpreadModelBox() {
      const roots = (Array.isArray(core.mainObject) ? core.mainObject : [core.mainObject])
        .flat()
        .filter((item) => item?.isObject3D);
      const box = new THREE.Box3();
      roots.forEach((root) => box.expandByObject(root));
      return box.isEmpty() ? null : box;
    },

    goToAnnotationSpreadStep(index) {
      if (Viewer.isTourActive?.()) {
        Viewer.pauseTour?.();
        Viewer.goToTourStep?.(index);
      } else {
        Viewer.startTour?.({ autoplay: false, startStep: index });
      }
    },

    // Card size follows the canvas width; heights (with and without the
    // description) are measured again only when that width changes.
    measureAnnotationSpreadCards(canvasWidth) {
      const state = Viewer.annotationSpreadState;
      const cardWidth = Math.round(Math.min(240, Math.max(112, canvasWidth * 0.24)));
      if (state.measuredWidth === cardWidth) return;
      state.measuredWidth = cardWidth;
      state.layer.style.setProperty("--annotation-spread-card-width", `${cardWidth}px`);
      state.items.forEach((item) => {
        item.card.hidden = false;
        item.shown = true;
        item.card.classList.remove("is-compact");
        item.width = item.card.offsetWidth;
        item.fullHeight = item.card.offsetHeight;
        item.card.classList.add("is-compact");
        item.compactHeight = item.card.offsetHeight;
        item.card.classList.toggle("is-compact", item.compact);
      });
    },

    // The model's bounding box projected to layer pixels.
    projectAnnotationSpreadBox(box, toScreen) {
      if (!box) return null;
      const rect = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
      const corner = new THREE.Vector3();
      for (let i = 0; i < 8; i += 1) {
        corner.set(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z
        );
        const point = toScreen(corner);
        if (!point) continue;
        rect.left = Math.min(rect.left, point.x);
        rect.right = Math.max(rect.right, point.x);
        rect.top = Math.min(rect.top, point.y);
        rect.bottom = Math.max(rect.bottom, point.y);
      }
      return Number.isFinite(rect.left) ? rect : null;
    },

    // Vertical room for a column: below the floating panels at the top
    // (tour panel, metadata card) and above the editor toolbar, where they
    // overlap the column's horizontal range.
    getAnnotationSpreadColumnBounds(layerRect, left, right) {
      let top = MARGIN;
      let bottom = layerRect.height - MARGIN;
      const obstacles = [
        ...(core.container?.querySelectorAll?.(":scope > .viewer-side-stack > *") || []),
        document.getElementById("metadata-card"),
        core.editorToolbar,
      ];
      obstacles.forEach((element) => {
        if (!element || element.hidden) return;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const x0 = rect.left - layerRect.left;
        const x1 = rect.right - layerRect.left;
        if (x1 < left || x0 > right) return;
        const y0 = rect.top - layerRect.top;
        const y1 = rect.bottom - layerRect.top;
        if (y1 <= layerRect.height / 2) top = Math.max(top, y1 + GAP);
        else if (y0 >= layerRect.height / 2) bottom = Math.min(bottom, y0 - GAP);
      });
      return { top, bottom: Math.max(bottom, top) };
    },

    // Stacks cards (sorted by their anchor) as close to their anchors'
    // heights as possible without overlapping, within [top, bottom].
    stackAnnotationSpreadColumn(column, top, bottom) {
      column.sort((a, b) => a.screen.y - b.screen.y);
      let cursor = top;
      column.forEach((item) => {
        item.y = Math.max(cursor, item.screen.y - item.height / 2);
        cursor = item.y + item.height + GAP;
      });
      let limit = bottom;
      for (let i = column.length - 1; i >= 0; i -= 1) {
        const item = column[i];
        item.y = Math.max(top, Math.min(item.y, limit - item.height));
        limit = item.y - GAP;
      }
    },

    // Called from the render loop.
    updateAnnotationSpread() {
      const state = Viewer.annotationSpreadState;
      if (!state || !core.camera) return;
      const canvas = core.renderer?.domElement;
      if (!canvas || !state.layer.isConnected) return;
      const canvasRect = canvas.getBoundingClientRect();
      const layerRect = state.layer.getBoundingClientRect();
      if (canvasRect.width <= 0 || canvasRect.height <= 0) return;
      const offsetX = canvasRect.left - layerRect.left;
      const offsetY = canvasRect.top - layerRect.top;
      const width = layerRect.width;
      const height = layerRect.height;

      Viewer.measureAnnotationSpreadCards(width);

      const projected = new THREE.Vector3();
      const toScreen = (point) => {
        projected.copy(point).project(core.camera);
        if (projected.z < -1 || projected.z > 1) return null;
        return {
          x: offsetX + ((projected.x + 1) / 2) * canvasRect.width,
          y: offsetY + ((1 - projected.y) / 2) * canvasRect.height,
        };
      };

      const modelRect = Viewer.projectAnnotationSpreadBox(state.box, toScreen)
        || { left: width / 2, right: width / 2, top: height / 2, bottom: height / 2 };
      const centerX = (modelRect.left + modelRect.right) / 2;
      const hysteresis = Math.max(modelRect.right - modelRect.left, 1) * SIDE_HYSTERESIS;

      const currentId = String(Viewer.tourState?.steps?.[Viewer.tourState.index]?.entry?.id ?? "");
      const toCamera = new THREE.Vector3();
      const cameraRight = new THREE.Vector3().setFromMatrixColumn(core.camera.matrixWorld, 0);
      const badgeEdge = new THREE.Vector3();
      const markers = new Map((Viewer.annotationPOIMarkers || [])
        .map((marker) => [String(marker.userData?.annotationId ?? ""), marker]));
      const columns = { left: [], right: [] };
      state.items.forEach((item) => {
        const screen = item.anchor ? toScreen(item.anchor) : null;
        const inside = screen && screen.x >= 0 && screen.x <= width && screen.y >= 0 && screen.y <= height;
        item.screen = inside ? screen : null;
        if (!inside) return;
        const dx = screen.x - centerX;
        if (!item.side || Math.abs(dx) > hysteresis) item.side = dx < 0 ? "left" : "right";
        columns[item.side].push(item);
      });

      const cardWidth = state.measuredWidth;
      const maxLeftEdge = Math.max(MARGIN, width / 2 - cardWidth - GAP);
      const minRightEdge = Math.min(width - MARGIN - cardWidth, width / 2 + GAP);
      const leftX = Math.min(maxLeftEdge, Math.max(MARGIN, modelRect.left - MODEL_GAP - cardWidth));
      const rightX = Math.max(minRightEdge, Math.min(width - MARGIN - cardWidth, modelRect.right + MODEL_GAP));
      const bounds = {
        left: Viewer.getAnnotationSpreadColumnBounds(layerRect, leftX, leftX + cardWidth),
        right: Viewer.getAnnotationSpreadColumnBounds(layerRect, rightX, rightX + cardWidth),
      };

      // Keep the columns balanced when one would not fit: the cards whose
      // points are nearest the middle move across.
      const fits = (side) => columns[side].reduce((sum, item) => sum + GAP + item.fullHeight, -GAP)
        <= bounds[side].bottom - bounds[side].top;
      ["left", "right"].forEach((from) => {
        const to = from === "left" ? "right" : "left";
        const source = columns[from];
        while (!fits(from) && source.length > columns[to].length + 1) {
          source.sort((a, b) => Math.abs(a.screen.x - centerX) - Math.abs(b.screen.x - centerX));
          const moved = source.shift();
          moved.side = to;
          columns[to].push(moved);
        }
      });

      // A column that is still too tall shows titles only (the current
      // step keeps its description).
      [["left", leftX], ["right", rightX]].forEach(([side, x]) => {
        const column = columns[side];
        if (!column.length) return;
        const compact = !fits(side);
        column.forEach((item) => {
          item.x = x;
          const itemCompact = compact && item.id !== currentId;
          if (item.compact !== itemCompact) {
            item.compact = itemCompact;
            item.card.classList.toggle("is-compact", itemCompact);
          }
          item.height = itemCompact ? item.compactHeight : item.fullHeight;
        });
        Viewer.stackAnnotationSpreadColumn(column, bounds[side].top, bounds[side].bottom);
      });

      state.items.forEach((item) => {
        const shown = !!item.screen;
        if (item.shown !== shown) {
          item.shown = shown;
          item.card.hidden = !shown;
          item.line.style.display = shown ? "" : "none";
          if (!shown) item.dot.style.display = "none";
        }
        if (!shown) return;

        let dimmed = false;
        if (item.normal) {
          toCamera.copy(core.camera.position).sub(item.anchor);
          dimmed = toCamera.dot(item.normal) < 0;
        }
        const current = item.id === currentId;
        if (item.dimmed !== dimmed) {
          item.dimmed = dimmed;
          item.card.classList.toggle("is-behind", dimmed);
          item.line.classList.toggle("is-behind", dimmed);
          item.dot.classList.toggle("is-behind", dimmed);
        }
        if (item.current !== current) {
          item.current = current;
          item.card.classList.toggle("is-current", current);
          item.line.classList.toggle("is-current", current);
          item.dot.classList.toggle("is-current", current);
          if (current) item.card.setAttribute("aria-current", "step");
          else item.card.removeAttribute("aria-current");
        }

        item.card.style.transform = `translate(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px)`;
        const edgeX = item.side === "left" ? item.x + item.width : item.x;
        const elbowX = item.side === "left" ? edgeX + ELBOW : edgeX - ELBOW;
        // Joins the card beside its title.
        const edgeY = item.y + Math.min(item.height / 2, 16);
        const { x, y } = item.screen;

        // The badge's on-screen radius (it grows while it is the current
        // step); without a marker a dot marks the point instead.
        const marker = markers.get(item.id);
        let badgeRadius = 0;
        if (marker) {
          badgeEdge.copy(item.anchor).addScaledVector(cameraRight, marker.scale.x * BADGE_RADIUS);
          const edge = toScreen(badgeEdge);
          if (edge) badgeRadius = Math.hypot(edge.x - x, edge.y - y);
        }
        item.dot.style.display = marker ? "none" : "";
        const dx = elbowX - x;
        const dy = edgeY - y;
        const length = Math.hypot(dx, dy);
        const start = length > badgeRadius
          ? { x: x + (dx / length) * badgeRadius, y: y + (dy / length) * badgeRadius }
          : { x: elbowX, y: edgeY };
        item.line.setAttribute("points", `${start.x.toFixed(1)},${start.y.toFixed(1)} ${elbowX.toFixed(1)},${edgeY.toFixed(1)} ${edgeX.toFixed(1)},${edgeY.toFixed(1)}`);
        item.dot.setAttribute("cx", x.toFixed(1));
        item.dot.setAttribute("cy", y.toFixed(1));
      });
    },
  });
}

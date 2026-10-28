import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import THREE from "../init.js";
import { getViewerSideStack } from "../ui/side-stack.js";
import { toastHelper } from "../viewer-utils.js";

// Historical photographs over the model. Each photo is kept with the camera
// it was taken from (position, target, vertical field of view and a roll):
// opening it flies the camera there and lays the photo over the canvas,
// faded in, or cut by a divider (swipe), so the reconstruction can be checked
// against its source. A photo with a `year` also sets the 4D timeline
// (timeline.js) to that year.
//
// The photo is fitted to the canvas height, which the camera's vertical field
// of view spans, so the two line up at any canvas width. Moving the camera
// away hides the photo until its view is restored; while aligning, it stays,
// and the camera, the field of view and the roll are set to match the photo,
// then saved as its view.
//
// Photos come from the manifest (AIM3DViewer.photos) or are added in the
// panel (Annotations > Historical photos) by URL - a plain image or a IIIF
// Image API service - or from a file (kept for this session only: a local
// file has no URL to export).
//
// On a phone, a photo can also be laid over the place itself, through the
// camera (photo-onsite.js).

const DEFAULT_OPACITY = 0.6;
const FLIGHT_MS = 1200;
// The camera counts as at the photo's view while within this share of the
// view's distance (and the field of view within FOV_TOLERANCE degrees).
const POSE_TOLERANCE = 0.01;
const FOV_TOLERANCE = 0.5;
// Size asked of a IIIF Image API service (fits in this box).
const IIIF_SIZE = 2000;

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function readText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(readText).filter(Boolean).join("\n");
  if (isPlainObject(value)) {
    const lang = core.currentLanguage || "en";
    return readText(value[lang] ?? value.en ?? value.none ?? Object.values(value)[0]);
  }
  return String(value);
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2;
}

function toVector(value) {
  const values = typeof value === "string" ? value.split(/[,\s;]+/).filter(Boolean).map(Number) : value;
  if (Array.isArray(values) && values.length >= 3 && values.slice(0, 3).every((v) => Number.isFinite(Number(v)))) {
    return new THREE.Vector3(Number(values[0]), Number(values[1]), Number(values[2]));
  }
  if (isPlainObject(value) && ["x", "y", "z"].every((key) => Number.isFinite(Number(value[key])))) {
    return new THREE.Vector3(Number(value.x), Number(value.y), Number(value.z));
  }
  return null;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// The image URL of a photo: `src` as it is, or the image of a IIIF Image API
// service (`service`, or a `src` ending in info.json).
export function resolvePhotoSource(raw) {
  const service = typeof raw?.service === "string" ? raw.service
    : typeof raw?.service?.id === "string" ? raw.service.id
      : typeof raw?.service?.["@id"] === "string" ? raw.service["@id"] : null;
  const src = typeof raw?.src === "string" ? raw.src.trim() : "";
  const base = service || (/\/info\.json$/i.test(src) ? src.replace(/\/info\.json$/i, "") : null);
  if (base) return `${base.replace(/\/+$/, "")}/full/!${IIIF_SIZE},${IIIF_SIZE}/0/default.jpg`;
  return src;
}

function normalizePhoto(raw, index) {
  if (!isPlainObject(raw)) return null;
  const src = resolvePhotoSource(raw);
  if (!src) return null;
  const view = isPlainObject(raw.view) ? raw.view : {};
  const position = toVector(view.position);
  const target = toVector(view.target);
  const fov = Number(view.fov);
  const year = Number(raw.year);
  const roll = Number(view.roll);
  const opacity = Number(raw.opacity);
  return {
    id: String(raw.id ?? `photo-${index + 1}`),
    label: raw.label ?? "",
    description: raw.description ?? "",
    source: raw.source ?? null,
    year: raw.year != null && raw.year !== "" && Number.isFinite(year) ? year : null,
    src,
    raw: {
      ...(typeof raw.src === "string" ? { src: raw.src } : {}),
      ...(raw.service != null ? { service: raw.service } : {}),
    },
    view: position && target
      ? { position, target, fov: Number.isFinite(fov) && fov > 0 && fov < 180 ? fov : null, roll: Number.isFinite(roll) ? roll : 0 }
      : null,
    opacity: Number.isFinite(opacity) && opacity >= 0 && opacity <= 1 ? opacity : null,
    // A local file has no URL to export.
    exportable: raw.exportable !== false,
    objectUrl: raw.objectUrl === true ? src : null,
  };
}

export function attachPhotoOverlay(Viewer) {
  Object.assign(Viewer, {
    photosState: null,

    getPhotosState() {
      if (!Viewer.photosState) {
        Viewer.photosState = {
          items: [],
          openId: null,
          opacity: DEFAULT_OPACITY,
          swipe: false,
          swipePosition: 0.5,
          aligning: false,
          flight: null,
          showPanel: true,
          panelOpen: false,
          ui: null,
          overlay: null,
        };
      }
      return Viewer.photosState;
    },

    getPhotos() {
      return Viewer.photosState?.items || [];
    },

    getOpenPhoto() {
      const state = Viewer.photosState;
      return state?.items.find((item) => item.id === state.openId) || null;
    },

    // Replaces the list (a manifest's photos, or none).
    setPhotos(list = []) {
      Viewer.closePhotoOnSite?.();
      Viewer.closePhoto();
      const state = Viewer.getPhotosState();
      state.items.forEach((item) => item.objectUrl && URL.revokeObjectURL(item.objectUrl));
      const seen = new Set();
      state.items = (Array.isArray(list) ? list : [])
        .map((raw, index) => normalizePhoto(raw, index))
        .filter((item) => item && !seen.has(item.id) && seen.add(item.id));
      Viewer.renderPhotosList();
      return state.items;
    },

    // A photo seen from the current camera, by URL or from a File.
    addPhoto({ src = "", service = null, file = null, label = "", year = null, open = true } = {}) {
      const state = Viewer.getPhotosState();
      let id = `photo-${state.items.length + 1}`;
      while (state.items.some((item) => item.id === id)) id = `${id}-1`;
      const objectUrl = file ? URL.createObjectURL(file) : null;
      const view = Viewer.captureCurrentAnnotationView?.() || null;
      const item = normalizePhoto({
        id,
        src: objectUrl || src,
        service,
        label: label || file?.name || "",
        year,
        view: view ? { ...view, roll: 0 } : undefined,
        exportable: !file,
        objectUrl: Boolean(objectUrl),
      }, state.items.length);
      if (!item) return null;
      state.items.push(item);
      Viewer.renderPhotosList();
      if (open) {
        // Taken from here: lined up by hand next.
        Viewer.openPhoto(item.id, { fly: false });
        Viewer.setPhotoAligning(true);
      }
      return item;
    },

    removePhoto(id) {
      const state = Viewer.photosState;
      const index = state?.items.findIndex((item) => item.id === id) ?? -1;
      if (index < 0) return false;
      if (Viewer.photoOnSite?.item.id === id) Viewer.closePhotoOnSite();
      if (state.openId === id) Viewer.closePhoto();
      const [item] = state.items.splice(index, 1);
      if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
      Viewer.renderPhotosList();
      return true;
    },

    // Flies to the photo's view and lays the photo over the canvas.
    openPhoto(id, { fly = true } = {}) {
      const state = Viewer.photosState;
      const item = state?.items.find((entry) => entry.id === String(id));
      if (!item) return false;
      state.openId = item.id;
      state.aligning = false;
      if (item.opacity != null) state.opacity = item.opacity;
      if (item.year != null && Viewer.hasTimeline?.()) {
        Viewer.pauseTimeline?.();
        Viewer.setTimelineYear?.(item.year);
      }
      Viewer.ensurePhotoOverlay();
      state.overlay.image.src = item.src;
      state.overlay.image.alt = readText(item.label);
      if (fly) Viewer.flyToPhotoView(item);
      Viewer.syncPhotosPanel();
      Viewer.syncPhotoOverlay(true);
      return true;
    },

    closePhoto() {
      const state = Viewer.photosState;
      if (!state) return;
      state.openId = null;
      state.aligning = false;
      state.flight = null;
      state.overlay?.root.remove();
      state.overlay = null;
      Viewer.syncPhotosPanel();
    },

    flyToPhotoView(item = Viewer.getOpenPhoto()) {
      const state = Viewer.photosState;
      if (!state || !item?.view || !core.camera || !core.controls) return false;
      core.cameraTweenToken = (core.cameraTweenToken ?? 0) + 1;
      core.cameraTween?.stop?.();
      core.targetTween?.stop?.();
      const perspective = core.camera.isPerspectiveCamera;
      state.flight = {
        startTime: performance.now(),
        duration: window.__E2E__ ? 0 : FLIGHT_MS,
        fromPosition: core.camera.position.clone(),
        fromTarget: core.controls.target.clone(),
        toPosition: item.view.position.clone(),
        toTarget: item.view.target.clone(),
        fromFov: perspective ? core.camera.fov : null,
        toFov: perspective && item.view.fov != null ? item.view.fov : (perspective ? core.camera.fov : null),
      };
      Viewer.updatePhotoOverlay(state.flight.startTime);
      return true;
    },

    // Is the camera where the photo was taken from?
    isAtPhotoView(item = Viewer.getOpenPhoto()) {
      if (!item?.view || !core.camera || !core.controls) return true;
      const distance = Math.max(item.view.position.distanceTo(item.view.target), 1e-6);
      const tolerance = distance * POSE_TOLERANCE;
      if (core.camera.position.distanceTo(item.view.position) > tolerance) return false;
      if (core.controls.target.distanceTo(item.view.target) > tolerance) return false;
      if (core.camera.isPerspectiveCamera && item.view.fov != null && Math.abs(core.camera.fov - item.view.fov) > FOV_TOLERANCE) return false;
      return true;
    },

    setPhotoOpacity(value) {
      const state = Viewer.photosState;
      const opacity = Number(value);
      if (!state || !Number.isFinite(opacity)) return;
      state.opacity = Math.min(Math.max(opacity, 0), 1);
      Viewer.syncPhotoOverlay(true);
      Viewer.syncPhotosPanel();
    },

    setPhotoSwipe(enabled, position = null) {
      const state = Viewer.photosState;
      if (!state) return;
      state.swipe = enabled === true;
      if (position != null && Number.isFinite(Number(position))) state.swipePosition = Math.min(Math.max(Number(position), 0), 1);
      Viewer.syncPhotoOverlay(true);
      Viewer.syncPhotosPanel();
    },

    // Aligning: the photo stays while the camera moves; the field of view
    // and the roll are set in the panel; "Save view" keeps the pose.
    setPhotoAligning(enabled) {
      const state = Viewer.photosState;
      if (!state?.openId) return;
      state.aligning = enabled === true;
      if (state.aligning) state.flight = null;
      Viewer.syncPhotosPanel();
      Viewer.syncPhotoOverlay(true);
    },

    setPhotoFov(fov) {
      const value = Number(fov);
      if (!core.camera?.isPerspectiveCamera || !Number.isFinite(value) || value <= 1 || value >= 179) return;
      core.camera.fov = value;
      core.camera.updateProjectionMatrix();
      Viewer.syncPhotosPanel();
    },

    setPhotoRoll(roll) {
      const item = Viewer.getOpenPhoto();
      const value = Number(roll);
      if (!item || !Number.isFinite(value)) return;
      if (!item.view) item.view = { position: core.camera.position.clone(), target: core.controls.target.clone(), fov: core.camera.fov ?? null, roll: 0 };
      item.view.roll = value;
      Viewer.syncPhotoOverlay(true);
      Viewer.syncPhotosPanel();
    },

    // The current camera as the open photo's view.
    savePhotoView() {
      const item = Viewer.getOpenPhoto();
      if (!item || !core.camera || !core.controls) return false;
      item.view = {
        position: core.camera.position.clone(),
        target: core.controls.target.clone(),
        fov: core.camera.isPerspectiveCamera ? core.camera.fov : null,
        roll: item.view?.roll ?? 0,
      };
      item.opacity = Viewer.photosState.opacity;
      Viewer.setPhotoAligning(false);
      toastHelper("photoViewSaved", "success");
      return true;
    },

    // Every frame (main.js animate): the flight to a photo, and the overlay.
    updatePhotoOverlay(time = performance.now()) {
      const state = Viewer.photosState;
      if (!state?.openId) return;
      const flight = state.flight;
      if (flight) {
        const progress = flight.duration > 0 ? Math.min(1, (time - flight.startTime) / flight.duration) : 1;
        const eased = easeInOutCubic(Math.max(0, progress));
        core.camera.position.lerpVectors(flight.fromPosition, flight.toPosition, eased);
        core.controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased);
        core.cameraLight?.position?.copy?.(core.camera.position);
        if (flight.fromFov != null && flight.toFov != null && flight.fromFov !== flight.toFov) {
          core.camera.fov = THREE.MathUtils.lerp(flight.fromFov, flight.toFov, eased);
          core.camera.updateProjectionMatrix();
        }
        core.controls.update();
        if (progress >= 1) state.flight = null;
      }
      Viewer.syncPhotoOverlay();
    },

    ensurePhotoOverlay() {
      const state = Viewer.photosState;
      if (state.overlay || !core.container) return;
      const root = document.createElement("div");
      root.className = "viewer-photo-overlay";
      root.id = "viewerPhotoOverlay";
      const frame = document.createElement("div");
      frame.className = "viewer-photo-overlay_frame";
      const image = document.createElement("img");
      image.className = "viewer-photo-overlay_image";
      image.decoding = "async";
      image.crossOrigin = "anonymous";
      image.addEventListener("load", () => Viewer.syncPhotoOverlay(true));
      image.addEventListener("error", () => {
        // Without CORS headers the image still shows, just not read back.
        if (image.crossOrigin) {
          image.removeAttribute("crossorigin");
          image.src = image.src;
          return;
        }
        toastHelper("photoLoadFailed", "error");
      });
      frame.append(image);
      const divider = document.createElement("div");
      divider.className = "viewer-photo-overlay_divider";
      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "viewer-photo-overlay_handle";
      handle.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M9 6.5v11L3.5 12zM15 6.5v11l5.5-5.5z"/></svg>';
      divider.append(handle);
      root.append(frame, divider);
      ["pointerdown", "pointerup", "wheel", "keydown", "click"].forEach((type) => {
        handle.addEventListener(type, (event) => event.stopPropagation());
      });
      let dragging = false;
      handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        handle.setPointerCapture?.(event.pointerId);
        dragging = true;
      });
      handle.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        const rect = root.getBoundingClientRect();
        Viewer.setPhotoSwipe(true, (event.clientX - rect.left) / Math.max(rect.width, 1));
      });
      const end = (event) => {
        dragging = false;
        handle.releasePointerCapture?.(event.pointerId);
      };
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
      handle.addEventListener("keydown", (event) => {
        const step = event.shiftKey ? 0.1 : 0.02;
        if (event.key === "ArrowLeft") Viewer.setPhotoSwipe(true, state.swipePosition - step);
        else if (event.key === "ArrowRight") Viewer.setPhotoSwipe(true, state.swipePosition + step);
        else return;
        event.preventDefault();
      });
      core.container.append(root);
      state.overlay = { root, frame, image, divider, handle, shown: "" };
      Viewer.updatePhotosLabels();
    },

    // Fits the photo to the canvas; only touches the DOM when something changed.
    syncPhotoOverlay(force = false) {
      const state = Viewer.photosState;
      const overlay = state?.overlay;
      const item = Viewer.getOpenPhoto();
      if (!overlay || !item) return;
      const canvas = core.renderer?.domElement;
      const container = core.container;
      if (!canvas || !container) return;
      const canvasRect = canvas.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const left = Math.round(canvasRect.left - containerRect.left + container.scrollLeft);
      const top = Math.round(canvasRect.top - containerRect.top + container.scrollTop);
      const width = Math.round(canvasRect.width);
      const height = Math.round(canvasRect.height);
      const naturalWidth = overlay.image.naturalWidth || 0;
      const naturalHeight = overlay.image.naturalHeight || 0;
      const away = !state.aligning && !state.flight && !Viewer.isAtPhotoView(item);
      const roll = item.view?.roll ?? 0;
      const key = [left, top, width, height, naturalWidth, naturalHeight, state.opacity, state.swipe, state.swipePosition.toFixed(4), away, state.aligning, roll, Boolean(state.flight)].join("|");
      if (!force && key === overlay.shown) return;
      overlay.shown = key;

      Object.assign(overlay.root.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
      // The canvas height is the vertical field of view: the photo fills it.
      const aspect = naturalWidth && naturalHeight ? naturalWidth / naturalHeight : width / Math.max(height, 1);
      const frameWidth = height * aspect;
      Object.assign(overlay.frame.style, {
        width: `${frameWidth}px`,
        height: `${height}px`,
        left: `${(width - frameWidth) / 2}px`,
        transform: roll ? `rotate(${roll}deg)` : "",
      });
      overlay.image.style.opacity = state.swipe ? "1" : String(state.opacity);
      // Swipe: the photo on the left of the divider, the model on the right.
      const cut = state.swipePosition * width - (width - frameWidth) / 2;
      overlay.frame.style.clipPath = state.swipe ? `inset(0 ${Math.max(frameWidth - cut, 0)}px 0 0)` : "";
      overlay.divider.hidden = !state.swipe;
      overlay.divider.style.left = `${state.swipePosition * 100}%`;
      overlay.root.classList.toggle("is-away", away || Boolean(state.flight));
      overlay.root.classList.toggle("is-aligning", state.aligning);
      if (state.ui) state.ui.returnButton.hidden = !away;
    },

    // ---- panel ----------------------------------------------------------------

    togglePhotosPanel(open) {
      const state = Viewer.getPhotosState();
      const next = typeof open === "boolean" ? open : !state.ui;
      if (next && !state.ui) Viewer.createPhotosPanel();
      else if (!next && state.ui) {
        state.ui.panel.remove();
        state.ui = null;
      }
      state.panelOpen = next;
      Viewer.updateEditorToolbarState?.();
      return next;
    },

    isPhotosPanelOpen() {
      return Boolean(Viewer.photosState?.ui);
    },

    createPhotosPanel() {
      const state = Viewer.getPhotosState();
      if (state.ui || !core.container) return;
      const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
      };
      const panel = el("section", "viewer-photos");
      panel.id = "viewerPhotos";
      panel.setAttribute("role", "group");
      const header = el("div", "viewer-photos_header");
      const title = el("span", "viewer-photos_title");
      const closeButton = el("button", "viewer-photos_icon", "×");
      closeButton.type = "button";
      header.append(title, closeButton);

      const pickHint = el("p", "viewer-photos_hint viewer-photos_pick");
      const list = el("div", "viewer-photos_list");
      const empty = el("p", "viewer-photos_empty");

      // The photo shown: its texts and how it lies over the model.
      const card = el("div", "viewer-photos_card");
      const cardTitle = el("strong", "viewer-photos_card-title");
      const description = el("p", "viewer-photos_description");
      const source = el("p", "viewer-photos_source");
      const opacityRow = el("label", "viewer-photos_row");
      const opacityLabel = el("span");
      const opacity = el("input");
      opacity.type = "range";
      opacity.min = "0";
      opacity.max = "1";
      opacity.step = "0.01";
      opacityRow.append(opacityLabel, opacity);
      const swipeRow = el("label", "viewer-photos_row viewer-photos_check");
      const swipe = el("input");
      swipe.type = "checkbox";
      const swipeLabel = el("span");
      swipeRow.append(swipe, swipeLabel);
      const actions = el("div", "viewer-photos_actions");
      const returnButton = el("button", "viewer-photos_button");
      returnButton.type = "button";
      const alignButton = el("button", "viewer-photos_button");
      alignButton.type = "button";
      const hideButton = el("button", "viewer-photos_button");
      hideButton.type = "button";
      // The photo over the place itself, through the phone's camera.
      const onSiteButton = el("button", "viewer-photos_button viewer-photos_onsite");
      onSiteButton.type = "button";
      onSiteButton.hidden = !Viewer.isPhotoOnSiteAvailable?.();
      actions.append(returnButton, alignButton, hideButton, onSiteButton);

      // Aligning: the camera's lens and roll set to the photo's.
      const align = el("div", "viewer-photos_align");
      const alignHint = el("p", "viewer-photos_hint");
      const fovRow = el("label", "viewer-photos_row");
      const fovLabel = el("span");
      const fov = el("input");
      fov.type = "range";
      fov.min = "5";
      fov.max = "120";
      fov.step = "0.5";
      const fovValue = el("output", "viewer-photos_value");
      fovRow.append(fovLabel, fov, fovValue);
      const rollRow = el("label", "viewer-photos_row");
      const rollLabel = el("span");
      const roll = el("input");
      roll.type = "range";
      roll.min = "-20";
      roll.max = "20";
      roll.step = "0.1";
      const rollValue = el("output", "viewer-photos_value");
      rollRow.append(rollLabel, roll, rollValue);
      const alignActions = el("div", "viewer-photos_actions");
      const saveButton = el("button", "viewer-photos_button is-primary");
      saveButton.type = "button";
      const removeButton = el("button", "viewer-photos_button");
      removeButton.type = "button";
      alignActions.append(saveButton, removeButton);
      align.append(alignHint, fovRow, rollRow, alignActions);
      card.append(cardTitle, description, source, opacityRow, swipeRow, actions, align);

      // Adding a photo: a URL (image or IIIF Image API) or a file.
      // Folded while there are photos to look at.
      const addBox = el("details", "viewer-photos_add-box");
      const addTitle = el("summary", "viewer-photos_add-title");
      const add = el("form", "viewer-photos_add");
      const urlInput = el("input", "viewer-photos_input");
      // Text, not "url": relative URLs ("./examples/...") are fine too.
      urlInput.type = "text";
      urlInput.inputMode = "url";
      urlInput.name = "url";
      const labelInput = el("input", "viewer-photos_input");
      labelInput.type = "text";
      const yearInput = el("input", "viewer-photos_input viewer-photos_year");
      yearInput.type = "number";
      yearInput.step = "1";
      const addRow = el("div", "viewer-photos_actions");
      const addButton = el("button", "viewer-photos_button is-primary");
      addButton.type = "submit";
      const fileButton = el("button", "viewer-photos_button");
      fileButton.type = "button";
      const fileInput = el("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.hidden = true;
      addRow.append(addButton, fileButton, fileInput);
      add.append(urlInput, labelInput, yearInput, addRow);
      addBox.append(addTitle, add);

      panel.append(header, pickHint, list, empty, card, addBox);
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        panel.addEventListener(type, (event) => event.stopPropagation());
      });

      closeButton.addEventListener("click", () => {
        Viewer.setPhotoOnSitePicking?.(false);
        Viewer.togglePhotosPanel(false);
      });
      opacity.addEventListener("input", () => Viewer.setPhotoOpacity(opacity.value));
      swipe.addEventListener("change", () => Viewer.setPhotoSwipe(swipe.checked));
      returnButton.addEventListener("click", () => Viewer.flyToPhotoView());
      alignButton.addEventListener("click", () => Viewer.setPhotoAligning(!state.aligning));
      hideButton.addEventListener("click", () => Viewer.closePhoto());
      onSiteButton.addEventListener("click", () => Viewer.openPhotoOnSite?.());
      fov.addEventListener("input", () => Viewer.setPhotoFov(fov.value));
      roll.addEventListener("input", () => Viewer.setPhotoRoll(roll.value));
      saveButton.addEventListener("click", () => Viewer.savePhotoView());
      removeButton.addEventListener("click", () => {
        const item = Viewer.getOpenPhoto();
        if (item) Viewer.removePhoto(item.id);
      });
      const addOptions = () => ({
        label: labelInput.value.trim(),
        year: yearInput.value === "" ? null : Number(yearInput.value),
      });
      add.addEventListener("submit", (event) => {
        event.preventDefault();
        const src = urlInput.value.trim();
        if (!src) {
          urlInput.focus();
          return;
        }
        if (Viewer.addPhoto({ src, ...addOptions() })) add.reset();
      });
      fileButton.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (file && Viewer.addPhoto({ file, ...addOptions() })) add.reset();
        fileInput.value = "";
      });

      getViewerSideStack()?.append(panel);
      state.ui = {
        panel, title, closeButton, pickHint, list, empty, card, cardTitle, description, source,
        opacityLabel, opacity, swipeLabel, swipe, returnButton, alignButton, hideButton, onSiteButton,
        align, alignHint, fovLabel, fov, fovValue, rollLabel, roll, rollValue, saveButton, removeButton,
        addBox, addTitle, urlInput, labelInput, yearInput, addButton, fileButton,
      };
      addBox.open = state.items.length === 0;
      Viewer.renderPhotosList();
      Viewer.updatePhotosLabels();
    },

    renderPhotosList() {
      const state = Viewer.photosState;
      const ui = state?.ui;
      if (!ui) return;
      ui.list.innerHTML = "";
      state.items.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "viewer-photos_item";
        button.dataset.photo = item.id;
        const thumb = document.createElement("img");
        thumb.className = "viewer-photos_thumb";
        thumb.alt = "";
        thumb.loading = "lazy";
        thumb.src = item.src;
        const text = document.createElement("span");
        text.className = "viewer-photos_item-text";
        const name = document.createElement("span");
        name.className = "viewer-photos_item-label";
        name.textContent = readText(item.label) || item.id;
        text.append(name);
        if (item.year != null) {
          const year = document.createElement("span");
          year.className = "viewer-photos_item-year";
          year.textContent = String(item.year);
          text.append(year);
        }
        button.append(thumb, text);
        button.addEventListener("click", () => {
          // Picked to be seen on site (photo-onsite.js startPhotoOnSite).
          if (state.pickOnSite) {
            Viewer.setPhotoOnSitePicking(false);
            if (state.openId !== item.id) Viewer.openPhoto(item.id, { fly: false });
            Viewer.openPhotoOnSite(item.id);
            return;
          }
          if (state.openId === item.id) Viewer.closePhoto();
          else Viewer.openPhoto(item.id);
        });
        ui.list.append(button);
      });
      Viewer.syncPhotosPanel();
    },

    updatePhotosLabels() {
      const state = Viewer.photosState;
      const overlay = state?.overlay;
      if (overlay) {
        overlay.handle.title = t("photos.divider", "Drag to compare the photo with the model");
        overlay.handle.setAttribute("aria-label", overlay.handle.title);
      }
      const ui = state?.ui;
      if (!ui) return;
      ui.panel.setAttribute("aria-label", t("photos.title", "Historical photos"));
      ui.title.textContent = t("photos.title", "Historical photos");
      ui.closeButton.title = t("photos.closePanel", "Close");
      ui.closeButton.setAttribute("aria-label", ui.closeButton.title);
      ui.pickHint.textContent = t("photos.onSite.pick", "Tap the photo to see on site.");
      ui.empty.textContent = t("photos.empty", "No photos yet. Add one taken from the current view.");
      ui.opacityLabel.textContent = t("photos.opacity", "Photo");
      ui.swipeLabel.textContent = t("photos.swipe", "Divider instead of fading");
      ui.returnButton.textContent = t("photos.return", "Back to the photo's view");
      ui.hideButton.textContent = t("photos.hide", "Hide photo");
      ui.onSiteButton.textContent = t("photos.onSite.open", "On site (camera)");
      ui.onSiteButton.title = t("photos.onSite.openTitle", "Lay the photo over the place through the camera");
      ui.alignHint.textContent = t("photos.alignHint", "Move the camera until the model lies over the photo, then set the lens and the tilt.");
      ui.fovLabel.textContent = t("photos.fov", "Lens (field of view)");
      ui.rollLabel.textContent = t("photos.roll", "Tilt");
      ui.saveButton.textContent = t("photos.save", "Save view");
      ui.removeButton.textContent = t("photos.remove", "Remove photo");
      ui.addTitle.textContent = t("photos.add", "Add a photo");
      ui.urlInput.placeholder = t("photos.url", "Image URL or IIIF info.json");
      ui.urlInput.setAttribute("aria-label", ui.urlInput.placeholder);
      ui.labelInput.placeholder = t("photos.label", "Title");
      ui.labelInput.setAttribute("aria-label", ui.labelInput.placeholder);
      ui.yearInput.placeholder = t("photos.year", "Year");
      ui.yearInput.setAttribute("aria-label", ui.yearInput.placeholder);
      ui.addButton.textContent = t("photos.addUrl", "Add");
      ui.fileButton.textContent = t("photos.addFile", "From file…");
      Viewer.syncPhotosPanel();
    },

    syncPhotosPanel() {
      const state = Viewer.photosState;
      const ui = state?.ui;
      if (!ui) return;
      const item = Viewer.getOpenPhoto();
      ui.empty.hidden = state.items.length > 0;
      ui.pickHint.hidden = !state.pickOnSite;
      [...ui.list.children].forEach((button) => {
        const active = button.dataset.photo === state.openId;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      ui.card.hidden = !item;
      if (!item) return;
      ui.cardTitle.textContent = [item.year, readText(item.label)].filter((part) => part != null && part !== "").join(" – ");
      ui.description.textContent = readText(item.description);
      ui.description.hidden = !ui.description.textContent;
      const source = readText(item.source);
      ui.source.textContent = source ? t("timeline.source", { source }, "Source: {source}") : "";
      ui.source.hidden = !source;
      ui.opacity.value = String(state.opacity);
      ui.opacity.disabled = state.swipe;
      ui.swipe.checked = state.swipe;
      ui.returnButton.hidden = !Viewer.photosState.overlay?.root.classList.contains("is-away") || state.aligning;
      ui.alignButton.textContent = state.aligning ? t("photos.cancelAlign", "Stop aligning") : t("photos.align", "Align");
      ui.alignButton.classList.toggle("is-active", state.aligning);
      ui.align.hidden = !state.aligning;
      const fovValue = core.camera?.isPerspectiveCamera ? core.camera.fov : null;
      ui.fov.disabled = fovValue == null;
      if (fovValue != null) {
        ui.fov.value = String(fovValue);
        ui.fovValue.textContent = `${round(fovValue, 1)}°`;
      }
      const roll = item.view?.roll ?? 0;
      ui.roll.value = String(roll);
      ui.rollValue.textContent = `${round(roll, 1)}°`;
    },

    // ---- manifests ------------------------------------------------------------

    // AIM3DViewer.photos of an exported manifest (photos from a local file
    // are left out: they have no URL).
    getPhotosForExport() {
      const items = (Viewer.photosState?.items || []).filter((item) => item.exportable);
      if (!items.length) return undefined;
      return items.map((item) => ({
        id: item.id,
        ...item.raw,
        ...(item.raw.src || item.raw.service ? {} : { src: item.src }),
        ...(item.label ? { label: item.label } : {}),
        ...(item.description ? { description: item.description } : {}),
        ...(item.source ? { source: item.source } : {}),
        ...(item.year != null ? { year: item.year } : {}),
        ...(item.opacity != null ? { opacity: round(item.opacity, 2) } : {}),
        ...(item.view ? {
          view: {
            position: item.view.position.toArray().map((value) => round(value)),
            target: item.view.target.toArray().map((value) => round(value)),
            ...(item.view.fov != null ? { fov: round(item.view.fov, 2) } : {}),
            ...(item.view.roll ? { roll: round(item.view.roll, 2) } : {}),
          },
        } : {}),
      }));
    },

    apply3IFManifestPhotos(config) {
      const list = Array.isArray(config) ? config : [];
      const hadPhotos = Viewer.getPhotos().length > 0;
      Viewer.setPhotos(list);
      if (list.length && Viewer.urlOptions?.hideUi !== true) Viewer.togglePhotosPanel(true);
      return list.length > 0 || hadPhotos;
    },

    disposePhotos() {
      if (!Viewer.photosState) return;
      Viewer.setPhotos([]);
    },
  });
}

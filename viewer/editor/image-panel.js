import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { getViewerSideStack } from "../ui/side-stack.js";
import { attachToolPanelChrome, isToolPanelMinimized, PANEL_ICONS, setToolPanelMinimized } from "../ui/tool-panel-chrome.js";
import { PHONE_TOOLBAR_QUERY } from "../editor-toolbar.js";
import { toastHelper } from "../viewer-utils.js";

// A 2D image (image2d.js): the window to enhance it, and - for a set - the
// filmstrip of its images and their grid.
//
// The window: the histogram (red, green, blue, luminance); brightness,
// contrast, gamma, saturation; one channel alone; auto levels, histogram
// equalisation, inversion; sharpening, relief (embossed in a light
// direction), edges, decorrelation stretch, false colour; a comparison with
// the original (a divider across the image); reset, and the enhanced image
// saved as PNG; below, what the file is (size, resolution, camera, place).
// The settings are the set's: the next image is shown the same way.
//
// The filmstrip, over the top of the scene: the images of the set as
// thumbnails, the one shown marked, ‹ › and ← → to step; the grid button
// shows all of them at once (a contact sheet; Escape closes it).
//
// While an image is shown the camera does not turn: a drag moves the image,
// the wheel zooms; the ground is hidden.

const isPhone = () => window.matchMedia(PHONE_TOOLBAR_QUERY).matches;
const percent = (value) => `${Math.round(value * 100)}%`;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

function physicalSize(info) {
  if (!info.metersPerPixel) return "";
  const cm = (pixels) => pixels * info.metersPerPixel * 100;
  // (A hair over: 6.35 is 6.3499... in floating point.)
  const format = (value) => (value >= 100 ? `${(value / 100 + 1e-9).toFixed(2)} m` : `${(value + 1e-9).toFixed(1)} cm`);
  return `${format(cm(info.width))} × ${format(cm(info.height))}`;
}

export function attachImagePanel(Viewer) {
  Object.assign(Viewer, {
    imageState: null,

    // Called after a model is added to the scene (loaders.js).
    setupImageControls(root) {
      Viewer.disposeImageControls();
      if (!root?.userData?.isImage2D) return false;
      const state = { root, api: null, hidden: false, collapsed: false, ui: null, strip: null, grid: null, controls: null, unsubscribe: null };
      Viewer.imageState = state;
      // A flat picture: moved and zoomed, not turned.
      const controls = core.controls;
      if (controls) {
        state.controls = {
          enableRotate: controls.enableRotate,
          left: controls.mouseButtons?.LEFT,
          one: controls.touches?.ONE,
        };
        controls.enableRotate = false;
        if (controls.mouseButtons) controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
        if (controls.touches) controls.touches.ONE = THREE.TOUCH.PAN;
      }
      state.onKey = (event) => Viewer.handleImageKey(event);
      window.addEventListener("keydown", state.onKey);
      import("../image2d.js").then((api) => {
        if (Viewer.imageState !== state) return;
        state.api = api;
        // Settings a manifest gave before the module was there.
        api.applyImageSettings(root);
        state.unsubscribe = api.onImageChange(root, () => Viewer.onImageShown());
        Viewer.createImagePanel();
        Viewer.createImageStrip();
        Viewer.updateEditorToolbarState?.();
      });
      return true;
    },

    disposeImageControls() {
      const state = Viewer.imageState;
      if (!state) return;
      state.unsubscribe?.();
      window.removeEventListener("keydown", state.onKey);
      const controls = core.controls;
      if (controls && state.controls) {
        controls.enableRotate = state.controls.enableRotate;
        if (controls.mouseButtons && state.controls.left !== undefined) controls.mouseButtons.LEFT = state.controls.left;
        if (controls.touches && state.controls.one !== undefined) controls.touches.ONE = state.controls.one;
      }
      if (core.basicGrid) core.basicGrid.visible = true;
      state.ui?.root.remove();
      state.strip?.remove();
      state.grid?.remove();
      Viewer.imageState = null;
      Viewer.updateEditorToolbarState?.();
    },

    isImageActive() {
      return Boolean(Viewer.imageState?.api);
    },

    isImagePanelVisible() {
      const state = Viewer.imageState;
      return Boolean(state?.ui && !state.hidden && !(isPhone() && isToolPanelMinimized(state.ui.root)));
    },

    toggleImagePanel() {
      const state = Viewer.imageState;
      if (!state?.ui) return;
      if (isPhone()) {
        const open = !state.hidden && !isToolPanelMinimized(state.ui.root);
        state.hidden = false;
        state.collapsed = false;
        Viewer.syncImagePanel();
        setToolPanelMinimized(state.ui.root, open);
        Viewer.updateEditorToolbarState?.();
        return;
      }
      state.hidden = !state.hidden;
      if (!state.hidden) state.collapsed = false;
      Viewer.syncImagePanel();
      Viewer.updateEditorToolbarState?.();
    },

    // Each frame (main.js animate): no ground under a picture.
    updateImageView() {
      if (Viewer.imageState && core.basicGrid?.visible) core.basicGrid.visible = false;
    },

    getImageSet() {
      const state = Viewer.imageState;
      return state?.api ? state.api.getImageState(state.root)?.items || [] : [];
    },

    getImageIndex() {
      const state = Viewer.imageState;
      return state?.api ? state.api.getImageState(state.root)?.index ?? -1 : -1;
    },

    async showImageAt(index) {
      const state = Viewer.imageState;
      if (!state?.api) return false;
      const before = state.root.userData.imageInfo;
      try {
        const shown = await state.api.showImage(state.root, index);
        // Another size: framed again.
        const after = state.root.userData.imageInfo;
        if (shown && before && (before.width !== after.width || before.height !== after.height || before.metersPerPixel !== after.metersPerPixel)) {
          Viewer.frameImage();
        }
        return shown;
      } catch (error) {
        console.error("Could not show the image", error);
        toastHelper("imageLoadError", "error");
        return false;
      }
    },

    stepImage(direction) {
      const count = Viewer.getImageSet().length;
      if (count < 2) return false;
      Viewer.showImageAt(Viewer.getImageIndex() + direction);
      return true;
    },

    // The camera straight on to the image, all of it in view.
    frameImage() {
      const state = Viewer.imageState;
      const camera = core.camera;
      if (!state || !camera || !core.controls) return;
      // Takes over from a camera flight still running (the fly-in to the
      // first image).
      core.cameraTweenToken = (core.cameraTweenToken ?? 0) + 1;
      core.cameraTween?.stop?.();
      core.targetTween?.stop?.();
      const box = new THREE.Box3().setFromObject(state.root);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const fov = THREE.MathUtils.degToRad(camera.fov || 45);
      const aspect = camera.aspect || 1;
      const distance = Math.max(size.y / (2 * Math.tan(fov / 2) * 0.85), size.x / (2 * Math.tan(fov / 2) * aspect * 0.85));
      core.controls.target.copy(center);
      camera.position.set(center.x, center.y, center.z + distance);
      camera.near = Math.max(distance / 1000, 1e-6);
      camera.far = distance * 100;
      camera.updateProjectionMatrix();
      // The zoom's range follows the image (the first one's set it).
      core.controls.maxDistance = distance * 4;
      core.controls.minDistance = 0;
      core.controls.update();
    },

    handleImageKey(event) {
      const state = Viewer.imageState;
      if (!state || Viewer.isTourActive?.() || event.defaultPrevented) return;
      if (event.target?.closest?.("input, select, textarea, [contenteditable='true']")) return;
      if (state.grid && !state.grid.hidden && event.key === "Escape") {
        Viewer.toggleImageGrid(false);
        event.preventDefault();
        return;
      }
      if (Viewer.getImageSet().length < 2) return;
      const steps = { ArrowLeft: -1, ArrowRight: 1, PageUp: -1, PageDown: 1 };
      if (event.key in steps) {
        Viewer.stepImage(steps[event.key]);
        event.preventDefault();
      } else if (event.key === "Home" || event.key === "End") {
        Viewer.showImageAt(event.key === "Home" ? 0 : Viewer.getImageSet().length - 1);
        event.preventDefault();
      }
    },

    updateImageSettings(change) {
      const state = Viewer.imageState;
      if (!state?.api) return;
      change(state.root.userData.image);
      state.api.applyImageSettings(state.root);
      Viewer.syncImagePanel();
    },

    resetImageSettings() {
      const state = Viewer.imageState;
      if (!state?.api) return;
      state.root.userData.image = { ...state.api.IMAGE_FILTER_DEFAULTS };
      state.api.applyImageSettings(state.root);
      Viewer.buildImagePanelBody();
    },

    async saveEnhancedImage() {
      const state = Viewer.imageState;
      if (!state?.api) return false;
      const blob = await state.api.renderEnhancedImage(state.root);
      if (!blob) return false;
      const info = state.root.userData.imageInfo || {};
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${String(info.name || "image").replace(/\.[^.]+$/, "")}-enhanced.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
      return true;
    },

    // ---- manifests ----

    // AIM3DViewer.image: the settings that are not the defaults.
    getImageForExport() {
      const state = Viewer.imageState;
      if (!state?.api) return undefined;
      const defaults = state.api.IMAGE_FILTER_DEFAULTS;
      const changed = Object.fromEntries(Object.entries(state.root.userData.image)
        .filter(([key, value]) => key in defaults && value !== defaults[key])
        .map(([key, value]) => [key, typeof value === "number" ? Math.round(value * 1000) / 1000 : value]));
      return Object.keys(changed).length ? changed : undefined;
    },

    // Over the image's settings: the manifest's (the others the defaults).
    apply3IFManifestImage(config) {
      const state = Viewer.imageState;
      if (!state || !config || typeof config !== "object") return false;
      const settings = state.root.userData.image;
      Object.entries(config).forEach(([key, value]) => {
        if (key in settings && typeof value === typeof settings[key]) settings[key] = value;
      });
      if (state.api) {
        state.api.applyImageSettings(state.root);
        Viewer.buildImagePanelBody();
      }
      return true;
    },

    // Another image of the set shown (image2d.js).
    onImageShown() {
      Viewer.buildImagePanelBody();
      Viewer.syncImageStrip();
    },

    // ---- the window ----

    createImagePanel() {
      const state = Viewer.imageState;
      const stack = getViewerSideStack();
      if (!state || !stack || core.PRESENTATION_MODE || Viewer.urlOptions?.hideUi === true) return;
      const root = document.createElement("section");
      root.id = "viewerImagePanel";
      root.className = "viewer-pointcloud-panel viewer-volume-panel viewer-image-panel";
      ["pointerdown", "pointerup", "wheel"].forEach((type) => root.addEventListener(type, (event) => event.stopPropagation()));
      root.addEventListener("keydown", (event) => {
        if (event.target?.closest?.("input, select, textarea")) event.stopPropagation();
      });
      const header = document.createElement("div");
      header.className = "viewer-pointcloud-panel_header";
      const title = document.createElement("strong");
      title.className = "viewer-audio-panel_title";
      const collapse = document.createElement("button");
      collapse.type = "button";
      collapse.className = "viewer-pointcloud-panel_collapse";
      collapse.addEventListener("click", () => {
        state.collapsed = !state.collapsed;
        Viewer.syncImagePanel();
      });
      header.append(title, collapse);
      attachToolPanelChrome(root, header, {
        icon: PANEL_ICONS.image,
        label: () => t("image.title", "Image"),
        modal: isPhone,
        onClose: () => {
          state.hidden = true;
          Viewer.syncImagePanel();
          Viewer.updateEditorToolbarState?.();
        },
      });
      const body = document.createElement("div");
      body.className = "viewer-pointcloud-panel_body";
      root.append(header, body);
      stack.appendChild(root);
      state.ui = { root, title, collapse, body, labels: [] };
      Viewer.buildImagePanelBody();
      if (isPhone()) setToolPanelMinimized(root, true, { focus: false });
      new MutationObserver(() => Viewer.updateEditorToolbarState?.()).observe(root, { attributes: true, attributeFilter: ["class"] });
    },

    buildImagePanelBody() {
      const state = Viewer.imageState;
      const ui = state?.ui;
      if (!ui || !state.api) return;
      const { api } = state;
      const settings = state.root.userData.image;
      const info = state.root.userData.imageInfo || {};
      ui.body.replaceChildren();
      ui.labels = [];
      const labels = ui.labels;
      const el = (tag, className) => {
        const element = document.createElement(tag);
        if (className) element.className = className;
        return element;
      };
      const row = (text, control, parent = ui.body) => {
        const element = el("label", "viewer-pointcloud-panel_row");
        const label = el("span");
        element.append(label, control);
        parent.appendChild(element);
        labels.push([label, text]);
        return element;
      };
      const slider = (min, max, step, value, onInput) => {
        const input = el("input");
        input.type = "range";
        Object.assign(input, { min: String(min), max: String(max), step: String(step), value: String(value) });
        input.addEventListener("input", () => onInput(Number(input.value)));
        return input;
      };
      const check = (text, checked, onChange, parent = ui.body) => {
        const element = el("label", "viewer-audio-panel_check");
        const input = el("input");
        input.type = "checkbox";
        input.checked = checked;
        input.addEventListener("change", () => onChange(input.checked));
        const label = el("span");
        element.append(input, label);
        parent.appendChild(element);
        labels.push([label, text]);
        return input;
      };
      const select = (values, current, labelOf, onChange) => {
        const element = el("select");
        values.forEach((value) => element.appendChild(new Option(labelOf(value), value)));
        element.value = current;
        element.addEventListener("change", () => onChange(element.value));
        return element;
      };
      const heading = (text) => {
        const element = el("div", "viewer-audio-panel_heading");
        ui.body.appendChild(element);
        labels.push([element, text]);
      };
      const button = (className, text, onClick, parent) => {
        const element = el("button", `viewer-pointcloud-panel_button ${className}`);
        element.type = "button";
        element.addEventListener("click", onClick);
        parent.appendChild(element);
        labels.push([element, text]);
        return element;
      };
      const live = () => Viewer.imageState?.root.userData.image || settings;

      // The set: where in it, and the way through it.
      const count = info.count || 1;
      if (count > 1) {
        const nav = el("div", "viewer-audio-panel_transport viewer-image-panel_nav");
        button("viewer-image-panel_prev", () => "‹", () => Viewer.stepImage(-1), nav);
        const position = el("span", "viewer-audio-panel_time");
        position.textContent = `${info.index + 1} / ${count}`;
        nav.appendChild(position);
        button("viewer-image-panel_next", () => "›", () => Viewer.stepImage(1), nav);
        button("viewer-image-panel_grid", () => t("image.grid", "All images"), () => Viewer.toggleImageGrid(), nav);
        ui.body.appendChild(nav);
      }

      // Histogram of the image (its own, before the settings).
      ui.histogram = el("canvas", "viewer-image-panel_histogram");
      ui.body.appendChild(ui.histogram);
      labels.push([ui.histogram, () => t("image.histogram", "Histogram: red, green, blue and luminance")]);

      heading(() => t("image.adjust", "Adjust"));
      row(() => t("image.brightness", { value: `${Math.round(live().brightness * 200)}` }, "Brightness {value}"),
        slider(-100, 100, 1, Math.round(settings.brightness * 200), (value) => Viewer.updateImageSettings((s) => { s.brightness = value / 200; })));
      row(() => t("image.contrast", { value: percent(live().contrast) }, "Contrast {value}"),
        slider(0, 300, 1, Math.round(settings.contrast * 100), (value) => Viewer.updateImageSettings((s) => { s.contrast = value / 100; })));
      row(() => t("image.gamma", { value: live().gamma.toFixed(2) }, "Gamma {value}"),
        slider(20, 300, 1, Math.round(settings.gamma * 100), (value) => Viewer.updateImageSettings((s) => { s.gamma = value / 100; })));
      row(() => t("image.saturation", { value: percent(live().saturation) }, "Saturation {value}"),
        slider(0, 300, 1, Math.round(settings.saturation * 100), (value) => Viewer.updateImageSettings((s) => { s.saturation = value / 100; })));
      row(() => t("image.channel", "Channel"), select(api.IMAGE_CHANNELS, settings.channel, (channel) => t(`image.channels.${channel}`, channel), (channel) => {
        Viewer.updateImageSettings((s) => { s.channel = channel; });
      }));
      check(() => t("image.autoLevels", "Auto levels (each channel to its full range)"), settings.autoLevels, (on) => Viewer.updateImageSettings((s) => { s.autoLevels = on; }));
      check(() => t("image.equalize", "Equalise the histogram"), settings.equalize, (on) => Viewer.updateImageSettings((s) => { s.equalize = on; }));
      check(() => t("image.invert", "Invert (negative)"), settings.invert, (on) => Viewer.updateImageSettings((s) => { s.invert = on; }));

      heading(() => t("image.enhance", "Enhance"));
      row(() => t("image.sharpen", { value: percent(live().sharpen / 2) }, "Sharpen {value}"),
        slider(0, 100, 1, Math.round(settings.sharpen * 50), (value) => Viewer.updateImageSettings((s) => { s.sharpen = value / 50; })));
      row(() => t("image.relief", { value: percent(live().relief) }, "Relief {value}"),
        slider(0, 100, 1, Math.round(settings.relief * 100), (value) => Viewer.updateImageSettings((s) => { s.relief = value / 100; })));
      const angle = row(() => t("image.reliefAngle", { value: `${Math.round(live().reliefAngle)}°` }, "Light from {value}"),
        slider(0, 359, 1, settings.reliefAngle, (value) => Viewer.updateImageSettings((s) => { s.reliefAngle = value; })));
      angle.classList.add("viewer-image-panel_relief-angle");
      row(() => t("image.edges", { value: percent(live().edges) }, "Edges {value}"),
        slider(0, 100, 1, Math.round(settings.edges * 100), (value) => Viewer.updateImageSettings((s) => { s.edges = value / 100; })));
      check(() => t("image.dstretch", "Decorrelation stretch (faint pigments)"), settings.dstretch, (on) => Viewer.updateImageSettings((s) => { s.dstretch = on; }));
      row(() => t("image.falseColor", "False colour"), select(api.FALSE_COLOR_MAPS, settings.falseColor, (map) => t(`image.falseColors.${map}`, map), (map) => {
        Viewer.updateImageSettings((s) => { s.falseColor = map; });
      }));

      heading(() => t("image.compareHeading", "Compare"));
      check(() => t("image.compare", "With the original (left of the line)"), settings.compare, (on) => Viewer.updateImageSettings((s) => { s.compare = on; }));
      const split = row(() => t("image.split", "Line"),
        slider(0, 100, 1, Math.round(settings.split * 100), (value) => Viewer.updateImageSettings((s) => { s.split = value / 100; })));
      split.classList.add("viewer-image-panel_split");

      const actions = el("div", "viewer-sounds-panel_placing");
      button("viewer-image-panel_reset", () => t("image.reset", "Reset"), () => Viewer.resetImageSettings(), actions);
      button("viewer-image-panel_save", () => t("image.save", "Save the image (PNG)"), () => Viewer.saveEnhancedImage(), actions);
      ui.body.appendChild(actions);

      // What the file is.
      const summary = el("dl", "viewer-volume-panel_summary");
      const fact = (term, value) => {
        if (value === undefined || value === null || value === "") return;
        const dt = el("dt");
        const dd = el("dd");
        dd.textContent = value;
        summary.append(dt, dd);
        labels.push([dt, term]);
      };
      const tags = info.tags || {};
      fact(() => t("image.file", "File"), info.name);
      fact(() => t("image.format", "Format"), info.format);
      fact(() => t("image.pixels", "Pixels"), info.width ? `${info.width} × ${info.height}${info.shown && info.shown[0] !== info.width ? ` (${t("image.shownAt", { value: `${info.shown[0]} × ${info.shown[1]}` }, "shown at {value}")})` : ""}` : "");
      fact(() => t("image.bitDepth", "Bit depth"), info.bitDepth ? `${info.bitDepth} bit` : "");
      fact(() => t("image.resolution", "Resolution"), info.dpi ? `${info.dpi} dpi` : t("image.noResolution", "not given: measured in pixels"));
      fact(() => t("image.physicalSize", "Size"), physicalSize(info));
      fact(() => t("image.size", "File size"), formatBytes(info.size));
      ["title", "description", "artist", "copyright", "date", "camera", "lens", "exposure", "aperture", "iso", "focalLength", "software"].forEach((key) => {
        fact(() => t(`image.tags.${key}`, key), tags[key]);
      });
      if (info.gps) {
        fact(() => t("image.gps", "Place (GPS)"), `${info.gps.latitude.toFixed(5)}, ${info.gps.longitude.toFixed(5)}${Number.isFinite(info.gps.altitude) ? `, ${Math.round(info.gps.altitude)} m` : ""}`);
      }
      ui.body.appendChild(summary);
      Viewer.syncImagePanel();
    },

    syncImagePanel() {
      const state = Viewer.imageState;
      const ui = state?.ui;
      if (!ui) return;
      const info = state.root.userData.imageInfo || {};
      const settings = state.root.userData.image;
      const name = info.tags?.title || info.name || t("image.title", "Image");
      ui.title.textContent = name;
      ui.title.title = name;
      ui.root.setAttribute("aria-label", t("image.title", "Image"));
      ui.root.hidden = state.hidden;
      ui.body.hidden = state.collapsed && !isPhone();
      ui.collapse.textContent = state.collapsed ? "+" : "–";
      const collapseLabel = state.collapsed ? t("image.expand", "Show settings") : t("image.collapse", "Hide settings");
      ui.collapse.title = collapseLabel;
      ui.collapse.setAttribute("aria-label", collapseLabel);
      ui.body.querySelector(".viewer-image-panel_relief-angle")?.toggleAttribute("hidden", !(settings.relief > 0));
      ui.body.querySelector(".viewer-image-panel_split")?.toggleAttribute("hidden", !settings.compare);
      ui.labels.forEach(([element, text]) => {
        if (element instanceof HTMLCanvasElement) element.setAttribute("aria-label", text());
        else element.textContent = text();
      });
      Viewer.drawImageHistogram();
    },

    drawImageHistogram() {
      const state = Viewer.imageState;
      const canvas = state?.ui?.histogram;
      const stats = state?.api?.getImageState(state.root)?.stats;
      if (!canvas || !stats || canvas.hidden) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      const context = canvas.getContext("2d");
      const { width, height } = canvas;
      context.clearRect(0, 0, width, height);
      const peak = Math.max(1, ...stats.histogram.flatMap((bins) => Array.from(bins.subarray(1, 255))));
      const colors = ["rgba(235, 80, 70, 0.55)", "rgba(90, 200, 110, 0.55)", "rgba(80, 140, 240, 0.55)", "rgba(240, 240, 240, 0.85)"];
      context.globalCompositeOperation = "lighter";
      stats.histogram.forEach((bins, channel) => {
        context.fillStyle = colors[channel];
        context.beginPath();
        context.moveTo(0, height);
        for (let i = 0; i < 256; i++) {
          context.lineTo((i / 255) * width, height - Math.min(1, bins[i] / peak) * height);
        }
        context.lineTo(width, height);
        context.closePath();
        if (channel < 3) context.fill();
        else {
          context.strokeStyle = colors[3];
          context.lineWidth = ratio;
          context.stroke();
        }
      });
      context.globalCompositeOperation = "source-over";
    },

    // ---- the filmstrip and the grid of a set ----

    createImageStrip() {
      const state = Viewer.imageState;
      const items = Viewer.getImageSet();
      if (!state || items.length < 2 || Viewer.urlOptions?.hideUi === true) return;
      const strip = document.createElement("div");
      strip.className = "viewer-image-strip";
      strip.setAttribute("role", "toolbar");
      ["pointerdown", "pointerup", "wheel"].forEach((type) => strip.addEventListener(type, (event) => event.stopPropagation()));
      const prev = document.createElement("button");
      prev.type = "button";
      prev.className = "viewer-image-strip_step";
      prev.textContent = "‹";
      prev.addEventListener("click", () => Viewer.stepImage(-1));
      const list = document.createElement("div");
      list.className = "viewer-image-strip_list";
      const next = document.createElement("button");
      next.type = "button";
      next.className = "viewer-image-strip_step";
      next.textContent = "›";
      next.addEventListener("click", () => Viewer.stepImage(1));
      const counter = document.createElement("span");
      counter.className = "viewer-image-strip_counter";
      const gridButton = document.createElement("button");
      gridButton.type = "button";
      gridButton.className = "viewer-image-strip_grid";
      gridButton.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor"/><rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor"/><rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor"/><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor"/></svg>';
      gridButton.addEventListener("click", () => Viewer.toggleImageGrid());
      items.forEach((item, index) => {
        const thumb = document.createElement("button");
        thumb.type = "button";
        thumb.className = "viewer-image-strip_thumb";
        thumb.dataset.index = String(index);
        thumb.title = item.name;
        thumb.setAttribute("aria-label", item.name);
        thumb.addEventListener("click", () => Viewer.showImageAt(index));
        list.appendChild(thumb);
      });
      strip.append(prev, list, next, counter, gridButton);
      (core.container || document.body).appendChild(strip);
      state.strip = strip;
      state.stripUi = { prev, next, counter, gridButton, list };
      Viewer.syncImageStrip();
      Viewer.loadImageThumbnails();
    },

    // The thumbnails, one after another, into the strip and the grid.
    async loadImageThumbnails() {
      const state = Viewer.imageState;
      if (!state?.api) return;
      const items = Viewer.getImageSet();
      for (const [index, item] of items.entries()) {
        if (Viewer.imageState !== state) return;
        try {
          const url = await state.api.imageThumbnail(item);
          [state.strip, state.grid].forEach((container) => {
            const thumb = container?.querySelector(`[data-index="${index}"]`);
            if (thumb && !thumb.querySelector("img")) {
              const img = document.createElement("img");
              img.alt = "";
              img.src = url;
              thumb.prepend(img);
            }
          });
        } catch (error) {
          console.warn("Could not make a thumbnail", item.name, error);
        }
      }
    },

    syncImageStrip() {
      const state = Viewer.imageState;
      const index = Viewer.getImageIndex();
      const count = Viewer.getImageSet().length;
      if (state?.stripUi) {
        const { prev, next, counter, gridButton, list } = state.stripUi;
        counter.textContent = `${index + 1} / ${count}`;
        prev.setAttribute("aria-label", t("image.previous", "Previous image (←)"));
        prev.title = prev.getAttribute("aria-label");
        next.setAttribute("aria-label", t("image.next", "Next image (→)"));
        next.title = next.getAttribute("aria-label");
        gridButton.setAttribute("aria-label", t("image.grid", "All images"));
        gridButton.title = gridButton.getAttribute("aria-label");
        gridButton.setAttribute("aria-pressed", state.grid && !state.grid.hidden ? "true" : "false");
        list.querySelectorAll(".viewer-image-strip_thumb").forEach((thumb) => {
          const current = Number(thumb.dataset.index) === index;
          thumb.classList.toggle("is-current", current);
          thumb.setAttribute("aria-current", current ? "true" : "false");
          if (current) thumb.scrollIntoView?.({ block: "nearest", inline: "center" });
        });
      }
      state?.grid?.querySelectorAll(".viewer-image-grid_item").forEach((thumb) => {
        thumb.classList.toggle("is-current", Number(thumb.dataset.index) === index);
      });
    },

    toggleImageGrid(open) {
      const state = Viewer.imageState;
      if (!state || Viewer.getImageSet().length < 2) return;
      const show = typeof open === "boolean" ? open : !(state.grid && !state.grid.hidden);
      if (show && !state.grid) {
        const grid = document.createElement("div");
        grid.className = "viewer-image-grid";
        grid.setAttribute("role", "dialog");
        ["pointerdown", "pointerup", "wheel"].forEach((type) => grid.addEventListener(type, (event) => event.stopPropagation()));
        const header = document.createElement("div");
        header.className = "viewer-image-grid_header";
        const title = document.createElement("strong");
        const close = document.createElement("button");
        close.type = "button";
        close.className = "viewer-image-grid_close";
        close.textContent = "×";
        close.addEventListener("click", () => Viewer.toggleImageGrid(false));
        header.append(title, close);
        const list = document.createElement("div");
        list.className = "viewer-image-grid_list";
        Viewer.getImageSet().forEach((item, index) => {
          const thumb = document.createElement("button");
          thumb.type = "button";
          thumb.className = "viewer-image-grid_item";
          thumb.dataset.index = String(index);
          const caption = document.createElement("span");
          caption.textContent = item.name;
          thumb.appendChild(caption);
          if (item.thumbnail) {
            const img = document.createElement("img");
            img.alt = "";
            img.src = item.thumbnail;
            thumb.prepend(img);
          }
          thumb.addEventListener("click", () => {
            Viewer.showImageAt(index);
            Viewer.toggleImageGrid(false);
          });
          list.appendChild(thumb);
        });
        grid.append(header, list);
        (core.container || document.body).appendChild(grid);
        state.grid = grid;
        state.gridTitle = title;
        state.gridClose = close;
      }
      if (state.grid) {
        state.grid.hidden = !show;
        state.gridTitle.textContent = t("image.gridTitle", { count: Viewer.getImageSet().length }, "All images ({count})");
        state.gridClose.setAttribute("aria-label", t("image.closeGrid", "Close (Esc)"));
        state.grid.setAttribute("aria-label", state.gridTitle.textContent);
        if (show) state.grid.querySelector(".is-current, .viewer-image-grid_item")?.focus?.();
      }
      Viewer.syncImageStrip();
    },
  });
}

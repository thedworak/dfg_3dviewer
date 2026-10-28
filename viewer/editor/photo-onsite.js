import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { toastHelper } from "../viewer-utils.js";

// A historical photo over the place itself: rephotography with the phone.
// The rear camera fills the screen and the open photo (photo-overlay.js) lies
// over it, faded in, cut by a divider, or shown alone while "Then" is held.
// Standing where the photographer stood, the photo is lined up by hand with
// what the camera sees: one finger moves it, two pinch and turn it (the mouse
// wheel scales, with Shift turns). "Save" keeps the camera frame with the
// photo over it as an image, shared or downloaded.
//
// The alignment stays with the photo for the session (item.onSite), in
// shares of the screen, so it survives turning the phone.

const DEFAULT_OPACITY = 0.5;
const MIN_SCALE = 0.1;
const MAX_SCALE = 12;
// Longest side (pixels) of a saved comparison.
const CAPTURE_SIZE = 2400;
const HINT_MS = 6000;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function readText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(readText).filter(Boolean).join("\n");
  if (typeof value === "object") {
    const lang = core.currentLanguage || "en";
    return readText(value[lang] ?? value.en ?? value.none ?? Object.values(value)[0]);
  }
  return String(value);
}

function defaultAlignment() {
  return { x: 0, y: 0, scale: 1, rotation: 0 };
}

export function attachPhotoOnSite(Viewer) {
  Object.assign(Viewer, {
    photoOnSite: null,

    // A camera the page may ask for (a secure context with getUserMedia).
    isPhotoOnSiteAvailable() {
      return typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices?.getUserMedia === "function" &&
        window.isSecureContext !== false;
    },

    isPhotoOnSiteOpen() {
      return Boolean(Viewer.photoOnSite);
    },

    // The camera, full screen, with the photo (the open one by default) over it.
    async openPhotoOnSite(id = Viewer.photosState?.openId) {
      if (Viewer.photoOnSite) return false;
      const item = Viewer.getPhotos().find((entry) => entry.id === String(id));
      if (!item) return false;
      if (!Viewer.isPhotoOnSiteAvailable()) {
        toastHelper("photoCameraUnavailable", "error");
        return false;
      }
      if (!item.onSite) item.onSite = defaultAlignment();
      const state = {
        item,
        opacity: item.onSiteOpacity ?? DEFAULT_OPACITY,
        swipe: false,
        swipePosition: 0.5,
        peek: false,
        stream: null,
        pointers: new Map(),
        gesture: null,
        fullscreen: false,
        hintTimer: 0,
        ui: null,
      };
      Viewer.photoOnSite = state;
      Viewer.createPhotoOnSiteUi(state);
      // Full screen needs the click that opened this: asked before the camera.
      try {
        if (!document.fullscreenElement && state.ui.root.requestFullscreen) {
          state.fullscreen = true;
          state.ui.root.requestFullscreen({ navigationUI: "hide" }).catch(() => { state.fullscreen = false; });
        }
      } catch {
        state.fullscreen = false;
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch (error) {
        console.warn("Camera refused", error);
        if (Viewer.photoOnSite === state) Viewer.closePhotoOnSite();
        const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
        toastHelper(denied ? "photoCameraDenied" : "photoCameraUnavailable", "error");
        return false;
      }
      // Closed while the browser asked.
      if (Viewer.photoOnSite !== state) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      state.stream = stream;
      stream.getVideoTracks().forEach((track) => track.addEventListener("ended", () => {
        if (Viewer.photoOnSite === state) Viewer.closePhotoOnSite();
      }));
      const video = state.ui.video;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Autoplay of a muted inline video is allowed; the frame shows anyway.
      }
      state.ui.root.classList.remove("is-starting");
      Viewer.syncPhotoOnSite();
      return true;
    },

    closePhotoOnSite() {
      const state = Viewer.photoOnSite;
      if (!state) return;
      Viewer.photoOnSite = null;
      clearTimeout(state.hintTimer);
      state.stream?.getTracks().forEach((track) => track.stop());
      if (state.ui) {
        state.ui.video.srcObject = null;
        window.removeEventListener("resize", state.ui.onResize);
        document.removeEventListener("keydown", state.ui.onKeyDown, true);
        if (document.fullscreenElement === state.ui.root) document.exitFullscreen?.().catch(() => {});
        state.ui.root.remove();
      }
      Viewer.syncPhotosPanel?.();
    },

    setPhotoOnSiteOpacity(value) {
      const state = Viewer.photoOnSite;
      const opacity = Number(value);
      if (!state || !Number.isFinite(opacity)) return;
      state.opacity = clamp(opacity, 0, 1);
      state.item.onSiteOpacity = state.opacity;
      Viewer.syncPhotoOnSite();
    },

    setPhotoOnSiteSwipe(enabled, position = null) {
      const state = Viewer.photoOnSite;
      if (!state) return;
      state.swipe = enabled === true;
      if (position != null && Number.isFinite(Number(position))) state.swipePosition = clamp(Number(position), 0, 1);
      Viewer.syncPhotoOnSite();
    },

    // Only the photo, while held.
    setPhotoOnSitePeek(enabled) {
      const state = Viewer.photoOnSite;
      if (!state) return;
      state.peek = enabled === true;
      Viewer.syncPhotoOnSite();
    },

    // How the photo lies over the camera: offsets in shares of the screen,
    // the scale over the photo fitted to the screen, the turn in degrees.
    setPhotoOnSiteAlignment(next = {}) {
      const state = Viewer.photoOnSite;
      if (!state) return null;
      const current = state.item.onSite;
      const pick = (key, fallback) => (Number.isFinite(Number(next[key])) ? Number(next[key]) : fallback);
      state.item.onSite = {
        x: clamp(pick("x", current.x), -2, 2),
        y: clamp(pick("y", current.y), -2, 2),
        scale: clamp(pick("scale", current.scale), MIN_SCALE, MAX_SCALE),
        rotation: pick("rotation", current.rotation),
      };
      Viewer.syncPhotoOnSite();
      return { ...state.item.onSite };
    },

    resetPhotoOnSiteAlignment() {
      return Viewer.setPhotoOnSiteAlignment(defaultAlignment());
    },

    getPhotoOnSiteAlignment() {
      const item = Viewer.photoOnSite?.item;
      return item?.onSite ? { ...item.onSite } : null;
    },

    // The photo's box on screen: fitted inside it, before the alignment.
    getPhotoOnSiteBase() {
      const state = Viewer.photoOnSite;
      const image = state?.ui?.image;
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      const aspect = image?.naturalWidth && image?.naturalHeight ? image.naturalWidth / image.naturalHeight : width / height;
      const fitWidth = Math.min(width, height * aspect);
      return { screenWidth: width, screenHeight: height, width: fitWidth, height: fitWidth / aspect };
    },

    syncPhotoOnSite() {
      const state = Viewer.photoOnSite;
      const ui = state?.ui;
      if (!ui) return;
      const base = Viewer.getPhotoOnSiteBase();
      const { x, y, scale, rotation } = state.item.onSite;
      Object.assign(ui.frame.style, {
        width: `${base.width}px`,
        height: `${base.height}px`,
        left: `${(base.screenWidth - base.width) / 2}px`,
        top: `${(base.screenHeight - base.height) / 2}px`,
        transform: `translate(${x * base.screenWidth}px, ${y * base.screenHeight}px) rotate(${rotation}deg) scale(${scale})`,
      });
      ui.layer.style.opacity = state.peek || state.swipe ? "1" : String(state.opacity);
      // The divider: the photo on its left, the place today on its right.
      ui.layer.style.clipPath = state.swipe && !state.peek ? `inset(0 ${(1 - state.swipePosition) * 100}% 0 0)` : "";
      ui.divider.hidden = !state.swipe || state.peek;
      ui.divider.style.left = `${state.swipePosition * 100}%`;
      ui.opacity.value = String(state.opacity);
      ui.opacity.disabled = state.swipe;
      ui.fadeButton.classList.toggle("is-active", !state.swipe);
      ui.fadeButton.setAttribute("aria-pressed", state.swipe ? "false" : "true");
      ui.swipeButton.classList.toggle("is-active", state.swipe);
      ui.swipeButton.setAttribute("aria-pressed", state.swipe ? "true" : "false");
      ui.peekButton.classList.toggle("is-active", state.peek);
      ui.root.classList.toggle("is-peeking", state.peek);
    },

    createPhotoOnSiteUi(state) {
      const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
      };
      const button = (className) => {
        const node = el("button", `viewer-onsite_button${className ? ` ${className}` : ""}`);
        node.type = "button";
        return node;
      };
      const root = el("div", "viewer-onsite is-starting");
      root.id = "viewerPhotoOnSite";
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");

      const video = el("video", "viewer-onsite_video");
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("muted", "");

      // The surface the gestures land on, under the photo layer.
      const stage = el("div", "viewer-onsite_stage");
      const layer = el("div", "viewer-onsite_layer");
      const frame = el("div", "viewer-onsite_frame");
      const image = el("img", "viewer-onsite_image");
      image.alt = "";
      image.decoding = "async";
      image.draggable = false;
      image.crossOrigin = "anonymous";
      image.addEventListener("load", () => Viewer.syncPhotoOnSite());
      image.addEventListener("error", () => {
        // Without CORS headers the image still shows, it just cannot be saved.
        if (image.crossOrigin) {
          image.removeAttribute("crossorigin");
          image.src = image.src;
          return;
        }
        toastHelper("photoLoadFailed", "error");
      });
      frame.append(image);
      layer.append(frame);

      const divider = el("div", "viewer-onsite_divider");
      const handle = button("viewer-onsite_handle");
      handle.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M9 6.5v11L3.5 12zM15 6.5v11l5.5-5.5z"/></svg>';
      divider.append(handle);

      const top = el("div", "viewer-onsite_top");
      const title = el("div", "viewer-onsite_title");
      const closeButton = button("viewer-onsite_close");
      closeButton.textContent = "×";
      top.append(title, closeButton);

      const hint = el("p", "viewer-onsite_hint");
      const starting = el("p", "viewer-onsite_starting");
      const status = el("p", "viewer-onsite_status");
      status.setAttribute("role", "status");
      status.hidden = true;

      const bar = el("div", "viewer-onsite_bar");
      const opacityRow = el("label", "viewer-onsite_row");
      const opacityLabel = el("span");
      const opacity = el("input");
      opacity.type = "range";
      opacity.min = "0";
      opacity.max = "1";
      opacity.step = "0.01";
      opacityRow.append(opacityLabel, opacity);
      const modes = el("div", "viewer-onsite_actions");
      const fadeButton = button();
      const swipeButton = button();
      const peekButton = button("viewer-onsite_peek");
      modes.append(fadeButton, swipeButton, peekButton);
      const actions = el("div", "viewer-onsite_actions");
      const resetButton = button();
      const captureButton = button("is-primary");
      actions.append(resetButton, captureButton);
      bar.append(opacityRow, modes, actions);

      root.append(video, stage, layer, divider, top, hint, starting, status, bar);
      document.body.append(root);

      closeButton.addEventListener("click", () => Viewer.closePhotoOnSite());
      opacity.addEventListener("input", () => Viewer.setPhotoOnSiteOpacity(opacity.value));
      fadeButton.addEventListener("click", () => Viewer.setPhotoOnSiteSwipe(false));
      swipeButton.addEventListener("click", () => Viewer.setPhotoOnSiteSwipe(true));
      resetButton.addEventListener("click", () => Viewer.resetPhotoOnSiteAlignment());
      captureButton.addEventListener("click", () => Viewer.capturePhotoOnSite());
      const peekOff = () => Viewer.setPhotoOnSitePeek(false);
      peekButton.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        peekButton.setPointerCapture?.(event.pointerId);
        Viewer.setPhotoOnSitePeek(true);
      });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => peekButton.addEventListener(type, peekOff));
      peekButton.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          Viewer.setPhotoOnSitePeek(true);
        }
      });
      peekButton.addEventListener("keyup", peekOff);
      peekButton.addEventListener("contextmenu", (event) => event.preventDefault());

      // The divider's handle.
      let dragging = false;
      handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        handle.setPointerCapture?.(event.pointerId);
        dragging = true;
      });
      handle.addEventListener("pointermove", (event) => {
        if (dragging) Viewer.setPhotoOnSiteSwipe(true, event.clientX / Math.max(window.innerWidth, 1));
      });
      const endDrag = (event) => {
        dragging = false;
        handle.releasePointerCapture?.(event.pointerId);
      };
      handle.addEventListener("pointerup", endDrag);
      handle.addEventListener("pointercancel", endDrag);
      handle.addEventListener("keydown", (event) => {
        const step = event.shiftKey ? 0.1 : 0.02;
        if (event.key === "ArrowLeft") Viewer.setPhotoOnSiteSwipe(true, state.swipePosition - step);
        else if (event.key === "ArrowRight") Viewer.setPhotoOnSiteSwipe(true, state.swipePosition + step);
        else return;
        event.preventDefault();
      });

      Viewer.bindPhotoOnSiteGestures(state, stage);

      const onResize = () => Viewer.syncPhotoOnSite();
      const onKeyDown = (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        Viewer.closePhotoOnSite();
      };
      window.addEventListener("resize", onResize);
      document.addEventListener("keydown", onKeyDown, true);

      state.ui = {
        root, video, stage, layer, frame, image, divider, handle, top, title, closeButton, hint, starting, status,
        opacityLabel, opacity, fadeButton, swipeButton, peekButton, resetButton, captureButton, onResize, onKeyDown,
      };
      image.src = state.item.src;
      Viewer.updatePhotoOnSiteLabels();
      Viewer.syncPhotoOnSite();
      state.hintTimer = setTimeout(() => hint.classList.add("is-faded"), HINT_MS);
      closeButton.focus({ preventScroll: true });
    },

    // One finger moves the photo; two pinch and turn it about their middle.
    bindPhotoOnSiteGestures(state, stage) {
      const pointers = state.pointers;
      const start = () => {
        const base = Viewer.getPhotoOnSiteBase();
        const points = [...pointers.values()];
        const center = points.reduce((sum, p) => ({ x: sum.x + p.x / points.length, y: sum.y + p.y / points.length }), { x: 0, y: 0 });
        const [a, b] = points;
        state.gesture = {
          alignment: { ...state.item.onSite },
          base,
          center,
          distance: b ? Math.hypot(b.x - a.x, b.y - a.y) : 0,
          angle: b ? Math.atan2(b.y - a.y, b.x - a.x) : 0,
        };
        Viewer.hidePhotoOnSiteHint();
      };
      stage.addEventListener("pointerdown", (event) => {
        if (pointers.size >= 2) return;
        event.preventDefault();
        stage.setPointerCapture?.(event.pointerId);
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        start();
      });
      stage.addEventListener("pointermove", (event) => {
        if (!pointers.has(event.pointerId) || !state.gesture) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const { alignment, base, center, distance, angle } = state.gesture;
        const points = [...pointers.values()];
        const now = points.reduce((sum, p) => ({ x: sum.x + p.x / points.length, y: sum.y + p.y / points.length }), { x: 0, y: 0 });
        let factor = 1;
        let turn = 0;
        if (points.length === 2 && distance > 0) {
          const [a, b] = points;
          factor = Math.hypot(b.x - a.x, b.y - a.y) / distance;
          turn = Math.atan2(b.y - a.y, b.x - a.x) - angle;
        }
        const scale = clamp(alignment.scale * factor, MIN_SCALE, MAX_SCALE);
        factor = scale / alignment.scale;
        // The photo's middle, turned and scaled about the gesture's start
        // point, then carried along with it.
        const midX = base.screenWidth / 2 + alignment.x * base.screenWidth - center.x;
        const midY = base.screenHeight / 2 + alignment.y * base.screenHeight - center.y;
        const cos = Math.cos(turn);
        const sin = Math.sin(turn);
        const nextX = now.x + factor * (midX * cos - midY * sin);
        const nextY = now.y + factor * (midX * sin + midY * cos);
        Viewer.setPhotoOnSiteAlignment({
          x: (nextX - base.screenWidth / 2) / base.screenWidth,
          y: (nextY - base.screenHeight / 2) / base.screenHeight,
          scale,
          rotation: alignment.rotation + (turn * 180) / Math.PI,
        });
      });
      const end = (event) => {
        if (!pointers.delete(event.pointerId)) return;
        stage.releasePointerCapture?.(event.pointerId);
        // The finger left on the screen carries on from here.
        if (pointers.size) start();
        else state.gesture = null;
      };
      stage.addEventListener("pointerup", end);
      stage.addEventListener("pointercancel", end);
      stage.addEventListener("wheel", (event) => {
        event.preventDefault();
        const current = state.item.onSite;
        if (event.shiftKey) Viewer.setPhotoOnSiteAlignment({ rotation: current.rotation + Math.sign(event.deltaY || event.deltaX) * 0.5 });
        else Viewer.setPhotoOnSiteAlignment({ scale: current.scale * Math.exp(-event.deltaY * 0.0015) });
        Viewer.hidePhotoOnSiteHint();
      }, { passive: false });
    },

    hidePhotoOnSiteHint() {
      const state = Viewer.photoOnSite;
      if (!state?.ui) return;
      clearTimeout(state.hintTimer);
      state.ui.hint.classList.add("is-faded");
    },

    // The camera frame as seen, with the photo over it as shown, as a JPEG.
    async renderPhotoOnSite() {
      const state = Viewer.photoOnSite;
      const ui = state?.ui;
      if (!ui) return null;
      const screenWidth = window.innerWidth || 1;
      const screenHeight = window.innerHeight || 1;
      const ratio = Math.min(CAPTURE_SIZE / Math.max(screenWidth, screenHeight), Math.max(window.devicePixelRatio || 1, 1) * 1.5);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(screenWidth * ratio);
      canvas.height = Math.round(screenHeight * ratio);
      const context = canvas.getContext("2d");
      context.scale(ratio, ratio);
      context.fillStyle = "#000";
      context.fillRect(0, 0, screenWidth, screenHeight);
      // The video fills the screen and is cropped (object-fit: cover).
      const video = ui.video;
      if (video.videoWidth && video.videoHeight) {
        const cover = Math.max(screenWidth / video.videoWidth, screenHeight / video.videoHeight);
        const width = video.videoWidth * cover;
        const height = video.videoHeight * cover;
        context.drawImage(video, (screenWidth - width) / 2, (screenHeight - height) / 2, width, height);
      }
      const image = ui.image;
      if (image.naturalWidth && image.naturalHeight) {
        const base = Viewer.getPhotoOnSiteBase();
        const { x, y, scale, rotation } = state.item.onSite;
        context.save();
        if (state.swipe && !state.peek) {
          context.beginPath();
          context.rect(0, 0, screenWidth * state.swipePosition, screenHeight);
          context.clip();
        }
        context.globalAlpha = state.peek || state.swipe ? 1 : state.opacity;
        context.translate(screenWidth / 2 + x * screenWidth, screenHeight / 2 + y * screenHeight);
        context.rotate((rotation * Math.PI) / 180);
        context.scale(scale, scale);
        context.drawImage(image, -base.width / 2, -base.height / 2, base.width, base.height);
        context.restore();
        if (state.swipe && !state.peek) {
          context.fillStyle = "rgba(255, 255, 255, 0.92)";
          context.fillRect(screenWidth * state.swipePosition - 1, 0, 2, screenHeight);
        }
      }
      return new Promise((resolve, reject) => {
        try {
          canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("empty capture"))), "image/jpeg", 0.92);
        } catch (error) {
          // A photo from a server without CORS headers taints the canvas.
          reject(error);
        }
      });
    },

    async capturePhotoOnSite() {
      const state = Viewer.photoOnSite;
      if (!state?.ui) return false;
      const item = state.item;
      const name = `${[item.year, readText(item.label) || item.id, "today"].filter((part) => part != null && part !== "")
        .join("-").replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 80)}.jpg`;
      let blob;
      try {
        blob = await Viewer.renderPhotoOnSite();
      } catch (error) {
        console.warn("On-site capture failed", error);
        Viewer.showPhotoOnSiteStatus(t("photos.onSite.captureFailed", "The comparison could not be saved: the photo's server does not allow it."));
        return false;
      }
      if (!blob) return false;
      const file = typeof File === "function" ? new File([blob], name, { type: "image/jpeg" }) : null;
      try {
        if (file && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: readText(item.label) || name });
          Viewer.showPhotoOnSiteStatus(t("photos.onSite.captured", "Comparison saved."));
          return true;
        }
      } catch (error) {
        if (error?.name === "AbortError") return false;
        // Sharing refused: downloaded instead.
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      Viewer.showPhotoOnSiteStatus(t("photos.onSite.captured", "Comparison saved."));
      return true;
    },

    // A short message inside the full-screen view (toasts lie under it).
    showPhotoOnSiteStatus(text) {
      const state = Viewer.photoOnSite;
      if (!state?.ui) return;
      const status = state.ui.status;
      status.textContent = text;
      status.hidden = false;
      clearTimeout(state.statusTimer);
      state.statusTimer = setTimeout(() => { status.hidden = true; }, 3000);
    },

    updatePhotoOnSiteLabels() {
      const state = Viewer.photoOnSite;
      const ui = state?.ui;
      if (!ui) return;
      const item = state.item;
      ui.root.setAttribute("aria-label", t("photos.onSite.title", "The photo on site"));
      ui.title.textContent = [item.year, readText(item.label)].filter((part) => part != null && part !== "").join(" – ") ||
        t("photos.onSite.title", "The photo on site");
      ui.image.alt = readText(item.label);
      ui.closeButton.title = t("photos.onSite.close", "Close the camera");
      ui.closeButton.setAttribute("aria-label", ui.closeButton.title);
      ui.hint.textContent = t("photos.onSite.hint", "Stand where the photo was taken. Drag the photo with one finger, pinch and turn it with two, until it lies over the place.");
      ui.starting.textContent = t("photos.onSite.starting", "Starting the camera…");
      ui.opacityLabel.textContent = t("photos.opacity", "Photo");
      ui.fadeButton.textContent = t("photos.onSite.fade", "Fade");
      ui.swipeButton.textContent = t("photos.onSite.divider", "Divider");
      ui.peekButton.textContent = t("photos.onSite.peek", "Hold: then");
      ui.peekButton.title = t("photos.onSite.peekTitle", "Hold to see only the photo");
      ui.resetButton.textContent = t("photos.onSite.reset", "Reset");
      ui.captureButton.textContent = t("photos.onSite.capture", "Save comparison");
      ui.handle.title = t("photos.onSite.dividerHandle", "Drag to compare then and now");
      ui.handle.setAttribute("aria-label", ui.handle.title);
    },
  });
}

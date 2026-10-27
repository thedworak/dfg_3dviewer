import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { applyRenderingSettings, getRenderingSettings } from "../rendering.js";
import { hideSmartHint, showSmartHint } from "../ui/smart-hint.js";
import { deviceTier, qualityForWeight } from "./performance-rules.js";

// Render quality, and a hint when the view stutters for a while.
//
// Three levels (Look > Rendering > Render quality): "high" as configured,
// "balanced" (no ambient occlusion, at most 1.25 pixels per CSS pixel) and
// "fast" (no post-processing, three quarters of a CSS pixel). Leaving "high"
// keeps the rendering settings it changes; back on "high" they return.
//
// The frame rate is measured every second (main.js animate). Below LOW_FPS
// for LOW_SECONDS in a row - not while a model loads or just after, nor in
// a hidden tab or a VR session - the hint offers the next lower level.
// Closed with its ×, it is not offered again in this session.
//
// Right after a model has loaded, its size is weighed against the device
// (assessModelWeight): a model far beyond what such a device draws smoothly
// gets the lower level offered at once, before the view stutters.

export const RENDER_QUALITIES = ["high", "balanced", "fast"];
const QUALITY = {
  high: { maxPixelRatio: Infinity, scale: 1 },
  balanced: { maxPixelRatio: 1.25, scale: 1, rendering: { postprocessing: { ao: false } } },
  fast: { maxPixelRatio: 1, scale: 0.75, rendering: { postprocessing: { enabled: false, ao: false } } },
};
const LOW_FPS = 24;
const LOW_SECONDS = 6;
// After loading: shaders compile, textures upload, the camera flies in.
const SETTLE_MS = 5000;
// A longer gap is the tab in the background or the page busy, not a frame.
const MAX_FRAME_MS = 1000;
const HINT_KEY = "performance";

export function attachPerformance(Viewer) {
  Object.assign(Viewer, {
    performance: {
      quality: "high",
      // The rendering settings "high" had, while on a lower level.
      saved: null,
      // Measuring: off in tests unless asked for (setPerformanceAdvisor).
      advisor: typeof window === "undefined" || !window.__E2E__,
      lastTime: null,
      windowStart: null,
      frames: 0,
      // The frame rates of the last seconds.
      history: [],
      settledAt: null,
      fps: null,
    },

    setPerformanceAdvisor(enabled) {
      Viewer.performance.advisor = enabled === true;
      Viewer.resetPerformanceSamples();
    },

    resetPerformanceSamples() {
      Object.assign(Viewer.performance, { lastTime: null, windowStart: null, frames: 0, history: [] });
    },

    getRenderQuality() {
      return Viewer.performance.quality;
    },

    // The renderer's pixel ratio for the current quality (main.js updateSize).
    getRenderPixelRatio() {
      const device = window.devicePixelRatio || 1;
      const quality = QUALITY[Viewer.performance.quality] || QUALITY.high;
      return Math.min(device, quality.maxPixelRatio) * quality.scale;
    },

    setRenderQuality(level, { silent = false } = {}) {
      const state = Viewer.performance;
      if (!RENDER_QUALITIES.includes(level) || level === state.quality) return false;
      // Back to what "high" had, then the new level's changes.
      if (state.saved) applyRenderingSettings(state.saved);
      if (level === "high") {
        state.saved = null;
      } else {
        state.saved = state.saved || getRenderingSettings();
        if (QUALITY[level].rendering) applyRenderingSettings(QUALITY[level].rendering);
      }
      state.quality = level;
      core.renderer?.setPixelRatio?.(Viewer.getRenderPixelRatio());
      Viewer.updateSize?.();
      Viewer.resetPerformanceSamples();
      Viewer.updateLightsSubmenuState?.();
      Viewer.updateEditorToolbarState?.();
      if (!silent) hideSmartHint(HINT_KEY);
      return true;
    },

    // The next lower level, as the hint offers it.
    lowerRenderQuality() {
      const next = RENDER_QUALITIES[RENDER_QUALITIES.indexOf(Viewer.performance.quality) + 1];
      if (!next) return false;
      const previous = Viewer.performance.quality;
      Viewer.setRenderQuality(next);
      showSmartHint({
        key: "performanceLowered",
        once: false,
        message: t("performance.lowered", { quality: t(`performance.quality.${next}`, next) }, "Render quality: {quality}."),
        duration: 8000,
        actions: [{ key: "undo", label: t("performance.undo", "Undo"), run: () => Viewer.setRenderQuality(previous) }],
      });
      return true;
    },

    // What the browser tells of the device (deviceTier).
    getDeviceInfo() {
      let gpu = "";
      try {
        const gl = core.renderer?.getContext?.();
        if (gl?.getParameter) gpu = String(gl.getParameter(gl.RENDERER) || "");
      } catch (_error) {
        // WebGPU, or a context lost.
      }
      return {
        coarse: window.matchMedia?.("(pointer: coarse)").matches === true,
        memory: navigator.deviceMemory ?? null,
        cores: navigator.hardwareConcurrency ?? null,
        gpu,
      };
    },

    // After loading (loaders.js): a model far too heavy for this device
    // gets the lower quality offered at once.
    assessModelWeight() {
      const state = Viewer.performance;
      if (!state.advisor || Viewer.urlOptions?.hideUi === true) return false;
      let triangles = 0;
      (Viewer.getSunModelRoots?.() || []).forEach((root) => root.traverse((object) => {
        const count = object.userData?.gaussianSplats?.count;
        if (Number.isFinite(count)) triangles += count;
        if (!object.isMesh || !object.geometry?.attributes?.position) return;
        const geometry = object.geometry;
        triangles += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1);
      }));
      const tier = deviceTier(Viewer.getDeviceInfo());
      const level = qualityForWeight(triangles, tier);
      if (!level || RENDER_QUALITIES.indexOf(level) <= RENDER_QUALITIES.indexOf(state.quality)) return false;
      return showSmartHint({
        key: "performanceHeavy",
        tone: "warning",
        message: t("performance.heavy", { triangles: (triangles / 1e6).toFixed(1) }, "A heavy model for this device ({triangles} M triangles)."),
        detail: t(`performance.offer.${level}`, ""),
        actions: [{
          key: "lower",
          primary: true,
          label: t("performance.lower", { quality: t(`performance.quality.${level}`, level) }, "Switch to {quality}"),
          run: () => {
            const previous = state.quality;
            Viewer.setRenderQuality(level);
            showSmartHint({
              key: "performanceLowered",
              once: false,
              message: t("performance.lowered", { quality: t(`performance.quality.${level}`, level) }, "Render quality: {quality}."),
              duration: 8000,
              actions: [{ key: "undo", label: t("performance.undo", "Undo"), run: () => Viewer.setRenderQuality(previous) }],
            });
          },
        }],
      });
    },

    // Is the viewer busy with something that makes frames slow anyway?
    isPerformanceBusy(time) {
      const state = Viewer.performance;
      const spinner = Viewer.spinnerElement;
      const loading = window.viewer?.fullModelLoaded !== true
        || Boolean(spinner && !spinner.hidden && !spinner.dataset.complete);
      if (loading) {
        state.settledAt = null;
        return true;
      }
      if (state.settledAt === null) state.settledAt = time;
      return time - state.settledAt < SETTLE_MS
        || document.hidden
        || Boolean(Viewer.xr?.session || core.renderer?.xr?.isPresenting)
        || Viewer.urlOptions?.hideUi === true;
    },

    // Every frame (main.js animate).
    samplePerformance(time) {
      const state = Viewer.performance;
      if (!state.advisor || !Number.isFinite(time)) return;
      const last = state.lastTime;
      state.lastTime = time;
      if (Viewer.isPerformanceBusy(time) || last === null || time - last > MAX_FRAME_MS) {
        state.windowStart = null;
        state.frames = 0;
        if (last !== null && time - last > MAX_FRAME_MS) state.history = [];
        return;
      }
      if (state.windowStart === null) {
        state.windowStart = time;
        state.frames = 0;
        return;
      }
      state.frames += 1;
      const elapsed = time - state.windowStart;
      if (elapsed < 1000) return;
      Viewer.recordPerformanceSecond(state.frames * 1000 / elapsed);
      state.windowStart = time;
      state.frames = 0;
    },

    // One second's frame rate; the hint after LOW_SECONDS slow ones.
    recordPerformanceSecond(fps) {
      const state = Viewer.performance;
      state.fps = fps;
      state.history.push(fps);
      if (state.history.length > LOW_SECONDS) state.history.shift();
      if (state.history.length < LOW_SECONDS || state.history.some((value) => value >= LOW_FPS)) return false;
      state.history = [];
      return Viewer.offerLowerRenderQuality(fps);
    },

    offerLowerRenderQuality(fps) {
      const next = RENDER_QUALITIES[RENDER_QUALITIES.indexOf(Viewer.performance.quality) + 1];
      if (!next) return false;
      return showSmartHint({
        key: HINT_KEY,
        tone: "warning",
        message: t("performance.slow", { fps: Math.round(fps) }, "The view is stuttering (about {fps} frames per second)."),
        detail: t(`performance.offer.${next}`, ""),
        actions: [{
          key: "lower",
          primary: true,
          label: t("performance.lower", { quality: t(`performance.quality.${next}`, next) }, "Switch to {quality}"),
          run: () => Viewer.lowerRenderQuality(),
        }],
      });
    },
  });
}

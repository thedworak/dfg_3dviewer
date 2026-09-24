import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { toastHelper } from "../viewer-utils.js";
import { getViewerSideStack } from "../ui/side-stack.js";

// Guided tour: steps through the model's annotations in marker order, flying
// the camera to each one and showing its title and description in a panel.
// Each annotation can carry its own camera pose (`view`, captured in the
// annotation dialog); annotations without one get a view computed from their
// faces' position and normal.
// Settings (viewer-settings.json → viewer.tour):
//   autostart (bool, default false) - start once the model and annotations load
//   autoplay (bool, default false)  - advance steps automatically
//   stepDuration (seconds, default 6) - pause on each step while autoplaying
//   transitionDuration (seconds, default 1.5) - camera flight time
//   loop (bool, default true) - wrap around at the last step while autoplaying
// URL overrides: ?tour=1, ?tourAutoplay=0|1, ?tourStep=<1-based index>,
// ?tourInterval=<seconds>.

const HIGHLIGHT_SCALE = 1.6;

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

export function attachTour(Viewer) {
  Object.assign(Viewer, {
    tourState: null,
    tourAutostartDone: false,

    getTourOptions() {
      const config = core.CONFIG?.viewer?.tour || {};
      const params = new URLSearchParams(window.location.search);
      const autostartParam = Viewer.parseBooleanParam?.(params.get("tour"));
      const autoplayParam = Viewer.parseBooleanParam?.(params.get("tourAutoplay"));
      const intervalParam = Viewer.parseFloatParam?.(params.get("tourInterval"));
      const stepParam = Number.parseInt(params.get("tourStep") || "", 10);
      const stepDuration = Number.isFinite(intervalParam) ? intervalParam : Number(config.stepDuration);
      const transitionDuration = Number(config.transitionDuration);
      return {
        autostart: typeof autostartParam === "boolean" ? autostartParam : config.autostart === true,
        autoplay: typeof autoplayParam === "boolean" ? autoplayParam : config.autoplay === true,
        startStep: Number.isInteger(stepParam) && stepParam > 0 ? stepParam - 1 : 0,
        stepDurationMs: (Number.isFinite(stepDuration) && stepDuration > 0 ? stepDuration : 6) * 1000,
        transitionDurationMs: prefersReducedMotion()
          ? 0
          : (Number.isFinite(transitionDuration) && transitionDuration >= 0 ? transitionDuration : 1.5) * 1000,
        loop: config.loop !== false,
      };
    },

    // Annotations whose target object is in the scene, in marker order
    // (the index matches the number drawn on the marker).
    getTourSteps() {
      const entries = Viewer.getAnnotationEntriesForPersistence?.() || [];
      return entries
        .map((entry, index) => ({ entry, markerNumber: index + 1 }))
        .filter(({ entry }) => Viewer.getAnnotationEntryCenter(entry));
    },

    isTourActive() {
      return Viewer.tourState?.active === true;
    },

    startTour(options = {}) {
      const steps = Viewer.getTourSteps();
      if (!steps.length) {
        toastHelper("tourNoAnnotations", "warning");
        return false;
      }

      const tourOptions = { ...Viewer.getTourOptions(), ...options };
      if (Viewer.tourState?.active) Viewer.stopTour({ restoreAutoRotate: false });

      Viewer.closeAnnotationPOITooltip?.();
      Viewer.closeAnnotationDialog?.();
      Viewer.hideInteractionHintForTour();

      Viewer.tourState = {
        active: true,
        steps,
        index: -1,
        playing: tourOptions.autoplay === true,
        options: tourOptions,
        timer: null,
        flight: null,
        highlighted: null,
        savedAutoRotate: core.controls?.autoRotate === true,
        ui: null,
      };
      if (core.controls) core.controls.autoRotate = false;

      Viewer.createTourPanel();
      Viewer.bindTourInterruptListeners();
      Viewer.updateEditorToolbarState?.();
      const startIndex = Math.min(Math.max(tourOptions.startStep || 0, 0), steps.length - 1);
      Viewer.goToTourStep(startIndex);
      return true;
    },

    stopTour({ restoreAutoRotate = true } = {}) {
      const state = Viewer.tourState;
      if (!state) return false;
      clearTimeout(state.timer);
      state.flight = null;
      Viewer.setTourHighlight(null);
      Viewer.unbindTourInterruptListeners();
      state.ui?.panel.remove();
      if (restoreAutoRotate && core.controls) core.controls.autoRotate = state.savedAutoRotate;
      Viewer.tourState = null;
      Viewer.updateEditorToolbarState?.();
      return true;
    },

    toggleTour() {
      return Viewer.isTourActive() ? Viewer.stopTour() : Viewer.startTour();
    },

    goToTourStep(index, { fly = true } = {}) {
      const state = Viewer.tourState;
      if (!state?.active || !state.steps.length) return false;
      const count = state.steps.length;
      const nextIndex = ((index % count) + count) % count;
      clearTimeout(state.timer);
      state.index = nextIndex;

      const step = state.steps[nextIndex];
      Viewer.setTourHighlight(step.entry);
      Viewer.syncTourPanel();

      const view = Viewer.resolveTourStepView(step.entry);
      if (fly && view) {
        Viewer.flyTourCamera(view, state.options.transitionDurationMs, () => Viewer.scheduleNextTourStep());
      } else {
        Viewer.scheduleNextTourStep();
      }
      return true;
    },

    nextTourStep() {
      const state = Viewer.tourState;
      if (!state?.active) return false;
      return Viewer.goToTourStep(state.index + 1);
    },

    previousTourStep() {
      const state = Viewer.tourState;
      if (!state?.active) return false;
      return Viewer.goToTourStep(state.index - 1);
    },

    // Go to the step of a clicked POI marker. Returns false when the marker
    // is not part of the running tour.
    goToTourStepForMarker(marker) {
      const state = Viewer.tourState;
      if (!state?.active) return false;
      const annotationId = String(marker?.userData?.annotationId || "");
      const index = state.steps.findIndex(({ entry }) => String(entry.id) === annotationId);
      if (index < 0) return false;
      Viewer.pauseTour();
      return Viewer.goToTourStep(index);
    },

    playTour() {
      const state = Viewer.tourState;
      if (!state?.active) return false;
      state.playing = true;
      Viewer.syncTourPanel();
      // Resuming on the last step of a non-looping tour starts over.
      if (!state.options.loop && state.index >= state.steps.length - 1) {
        return Viewer.goToTourStep(0);
      }
      if (!state.flight) Viewer.scheduleNextTourStep();
      return true;
    },

    pauseTour() {
      const state = Viewer.tourState;
      if (!state?.active || !state.playing) return false;
      state.playing = false;
      clearTimeout(state.timer);
      Viewer.syncTourPanel();
      return true;
    },

    toggleTourPlayback() {
      const state = Viewer.tourState;
      if (!state?.active) return false;
      return state.playing ? Viewer.pauseTour() : Viewer.playTour();
    },

    scheduleNextTourStep() {
      const state = Viewer.tourState;
      if (!state?.active || !state.playing) return;
      clearTimeout(state.timer);
      const isLast = state.index >= state.steps.length - 1;
      if (isLast && !state.options.loop) {
        state.playing = false;
        Viewer.syncTourPanel();
        return;
      }
      state.timer = setTimeout(() => Viewer.nextTourStep(), state.options.stepDurationMs);
    },

    // Camera pose for a step: the annotation's saved view, or one looking at
    // its faces along their normal from a distance scaled to the model.
    resolveTourStepView(entry) {
      const saved = Viewer.normalizeAnnotationView?.(entry?.view);
      if (saved) {
        return {
          position: new THREE.Vector3().fromArray(saved.position),
          target: new THREE.Vector3().fromArray(saved.target),
          fov: saved.fov,
        };
      }

      const center = Viewer.getAnnotationEntryCenter(entry);
      if (!center || !core.camera) return null;

      let direction = Viewer.getAnnotationEntryNormal(entry);
      if (!direction) {
        direction = core.camera.position.clone().sub(center);
        if (direction.lengthSq() === 0) direction.set(0, 0, 1);
        direction.normalize();
      }

      const radius = Viewer.getTourModelRadius();
      const fov = core.camera.isPerspectiveCamera ? core.camera.fov : 45;
      // Frame roughly half of the model around the annotation.
      const distance = Math.max(radius * 0.5 / Math.tan(THREE.MathUtils.degToRad(fov / 2)), radius * 0.2, 0.01);
      return {
        position: center.clone().addScaledVector(direction, distance),
        target: center,
      };
    },

    getTourModelRadius() {
      const roots = (Array.isArray(core.mainObject) ? core.mainObject : [core.mainObject])
        .filter((object) => object?.isObject3D);
      const box = new THREE.Box3();
      roots.forEach((object) => box.expandByObject(object, true));
      if (box.isEmpty()) {
        return Math.max(core.camera?.position?.distanceTo?.(core.controls?.target || new THREE.Vector3()) || 1, 0.01) / 2;
      }
      return box.getBoundingSphere(new THREE.Sphere()).radius || 1;
    },

    flyTourCamera(view, durationMs, onComplete) {
      const state = Viewer.tourState;
      if (!state || !core.camera || !core.controls) return;

      // Take over from any running camera tween (initial fit, keyboard moves).
      core.cameraTweenToken = (core.cameraTweenToken ?? 0) + 1;
      core.cameraTween?.stop?.();
      core.targetTween?.stop?.();

      const startFov = core.camera.isPerspectiveCamera ? core.camera.fov : null;
      state.flight = {
        startTime: performance.now(),
        duration: Math.max(0, durationMs),
        fromPosition: core.camera.position.clone(),
        fromTarget: core.controls.target.clone(),
        toPosition: view.position.clone(),
        toTarget: view.target.clone(),
        fromFov: startFov,
        toFov: startFov != null && Number.isFinite(view.fov) ? view.fov : startFov,
        onComplete,
      };
      Viewer.updateTour(state.flight.startTime);
    },

    // Called from the render loop.
    updateTour(time = performance.now()) {
      const flight = Viewer.tourState?.flight;
      if (!flight) return;

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

      if (progress >= 1) {
        Viewer.tourState.flight = null;
        flight.onComplete?.();
      }
    },

    setTourHighlight(entry) {
      const state = Viewer.tourState;
      const previous = state?.highlighted;
      if (previous?.marker) {
        previous.marker.scale.copy(previous.baseScale);
        previous.marker.renderOrder = previous.renderOrder;
      }
      if (state) state.highlighted = null;
      if (!entry || !state) return;

      const marker = (Viewer.annotationPOIMarkers || [])
        .find((item) => String(item.userData?.annotationId || "") === String(entry.id));
      if (!marker) return;
      state.highlighted = { marker, baseScale: marker.scale.clone(), renderOrder: marker.renderOrder };
      marker.scale.multiplyScalar(HIGHLIGHT_SCALE);
      marker.renderOrder = 999;
    },

    hideInteractionHintForTour() {
      if (core.handHint) {
        core.handHint.hidden = true;
        core.handHint.classList.remove("hand-drag-animate");
      }
      if (core.GESTURE?.active) Viewer.stopGesture?.();
      if (core.GESTURE) core.GESTURE.rotate = false;
    },

    // Dragging or zooming the model pauses autoplay; the tour stays open.
    bindTourInterruptListeners() {
      const canvas = core.renderer?.domElement;
      const state = Viewer.tourState;
      if (!canvas || !state) return;
      const interrupt = () => {
        if (!Viewer.tourState?.active) return;
        Viewer.tourState.flight = null;
        Viewer.pauseTour();
      };
      state.interruptHandler = interrupt;
      canvas.addEventListener("pointerdown", interrupt);
      canvas.addEventListener("wheel", interrupt, { passive: true });
    },

    unbindTourInterruptListeners() {
      const canvas = core.renderer?.domElement;
      const handler = Viewer.tourState?.interruptHandler;
      if (!canvas || !handler) return;
      canvas.removeEventListener("pointerdown", handler);
      canvas.removeEventListener("wheel", handler);
    },

    createTourPanel() {
      const state = Viewer.tourState;
      const stack = getViewerSideStack();
      if (!state || !stack) return;

      const panel = document.createElement("section");
      panel.id = "viewerTourPanel";
      panel.className = "viewer-tour-panel";

      const header = document.createElement("div");
      header.className = "viewer-tour-panel_header";
      const counter = document.createElement("span");
      counter.className = "viewer-tour-panel_counter";
      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "viewer-tour-panel_close";
      closeButton.textContent = "×";
      header.append(counter, closeButton);

      const body = document.createElement("div");
      body.className = "viewer-tour-panel_body";
      body.setAttribute("aria-live", "polite");
      body.setAttribute("aria-atomic", "true");
      const title = document.createElement("h4");
      title.className = "viewer-tour-panel_title";
      const description = document.createElement("p");
      description.className = "viewer-tour-panel_description";
      body.append(title, description);

      const controls = document.createElement("div");
      controls.className = "viewer-tour-panel_controls";
      const prevButton = document.createElement("button");
      prevButton.type = "button";
      prevButton.className = "viewer-tour-panel_prev";
      prevButton.textContent = "‹";
      const playButton = document.createElement("button");
      playButton.type = "button";
      playButton.className = "viewer-tour-panel_play";
      const nextButton = document.createElement("button");
      nextButton.type = "button";
      nextButton.className = "viewer-tour-panel_next";
      nextButton.textContent = "›";
      controls.append(prevButton, playButton, nextButton);

      panel.append(header, body, controls);

      // Keep input on the panel away from the orbit controls and the
      // viewer's own shortcuts.
      ["pointerdown", "pointerup", "wheel"].forEach((type) => {
        panel.addEventListener(type, (event) => event.stopPropagation());
      });
      panel.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.target?.closest?.("button") && (event.key === "Enter" || event.key === " ")) return;
        const handled = Viewer.handleTourKey(event.key);
        if (handled) event.preventDefault();
      });

      closeButton.addEventListener("click", () => Viewer.stopTour());
      prevButton.addEventListener("click", () => {
        Viewer.pauseTour();
        Viewer.previousTourStep();
      });
      nextButton.addEventListener("click", () => {
        Viewer.pauseTour();
        Viewer.nextTourStep();
      });
      playButton.addEventListener("click", () => Viewer.toggleTourPlayback());

      stack.prepend(panel);
      state.ui = { panel, counter, closeButton, title, description, prevButton, playButton, nextButton };
      Viewer.updateTourLabels();
    },

    // Shared by the panel and the canvas key handler. Returns true when the
    // key was used.
    handleTourKey(key) {
      if (!Viewer.isTourActive()) return false;
      switch (key) {
        case "Escape":
          return Viewer.stopTour();
        case "PageDown":
        case "n":
        case "N":
          Viewer.pauseTour();
          return Viewer.nextTourStep();
        case "PageUp":
        case "p":
        case "P":
          Viewer.pauseTour();
          return Viewer.previousTourStep();
        case "ArrowRight":
        case "ArrowLeft":
          // Only reached from inside the panel; on the canvas arrows orbit.
          Viewer.pauseTour();
          return key === "ArrowRight" ? Viewer.nextTourStep() : Viewer.previousTourStep();
        default:
          return false;
      }
    },

    updateTourLabels() {
      const ui = Viewer.tourState?.ui;
      if (!ui) return;
      ui.panel.setAttribute("aria-label", t("tour.panel", "Guided tour"));
      ui.closeButton.setAttribute("aria-label", t("tour.close", "Close tour (Esc)"));
      ui.closeButton.title = t("tour.close", "Close tour (Esc)");
      ui.prevButton.setAttribute("aria-label", t("tour.previous", "Previous step (P)"));
      ui.prevButton.title = t("tour.previous", "Previous step (P)");
      ui.nextButton.setAttribute("aria-label", t("tour.next", "Next step (N)"));
      ui.nextButton.title = t("tour.next", "Next step (N)");
      Viewer.syncTourPanel();
    },

    syncTourPanel() {
      const state = Viewer.tourState;
      const ui = state?.ui;
      if (!ui) return;
      const step = state.steps[state.index];
      ui.counter.textContent = t("tour.step", {
        current: state.index + 1,
        total: state.steps.length,
      }, "Step {current} / {total}");
      ui.title.textContent = step
        ? `${step.markerNumber}. ${step.entry.title || t("tour.untitled", "Untitled annotation")}`
        : "";
      ui.description.textContent = step?.entry.description || "";
      ui.description.hidden = !step?.entry.description;
      const playLabel = state.playing ? t("tour.pause", "Pause tour") : t("tour.play", "Play tour");
      ui.playButton.textContent = state.playing ? "❚❚" : "▶";
      ui.playButton.setAttribute("aria-label", playLabel);
      ui.playButton.setAttribute("aria-pressed", state.playing ? "true" : "false");
      ui.playButton.title = playLabel;
      const single = state.steps.length < 2;
      ui.prevButton.disabled = single;
      ui.nextButton.disabled = single;
      ui.playButton.disabled = single;
    },

    // Annotations were added, removed or re-imported: keep a running tour in
    // sync and start a pending autostart once there is something to show.
    onAnnotationsChangedForTour() {
      const state = Viewer.tourState;
      if (state?.active) {
        const currentId = state.steps[state.index]?.entry?.id;
        const steps = Viewer.getTourSteps();
        if (!steps.length) {
          Viewer.stopTour();
          return;
        }
        state.steps = steps;
        const sameIndex = steps.findIndex(({ entry }) => entry.id === currentId);
        state.index = sameIndex >= 0 ? sameIndex : Math.min(state.index, steps.length - 1);
        // Markers were rebuilt, so the old highlight points at a disposed sprite.
        state.highlighted = null;
        Viewer.setTourHighlight(steps[state.index].entry);
        Viewer.syncTourPanel();
        return;
      }
      Viewer.maybeAutostartTour();
    },

    maybeAutostartTour() {
      if (Viewer.tourAutostartDone || Viewer.isTourActive()) return false;
      if (!Viewer.getTourOptions().autostart) return false;
      if (!Viewer.getTourSteps().length) return false;
      Viewer.tourAutostartDone = true;
      return Viewer.startTour();
    },
  });
}

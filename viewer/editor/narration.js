import { core } from "../core.js";
import { t } from "../i18n-utils.js";

// Narration: an annotation's sound (entry.audio: { src, captions }) - a
// voice telling about the place, an interview, a recording made there.
// Played by the guided tour when it comes to the annotation (tour.js: the
// next step waits until it has been told) or from the annotation dialog.
// Its captions (a WebVTT file) are shown over the scene, one line at a time,
// for those who cannot hear it or have the sound off.
//
// One narration plays at a time, not through the scene's sounds
// (editor/scene-sounds.js), which go on under it, quieter.

// entry.audio as the manifest or the dialog gives it -> { src, captions? }
// or null.
export function normalizeAnnotationAudio(raw) {
  const value = typeof raw === "string" ? { src: raw } : raw;
  const src = String(value?.src || value?.url || "").trim();
  if (!src) return null;
  const captions = String(value?.captions || "").trim();
  return { src, ...(captions ? { captions } : {}) };
}

export function attachNarration(Viewer) {
  Object.assign(Viewer, {
    narrationState: null,

    isNarrationPlaying() {
      const element = Viewer.narrationState?.element;
      return Boolean(element && !element.paused && !element.ended);
    },

    // The annotation whose narration plays (or is paused), or null.
    getNarrationEntryId() {
      return Viewer.narrationState?.entryId ?? null;
    },

    // Plays the annotation's narration; onEnd when it has been told (not
    // when it is stopped). Resolves to whether it started.
    async playNarration(entry, { onEnd = null } = {}) {
      const audio = normalizeAnnotationAudio(entry?.audio);
      Viewer.stopNarration();
      if (!audio) return false;
      const element = new Audio();
      element.preload = "auto";
      element.crossOrigin = "anonymous";
      element.src = audio.src;
      const state = { entryId: String(entry.id ?? ""), element, onEnd, track: null };
      Viewer.narrationState = state;
      if (audio.captions) {
        const track = document.createElement("track");
        track.kind = "captions";
        track.src = audio.captions;
        track.default = true;
        element.appendChild(track);
        state.track = track;
        // Hidden: read here, not drawn by the browser (an <audio> has no
        // place to draw them).
        track.track.mode = "hidden";
        track.track.addEventListener("cuechange", () => Viewer.showNarrationCaption(track.track));
      }
      element.addEventListener("ended", () => {
        if (Viewer.narrationState !== state) return;
        Viewer.showNarrationCaption(null);
        Viewer.duckSceneSounds?.(false);
        const done = state.onEnd;
        state.onEnd = null;
        Viewer.syncNarrationControls();
        done?.();
      });
      element.addEventListener("error", () => {
        if (Viewer.narrationState !== state) return;
        console.warn("Could not play the narration", audio.src);
        const done = state.onEnd;
        Viewer.stopNarration();
        done?.();
      });
      ["play", "pause"].forEach((type) => element.addEventListener(type, () => Viewer.syncNarrationControls()));
      try {
        await element.play();
      } catch (error) {
        // No click yet (autoplay blocked), or no file: the caller goes on.
        console.warn("Could not play the narration", error);
        if (Viewer.narrationState === state) Viewer.stopNarration();
        return false;
      }
      Viewer.duckSceneSounds?.(true);
      Viewer.syncNarrationControls();
      return true;
    },

    pauseNarration() {
      Viewer.narrationState?.element.pause();
      Viewer.duckSceneSounds?.(false);
    },

    resumeNarration() {
      const element = Viewer.narrationState?.element;
      if (!element || element.ended) return false;
      element.play().catch(() => {});
      Viewer.duckSceneSounds?.(true);
      return true;
    },

    stopNarration() {
      const state = Viewer.narrationState;
      if (!state) return;
      Viewer.narrationState = null;
      state.onEnd = null;
      state.element.pause();
      state.element.removeAttribute("src");
      state.element.load();
      Viewer.showNarrationCaption(null);
      Viewer.duckSceneSounds?.(false);
      Viewer.syncNarrationControls();
    },

    // The current cue of the captions, over the scene.
    showNarrationCaption(track) {
      const cue = track?.activeCues?.[track.activeCues.length - 1];
      const text = cue ? String(cue.text || "").replace(/<[^>]+>/g, "").trim() : "";
      let bar = Viewer.narrationCaption;
      if (!text) {
        if (bar) bar.hidden = true;
        return;
      }
      if (!bar) {
        bar = document.createElement("div");
        bar.className = "viewer-narration-caption";
        bar.setAttribute("role", "status");
        bar.setAttribute("aria-live", "polite");
        (core.container || document.body).appendChild(bar);
        Viewer.narrationCaption = bar;
      }
      bar.textContent = text;
      bar.hidden = false;
    },

    // The narration's buttons (the tour panel's, the dialog's) follow it.
    syncNarrationControls() {
      Viewer.syncTourNarration?.();
      const button = Viewer.annotationDialogNarrationButton;
      if (button) {
        const playing = Viewer.isNarrationPlaying() && Viewer.getNarrationEntryId() === "dialog";
        button.textContent = playing ? t("narration.stop", "❚❚ Stop") : t("narration.listen", "▶ Listen");
      }
    },
  });
}

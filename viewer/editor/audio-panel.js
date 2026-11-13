import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { getViewerSideStack } from "../ui/side-stack.js";
import { attachToolPanelChrome, isToolPanelMinimized, PANEL_ICONS, setToolPanelMinimized } from "../ui/tool-panel-chrome.js";
import { PHONE_TOOLBAR_QUERY } from "../editor-toolbar.js";

// Audio controls, shown when the loaded model is an audio file (audio.js):
//
//   play, pause, stop, loop and the time; the waveform of the whole file -
//   a click jumps there, a drag selects a part to play (and loop); the
//   file's markers to jump to; a view of the sound - its spectrogram, or,
//   while it plays, its spectrum or its waveform live (oscilloscope);
//   the speed (with or without the pitch), the volume, the channels, a
//   filter, an even loudness and a reverberation; the 3D scene's
//   frequency axis, levels and height; below, what the file is.
//
// While the panel is not open (on phones: minimized to its icon), a small
// player stays at the bottom, above the toolbar: back and forward, play or
// pause, stop, repeat and the time, to be reached with a thumb.
//
// In the scene, the playhead's pane (audio.js) is dragged with the pointer
// to move the time, as the panel's waveform is clicked.
//
// Like the volume settings (volume-panel.js): it opens by itself in the
// side stack; on phones it appears minimized to its icon and opens as a
// modal window. The toolbar's audio button toggles it. Its canvases are
// drawn each frame (updateAudio, from main.js animate) while it is open.

const isPhone = () => window.matchMedia(PHONE_TOOLBAR_QUERY).matches;
// The mini player's back and forward step, in seconds.
const MINI_STEP = 5;
const MINI_GAP = 8;
const VIEWS = ["spectrogram", "spectrum", "scope"];
const FILTER_MIN = 20;
const FILTER_MAX = 20000;

const sliderToFrequency = (value) => FILTER_MIN * Math.pow(FILTER_MAX / FILTER_MIN, Number(value) / 100);
const frequencyToSlider = (hz) => Math.round((Math.log(hz / FILTER_MIN) / Math.log(FILTER_MAX / FILTER_MIN)) * 100);

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

const formatDb = (db) => (Number.isFinite(db) ? `${db.toFixed(1)} dBFS` : "–∞ dBFS");

// A canvas sized for the screen's pixels; returns its 2D context.
function fitCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return canvas.getContext("2d");
}

export function attachAudioPanel(Viewer) {
  Object.assign(Viewer, {
    audioState: null,

    // Called after a model is added to the scene (loaders.js).
    setupAudioControls(root) {
      Viewer.disposeAudioControls();
      if (!root?.userData?.isAudio) return false;
      const state = {
        root,
        api: null,
        player: null,
        collapsed: false,
        hidden: false,
        view: "spectrogram",
        ui: null,
        drag: null,
        cache: {},
        unsubscribe: null,
      };
      Viewer.audioState = state;
      // audio.js is loaded already (loaders.js); this only fetches the module.
      import("../audio.js").then((api) => {
        if (Viewer.audioState !== state) return;
        state.api = api;
        state.player = api.getAudioState(root)?.player || null;
        if (!state.player) return;
        state.unsubscribe = state.player.on(() => Viewer.syncAudioPanel());
        Viewer.bindAudioPlayheadDrag();
        Viewer.createAudioPanel();
        Viewer.updateEditorToolbarState?.();
      });
      return true;
    },

    disposeAudioControls() {
      const state = Viewer.audioState;
      if (!state) return;
      state.unsubscribe?.();
      Viewer.endAudioPlayheadDrag(state);
      state.player?.pause();
      state.ui?.root.remove();
      state.mini?.root.remove();
      Viewer.audioState = null;
      Viewer.updateEditorToolbarState?.();
    },

    isAudioActive() {
      return Boolean(Viewer.audioState?.player);
    },

    isAudioPanelVisible() {
      const state = Viewer.audioState;
      return Boolean(state?.ui && !state.hidden && !(isPhone() && isToolPanelMinimized(state.ui.root)));
    },

    toggleAudioPanel() {
      const state = Viewer.audioState;
      if (!state?.ui) return;
      if (isPhone()) {
        const open = !state.hidden && !isToolPanelMinimized(state.ui.root);
        state.hidden = false;
        state.collapsed = false;
        Viewer.syncAudioPanel();
        setToolPanelMinimized(state.ui.root, open);
        Viewer.updateEditorToolbarState?.();
        return;
      }
      state.hidden = !state.hidden;
      if (!state.hidden) state.collapsed = false;
      Viewer.syncAudioPanel();
      Viewer.updateEditorToolbarState?.();
    },

    closeAudioPanel() {
      const state = Viewer.audioState;
      if (!state?.ui) return;
      state.hidden = true;
      Viewer.syncAudioPanel();
      Viewer.updateEditorToolbarState?.();
    },

    // Play or pause (the panel's button, Space in the panel).
    toggleAudioPlayback() {
      const player = Viewer.audioState?.player;
      player?.toggle().catch((error) => console.warn("Could not play the audio file", error));
    },

    // Changes the 3D scene's settings (root.userData.audio).
    updateAudioSceneSettings(change) {
      const state = Viewer.audioState;
      if (!state?.api) return;
      change(state.root.userData.audio);
      state.api.applyAudioSettings(state.root);
      state.cache = {};
      Viewer.syncAudioPanel();
    },

    updateAudioPlayback(change) {
      Viewer.audioState?.player?.update(change);
      Viewer.syncAudioPanel();
    },

    // ---- The playhead dragged in the scene ----

    bindAudioPlayheadDrag() {
      const canvas = core.renderer?.domElement;
      if (!canvas || Viewer.audioPlayheadCanvas === canvas) return;
      Viewer.audioPlayheadCanvas = canvas;
      Viewer.audioPlayheadRaycaster = new THREE.Raycaster();
      // Capture phase: a grab on the pane never reaches OrbitControls.
      canvas.addEventListener("pointerdown", Viewer.onAudioPlayheadPointerDown, { capture: true });
      canvas.addEventListener("pointermove", Viewer.onAudioPlayheadPointerMove);
      canvas.addEventListener("pointerup", Viewer.onAudioPlayheadPointerUp);
      canvas.addEventListener("pointercancel", Viewer.onAudioPlayheadPointerUp);
      canvas.addEventListener("pointerleave", () => Viewer.setAudioPlayheadHover(false));
    },

    getAudioPointerRay(event) {
      const canvas = core.renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      Viewer.audioPlayheadRaycaster.setFromCamera(pointer, core.camera);
      return Viewer.audioPlayheadRaycaster.ray;
    },

    // Where the pointer meets the playhead's pane (audio.js), or null.
    pickAudioPlayhead(event) {
      const state = Viewer.audioState;
      if (!state?.api || !state.player || !core.camera || state.root.visible === false) return null;
      return state.api.hitAudioPlayhead(state.root, Viewer.getAudioPointerRay(event));
    },

    setAudioPlayheadHover(hover) {
      const state = Viewer.audioState;
      if (!state || state.playheadHover === hover) return;
      state.playheadHover = hover;
      const canvas = core.renderer?.domElement;
      if (canvas && !state.playheadDrag) canvas.style.cursor = hover ? "ew-resize" : "";
    },

    seekAudioToPointer(event) {
      const state = Viewer.audioState;
      const time = state.api.audioTimeAtRay(state.root, Viewer.getAudioPointerRay(event), state.playheadDrag?.grab);
      if (time !== null) state.player.currentTime = time;
    },

    onAudioPlayheadPointerDown(event) {
      if (event.button !== 0 || Viewer.clippingState?.drag) return;
      const state = Viewer.audioState;
      const grab = state ? Viewer.pickAudioPlayhead(event) : null;
      if (!grab) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const canvas = core.renderer.domElement;
      canvas.setPointerCapture?.(event.pointerId);
      state.playheadDrag = { pointerId: event.pointerId, grab, controlsEnabled: core.controls?.enabled !== false };
      if (core.controls) core.controls.enabled = false;
      // Keep the click handler in picking.js from treating the release as a click.
      Viewer.onDownPosition?.set?.(Number.NaN, Number.NaN);
      canvas.style.cursor = "grabbing";
      Viewer.disableInteractionHint?.();
      Viewer.seekAudioToPointer(event);
    },

    onAudioPlayheadPointerMove(event) {
      const state = Viewer.audioState;
      if (!state) return;
      if (!state.playheadDrag) {
        if (event.buttons === 0 && !Viewer.clippingState?.drag) Viewer.setAudioPlayheadHover(Boolean(Viewer.pickAudioPlayhead(event)));
        return;
      }
      if (event.pointerId !== state.playheadDrag.pointerId) return;
      Viewer.seekAudioToPointer(event);
    },

    onAudioPlayheadPointerUp(event) {
      const state = Viewer.audioState;
      if (!state?.playheadDrag || event.pointerId !== state.playheadDrag.pointerId) return;
      core.renderer.domElement.releasePointerCapture?.(event.pointerId);
      Viewer.endAudioPlayheadDrag(state);
      state.playheadHover = Boolean(Viewer.pickAudioPlayhead(event));
      core.renderer.domElement.style.cursor = state.playheadHover ? "ew-resize" : "";
    },

    endAudioPlayheadDrag(state) {
      const drag = state?.playheadDrag;
      if (!drag) return;
      state.playheadDrag = null;
      if (core.controls) core.controls.enabled = drag.controlsEnabled;
      if (core.renderer?.domElement) core.renderer.domElement.style.cursor = "";
    },

    // ---- manifests ----

    // AIM3DViewer.audio: the 3D view's settings and the playback's, those
    // that are not the defaults.
    getAudioForExport() {
      const state = Viewer.audioState;
      if (!state?.api || !state.player) return undefined;
      const scene = Object.fromEntries(Object.entries(state.root.userData.audio)
        .filter(([key, value]) => state.api.DEFAULT_AUDIO_SETTINGS[key] !== value));
      const { volume, rate, preservePitch, loop, region, channelMode, filter, compressor, reverb, reverbMix } = state.player.settings;
      const playback = {
        ...(volume !== 1 ? { volume } : {}),
        ...(rate !== 1 ? { rate } : {}),
        ...(preservePitch ? {} : { preservePitch: false }),
        ...(loop ? { loop: true } : {}),
        ...(region ? { region: { start: Math.round(region.start * 1000) / 1000, end: Math.round(region.end * 1000) / 1000 } } : {}),
        ...(channelMode !== "stereo" ? { channelMode } : {}),
        ...(filter.type !== "off" ? { filter: { ...filter } } : {}),
        ...(compressor ? { compressor: true } : {}),
        ...(reverb !== "off" ? { reverb, reverbMix } : {}),
      };
      const result = { ...scene, ...(Object.keys(playback).length ? { playback } : {}) };
      return Object.keys(result).length ? result : undefined;
    },

    // The manifest's 3D view and playback settings, the window built again.
    apply3IFManifestAudio(config) {
      const state = Viewer.audioState;
      if (!state || !config || typeof config !== "object") return false;
      const { playback, ...scene } = config;
      Object.entries(scene).forEach(([key, value]) => {
        if (key in state.root.userData.audio && typeof value === typeof state.root.userData.audio[key]) state.root.userData.audio[key] = value;
      });
      import("../audio.js").then((api) => {
        if (Viewer.audioState !== state) return;
        api.applyAudioSettings(state.root);
        const player = api.getAudioState(state.root)?.player;
        if (player && playback && typeof playback === "object") {
          player.update((settings) => {
            Object.entries(playback).forEach(([key, value]) => {
              if (!(key in settings)) return;
              if (key === "filter" && value && typeof value === "object") Object.assign(settings.filter, value);
              else settings[key] = value;
            });
          });
          if (playback.region?.start > 0) player.currentTime = playback.region.start;
        }
        // Its controls built again with these values.
        if (state.ui) {
          state.ui.root.remove();
          state.ui = null;
          state.cache = {};
          if (state.api) Viewer.createAudioPanel();
        }
      });
      return true;
    },

    // Each frame (main.js animate).
    updateAudio() {
      const state = Viewer.audioState;
      if (!state?.api) return;
      state.api.updateAudioScene(state.root);
      Viewer.updateAudioMiniPlayer();
      if (state.ui && !state.hidden && !(state.collapsed && !isPhone()) && !isToolPanelMinimized(state.ui.root)) {
        Viewer.drawAudioPanel();
      }
    },

    createAudioPanel() {
      const state = Viewer.audioState;
      const stack = getViewerSideStack();
      if (!state || !stack || core.PRESENTATION_MODE || Viewer.urlOptions?.hideUi === true) return;
      const info = state.root.userData.audioInfo || {};
      const player = state.player;
      const { api } = state;

      const root = document.createElement("section");
      root.id = "viewerAudioPanel";
      root.className = "viewer-pointcloud-panel viewer-volume-panel viewer-audio-panel";
      ["pointerdown", "pointerup", "wheel"].forEach((type) => {
        root.addEventListener(type, (event) => event.stopPropagation());
      });
      root.addEventListener("keydown", (event) => {
        event.stopPropagation();
        const typing = event.target.closest?.("button, input, select, textarea");
        if (event.key === " " && !typing) {
          event.preventDefault();
          Viewer.toggleAudioPlayback();
        }
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
        Viewer.syncAudioPanel();
      });
      header.append(title, collapse);
      attachToolPanelChrome(root, header, {
        icon: PANEL_ICONS.audio,
        label: () => t("audio.title", "Audio"),
        modal: isPhone,
        onClose: () => Viewer.closeAudioPanel(),
      });

      const body = document.createElement("div");
      body.className = "viewer-pointcloud-panel_body";
      root.append(header, body);

      // [element, () => text] pairs, refreshed by syncAudioPanel(); an input's
      // text is its aria-label.
      const labels = [];
      const ui = { root, title, collapse, body, labels };
      state.ui = ui;

      const button = (className, onClick) => {
        const element = document.createElement("button");
        element.type = "button";
        element.className = `viewer-pointcloud-panel_button ${className}`;
        element.addEventListener("click", onClick);
        return element;
      };
      const row = (text, control, parent = body) => {
        const element = document.createElement("label");
        element.className = "viewer-pointcloud-panel_row";
        const label = document.createElement("span");
        element.append(label, control);
        parent.appendChild(element);
        labels.push([label, text]);
        return element;
      };
      const check = (text, checked, onChange, parent = body) => {
        const element = document.createElement("label");
        element.className = "viewer-audio-panel_check";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = checked;
        input.addEventListener("change", () => onChange(input.checked));
        const label = document.createElement("span");
        element.append(input, label);
        parent.appendChild(element);
        labels.push([label, text]);
        return input;
      };
      const select = (values, current, labelOf, onChange) => {
        const element = document.createElement("select");
        values.forEach((value) => element.appendChild(new Option("", String(value))));
        element.value = String(current);
        element.addEventListener("change", () => onChange(element.value));
        // Option texts follow the language (syncAudioPanel).
        element.audioLabels = () => [...element.options].forEach((option) => { option.textContent = labelOf(option.value); });
        ui.selects = [...(ui.selects || []), element];
        return element;
      };
      const slider = (min, max, step, value, onInput) => {
        const element = document.createElement("input");
        element.type = "range";
        element.min = String(min);
        element.max = String(max);
        element.step = String(step);
        element.value = String(value);
        element.addEventListener("input", () => onInput(Number(element.value)));
        return element;
      };
      const heading = (text) => {
        const element = document.createElement("div");
        element.className = "viewer-audio-panel_heading";
        body.appendChild(element);
        labels.push([element, text]);
      };

      // ---- Transport ----
      const transport = document.createElement("div");
      transport.className = "viewer-audio-panel_transport";
      ui.play = button("viewer-audio-panel_play", () => Viewer.toggleAudioPlayback());
      ui.stop = button("viewer-audio-panel_stop", () => player.stop());
      ui.stop.textContent = "■";
      ui.loop = button("viewer-audio-panel_loop", () => Viewer.updateAudioPlayback((s) => { s.loop = !s.loop; }));
      ui.loop.textContent = "⟲";
      ui.time = document.createElement("span");
      ui.time.className = "viewer-audio-panel_time";
      transport.append(ui.play, ui.stop, ui.loop, ui.time);
      body.appendChild(transport);

      // ---- Waveform: jump, select ----
      ui.wave = document.createElement("canvas");
      ui.wave.className = "viewer-audio-panel_wave";
      ui.wave.tabIndex = 0;
      body.appendChild(ui.wave);
      const timeAt = (event) => {
        const box = ui.wave.getBoundingClientRect();
        return Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * player.duration;
      };
      ui.wave.addEventListener("pointerdown", (event) => {
        if (!player.duration) return;
        ui.wave.setPointerCapture?.(event.pointerId);
        state.drag = { start: timeAt(event), x: event.clientX, moved: false };
      });
      ui.wave.addEventListener("pointermove", (event) => {
        const drag = state.drag;
        if (!drag) return;
        if (Math.abs(event.clientX - drag.x) > 4) drag.moved = true;
        if (!drag.moved) return;
        const time = timeAt(event);
        const region = { start: Math.min(drag.start, time), end: Math.max(drag.start, time) };
        player.update((s) => { s.region = region.end - region.start > 0.02 ? region : null; });
      });
      const endDrag = (event) => {
        const drag = state.drag;
        if (!drag) return;
        state.drag = null;
        if (!drag.moved) player.currentTime = timeAt(event);
        else if (player.settings.region) player.currentTime = player.settings.region.start;
        Viewer.syncAudioPanel();
      };
      ui.wave.addEventListener("pointerup", endDrag);
      ui.wave.addEventListener("pointercancel", () => { state.drag = null; });
      ui.wave.addEventListener("keydown", (event) => {
        const step = event.shiftKey ? 10 : 2;
        if (event.key === "ArrowRight") player.currentTime = player.currentTime + step;
        else if (event.key === "ArrowLeft") player.currentTime = player.currentTime - step;
        else if (event.key === "Home") player.currentTime = 0;
        else return;
        event.preventDefault();
      });
      labels.push([ui.wave, () => t("audio.waveHint", "Waveform: click to jump, drag to select a part")]);

      const regionRow = document.createElement("div");
      regionRow.className = "viewer-audio-panel_region";
      ui.regionText = document.createElement("span");
      ui.clearRegion = button("viewer-audio-panel_clear", () => Viewer.updateAudioPlayback((s) => { s.region = null; }));
      regionRow.append(ui.regionText, ui.clearRegion);
      body.appendChild(regionRow);
      ui.regionRow = regionRow;
      labels.push([ui.clearRegion, () => t("audio.clearRegion", "Whole file")]);

      // ---- Markers ----
      if (info.markers?.length) {
        heading(() => t("audio.markers", "Markers"));
        const list = document.createElement("div");
        list.className = "viewer-audio-panel_markers";
        info.markers.forEach((marker) => {
          const item = button("viewer-audio-panel_marker", () => { player.currentTime = marker.time; });
          item.textContent = `${api.formatTime(marker.time)} · ${marker.label}`;
          item.title = marker.label;
          list.appendChild(item);
        });
        body.appendChild(list);
      }

      // ---- View of the sound ----
      ui.viewSelect = select(VIEWS, state.view, (view) => t(`audio.views.${view}`, view), (view) => {
        state.view = view;
        Viewer.syncAudioPanel();
      });
      row(() => t("audio.view", "View"), ui.viewSelect);
      ui.view = document.createElement("canvas");
      ui.view.className = "viewer-audio-panel_view";
      body.appendChild(ui.view);
      // A click moves the playhead in every view, playing or not: the live
      // views (spectrum, oscilloscope) show it as a line along the bottom.
      ui.view.addEventListener("click", (event) => {
        if (!player.duration) return;
        const box = ui.view.getBoundingClientRect();
        player.currentTime = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * player.duration;
        Viewer.syncAudioPanel();
      });
      ui.viewNote = document.createElement("p");
      ui.viewNote.className = "viewer-pointcloud-panel_note";
      body.appendChild(ui.viewNote);

      // ---- Playback ----
      heading(() => t("audio.playback", "Playback"));
      row(() => t("audio.speed", "Speed"), select(api.PLAYBACK_RATES, player.settings.rate, (rate) => `×${rate}`, (rate) => {
        Viewer.updateAudioPlayback((s) => { s.rate = Number(rate); });
      }));
      check(() => t("audio.preservePitch", "Keep the pitch"), player.settings.preservePitch, (on) => {
        Viewer.updateAudioPlayback((s) => { s.preservePitch = on; });
      });
      row(
        () => t("audio.volume", { value: `${Math.round(player.settings.volume * 100)}%` }, "Volume {value}"),
        slider(0, 100, 1, player.settings.volume * 100, (value) => Viewer.updateAudioPlayback((s) => { s.volume = value / 100; })),
      );
      if ((info.channels || 1) > 1) {
        row(() => t("audio.channels", "Channels"), select(api.CHANNEL_MODES, player.settings.channelMode, (mode) => t(`audio.channelModes.${mode}`, mode), (mode) => {
          Viewer.updateAudioPlayback((s) => { s.channelMode = mode; });
        }));
      }

      // ---- Effects ----
      heading(() => t("audio.effects", "Effects"));
      row(() => t("audio.filter", "Filter"), select(api.FILTER_TYPES, player.settings.filter.type, (type) => t(`audio.filters.${type}`, type), (type) => {
        Viewer.updateAudioPlayback((s) => { s.filter.type = type; });
      }));
      ui.filterFrequency = row(
        () => t("audio.filterFrequency", { value: api.formatFrequency(player.settings.filter.frequency) }, "Frequency {value}"),
        slider(0, 100, 1, frequencyToSlider(player.settings.filter.frequency), (value) => Viewer.updateAudioPlayback((s) => {
          s.filter.frequency = Math.round(sliderToFrequency(value));
        })),
      );
      check(() => t("audio.compressor", "Even loudness"), player.settings.compressor, (on) => {
        Viewer.updateAudioPlayback((s) => { s.compressor = on; });
      });
      row(() => t("audio.reverb", "Reverberation"), select(api.REVERB_PRESETS, player.settings.reverb, (preset) => t(`audio.reverbs.${preset}`, preset), (preset) => {
        Viewer.updateAudioPlayback((s) => { s.reverb = preset; });
      }));
      ui.reverbMix = row(
        () => t("audio.reverbMix", { value: `${Math.round(player.settings.reverbMix * 100)}%` }, "Amount {value}"),
        slider(0, 100, 1, player.settings.reverbMix * 100, (value) => Viewer.updateAudioPlayback((s) => { s.reverbMix = value / 100; })),
      );

      // ---- The 3D scene ----
      const settings = state.root.userData.audio;
      if (info.analysed) {
        heading(() => t("audio.scene", "3D view"));
        row(() => t("audio.frequencyScale", "Frequency axis"), select(api.FREQUENCY_SCALES, settings.frequencyScale, (scale) => t(`audio.frequencyScales.${scale}`, scale), (scale) => {
          Viewer.updateAudioSceneSettings((s) => { s.frequencyScale = scale; });
        }));
        row(
          () => t("audio.range", { value: state.root.userData.audio.range }, "Levels shown: {value} dB"),
          slider(30, 120, 5, settings.range, (value) => Viewer.updateAudioSceneSettings((s) => { s.range = value; })),
        );
        row(
          () => t("audio.height", { value: `×${state.root.userData.audio.heightScale.toFixed(1)}` }, "Height {value}"),
          slider(0, 30, 1, settings.heightScale * 10, (value) => Viewer.updateAudioSceneSettings((s) => { s.heightScale = Math.max(0.05, value / 10); })),
        );
        check(() => t("audio.showTerrain", "Spectrogram as a landscape"), settings.showTerrain, (on) => {
          Viewer.updateAudioSceneSettings((s) => { s.showTerrain = on; });
        });
        check(() => t("audio.showWaveform", "Waveform"), settings.showWaveform, (on) => {
          Viewer.updateAudioSceneSettings((s) => { s.showWaveform = on; });
        });
      } else {
        const note = document.createElement("p");
        note.className = "viewer-pointcloud-panel_note";
        body.appendChild(note);
        labels.push([note, () => t("audio.notAnalysed", "Too large to analyse in the browser: it is played only.")]);
      }

      // ---- What the file is ----
      const summary = document.createElement("dl");
      summary.className = "viewer-volume-panel_summary";
      const fact = (term, value) => {
        if (value === undefined || value === null || value === "") return;
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dd.textContent = value;
        summary.append(dt, dd);
        labels.push([dt, term]);
      };
      const tags = info.tags || {};
      ["title", "artist", "album", "date", "genre", "location", "description", "comment", "originator", "copyright"].forEach((key) => {
        // A Broadcast Wave file often says the same as description and comment.
        if (key === "comment" && tags.comment === tags.description) return;
        fact(() => t(`audio.tags.${key}`, key), tags[key]);
      });
      fact(() => t("audio.format", "Format"), [info.format, info.codec && info.codec !== info.format ? info.codec : ""].filter(Boolean).join(", "));
      fact(() => t("audio.duration", "Duration"), info.duration ? api.formatTime(info.duration, { precise: true }) : "");
      fact(() => t("audio.sampleRate", "Sample rate"), info.sampleRate ? `${(info.sampleRate / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} kHz` : "");
      fact(() => t("audio.channelCount", "Channels"), info.channels);
      fact(() => t("audio.bitDepth", "Bit depth"), info.bitsPerSample ? `${info.bitsPerSample} bit` : "");
      fact(() => t("audio.bitrate", "Bit rate"), info.bitrate ? `${Math.round(info.bitrate / 1000)} kbit/s` : "");
      fact(() => t("audio.size", "File size"), formatBytes(info.size));
      if (info.stats) {
        fact(() => t("audio.peak", "Peak level"), formatDb(info.stats.peakDb));
        fact(() => t("audio.rms", "Average level (RMS)"), formatDb(info.stats.rmsDb));
        if (info.stats.clipped) fact(() => t("audio.clipped", "Clipped samples"), info.stats.clipped.toLocaleString());
      }
      fact(() => t("audio.software", "Software"), tags.software);
      body.appendChild(summary);

      stack.appendChild(root);
      Viewer.createAudioMiniPlayer();
      if (isPhone()) setToolPanelMinimized(root, true, { focus: false });
      new MutationObserver(() => Viewer.updateEditorToolbarState?.()).observe(root, { attributes: true, attributeFilter: ["class"] });
      Viewer.syncAudioPanel();
    },

    syncAudioPanel() {
      const state = Viewer.audioState;
      const ui = state?.ui;
      if (!ui) return;
      const player = state.player;
      const info = state.root.userData.audioInfo || {};
      const name = info.tags?.title || state.root.name || t("audio.title", "Audio");
      ui.root.setAttribute("aria-label", t("audio.title", "Audio"));
      ui.title.textContent = name;
      ui.title.title = name;
      ui.root.hidden = state.hidden;
      ui.body.hidden = state.collapsed && !isPhone();
      ui.collapse.textContent = state.collapsed ? "+" : "–";
      const collapseLabel = state.collapsed ? t("audio.expand", "Show settings") : t("audio.collapse", "Hide settings");
      ui.collapse.title = collapseLabel;
      ui.collapse.setAttribute("aria-label", collapseLabel);
      ui.collapse.setAttribute("aria-expanded", state.collapsed ? "false" : "true");

      const playing = player.playing;
      ui.play.textContent = playing ? "❚❚" : "▶";
      const playLabel = playing ? t("audio.pause", "Pause") : t("audio.play", "Play");
      ui.play.title = playLabel;
      ui.play.setAttribute("aria-label", playLabel);
      ui.play.setAttribute("aria-pressed", playing ? "true" : "false");
      ui.stop.title = t("audio.stop", "Stop");
      ui.stop.setAttribute("aria-label", ui.stop.title);
      ui.loop.title = t("audio.loop", "Repeat");
      ui.loop.setAttribute("aria-label", ui.loop.title);
      ui.loop.setAttribute("aria-pressed", player.settings.loop ? "true" : "false");

      const region = player.settings.region;
      ui.regionRow.hidden = !region;
      if (region) {
        ui.regionText.textContent = t("audio.region", {
          start: state.api.formatTime(region.start, { precise: true }),
          end: state.api.formatTime(region.end, { precise: true }),
        }, "Part {start}–{end}");
      }
      ui.filterFrequency.hidden = player.settings.filter.type === "off";
      ui.reverbMix.hidden = player.settings.reverb === "off";
      ui.viewSelect.value = state.view;
      const live = state.view !== "spectrogram";
      ui.viewNote.hidden = !(live && !player.analyser) && !(state.view === "spectrogram" && !info.analysed);
      ui.viewNote.textContent = live
        ? t("audio.liveHint", "Press play to see the sound live.")
        : t("audio.notAnalysed", "Too large to analyse in the browser: it is played only.");

      ui.labels.forEach(([element, text]) => {
        if (element instanceof HTMLInputElement || element instanceof HTMLCanvasElement || element instanceof HTMLButtonElement) {
          element.setAttribute("aria-label", text());
          if (element instanceof HTMLButtonElement) element.textContent = text();
        } else {
          element.textContent = text();
        }
      });
      (ui.selects || []).forEach((element) => element.audioLabels?.());
      Viewer.syncAudioMiniPlayer();
      Viewer.drawAudioPanel();
    },

    // ---- The mini player ----

    createAudioMiniPlayer() {
      const state = Viewer.audioState;
      if (!state?.player || state.mini || !core.container) return;
      const player = state.player;
      const root = document.createElement("div");
      root.id = "viewerAudioMiniPlayer";
      root.className = "viewer-audio-mini";
      root.setAttribute("role", "group");
      root.hidden = true;
      // Its taps and drags are not the camera's.
      ["pointerdown", "pointerup", "wheel", "keydown", "touchstart"].forEach((type) => {
        root.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
      });
      const button = (className, text, onClick) => {
        const element = document.createElement("button");
        element.type = "button";
        element.className = `viewer-audio-mini_button ${className}`;
        element.textContent = text;
        element.addEventListener("click", onClick);
        return element;
      };
      const mini = { root };
      mini.back = button("viewer-audio-mini_back", "−5", () => { player.currentTime = player.currentTime - MINI_STEP; });
      mini.play = button("viewer-audio-mini_play", "▶", () => Viewer.toggleAudioPlayback());
      mini.forward = button("viewer-audio-mini_forward", "+5", () => { player.currentTime = player.currentTime + MINI_STEP; });
      mini.stop = button("viewer-audio-mini_stop", "■", () => player.stop());
      mini.loop = button("viewer-audio-mini_loop", "⟲", () => Viewer.updateAudioPlayback((s) => { s.loop = !s.loop; }));
      mini.range = document.createElement("input");
      mini.range.type = "range";
      mini.range.className = "viewer-audio-mini_range";
      mini.range.min = "0";
      mini.range.max = "1000";
      mini.range.step = "1";
      mini.range.addEventListener("input", () => {
        player.currentTime = (Number(mini.range.value) / 1000) * player.duration;
      });
      mini.time = document.createElement("span");
      mini.time.className = "viewer-audio-mini_time";
      root.append(mini.back, mini.play, mini.forward, mini.stop, mini.loop, mini.range, mini.time);
      core.container.appendChild(root);
      state.mini = mini;
      Viewer.syncAudioMiniPlayer();
    },

    // Labels and states (with the panel's, syncAudioPanel).
    syncAudioMiniPlayer() {
      const state = Viewer.audioState;
      const mini = state?.mini;
      if (!mini) return;
      const player = state.player;
      const label = (element, text) => {
        element.title = text;
        element.setAttribute("aria-label", text);
      };
      mini.root.setAttribute("aria-label", t("audio.toggle", "Audio player"));
      const playing = player.playing;
      mini.play.textContent = playing ? "❚❚" : "▶";
      mini.play.setAttribute("aria-pressed", playing ? "true" : "false");
      label(mini.play, playing ? t("audio.pause", "Pause") : t("audio.play", "Play"));
      label(mini.back, t("audio.back", { seconds: MINI_STEP }, "Back {seconds} s"));
      label(mini.forward, t("audio.forward", { seconds: MINI_STEP }, "Forward {seconds} s"));
      label(mini.stop, t("audio.stop", "Stop"));
      label(mini.loop, t("audio.loop", "Repeat"));
      mini.loop.setAttribute("aria-pressed", player.settings.loop ? "true" : "false");
      mini.range.setAttribute("aria-label", t("audio.position", "Position"));
      Viewer.updateAudioMiniPlayer();
    },

    // Each frame: shown while the panel is not, above the toolbar; the time.
    updateAudioMiniPlayer() {
      const state = Viewer.audioState;
      const mini = state?.mini;
      if (!mini) return;
      const show = Boolean(state.ui) && !Viewer.isAudioPanelVisible();
      if (mini.root.hidden === show) mini.root.hidden = !show;
      if (!show) return;

      // Above the toolbar when it is at the bottom (it can be moved).
      let bottom = 12;
      const toolbar = document.getElementById("viewerEditorToolbar");
      const container = core.container.getBoundingClientRect();
      if (toolbar && toolbar.offsetParent !== null) {
        // On phones its row of tools floats above its dock.
        [toolbar, toolbar.querySelector(".viewer-menus_nav")].forEach((element) => {
          const box = element?.getBoundingClientRect();
          if (box?.height && box.top > container.top + container.height / 2) {
            bottom = Math.max(bottom, Math.round(container.bottom - box.top + MINI_GAP));
          }
        });
      }
      if (state.miniBottom !== bottom) {
        state.miniBottom = bottom;
        mini.root.style.bottom = `${bottom}px`;
      }

      const player = state.player;
      const duration = player.duration;
      const time = player.currentTime;
      const text = `${state.api.formatTime(time)} / ${state.api.formatTime(duration)}`;
      if (mini.time.textContent !== text) mini.time.textContent = text;
      // Not while the slider is held.
      if (!mini.range.matches(":active")) {
        const value = String(Math.round((duration > 0 ? time / duration : 0) * 1000));
        if (mini.range.value !== value) mini.range.value = value;
      }
      const playing = player.playing;
      if ((mini.play.getAttribute("aria-pressed") === "true") !== playing) Viewer.syncAudioMiniPlayer();
    },

    drawAudioPanel() {
      const state = Viewer.audioState;
      const ui = state?.ui;
      if (!ui || !state.api) return;
      const player = state.player;
      const duration = player.duration;
      const time = player.currentTime;
      const timeText = `${state.api.formatTime(time, { precise: true })} / ${state.api.formatTime(duration)}`;
      if (ui.time.textContent !== timeText) ui.time.textContent = timeText;
      if (!ui.body.hidden) {
        Viewer.drawAudioWave(state, time / (duration || 1));
        Viewer.drawAudioView(state, time / (duration || 1));
      }
    },

    // The whole file's waveform (kept as an image), the selected part, the
    // markers and the playhead.
    drawAudioWave(state, fraction) {
      const canvas = state.ui.wave;
      const context = fitCanvas(canvas);
      const { width, height } = canvas;
      const analysis = state.api.getAudioState(state.root)?.analysis;
      const color = getComputedStyle(state.ui.root).color || "#fff";
      const key = `${width}x${height}|${color}`;
      if (state.cache.waveKey !== key) {
        const image = document.createElement("canvas");
        image.width = width;
        image.height = height;
        const draw = image.getContext("2d");
        draw.fillStyle = color;
        draw.globalAlpha = 0.85;
        const peaks = analysis?.peaks;
        if (peaks) {
          const middle = height / 2;
          for (let x = 0; x < width; x++) {
            const from = Math.floor((x * peaks.buckets) / width);
            const to = Math.max(from + 1, Math.floor(((x + 1) * peaks.buckets) / width));
            let low = 0;
            let high = 0;
            peaks.min.forEach((min, ch) => {
              for (let b = from; b < to; b++) {
                if (min[b] < low) low = min[b];
                if (peaks.max[ch][b] > high) high = peaks.max[ch][b];
              }
            });
            const top = middle - high * middle;
            draw.fillRect(x, top, 1, Math.max(1, (high - low) * middle));
          }
        } else {
          draw.globalAlpha = 0.3;
          draw.fillRect(0, height / 2 - 1, width, 2);
        }
        state.cache.wave = image;
        state.cache.waveKey = key;
      }
      context.clearRect(0, 0, width, height);
      context.drawImage(state.cache.wave, 0, 0);
      const duration = state.player.duration || 1;
      const region = state.player.settings.region;
      if (region) {
        context.fillStyle = "rgba(245, 160, 60, 0.28)";
        context.fillRect((region.start / duration) * width, 0, ((region.end - region.start) / duration) * width, height);
      }
      const markers = state.root.userData.audioInfo?.markers || [];
      context.fillStyle = "rgba(120, 200, 255, 0.9)";
      markers.forEach((marker) => context.fillRect(Math.round((marker.time / duration) * width), 0, Math.max(1, window.devicePixelRatio || 1), height * 0.3));
      context.fillStyle = "#f5a03c";
      context.fillRect(Math.round(fraction * width) - 1, 0, Math.max(2, window.devicePixelRatio || 1), height);
    },

    // The spectrogram (kept as an image) with the playhead, or the live
    // spectrum or oscilloscope from the player's analyser.
    drawAudioView(state, fraction) {
      const canvas = state.ui.view;
      const context = fitCanvas(canvas);
      const { width, height } = canvas;
      const { api, player } = state;
      context.clearRect(0, 0, width, height);
      if (state.view === "spectrogram") {
        const analysis = api.getAudioState(state.root)?.analysis;
        if (!analysis) return;
        const settings = state.root.userData.audio;
        const key = `${width}x${height}|${settings.frequencyScale}|${settings.range}`;
        if (state.cache.viewKey !== key) {
          const columns = Math.min(width, 1200);
          const rows = Math.min(height, 400);
          const grid = api.spectrogramGrid(analysis.spectrogram, columns, rows, settings.frequencyScale);
          const top = analysis.spectrogram.maxDb;
          const image = new ImageData(columns, rows);
          for (let c = 0; c < columns; c++) {
            for (let r = 0; r < rows; r++) {
              const level = (grid[c * rows + r] - (top - settings.range)) / settings.range;
              const [red, green, blue] = api.infernoColor(level);
              const at = ((rows - 1 - r) * columns + c) * 4;
              image.data[at] = red;
              image.data[at + 1] = green;
              image.data[at + 2] = blue;
              image.data[at + 3] = 255;
            }
          }
          const bitmap = document.createElement("canvas");
          bitmap.width = columns;
          bitmap.height = rows;
          bitmap.getContext("2d").putImageData(image, 0, 0);
          state.cache.view = bitmap;
          state.cache.viewKey = key;
        }
        context.imageSmoothingEnabled = true;
        context.drawImage(state.cache.view, 0, 0, width, height);
        // The frequencies at the left.
        const ratio = window.devicePixelRatio || 1;
        const nyquist = analysis.spectrogram.sampleRate / 2;
        context.font = `${10 * ratio}px system-ui, sans-serif`;
        context.textBaseline = "middle";
        api.frequencyTicks(nyquist, settings.frequencyScale).forEach((hz) => {
          const y = height - api.frequencyFraction(hz, nyquist, settings.frequencyScale) * height;
          context.fillStyle = "rgba(255, 255, 255, 0.35)";
          context.fillRect(0, Math.round(y), width, 1);
          context.fillStyle = "rgba(255, 255, 255, 0.85)";
          context.fillText(api.formatFrequency(hz), 4 * ratio, y - 6 * ratio);
        });
        context.fillStyle = "#ffffff";
        context.fillRect(Math.round(fraction * width) - 1, 0, Math.max(2, ratio), height);
        return;
      }
      // Where the time is (and where a click jumps to): a thin line along
      // the bottom, under the live drawing.
      const ratio = window.devicePixelRatio || 1;
      if (player.duration) {
        context.fillStyle = "rgba(255, 255, 255, 0.18)";
        context.fillRect(0, height - 2 * ratio, width, 2 * ratio);
        context.fillStyle = "#f5a03c";
        context.fillRect(0, height - 2 * ratio, Math.round(fraction * width), 2 * ratio);
      }
      const analyser = player.analyser;
      if (!analyser) return;
      if (state.view === "spectrum") {
        const data = state.cache.spectrumData?.length === analyser.frequencyBinCount
          ? state.cache.spectrumData
          : (state.cache.spectrumData = new Uint8Array(analyser.frequencyBinCount));
        analyser.getByteFrequencyData(data);
        const nyquist = player.context.sampleRate / 2;
        const bars = Math.max(16, Math.floor(width / (4 * (window.devicePixelRatio || 1))));
        const binHz = nyquist / data.length;
        for (let i = 0; i < bars; i++) {
          const low = api.frequencyAt(i / bars, nyquist, "log") / binHz;
          const high = api.frequencyAt((i + 1) / bars, nyquist, "log") / binHz;
          let value = 0;
          for (let b = Math.floor(low); b <= Math.min(data.length - 1, Math.ceil(high)); b++) value = Math.max(value, data[b]);
          const level = value / 255;
          const [red, green, blue] = api.infernoColor(0.25 + level * 0.75);
          context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
          const barWidth = width / bars;
          context.fillRect(i * barWidth + 1, height - level * height, Math.max(1, barWidth - 2), level * height);
        }
        return;
      }
      const samples = state.cache.scopeData?.length === analyser.fftSize
        ? state.cache.scopeData
        : (state.cache.scopeData = new Float32Array(analyser.fftSize));
      analyser.getFloatTimeDomainData(samples);
      context.strokeStyle = "#f5a03c";
      context.lineWidth = Math.max(1, window.devicePixelRatio || 1) * 1.5;
      context.beginPath();
      for (let x = 0; x < width; x++) {
        const value = samples[Math.floor((x / width) * samples.length)] || 0;
        const y = height / 2 - value * (height / 2) * 0.95;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    },
  });
}

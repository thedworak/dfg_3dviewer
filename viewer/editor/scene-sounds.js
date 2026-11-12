import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { getViewerSideStack } from "../ui/side-stack.js";
import { attachToolPanelChrome, isToolPanelMinimized, PANEL_ICONS, setToolPanelMinimized } from "../ui/tool-panel-chrome.js";
import { PHONE_TOOLBAR_QUERY } from "../editor-toolbar.js";
import { loadedModelsBox } from "../viewer-utils.js";
import { soundInRoom } from "./scene-acoustics.js";

// Sound in the scene: sources heard from where the camera is, as IIIF
// Presentation 4 paints them into a Scene -
//
//   ambient  everywhere at the same level (wind, a room's hum);
//   point    from a point, fainter with the distance (a fountain, a bell);
//   spot     from a point, towards where it aims: full inside its cone,
//            fainter outside it (a speaker, a voice, a doorway).
//
// Each source plays a sound file (by URL; a file from the device for this
// session only) in a loop or once, at its volume. A point or spot source is
// at full volume up to its `distance` (scene units) and halves with each
// doubling beyond it (Web Audio's inverse distance model). A source with
// `years` [from, to] is heard only while the 4D timeline (timeline.js) is
// within them, faded in and out.
//
// Browsers start sound only after a click: the sources play from the
// window's play button, or - with `autoplay` - from the first click or key
// press in the page. The listener follows the camera each frame.
//
// The window (toolbar: Sounds) lists the sources: add one by URL or from a
// file, choose one to set its name, volume, distance, cone and years, place
// it - or aim it - with a click on the model. While it is open the point and
// spot sources show as icons, the chosen one with its full-volume sphere and
// the line it aims along.
//
// Kept in the manifest as AIM3DViewer.sounds ({ autoplay, volume, sources })
// and, for other viewers, as AmbientAudio / PointAudio / SpotAudio
// annotations painted into the scene (IIIF/presentation4.js).
//
// The room's acoustics - the sounds heard with the reverberation worked out
// from the model's geometry - are editor/scene-acoustics.js.

export const SOUND_TYPES = ["ambient", "point", "spot"];
const DEFAULT_CONE = 90;
const OUTER_GAIN = 0.15;
const FADE_SECONDS = 0.6;
// Under a narration (editor/narration.js).
const DUCKED = 0.35;
const MARKER_SIZE = 0.055;
const GOLD = "#f5a524";
const isPhone = () => window.matchMedia(PHONE_TOOLBAR_QUERY).matches;
const round = (value, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;

function toVector(value) {
  const parts = Array.isArray(value) ? value : value && typeof value === "object" ? [value.x, value.y, value.z] : null;
  if (!parts || parts.length < 3) return null;
  const numbers = parts.slice(0, 3).map(Number);
  return numbers.every(Number.isFinite) ? numbers : null;
}

function modelRadius() {
  const box = loadedModelsBox();
  if (box.isEmpty()) return 1;
  return Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1e-3);
}

function modelCenter() {
  const box = loadedModelsBox();
  return box.isEmpty() ? [0, 0, 0] : box.getCenter(new THREE.Vector3()).toArray();
}

// A source as the manifest or the window gives it -> one the viewer keeps.
export function normalizeSound(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;
  const src = String(raw.src || raw.url || "").trim();
  if (!src) return null;
  const type = SOUND_TYPES.includes(raw.type) ? raw.type : raw.position ? "point" : "ambient";
  const position = toVector(raw.position);
  const lookAt = toVector(raw.lookAt);
  const volume = Number(raw.volume);
  const distance = Number(raw.distance);
  const angle = Number(raw.angle);
  const years = Array.isArray(raw.years) && raw.years.length === 2 && raw.years.every((year) => year === null || Number.isFinite(Number(year)))
    ? raw.years.map((year) => (year === null ? null : Number(year)))
    : null;
  return {
    id: String(raw.id || `sound-${index + 1}`),
    type: type !== "ambient" && !position ? "ambient" : type,
    src,
    label: String(raw.label || "").trim(),
    position,
    lookAt,
    volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1,
    distance: Number.isFinite(distance) && distance > 0 ? distance : null,
    angle: Number.isFinite(angle) && angle > 0 ? Math.min(360, angle) : DEFAULT_CONE,
    loop: raw.loop !== false,
    years: years && !(years[0] === null && years[1] === null) ? years : null,
    on: raw.on !== false,
    // Heard in the room's acoustics (default: placed sources yes, ambient
    // ones no).
    acoustics: typeof raw.acoustics === "boolean" ? raw.acoustics : null,
    // A file from the device: no URL to save.
    file: raw.file === true,
  };
}

// The sound icon: a speaker with waves, gold when chosen.
const markerTextures = new Map();
function markerTexture(type, selected) {
  const key = `${type}|${selected}`;
  if (markerTextures.has(key)) return markerTextures.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const draw = (color, width) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(28, 52); ctx.lineTo(46, 52); ctx.lineTo(66, 34); ctx.lineTo(66, 94); ctx.lineTo(46, 76); ctx.lineTo(28, 76); ctx.closePath();
    ctx.stroke();
    [18, 32].forEach((radius) => {
      ctx.beginPath();
      ctx.arc(70, 64, radius, -Math.PI / 4, Math.PI / 4);
      ctx.stroke();
    });
    if (type === "spot") {
      ctx.beginPath();
      ctx.moveTo(108, 64); ctx.lineTo(122, 64);
      ctx.stroke();
    }
  };
  draw("rgba(0, 0, 0, 0.7)", 14);
  draw(selected ? GOLD : "#ffffff", 7);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  markerTextures.set(key, texture);
  return texture;
}

// The listening point: a ring around a dot, gold.
let listeningPointTexture = null;
function listeningTexture() {
  if (listeningPointTexture) return listeningPointTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  [["rgba(0, 0, 0, 0.7)", 14], [GOLD, 7]].forEach(([color, width]) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(64, 64, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(64, 64, 12 + (width > 10 ? 4 : 0), 0, Math.PI * 2);
    ctx.fill();
  });
  listeningPointTexture = new THREE.CanvasTexture(canvas);
  listeningPointTexture.colorSpace = THREE.SRGBColorSpace;
  return listeningPointTexture;
}

export function attachSceneSounds(Viewer) {
  Object.assign(Viewer, {
    soundsState: null,

    getSoundsState() {
      Viewer.soundsState ??= {
        sources: [],
        autoplay: false,
        volume: 1,
        playing: false,
        listener: null,
        group: null,
        nodes: new Map(),
        markers: null,
        selectedId: null,
        placing: null,
        open: false,
        collapsed: false,
        ui: null,
        armed: null,
      };
      return Viewer.soundsState;
    },

    getSceneSounds() {
      return Viewer.soundsState?.sources || [];
    },

    hasSceneSounds() {
      return Viewer.getSceneSounds().length > 0;
    },

    isSceneSoundPlaying() {
      return Viewer.soundsState?.playing === true;
    },

    // Replaces the sources (a manifest's, or none): an array, or
    // { autoplay, volume, sources }.
    setSceneSounds(config) {
      Viewer.stopSceneSounds();
      const state = Viewer.getSoundsState();
      Viewer.releaseSoundNodes();
      const list = Array.isArray(config) ? config : Array.isArray(config?.sources) ? config.sources : [];
      const seen = new Set();
      state.sources = list
        .map((raw, index) => normalizeSound(raw, index))
        .filter((source) => source && !seen.has(source.id) && seen.add(source.id));
      state.autoplay = config?.autoplay === true;
      const volume = Number(config?.volume);
      state.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
      state.selectedId = state.sources[0]?.id || null;
      state.placing = null;
      Viewer.setSceneAcoustics?.(Array.isArray(config) ? null : config?.acoustics);
      Viewer.disarmSceneSoundAutoplay();
      if (state.autoplay && state.sources.length) Viewer.armSceneSoundAutoplay();
      Viewer.renderSoundsPanel();
      Viewer.updateEditorToolbarState?.();
      return state.sources;
    },

    // Starts them with the first click or key press (browsers allow sound
    // only after one).
    armSceneSoundAutoplay() {
      const state = Viewer.getSoundsState();
      if (state.armed) return;
      const start = () => {
        Viewer.disarmSceneSoundAutoplay();
        if (Viewer.hasSceneSounds() && !state.playing) Viewer.startSceneSounds();
      };
      state.armed = start;
      window.addEventListener("pointerdown", start, true);
      window.addEventListener("keydown", start, true);
    },

    disarmSceneSoundAutoplay() {
      const state = Viewer.soundsState;
      if (!state?.armed) return;
      window.removeEventListener("pointerdown", state.armed, true);
      window.removeEventListener("keydown", state.armed, true);
      state.armed = null;
    },

    ensureSoundListener() {
      const state = Viewer.getSoundsState();
      if (state.listener || !core.scene) return state.listener;
      state.listener = new THREE.AudioListener();
      state.listener.name = "scene-sounds-listener";
      state.group = new THREE.Group();
      state.group.name = "scene-sounds";
      core.scene.add(state.listener, state.group);
      state.listener.setMasterVolume(state.volume);
      return state.listener;
    },

    // The source's audio object (made when first heard).
    soundNode(source) {
      const state = Viewer.getSoundsState();
      let node = state.nodes.get(source.id);
      if (node && node.src === source.src && node.type === source.type) return node;
      if (node) Viewer.releaseSoundNode(source.id);
      const listener = Viewer.ensureSoundListener();
      if (!listener) return null;
      const element = new Audio();
      element.crossOrigin = "anonymous";
      element.preload = "auto";
      element.src = source.src;
      const audio = source.type === "ambient" ? new THREE.Audio(listener) : new THREE.PositionalAudio(listener);
      audio.setMediaElementSource(element);
      // Silent until faded in (updateSceneSounds).
      audio.setVolume(0);
      audio.name = `sound:${source.id}`;
      state.group.add(audio);
      node = { audio, element, src: source.src, type: source.type, fade: 0 };
      element.addEventListener("error", () => {
        console.warn("Could not play the sound", source.src);
        node.failed = true;
      });
      state.nodes.set(source.id, node);
      Viewer.connectAcousticsSend?.(node);
      Viewer.applySoundSource(source);
      return node;
    },

    // The source's settings into its audio object.
    applySoundSource(source) {
      const node = Viewer.soundsState?.nodes.get(source.id);
      if (!node) return;
      const { audio, element } = node;
      element.loop = source.loop;
      if (audio.panner) {
        const distance = Viewer.soundRefDistance(source);
        audio.setDistanceModel("inverse");
        audio.setRefDistance(distance);
        audio.setRolloffFactor(1);
        if (source.position) audio.position.fromArray(source.position);
        if (source.type === "spot") {
          audio.setDirectionalCone(source.angle * 0.5, source.angle, OUTER_GAIN);
          audio.lookAt(new THREE.Vector3().fromArray(source.lookAt || modelCenter()));
        } else {
          audio.setDirectionalCone(360, 360, 1);
        }
        audio.updateMatrixWorld(true);
      }
    },

    // Full volume up to (scene units): the source's, or half the model's
    // radius.
    soundRefDistance(source) {
      return source?.distance || modelRadius() * 0.5;
    },

    releaseSoundNode(id) {
      const state = Viewer.soundsState;
      const node = state?.nodes.get(id);
      if (!node) return;
      Viewer.disconnectAcousticsSend?.(node);
      node.element.pause();
      node.element.removeAttribute("src");
      node.element.load();
      try { node.audio.disconnect(); } catch { /* not connected */ }
      node.audio.removeFromParent();
      state.nodes.delete(id);
    },

    releaseSoundNodes() {
      const state = Viewer.soundsState;
      if (!state) return;
      [...state.nodes.keys()].forEach((id) => Viewer.releaseSoundNode(id));
    },

    // Whether a source is heard now: switched on, and its years shown on the
    // timeline (when it has years and the model a timeline).
    isSoundAudible(source) {
      if (!source.on) return false;
      if (!source.years || !Viewer.hasTimeline?.()) return true;
      const year = Viewer.getTimelineYear?.();
      if (!Number.isFinite(year)) return true;
      const [from, to] = source.years;
      return (from === null || year >= from) && (to === null || year <= to);
    },

    async startSceneSounds() {
      const state = Viewer.getSoundsState();
      if (!state.sources.length) return false;
      Viewer.disarmSceneSoundAutoplay();
      const listener = Viewer.ensureSoundListener();
      if (!listener) return false;
      await listener.context.resume?.();
      state.playing = true;
      // The room, when it is to be heard and was not worked out yet.
      const acoustics = state.acoustics;
      if (acoustics?.on && !acoustics.result && !acoustics.computing) Viewer.computeSceneAcoustics?.();
      state.sources.forEach((source) => {
        const node = Viewer.soundNode(source);
        if (node && Viewer.isSoundAudible(source)) {
          node.element.play().catch((error) => console.warn("Could not play the sound", source.src, error));
        }
      });
      Viewer.syncSoundsPanel();
      Viewer.updateEditorToolbarState?.();
      return true;
    },

    stopSceneSounds() {
      const state = Viewer.soundsState;
      if (!state) return;
      state.playing = false;
      state.nodes.forEach((node) => {
        node.element.pause();
        node.fade = 0;
        node.audio.setVolume(0);
      });
      Viewer.updateAcousticsSends?.();
      Viewer.syncSoundsPanel();
      Viewer.updateEditorToolbarState?.();
    },

    toggleSceneSounds() {
      return Viewer.isSceneSoundPlaying() ? Viewer.stopSceneSounds() : Viewer.startSceneSounds();
    },

    setSceneSoundsVolume(volume) {
      const state = Viewer.getSoundsState();
      state.volume = Math.min(1, Math.max(0, Number(volume) || 0));
      state.listener?.setMasterVolume(state.volume * (state.ducked ? DUCKED : 1));
      Viewer.syncSoundsPanel();
    },

    // Quieter under a narration (editor/narration.js).
    duckSceneSounds(on) {
      const state = Viewer.soundsState;
      if (!state || state.ducked === Boolean(on)) return;
      state.ducked = Boolean(on);
      state.listener?.setMasterVolume(state.volume * (state.ducked ? DUCKED : 1));
    },

    // A new source: at the middle of the view (ambient: everywhere), chosen.
    addSceneSound({ type = "point", src = "", file = null, label = "" } = {}) {
      const state = Viewer.getSoundsState();
      const url = file ? URL.createObjectURL(file) : String(src || "").trim();
      if (!url) return null;
      let index = state.sources.length + 1;
      while (state.sources.some((source) => source.id === `sound-${index}`)) index += 1;
      const target = (core.controls?.target?.toArray?.() || modelCenter()).map((value) => round(value));
      // A cone aims at the viewer to start with.
      const towards = core.camera ? core.camera.position.toArray().map((value) => round(value)) : modelCenter();
      const source = normalizeSound({
        id: `sound-${index}`,
        type,
        src: url,
        label: label || file?.name || decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() || ""),
        position: type === "ambient" ? null : target,
        lookAt: type === "spot" ? towards : null,
        distance: type === "ambient" ? null : round(modelRadius() * 0.5),
        file: Boolean(file),
      }, index - 1);
      state.sources.push(source);
      state.selectedId = source.id;
      if (state.playing) {
        const node = Viewer.soundNode(source);
        node?.element.play().catch(() => {});
      }
      Viewer.renderSoundsPanel();
      Viewer.updateEditorToolbarState?.();
      return source;
    },

    updateSceneSound(id, change) {
      const state = Viewer.soundsState;
      const source = state?.sources.find((item) => item.id === id);
      if (!source) return null;
      const before = `${source.type}|${source.src}`;
      change(source);
      if (source.type !== "ambient" && !source.position) source.position = core.controls?.target?.toArray?.() || modelCenter();
      if (source.type === "spot" && !source.lookAt) source.lookAt = modelCenter();
      if (`${source.type}|${source.src}` !== before) {
        Viewer.releaseSoundNode(id);
        if (state.playing) Viewer.soundNode(source)?.element.play().catch(() => {});
      } else {
        Viewer.applySoundSource(source);
      }
      Viewer.syncSoundsPanel();
      return source;
    },

    removeSceneSound(id) {
      const state = Viewer.soundsState;
      if (!state) return;
      const source = state.sources.find((item) => item.id === id);
      if (!source) return;
      Viewer.releaseSoundNode(id);
      if (source.file) URL.revokeObjectURL(source.src);
      state.sources = state.sources.filter((item) => item.id !== id);
      if (state.selectedId === id) state.selectedId = state.sources[0]?.id || null;
      if (state.placing?.id === id) state.placing = null;
      if (!state.sources.length) state.playing = false;
      Viewer.renderSoundsPanel();
      Viewer.updateEditorToolbarState?.();
    },

    selectSceneSound(id) {
      const state = Viewer.getSoundsState();
      state.selectedId = id;
      state.placing = null;
      Viewer.renderSoundsPanel();
    },

    // The next click on the model places the source there ("position"), or
    // aims a spot source at it ("aim") (picking.js).
    startSoundPlacing(id, mode = "position") {
      const state = Viewer.getSoundsState();
      state.placing = state.placing?.id === id && state.placing.mode === mode ? null : { id, mode };
      Viewer.syncSoundsPanel();
    },

    isSoundPlacing() {
      return Boolean(Viewer.soundsState?.placing);
    },

    placeSoundAt(hit) {
      const state = Viewer.soundsState;
      const placing = state?.placing;
      if (!placing || !hit?.point) return false;
      state.placing = null;
      // A little off the surface, along its normal: not inside the wall.
      const point = hit.point.clone();
      const normal = hit.face?.normal && hit.object
        ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
        : null;
      if (placing.mode === "position" && normal) point.addScaledVector(normal, modelRadius() * 0.02);
      Viewer.updateSceneSound(placing.id, (source) => {
        if (placing.mode === "aim") source.lookAt = point.toArray().map((value) => round(value));
        else source.position = point.toArray().map((value) => round(value));
      });
      return true;
    },

    // Each frame (main.js animate): the listener where the camera is, the
    // timeline's fades, the icons.
    updateSceneSounds(delta = 0) {
      const state = Viewer.soundsState;
      if (!state) return;
      if (state.listener && core.camera) {
        core.camera.updateMatrixWorld();
        core.camera.matrixWorld.decompose(state.listener.position, state.listener.quaternion, state.listener.scale);
      }
      if (state.playing) {
        const step = Math.min(1, (delta || 0.016) / FADE_SECONDS);
        state.sources.forEach((source) => {
          const node = state.nodes.get(source.id);
          if (!node) return;
          const audible = Viewer.isSoundAudible(source);
          const target = audible ? 1 : 0;
          const before = node.fade;
          node.fade += Math.sign(target - node.fade) * Math.min(step, Math.abs(target - node.fade));
          if (audible && node.element.paused && !node.element.ended && !node.failed) node.element.play().catch(() => {});
          if (!audible && node.fade === 0 && !node.element.paused) node.element.pause();
          if (Math.abs(node.fade - before) > 1e-4 || node.volume !== source.volume) {
            node.volume = source.volume;
            node.audio.setVolume(source.volume * node.fade);
          }
        });
        Viewer.updateAcousticsSends?.();
      }
      Viewer.updateSoundMarkers();
    },

    // ---- icons ----

    updateSoundMarkers() {
      const state = Viewer.soundsState;
      if (!state) return;
      const shown = state.open && !state.hidden && Boolean(core.scene);
      if (!shown) {
        if (state.markers) state.markers.visible = false;
        return;
      }
      if (!state.markers) {
        state.markers = new THREE.Group();
        state.markers.name = "scene-sound-markers";
        state.markers.userData.isHelper = true;
        core.scene.add(state.markers);
      }
      state.markers.visible = true;
      const listening = state.acoustics?.position || null;
      const signature = state.sources.map((source) => [source.id, source.type, source.position, source.lookAt, source.distance, source.angle, source.id === state.selectedId].join(":")).join("|") + `|room:${listening}`;
      if (signature === state.markerSignature) return;
      state.markerSignature = signature;
      state.markers.children.slice().forEach((child) => {
        child.removeFromParent();
        child.geometry?.dispose?.();
        if (!child.isSprite) child.material?.dispose?.();
        else child.material.dispose();
      });
      const radius = modelRadius();
      // Where the room's acoustics were worked out.
      if (listening) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: listeningTexture(),
          depthTest: false,
          depthWrite: false,
          sizeAttenuation: false,
          transparent: true,
        }));
        sprite.scale.setScalar(MARKER_SIZE * 0.8);
        sprite.position.fromArray(listening);
        sprite.renderOrder = 999;
        sprite.userData.listeningPoint = true;
        state.markers.add(sprite);
      }
      state.sources.forEach((source) => {
        if (source.type === "ambient" || !source.position) return;
        const selected = source.id === state.selectedId;
        const position = new THREE.Vector3().fromArray(source.position);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: markerTexture(source.type, selected),
          depthTest: false,
          depthWrite: false,
          sizeAttenuation: false,
          transparent: true,
        }));
        sprite.scale.setScalar(MARKER_SIZE);
        sprite.position.copy(position);
        sprite.renderOrder = 999;
        sprite.userData.soundId = source.id;
        state.markers.add(sprite);
        if (!selected) return;
        // Where it is at full volume.
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(source.distance || radius * 0.5, 24, 12),
          new THREE.MeshBasicMaterial({ color: GOLD, wireframe: true, transparent: true, opacity: 0.25, depthWrite: false }),
        );
        sphere.position.copy(position);
        state.markers.add(sphere);
        if (source.type === "spot" && source.lookAt) {
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([position, new THREE.Vector3().fromArray(source.lookAt)]),
            new THREE.LineDashedMaterial({ color: GOLD, dashSize: radius * 0.04, gapSize: radius * 0.03, depthTest: false, transparent: true }),
          );
          line.computeLineDistances();
          line.renderOrder = 998;
          state.markers.add(line);
        }
      });
    },

    // ---- manifests ----

    // AIM3DViewer.sounds of an exported manifest (sources from a file left
    // out: they have no URL).
    getSoundsForExport() {
      const state = Viewer.soundsState;
      const sources = (state?.sources || []).filter((source) => !source.file);
      if (!sources.length) return undefined;
      return {
        ...(state.autoplay ? { autoplay: true } : {}),
        ...(state.volume !== 1 ? { volume: round(state.volume, 2) } : {}),
        sources: sources.map((source) => ({
          id: source.id,
          type: source.type,
          src: source.src,
          ...(source.label ? { label: source.label } : {}),
          ...(source.position && source.type !== "ambient" ? { position: source.position.map((value) => round(value)) } : {}),
          ...(source.type === "spot" && source.lookAt ? { lookAt: source.lookAt.map((value) => round(value)), angle: round(source.angle, 1) } : {}),
          ...(source.type !== "ambient" && source.distance ? { distance: round(source.distance) } : {}),
          ...(source.volume !== 1 ? { volume: round(source.volume, 2) } : {}),
          ...(source.loop ? {} : { loop: false }),
          ...(source.years ? { years: source.years } : {}),
          ...(source.on ? {} : { on: false }),
          ...(typeof source.acoustics === "boolean" ? { acoustics: source.acoustics } : {}),
        })),
        ...(Viewer.getAcousticsForExport?.() ? { acoustics: Viewer.getAcousticsForExport() } : {}),
      };
    },

    apply3IFManifestSounds(config) {
      const had = Viewer.hasSceneSounds();
      Viewer.setSceneSounds(config || []);
      const has = Viewer.hasSceneSounds();
      if (has && Viewer.urlOptions?.hideUi !== true) Viewer.toggleSoundsPanel(true);
      return has || had;
    },

    disposeSceneSounds() {
      const state = Viewer.soundsState;
      if (!state) return;
      Viewer.setSceneSounds([]);
      Viewer.toggleSoundsPanel(false);
    },

    // ---- the window ----

    isSoundsPanelOpen() {
      const state = Viewer.soundsState;
      return Boolean(state?.open && state.ui && !(isPhone() && isToolPanelMinimized(state.ui.root)));
    },

    toggleSoundsPanel(open) {
      const state = Viewer.getSoundsState();
      const next = typeof open === "boolean" ? open : !Viewer.isSoundsPanelOpen();
      state.open = next;
      if (!next) state.placing = null;
      if (next && !state.ui) Viewer.createSoundsPanel();
      if (state.ui) {
        state.ui.root.hidden = !next;
        if (next && isPhone()) setToolPanelMinimized(state.ui.root, false);
      }
      Viewer.renderSoundsPanel();
      Viewer.updateEditorToolbarState?.();
    },

    createSoundsPanel() {
      const state = Viewer.getSoundsState();
      const stack = getViewerSideStack();
      if (state.ui || !stack || core.PRESENTATION_MODE || Viewer.urlOptions?.hideUi === true) return;
      const root = document.createElement("section");
      root.id = "viewerSoundsPanel";
      root.className = "viewer-pointcloud-panel viewer-volume-panel viewer-sounds-panel";
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        root.addEventListener(type, (event) => event.stopPropagation());
      });
      const header = document.createElement("div");
      header.className = "viewer-pointcloud-panel_header";
      const title = document.createElement("strong");
      const collapse = document.createElement("button");
      collapse.type = "button";
      collapse.className = "viewer-pointcloud-panel_collapse";
      collapse.addEventListener("click", () => {
        state.collapsed = !state.collapsed;
        Viewer.syncSoundsPanel();
      });
      header.append(title, collapse);
      attachToolPanelChrome(root, header, {
        icon: PANEL_ICONS.sounds,
        label: () => t("sounds.title", "Sounds"),
        modal: isPhone,
        onClose: () => Viewer.toggleSoundsPanel(false),
      });
      const body = document.createElement("div");
      body.className = "viewer-pointcloud-panel_body";
      root.append(header, body);
      stack.appendChild(root);
      state.ui = { root, title, collapse, body };
      new MutationObserver(() => Viewer.updateEditorToolbarState?.()).observe(root, { attributes: true, attributeFilter: ["class"] });
    },

    // The window's contents, built again when the list or the chosen
    // source changes.
    renderSoundsPanel() {
      const state = Viewer.soundsState;
      const ui = state?.ui;
      if (!ui) return;
      ui.body.replaceChildren();
      ui.labels = [];
      const labels = ui.labels;
      const el = (tag, className, text) => {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
      };
      const button = (className, onClick) => {
        const element = el("button", `viewer-pointcloud-panel_button ${className}`);
        element.type = "button";
        element.addEventListener("click", onClick);
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
      const select = (values, current, labelOf, onChange) => {
        const element = el("select");
        values.forEach((value) => element.appendChild(new Option(labelOf(value), String(value))));
        element.value = String(current);
        element.addEventListener("change", () => onChange(element.value));
        return element;
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

      // Play all, and their volume.
      const transport = el("div", "viewer-audio-panel_transport");
      ui.play = button("viewer-sounds-panel_play", () => Viewer.toggleSceneSounds());
      ui.play.disabled = !state.sources.length;
      ui.volume = slider(0, 100, 1, Math.round(state.volume * 100), (value) => Viewer.setSceneSoundsVolume(value / 100));
      ui.volume.className = "viewer-sounds-panel_volume";
      labels.push([ui.volume, () => t("sounds.volume", { value: `${Math.round(state.volume * 100)}%` }, "Volume {value}")]);
      transport.append(ui.play, ui.volume);
      ui.body.appendChild(transport);
      check(() => t("sounds.autoplay", "Play when the scene is opened (first click)"), state.autoplay, (on) => { state.autoplay = on; });

      // The sources.
      const list = el("div", "viewer-sounds-panel_list");
      list.setAttribute("role", "listbox");
      state.sources.forEach((source) => {
        const item = el("div", "viewer-sounds-panel_item");
        item.classList.toggle("is-selected", source.id === state.selectedId);
        const on = el("input");
        on.type = "checkbox";
        on.checked = source.on;
        on.addEventListener("change", () => Viewer.updateSceneSound(source.id, (s) => { s.on = on.checked; }));
        labels.push([on, () => t("sounds.on", "Heard")]);
        const name = button("viewer-sounds-panel_name", () => Viewer.selectSceneSound(source.id));
        name.setAttribute("role", "option");
        name.setAttribute("aria-selected", source.id === state.selectedId ? "true" : "false");
        name.textContent = source.label || source.id;
        name.title = source.src.startsWith("blob:") ? source.label : source.src;
        const kind = el("span", "viewer-sounds-panel_kind");
        labels.push([kind, () => t(`sounds.types.${source.type}`, source.type)]);
        const remove = button("viewer-sounds-panel_remove", () => Viewer.removeSceneSound(source.id));
        remove.textContent = "×";
        labels.push([remove, () => t("sounds.remove", "Remove")]);
        item.append(on, name, kind, remove);
        list.appendChild(item);
      });
      if (!state.sources.length) {
        const empty = el("p", "viewer-pointcloud-panel_note");
        labels.push([empty, () => t("sounds.empty", "No sounds in this scene yet. Add one below: by its URL or from a file.")]);
        list.appendChild(empty);
      }
      ui.body.appendChild(list);

      // The chosen source.
      const source = state.sources.find((item) => item.id === state.selectedId);
      if (source) {
        const group = el("div", "viewer-volume-panel_channel viewer-sounds-panel_details");
        const nameInput = el("input");
        nameInput.type = "text";
        nameInput.value = source.label;
        nameInput.addEventListener("change", () => Viewer.updateSceneSound(source.id, (s) => { s.label = nameInput.value.trim(); }) && Viewer.renderSoundsPanel());
        row(() => t("sounds.label", "Name"), nameInput, group);
        row(() => t("sounds.type", "Heard"), select(SOUND_TYPES, source.type, (type) => t(`sounds.typeHints.${type}`, type), (type) => {
          Viewer.updateSceneSound(source.id, (s) => { s.type = type; });
          Viewer.renderSoundsPanel();
        }), group);
        row(
          () => t("sounds.sourceVolume", { value: `${Math.round(source.volume * 100)}%` }, "Volume {value}"),
          slider(0, 100, 1, Math.round(source.volume * 100), (value) => Viewer.updateSceneSound(source.id, (s) => { s.volume = value / 100; })),
          group,
        );
        if (source.type !== "ambient") {
          const radius = modelRadius();
          // 2% to 4 times the model's radius, on a logarithmic slider.
          const low = radius * 0.02;
          const high = radius * 4;
          const toSlider = (distance) => Math.round((Math.log((distance || radius * 0.5) / low) / Math.log(high / low)) * 100);
          const fromSlider = (value) => low * Math.pow(high / low, value / 100);
          const unit = (value) => Viewer.formatLength?.(value)?.text || `${round(value, 2)}`;
          row(
            () => t("sounds.distance", { value: unit(source.distance || radius * 0.5) }, "Full volume up to {value}"),
            slider(0, 100, 1, toSlider(source.distance), (value) => Viewer.updateSceneSound(source.id, (s) => { s.distance = round(fromSlider(value)); })),
            group,
          );
          if (source.type === "spot") {
            row(
              () => t("sounds.angle", { value: `${Math.round(source.angle)}°` }, "Cone {value}"),
              slider(10, 360, 5, source.angle, (value) => Viewer.updateSceneSound(source.id, (s) => { s.angle = value; })),
              group,
            );
          }
          const placing = el("div", "viewer-sounds-panel_placing");
          const place = button("viewer-sounds-panel_place", () => Viewer.startSoundPlacing(source.id, "position"));
          place.dataset.mode = "position";
          labels.push([place, () => t("sounds.place", "Place with a click")]);
          placing.appendChild(place);
          if (source.type === "spot") {
            const aim = button("viewer-sounds-panel_aim", () => Viewer.startSoundPlacing(source.id, "aim"));
            aim.dataset.mode = "aim";
            labels.push([aim, () => t("sounds.aim", "Aim with a click")]);
            placing.appendChild(aim);
          }
          group.appendChild(placing);
          ui.placingHint = el("p", "viewer-pointcloud-panel_note");
          group.appendChild(ui.placingHint);
        }
        check(() => t("sounds.loop", "Repeat"), source.loop, (on) => Viewer.updateSceneSound(source.id, (s) => { s.loop = on; }), group);
        check(() => t("sounds.inRoom", "In the room's acoustics"), soundInRoom(source), (on) => Viewer.updateSceneSound(source.id, (s) => { s.acoustics = on; }), group);
        if (Viewer.hasTimeline?.()) {
          const years = el("div", "viewer-sounds-panel_years");
          const yearInput = (value, index) => {
            const input = el("input");
            input.type = "number";
            input.step = "1";
            input.value = value ?? "";
            input.addEventListener("change", () => Viewer.updateSceneSound(source.id, (s) => {
              const next = s.years ? [...s.years] : [null, null];
              next[index] = input.value === "" ? null : Number(input.value);
              s.years = next[0] === null && next[1] === null ? null : next;
            }));
            return input;
          };
          const from = yearInput(source.years?.[0], 0);
          const to = yearInput(source.years?.[1], 1);
          labels.push([from, () => t("sounds.yearFrom", "From year")]);
          labels.push([to, () => t("sounds.yearTo", "To year")]);
          years.append(from, el("span", "", "–"), to);
          row(() => t("sounds.years", "Heard in the years (4D timeline)"), years, group);
        }
        const src = el("p", "viewer-sounds-panel_src", source.file ? "" : source.src);
        group.appendChild(src);
        if (source.file) labels.push([src, () => t("sounds.fromFile", "From a file: for this session only, not saved in the manifest.")]);
        ui.body.appendChild(group);
      }

      // The room's acoustics (editor/scene-acoustics.js).
      Viewer.renderAcousticsSection?.(ui.body, { el, button, row, select, slider, check });

      // Adding one.
      const add = el("div", "viewer-volume-panel_channel viewer-sounds-panel_add");
      const typeSelect = select(SOUND_TYPES, "point", (type) => t(`sounds.typeHints.${type}`, type), () => {});
      row(() => t("sounds.addType", "New sound, heard"), typeSelect, add);
      const url = el("input");
      url.type = "url";
      url.placeholder = "https://…/sound.mp3";
      row(() => t("sounds.url", "Sound file URL"), url, add);
      const actions = el("div", "viewer-sounds-panel_placing");
      const addUrl = button("viewer-sounds-panel_add-url", () => {
        if (!url.value.trim()) {
          url.focus();
          return;
        }
        Viewer.addSceneSound({ type: typeSelect.value, src: url.value.trim() });
      });
      labels.push([addUrl, () => t("sounds.add", "Add")]);
      const fileInput = el("input");
      fileInput.type = "file";
      fileInput.accept = "audio/*";
      fileInput.hidden = true;
      fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (file) Viewer.addSceneSound({ type: typeSelect.value, file });
      });
      const addFile = button("viewer-sounds-panel_add-file", () => fileInput.click());
      labels.push([addFile, () => t("sounds.addFile", "From a file…")]);
      actions.append(addUrl, addFile, fileInput);
      add.appendChild(actions);
      ui.body.appendChild(add);
      Viewer.syncSoundsPanel();
    },

    syncSoundsPanel() {
      const state = Viewer.soundsState;
      const ui = state?.ui;
      if (!ui) return;
      const title = t("sounds.title", "Sounds");
      ui.root.setAttribute("aria-label", title);
      ui.title.textContent = title;
      ui.root.hidden = !state.open;
      ui.body.hidden = state.collapsed && !isPhone();
      ui.collapse.textContent = state.collapsed ? "+" : "–";
      const collapseLabel = state.collapsed ? t("sounds.expand", "Show settings") : t("sounds.collapse", "Hide settings");
      ui.collapse.title = collapseLabel;
      ui.collapse.setAttribute("aria-label", collapseLabel);
      if (ui.play) {
        ui.play.textContent = state.playing ? t("sounds.stop", "❚❚ Stop the sounds") : t("sounds.play", "▶ Play the sounds");
        ui.play.setAttribute("aria-pressed", state.playing ? "true" : "false");
        ui.play.disabled = !state.sources.length;
      }
      ui.body.querySelectorAll("[data-mode]").forEach((element) => {
        element.setAttribute("aria-pressed", state.placing?.mode === element.dataset.mode ? "true" : "false");
      });
      if (ui.placingHint) {
        ui.placingHint.hidden = !state.placing;
        ui.placingHint.textContent = state.placing?.mode === "aim"
          ? t("sounds.aimHint", "Click the model where the sound is aimed.")
          : t("sounds.placeHint", "Click the model where the sound comes from.");
      }
      Viewer.syncAcousticsStatus?.();
      (ui.labels || []).forEach(([element, text]) => {
        if (element instanceof HTMLInputElement) element.setAttribute("aria-label", text());
        else if (element instanceof HTMLButtonElement && element.classList.contains("viewer-sounds-panel_remove")) element.setAttribute("aria-label", text());
        else element.textContent = text();
      });
    },
  });
}

import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { getViewerSideStack } from "../ui/side-stack.js";
import { attachToolPanelChrome, isToolPanelMinimized, PANEL_ICONS, isPhoneLayout, setToolPanelMinimized } from "../ui/tool-panel-chrome.js";
import { apiUrl, appRequestHeaders, hasRemote } from "../remote.js";
import { stopCameraIntro } from "../IIIF/presentation4.js";
import { isAIM3DManifest } from "../manifesto/aim3dviewer-validation.js";
import { liveSessionParts } from "./live-session-parts.js";
import { attachLiveSessionPeople } from "./live-session-people.js";
import {
  changedManifestBlocks,
  changedSessionLook,
  LIVE_SESSION_BLOCK_LIMIT,
  LIVE_SESSION_BLOCKS,
  LIVE_SESSION_PARTS,
  manifestModels,
  newSessionId,
  normalizeSessionBackground,
  normalizeSessionCamera,
  sameSessionCamera,
  sessionLook,
  SESSION_ID_PATTERN,
} from "../live-link-rules.js";

// Live link: the scene stays connected to where it comes from, and to other
// viewers showing it. Three things, one window (toolbar: Live link) -
//
//   the manifest   its URL is read again every few seconds, a manifest file
//                  from the device is watched for being saved, or its
//                  settings are edited in the window: only what changed is
//                  applied - a light, a year, the weather, a comment - and
//                  the camera flies to its new place. The model is not
//                  loaded again (unless the manifest names another one).
//   the model      its file (the URL's, or one from the device) is watched:
//                  saved again in the modelling program, it is loaded and
//                  takes the old one's place under a cross-fade, with the
//                  camera, the comments, the section and everything else of
//                  the scene kept.
//   a session      viewers that open one link see one scene: whoever moves
//                  the camera, the year, the section or the weather moves
//                  them for everyone. A phone becomes the remote control of
//                  a screen. The states travel through the worker
//                  (/api/live/<session>, worker/live_sessions.py); without a
//                  worker, between the tabs of one browser.
//
// The rules that need no DOM - what changed between two manifests, what a
// session's camera may hold - are in live-link-rules.js.

const FILE_POLL_MS = 1000;
const INTERVALS = [1, 2, 5, 15];
const CAMERA_SEND_MS = 100;
const BLOCK_SAMPLE_MS = 700;
const POLL_WAIT_S = 20;
const EDIT_DEBOUNCE_MS = 350;
const VEIL_FADE_MS = 700;
// The menus' phone layout (bar or rail), as the sheets go by.
const isPhone = () => isPhoneLayout();
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2);
const fileName = (url) => String(url || "").split(/[?#]/)[0].split("/").pop();
const clockTime = (date) => date.toLocaleTimeString(core.currentLanguage || "en", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function modelLoaded() {
  return (Array.isArray(core.mainObject) ? core.mainObject : [core.mainObject]).flat().some((item) => item?.isObject3D);
}

// What a session's state holds of the scene: the blocks, and the look.
const SESSION_KEYS = [...LIVE_SESSION_BLOCKS, "look", "background", ...LIVE_SESSION_PARTS];
// The parts read and shown by the viewer itself (the comments go through
// the manifest's import).
const OWN_PARTS = LIVE_SESSION_PARTS.filter((key) => key !== "comments");
const readBackground = () => normalizeSessionBackground(core.mainCanvas?.style?.getPropertyValue("background"));
// Blocks the scene writes out at once as they were set: one that reads
// otherwise right after the others' state was shown was changed here.
const SETTLED_KEYS = ["clipping", "lights", "materials", "measurements", "look", "background", "certainty", "comments", "cameras", "photos", "photo", "sounds", "surroundings", "image", "pointCloud"];
const blockTexts = (blocks) => Object.fromEntries(Object.entries(blocks).map(([key, value]) => [key, JSON.stringify(value)]));
const projectionOf = (camera) => (camera?.isOrthographicCamera ? "orthographic" : "perspective");

function readCamera() {
  const camera = core.camera;
  const target = core.controls?.target;
  if (!camera || !target) return null;
  return normalizeSessionCamera({
    position: camera.position.toArray(),
    target: target.toArray(),
    up: camera.up.toArray(),
    fov: camera.isPerspectiveCamera ? camera.fov : undefined,
    zoom: camera.zoom,
    projection: projectionOf(camera),
  });
}

export function attachLiveLink(Viewer) {
  attachLiveSessionPeople(Viewer);
  Object.assign(Viewer, {
    liveLinkState: null,

    getLiveLinkState() {
      Viewer.liveLinkState ??= {
        // Following the manifest: { kind: "url" | "file" | "editor", name,
        // url, handle, lastText, stamp, timer, interval, error, updatedAt,
        // changed: [keys] }.
        manifest: null,
        // The manifest applied last (what the next one is compared with).
        applied: null,
        // Following the model's file: { kind: "url" | "file", ... }.
        model: null,
        // The shared session: { id, transport, mode, peers, send, receive,
        // known: { camera, year, blocks, scene }, ... }.
        session: null,
        glide: null,
        // Our own reload of the model or the manifest: the follows stay.
        busy: false,
        generation: 0,
        client: newSessionId(12),
        open: false,
        collapsed: false,
        sections: {},
        ui: null,
        joinChecked: false,
        // A session the link names, waiting for a nickname.
        joining: null,
        // Why the last session ended here (closed, not let in).
        notice: null,
        // A signed-in host's sessions (live-session-people.js).
        history: null,
      };
      return Viewer.liveLinkState;
    },

    getLiveLink() {
      const state = Viewer.liveLinkState;
      if (!state) return null;
      const follow = (item) => (item ? {
        kind: item.kind,
        name: item.name,
        interval: item.interval,
        error: item.error,
        updatedAt: item.updatedAt,
        changed: item.changed || [],
        reloads: item.reloads || 0,
      } : null);
      return {
        manifest: follow(state.manifest),
        model: follow(state.model),
        session: state.session ? {
          id: state.session.id,
          mode: state.session.mode,
          peers: state.session.peers,
          pending: state.session.waiting,
          nick: state.session.nick,
          status: state.session.status,
          host: state.session.host,
          closed: state.session.closed,
          approval: state.session.approval,
          members: state.session.members,
          send: state.session.send,
          receive: state.session.receive,
          link: Viewer.liveSessionLink(),
          received: state.session.received,
          sent: state.session.sent,
        } : null,
        busy: state.busy,
      };
    },

    isLiveLinkActive() {
      const state = Viewer.liveLinkState;
      return Boolean(state && (state.manifest || state.model || state.session));
    },

    // ---- the camera on its way ----

    // Flies the camera to `view` ({ position, target, up, fov, zoom }) in
    // `seconds`; a drag takes it back. `fromSession`: the others moved it,
    // so where it lands is not sent back to them.
    glideLiveCamera(view, seconds = 0.9, { fromSession = false } = {}) {
      const state = Viewer.getLiveLinkState();
      const to = normalizeSessionCamera(view);
      if (!to || !core.camera || !core.controls) return false;
      stopCameraIntro();
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      state.glide = {
        fromPosition: core.camera.position.clone(),
        fromTarget: core.controls.target.clone(),
        fromFov: core.camera.isPerspectiveCamera ? core.camera.fov : null,
        fromZoom: core.camera.zoom,
        to,
        elapsed: 0,
        fromSession,
        seconds: reduced ? 0 : Math.max(0, seconds),
      };
      if (!state.controlsBound) {
        state.controlsBound = true;
        core.controls.addEventListener("start", () => {
          state.glide = null;
          state.dragging = true;
        });
        core.controls.addEventListener("end", () => {
          state.dragging = false;
        });
      }
      const reach = new THREE.Vector3().fromArray(to.position).distanceTo(new THREE.Vector3().fromArray(to.target));
      if (core.controls.maxDistance < reach * 2) core.controls.maxDistance = reach * 2;
      if (state.glide.seconds === 0) Viewer.stepLiveGlide(0);
      return true;
    },

    stepLiveGlide(delta) {
      const state = Viewer.liveLinkState;
      const glide = state?.glide;
      if (!glide || !core.camera || !core.controls) return;
      glide.elapsed += delta;
      const progress = glide.seconds > 0 ? Math.min(1, glide.elapsed / glide.seconds) : 1;
      const mix = ease(progress);
      const { to } = glide;
      core.camera.position.copy(glide.fromPosition).lerp(new THREE.Vector3().fromArray(to.position), mix);
      core.controls.target.copy(glide.fromTarget).lerp(new THREE.Vector3().fromArray(to.target), mix);
      if (to.up) core.camera.up.fromArray(to.up);
      let projection = false;
      if (to.fov && glide.fromFov !== null && core.camera.isPerspectiveCamera) {
        core.camera.fov = glide.fromFov + (to.fov - glide.fromFov) * mix;
        projection = true;
      }
      if (to.zoom && Math.abs(to.zoom - glide.fromZoom) > 1e-6) {
        core.camera.zoom = glide.fromZoom + (to.zoom - glide.fromZoom) * mix;
        projection = true;
      }
      if (projection) core.camera.updateProjectionMatrix();
      core.camera.lookAt(core.controls.target);
      core.cameraLight?.position?.copy?.(core.camera.position);
      if (progress >= 1) {
        state.glide = null;
        // What the camera reads now is what the session knows.
        if (state.session && glide.fromSession) state.session.absorbCamera = true;
      }
    },

    // ---- the manifest ----

    // The scene as a manifest: the one loaded, or the scene written out.
    currentLiveManifest() {
      const state = Viewer.getLiveLinkState();
      if (state.applied) return state.applied;
      const loaded = Viewer.currentManifest?.json;
      if (loaded && isAIM3DManifest(loaded)) return loaded;
      try {
        return Viewer.build3IFManifest();
      } catch (error) {
        console.warn("Live link: the scene could not be written as a manifest", error);
        return null;
      }
    },

    // A newer version of the manifest on screen: only what differs from
    // the one before is applied. Resolves to the blocks that changed
    // (["model"] when the manifest shows another model: loaded whole).
    async applyLiveManifest(next, { baseUrl } = {}) {
      const state = Viewer.getLiveLinkState();
      if (!next || typeof next !== "object") return [];
      const previous = Viewer.currentLiveManifest();
      const sameModel = previous && isAIM3DManifest(next) && modelLoaded()
        && JSON.stringify(manifestModels(previous)) === JSON.stringify(manifestModels(next));
      if (!sameModel) {
        state.busy = true;
        try {
          await Viewer.setupManifesto(JSON.stringify(next), "text", "aim3if", { baseUrl: baseUrl ?? Viewer.currentManifest?.baseUrl });
        } finally {
          state.busy = false;
        }
        state.applied = next;
        return ["model"];
      }
      const changed = changedManifestBlocks(previous, next);
      if (!changed.length) return [];
      const only = new Set(changed);
      const before = previous.AIM3DViewer || {};
      const after = next.AIM3DViewer || {};
      // The camera flies instead of jumping, when it only moved.
      if (only.has("camera") && after.camera && (after.camera.perspectiveMode ?? null) === (before.camera?.perspectiveMode ?? null)
        && Viewer.glideLiveCamera(after.camera)) {
        only.delete("camera");
      }
      // Only the year: the timeline travels there.
      if (only.has("timeline") && before.timeline && after.timeline && Viewer.hasTimeline?.()
        && JSON.stringify({ ...before.timeline, year: 0 }) === JSON.stringify({ ...after.timeline, year: 0 })
        && Number.isFinite(after.timeline.year)) {
        Viewer.setTimelineYear(after.timeline.year);
        only.delete("timeline");
      }
      // Blocks read together by the import.
      if (only.has("location")) only.add("sun");
      if (only.has("compare")) only.add("variants");
      if (only.size) {
        const imported = Viewer.import3IFManifest(structuredClone(next), { only, quiet: true });
        if (!imported) throw new Error(t("liveLink.errors.invalid", "the manifest is not valid"));
      }
      state.applied = next;
      if (Viewer.currentManifest && isAIM3DManifest(Viewer.currentManifest.json)) Viewer.currentManifest.json = next;
      if (state.session) state.session.absorb = true;
      return changed;
    },

    async readLiveManifestText(text, item) {
      const state = Viewer.getLiveLinkState();
      const generation = state.generation;
      const baseUrl = item.kind === "url" ? Viewer.currentManifest?.baseUrl : undefined;
      const json = await Viewer.getManifestJson(text, "text", baseUrl);
      if (generation !== state.generation || state.manifest !== item) return;
      const changed = await Viewer.applyLiveManifest(json, { baseUrl });
      item.updatedAt = new Date();
      item.changed = changed;
      item.reloads = (item.reloads || 0) + 1;
      item.error = null;
      Viewer.fillLiveManifestEditor();
    },

    // Follows the manifest: its URL (the one on screen by default), read
    // again every `interval` seconds.
    followLiveManifest({ url, interval = 2 } = {}) {
      const state = Viewer.getLiveLinkState();
      const current = Viewer.currentManifest;
      const source = url || (current?.type !== "text" && typeof current?.source === "string" ? current.source : null);
      if (!source) return false;
      Viewer.stopLiveManifest();
      const item = { kind: "url", name: fileName(source), url: source, lastText: null, timer: null, interval: Math.min(3600, Math.max(0.5, Number(interval) || 2)), error: null, updatedAt: null, changed: [], reloads: 0 };
      state.manifest = item;
      state.applied = current?.json && isAIM3DManifest(current.json) ? current.json : null;
      const generation = state.generation;
      const read = async () => {
        if (generation !== state.generation || state.manifest !== item) return;
        try {
          if (!document.hidden) {
            const response = await fetch(source, { cache: "no-store" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            if (generation !== state.generation || state.manifest !== item) return;
            // The first read is the manifest on screen.
            if (item.lastText === null) item.lastText = text;
            else if (text !== item.lastText) {
              item.lastText = text;
              await Viewer.readLiveManifestText(text, item);
            }
            item.error = null;
          }
        } catch (error) {
          item.error = error?.message || String(error);
        }
        if (generation !== state.generation || state.manifest !== item) return;
        Viewer.syncLiveLinkPanel();
        item.timer = setTimeout(read, item.interval * 1000);
      };
      read();
      Viewer.renderLiveLinkPanel();
      Viewer.updateEditorToolbarState?.();
      return true;
    },

    // A manifest file from the device: shown, then watched for being saved
    // (File System Access API; elsewhere it is read once).
    async openLiveManifestFile(fileOrHandle) {
      const state = Viewer.getLiveLinkState();
      let handle = null;
      let file = fileOrHandle || null;
      if (!file && typeof window.showOpenFilePicker === "function") {
        try {
          [handle] = await window.showOpenFilePicker({ types: [{ description: "Manifest (JSON)", accept: { "application/json": [".json"] } }] });
        } catch {
          return false;
        }
      } else if (file && typeof file.getFile === "function") handle = file;
      if (handle) file = await handle.getFile();
      if (!file) return false;
      Viewer.stopLiveManifest();
      const generation = state.generation;
      const item = { kind: "file", name: file.name, handle, lastText: null, stamp: null, timer: null, interval: FILE_POLL_MS / 1000, error: null, updatedAt: null, changed: [], reloads: 0 };
      state.manifest = item;
      const read = async () => {
        if (generation !== state.generation || state.manifest !== item) return;
        try {
          const current = handle ? await handle.getFile() : file;
          const stamp = `${current.lastModified}:${current.size}`;
          if (stamp !== item.stamp) {
            const text = await current.text();
            if (generation !== state.generation || state.manifest !== item) return;
            item.stamp = stamp;
            if (text !== item.lastText) {
              item.lastText = text;
              await Viewer.readLiveManifestText(text, item);
            }
          }
          item.error = null;
        } catch (error) {
          item.error = error?.message || String(error);
        }
        if (generation !== state.generation || state.manifest !== item) return;
        Viewer.syncLiveLinkPanel();
        if (handle) item.timer = setTimeout(read, FILE_POLL_MS);
      };
      await read();
      Viewer.renderLiveLinkPanel();
      Viewer.updateEditorToolbarState?.();
      return true;
    },

    stopLiveManifest() {
      const state = Viewer.liveLinkState;
      if (!state?.manifest) return;
      clearTimeout(state.manifest.timer);
      state.manifest = null;
      state.generation += 1;
      Viewer.renderLiveLinkPanel();
      Viewer.updateEditorToolbarState?.();
    },

    // The scene's settings as text (the manifest's AIM3DViewer block), in
    // the window: typed there, applied as they are typed.
    fillLiveManifestEditor({ force = false } = {}) {
      const state = Viewer.liveLinkState;
      const editor = state?.ui?.editor;
      if (!editor || (!force && document.activeElement === editor)) return;
      const manifest = Viewer.currentLiveManifest();
      const { thumbnails: _thumbnails, ...block } = manifest?.AIM3DViewer || {};
      editor.value = manifest ? JSON.stringify(block, null, 2) : "";
      editor.classList.remove("is-invalid");
      if (state.ui.editorNote) state.ui.editorNote.textContent = "";
    },

    async applyLiveManifestText(text) {
      const state = Viewer.getLiveLinkState();
      const note = state.ui?.editorNote;
      let block;
      try {
        block = JSON.parse(text);
        if (!block || typeof block !== "object" || Array.isArray(block)) throw new Error(t("liveLink.errors.object", "an object is expected"));
      } catch (error) {
        state.ui?.editor?.classList.add("is-invalid");
        if (note) note.textContent = t("liveLink.editorInvalid", { error: error.message }, "Not applied yet: {error}");
        return null;
      }
      const base = Viewer.currentLiveManifest();
      if (!base) return null;
      const next = { ...base, AIM3DViewer: { ...block, ...(base.AIM3DViewer?.thumbnails ? { thumbnails: base.AIM3DViewer.thumbnails } : {}) } };
      try {
        // The scene written out is what the typed one is compared with.
        state.applied ??= base;
        const changed = await Viewer.applyLiveManifest(next);
        state.ui?.editor?.classList.remove("is-invalid");
        if (note) note.textContent = changed.length ? t("liveLink.editorApplied", { blocks: changed.join(", ") }, "Applied: {blocks}") : "";
        return changed;
      } catch (error) {
        state.ui?.editor?.classList.add("is-invalid");
        if (note) note.textContent = t("liveLink.editorInvalid", { error: error.message }, "Not applied yet: {error}");
        return null;
      }
    },

    // ---- the model's file ----

    // The model's file changed: the new one takes the old one's place, the
    // scene around it kept. `load` loads it (resolves to whether it did).
    async reloadLiveModel(load) {
      const state = Viewer.getLiveLinkState();
      if (state.busy) return false;
      state.busy = true;
      let veil = null;
      try {
        const scene = Viewer.build3IFManifest();
        const manifest = Viewer.currentManifest;
        const shownUrl = Viewer.shownModelUrl;
        const session = state.session;
        if (session) session.loading = true;
        veil = Viewer.showLiveVeil();
        const loaded = await load();
        if (loaded === false) return false;
        if (manifest) Viewer.currentManifest = manifest;
        if (shownUrl && !Viewer.shownModelUrl) Viewer.shownModelUrl = shownUrl;
        stopCameraIntro();
        Viewer.import3IFManifest(scene, { quiet: true });
        state.applied = null;
        if (session) {
          session.loading = false;
          session.absorb = true;
          session.absorbCamera = true;
        }
        return true;
      } finally {
        state.busy = false;
        if (state.session) state.session.loading = false;
        Viewer.hideLiveVeil(veil);
      }
    },

    // The view as it is, held over the canvas while the new model loads,
    // then faded away: the old model gives way to the new one.
    showLiveVeil() {
      const canvas = core.renderer?.domElement;
      if (!canvas || !core.container || core.rendererBackend === "webgpu") return null;
      try {
        Viewer.render();
        const image = document.createElement("img");
        image.className = "viewer-livelink-veil";
        image.alt = "";
        image.src = canvas.toDataURL("image/jpeg", 0.9);
        const frame = canvas.getBoundingClientRect();
        const host = core.container.getBoundingClientRect();
        Object.assign(image.style, { left: `${frame.left - host.left}px`, top: `${frame.top - host.top}px`, width: `${frame.width}px`, height: `${frame.height}px` });
        core.container.appendChild(image);
        return image;
      } catch {
        return null;
      }
    },

    hideLiveVeil(veil) {
      if (!veil) return;
      // Two frames with the new model drawn, then the fade.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        veil.classList.add("is-leaving");
        setTimeout(() => veil.remove(), VEIL_FADE_MS + 100);
      }));
    },

    // Follows the model's URL: asked every `interval` seconds whether the
    // file changed (its ETag, date or size).
    followLiveModel({ url, interval = 2 } = {}) {
      const state = Viewer.getLiveLinkState();
      const source = url || Viewer.shownModelUrl;
      if (!source || String(source).startsWith("blob:")) return false;
      Viewer.stopLiveModel();
      const item = { kind: "url", name: fileName(source), url: source, stamp: null, timer: null, interval: Math.min(3600, Math.max(0.5, Number(interval) || 2)), error: null, updatedAt: null, reloads: 0 };
      state.model = item;
      const generation = state.modelGeneration = (state.modelGeneration || 0) + 1;
      const alive = () => generation === state.modelGeneration && state.model === item;
      const check = async () => {
        if (!alive()) return;
        try {
          if (!document.hidden && !state.busy) {
            const response = await fetch(source, { method: "HEAD", cache: "no-store" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const stamp = ["ETag", "Last-Modified", "Content-Length"].map((name) => response.headers.get(name) || "").join("|");
            if (!alive()) return;
            if (item.stamp === null || stamp === "||") item.stamp = stamp;
            else if (stamp !== item.stamp) {
              item.stamp = stamp;
              const done = await Viewer.reloadLiveModel(async () => {
                // The browser's copy of the file is renewed first.
                await fetch(source, { cache: "reload" }).then((fresh) => fresh.arrayBuffer());
                core.autoPath = source;
                Viewer.resetLoadedModelState();
                await Viewer.mainLoadModelWrapper();
                return true;
              });
              if (done) {
                item.updatedAt = new Date();
                item.reloads += 1;
              }
            }
            item.error = null;
          }
        } catch (error) {
          item.error = error?.message || String(error);
        }
        if (!alive()) return;
        Viewer.syncLiveLinkPanel();
        item.timer = setTimeout(check, item.interval * 1000);
      };
      check();
      Viewer.renderLiveLinkPanel();
      Viewer.updateEditorToolbarState?.();
      return true;
    },

    // A model file from the device: shown, then watched for being saved.
    async openLiveModelFile(fileOrHandle) {
      const state = Viewer.getLiveLinkState();
      let handle = null;
      let file = fileOrHandle || null;
      if (!file && typeof window.showOpenFilePicker === "function") {
        try {
          [handle] = await window.showOpenFilePicker();
        } catch {
          return false;
        }
      } else if (file && typeof file.getFile === "function") handle = file;
      if (handle) file = await handle.getFile();
      if (!file) return false;
      Viewer.stopLiveModel();
      const item = { kind: "file", name: file.name, handle, stamp: `${file.lastModified}:${file.size}`, timer: null, interval: FILE_POLL_MS / 1000, error: null, updatedAt: null, reloads: 0 };
      state.busy = true;
      try {
        if (!(await Viewer.openLocalFile(file))) return false;
      } finally {
        state.busy = false;
      }
      state.model = item;
      const generation = state.modelGeneration = (state.modelGeneration || 0) + 1;
      const alive = () => generation === state.modelGeneration && state.model === item;
      const check = async () => {
        if (!alive()) return;
        try {
          const current = await handle.getFile();
          const stamp = `${current.lastModified}:${current.size}`;
          if (stamp !== item.stamp && !state.busy) {
            item.stamp = stamp;
            const done = await Viewer.reloadLiveModel(() => Viewer.openLocalFile(current));
            if (done) {
              item.updatedAt = new Date();
              item.reloads += 1;
            }
          }
          item.error = null;
        } catch (error) {
          item.error = error?.message || String(error);
        }
        if (!alive()) return;
        Viewer.syncLiveLinkPanel();
        item.timer = setTimeout(check, FILE_POLL_MS);
      };
      if (handle) item.timer = setTimeout(check, FILE_POLL_MS);
      Viewer.renderLiveLinkPanel();
      Viewer.updateEditorToolbarState?.();
      return true;
    },

    stopLiveModel() {
      const state = Viewer.liveLinkState;
      if (!state?.model) return;
      clearTimeout(state.model.timer);
      state.model = null;
      state.modelGeneration = (state.modelGeneration || 0) + 1;
      Viewer.renderLiveLinkPanel();
      Viewer.updateEditorToolbarState?.();
    },

    // ---- the shared session ----

    liveSessionLink() {
      const id = Viewer.liveLinkState?.session?.id;
      if (!id) return "";
      const url = new URL(window.location.href);
      url.searchParams.set("session", id);
      return url.href;
    },

    // What this viewer shows, for the others: the camera, the year, the
    // scene's blocks (LIVE_SESSION_BLOCKS) and where the scene comes from.
    readLiveSessionScene() {
      const current = Viewer.currentManifest;
      const manifest = current?.type !== "text" && typeof current?.source === "string" && !current.source.startsWith("blob:") ? current.source : null;
      const model = Viewer.shownModelUrl && !String(Viewer.shownModelUrl).startsWith("blob:") ? Viewer.shownModelUrl : null;
      return { manifest, model: manifest ? null : model };
    },

    readLiveSessionBlocks() {
      let block = {};
      let manifest = null;
      try {
        manifest = Viewer.build3IFManifest();
        block = manifest?.AIM3DViewer || {};
      } catch {
        return null;
      }
      const blocks = {};
      LIVE_SESSION_BLOCKS.forEach((key) => {
        if (block[key] === undefined) return;
        blocks[key] = block[key];
      });
      // The ground, the background, the environment, the rendering.
      const look = sessionLook(block.viewer);
      if (look) blocks.look = look;
      // The background as the canvas shows it (a gradient is in no block).
      const background = readBackground();
      if (background) blocks.background = background;
      // The camera's own light is where each viewer's camera is.
      const headlight = core.cameraLight?.position?.toArray?.();
      if (headlight && Array.isArray(blocks.lights)) {
        blocks.lights = blocks.lights.map((light) => {
          if (light?.type !== "DirectionalLight" || !Array.isArray(light.position) || light.position.some((value, index) => value !== headlight[index])) return light;
          const { position: _position, ...rest } = light;
          return rest;
        });
      }
      // The year travels on its own, many times a second.
      if (blocks.timeline) blocks.timeline = { ...blocks.timeline, year: 0 };
      // The surroundings: their window is each viewer's own, and the year
      // they follow is the timeline's.
      if (blocks.surroundings) {
        const { open: _open, year, ...surroundings } = blocks.surroundings;
        blocks.surroundings = { ...surroundings, ...(surroundings.followTimeline ? {} : { year }) };
      }
      // The comments, as the manifest writes them.
      const comments = (manifest?.items || []).find((item) => item?.type === "Scene")?.annotations?.[0]?.items;
      if (Array.isArray(comments) && comments.length) blocks.comments = comments;
      // The parts no block of the manifest holds.
      Viewer.liveSessionParts ??= liveSessionParts(Viewer);
      OWN_PARTS.forEach((key) => {
        try {
          const value = Viewer.liveSessionParts[key].read(block);
          if (value !== undefined) blocks[key] = JSON.parse(JSON.stringify(value));
        } catch (error) {
          console.warn(`Live session: ${key} could not be read`, error);
        }
      });
      // Too much to send with every state (a table kept as rows, hundreds
      // of measurements): left out, and named so that the others keep theirs.
      const skipped = SESSION_KEYS.filter((key) => blocks[key] !== undefined && JSON.stringify(blocks[key]).length > LIVE_SESSION_BLOCK_LIMIT);
      skipped.forEach((key) => delete blocks[key]);
      if (skipped.length) Object.defineProperty(blocks, "skipped", { value: skipped, enumerable: false });
      return blocks;
    },

    // Starts a session (a new one, or the one named `id`) and joins it
    // under a nickname: `nick`, the account's, or the one used last here;
    // without one the window asks for it (and null is returned).
    async startLiveSession(id, { nick } = {}) {
      const state = Viewer.getLiveLinkState();
      const room = typeof id === "string" && SESSION_ID_PATTERN.test(id) ? id : newSessionId();
      const name = Viewer.liveSessionNick(nick);
      if (!name) {
        Viewer.askLiveSessionNick(typeof id === "string" && SESSION_ID_PATTERN.test(id) ? id : null);
        return null;
      }
      Viewer.rememberLiveSessionNick(name);
      Viewer.leaveLiveSession();
      state.joining = null;
      state.notice = null;
      const session = {
        id: room,
        mode: "server",
        nick: name,
        // The people (live-session-people.js): this viewer's place
        // ("active", "pending"), whether it is the host, the public id the
        // others know it by, how many are in and wait, who they are.
        status: "active",
        host: false,
        you: state.client,
        members: [],
        waiting: 0,
        roster: -1,
        closed: false,
        approval: "auto",
        peers: 1,
        send: true,
        receive: true,
        version: 0,
        known: { camera: null, year: null, blocks: {}, scene: null },
        // The others' blocks as they came and were shown, until changed
        // here: the scene may write them out a little differently, and
        // they are not shown again with every state.
        shown: {},
        // Until the others' state has been asked for, nothing is sent: a
        // viewer that joins takes the session's view, not the other way.
        ready: false,
        sent: 0,
        received: 0,
        lastCameraSent: 0,
        lastBlockSample: 0,
        pending: null,
        posting: false,
        channel: null,
        abort: new AbortController(),
        loading: false,
        absorb: false,
        absorbCamera: false,
      };
      state.session = session;
      Viewer.renderLiveLinkPanel();
      Viewer.updateEditorToolbarState?.();

      // The worker relays; without one, the tabs of this browser share.
      let first = null;
      try {
        await Viewer.joinLiveSessionServer(session);
        const response = await fetch(apiUrl(`/api/live/${room}?since=0&wait=0&client=${state.client}`), { headers: appRequestHeaders(), signal: session.abort.signal, cache: "no-store" });
        if (!response.ok || !/json/.test(response.headers.get("Content-Type") || "")) throw new Error(`HTTP ${response.status}`);
        first = await response.json();
        if (typeof first?.version !== "number") throw new Error("no relay");
      } catch (error) {
        if (error?.refused && state.session === session) {
          Viewer.endLiveSession(error.closed
            ? t("liveLink.session.closedJoin", "This session is closed. It can be joined again once its host resumes it.")
            : error.rejected ? t("liveLink.session.rejected", "The host did not let you in.") : error.message);
          return null;
        }
        first = null;
      }
      if (state.session !== session) return null;
      if (first) {
        session.mode = "server";
        Viewer.receiveLiveSession(first);
        Viewer.pollLiveSession(session);
      } else {
        session.mode = "browser";
        const channel = new BroadcastChannel(`aim3d-live-${room}`);
        session.channel = channel;
        session.seen = new Map();
        channel.addEventListener("message", (event) => {
          const message = event.data;
          if (state.session !== session || !message || message.client === state.client) return;
          session.seen.set(message.client, { at: Date.now(), nick: message.nick || "" });
          if (message.hello) {
            // Someone joined: they get the scene as it is.
            if (session.last && session.send) channel.postMessage({ client: state.client, state: session.last });
          }
          if (message.state) Viewer.receiveLiveSession({ state: message.state, sender: message.client });
          Viewer.countLiveSessionPeers();
        });
        channel.postMessage({ client: state.client, nick: session.nick, hello: true });
        session.heartbeat = setInterval(() => {
          channel.postMessage({ client: state.client, nick: session.nick, beat: true });
          Viewer.countLiveSessionPeers();
        }, 4000);
      }
      // A moment for the others' state to arrive before this one is sent.
      setTimeout(() => {
        if (state.session === session) session.ready = true;
      }, first?.state ? 0 : 400);
      Viewer.syncLiveLinkPanel();
      return room;
    },

    countLiveSessionPeers() {
      const state = Viewer.liveLinkState;
      const session = state?.session;
      if (!session?.seen) return;
      const now = Date.now();
      session.seen.forEach((seen, client) => {
        if (now - seen.at > 10000) session.seen.delete(client);
      });
      // The tabs of one browser: everyone is in, nobody is host.
      Viewer.applyLiveSessionPeople(session, {
        peers: session.seen.size + 1,
        members: [
          { id: state.client, nick: session.nick, status: "active", host: false },
          ...[...session.seen].map(([client, seen]) => ({ id: client, nick: seen.nick, status: "active", host: false })),
        ],
      });
    },

    async pollLiveSession(session) {
      const state = Viewer.getLiveLinkState();
      while (state.session === session) {
        try {
          const response = await fetch(apiUrl(`/api/live/${session.id}?since=${session.version}&roster=${session.roster}&wait=${POLL_WAIT_S}&client=${state.client}`), {
            headers: appRequestHeaders(),
            signal: session.abort.signal,
            cache: "no-store",
          });
          if (!response.ok) {
            const refusal = await response.json().catch(() => null);
            // The worker forgot the room (it started again, or the room
            // was idle): in again, under the same name.
            if (refusal?.rejoin) {
              await Viewer.joinLiveSessionServer(session);
              continue;
            }
            throw new Error(refusal?.error || `HTTP ${response.status}`);
          }
          const answer = await response.json();
          if (state.session !== session) return;
          session.error = null;
          Viewer.receiveLiveSession(answer);
        } catch (error) {
          if (state.session !== session) return;
          if (error?.refused) {
            Viewer.endLiveSession(error.closed
              ? t("liveLink.session.closedJoin", "This session is closed. It can be joined again once its host resumes it.")
              : error.rejected ? t("liveLink.session.rejected", "The host did not let you in.") : error.message);
            return;
          }
          session.error = error?.message || String(error);
          Viewer.syncLiveLinkPanel();
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    },

    // A state from the session: what differs from what this viewer knows
    // is shown - unless it is this viewer's own, or following is off.
    receiveLiveSession(answer) {
      const state = Viewer.getLiveLinkState();
      const session = state.session;
      if (!session || !answer) return;
      Viewer.applyLiveSessionPeople(session, answer);
      if (state.session !== session) return;
      // Waiting to be let in: the states come once in, from the first.
      if (typeof answer.version === "number" && session.status === "active") session.version = Math.max(session.version, answer.version);
      const remote = answer.state;
      if (!remote || typeof remote !== "object" || answer.sender === session.you || answer.sender === state.client) return;
      Viewer.noteLiveSessionLeader(session, answer.sender);
      if (!session.receive) return;
      session.received += 1;
      const { known } = session;

      // Another scene: opened first, the rest follows with the next state.
      const scene = remote.scene && typeof remote.scene === "object" ? remote.scene : null;
      if (scene && !session.loading && !state.busy) {
        const own = Viewer.readLiveSessionScene();
        const url = (value) => (typeof value === "string" && !value.startsWith("blob:") && value.length < 2000 ? value : null);
        const manifest = url(scene.manifest);
        const model = url(scene.model);
        if ((manifest && manifest !== own.manifest) || (!manifest && model && model !== own.model)) {
          session.loading = true;
          state.busy = true;
          const open = manifest
            ? Viewer.setupManifesto(manifest, "url")
            : (async () => {
              core.autoPath = model;
              Viewer.resetLoadedModelState();
              await Viewer.mainLoadModelWrapper();
            })();
          Promise.resolve(open).catch((error) => console.warn("Live session: the scene could not be opened", error)).finally(() => {
            state.busy = false;
            if (state.session === session) {
              session.loading = false;
              session.absorb = true;
              session.absorbCamera = true;
              // The state that came with the scene, now on the model.
              session.known.blocks = {};
              session.shown = {};
              session.known.camera = null;
              Viewer.receiveLiveSession({ state: remote, sender: answer.sender });
            }
          });
          known.scene = JSON.stringify(Viewer.readLiveSessionScene());
          return;
        }
      }
      if (session.loading || !modelLoaded()) return;

      const camera = normalizeSessionCamera(remote.camera);
      if (camera && !state.dragging && !sameSessionCamera(camera, known.camera)) {
        known.camera = camera;
        if (camera.projection && camera.projection !== projectionOf(core.camera)) {
          // The other projection: from the others' place, so that it shows
          // as much as theirs.
          core.camera.position.fromArray(camera.position);
          core.controls?.target?.fromArray(camera.target);
          if (camera.up) core.camera.up.fromArray(camera.up);
          if (camera.fov && core.camera.isPerspectiveCamera) core.camera.fov = camera.fov;
          core.camera.lookAt(core.controls?.target ?? new THREE.Vector3());
          Viewer.setCameraProjection?.(camera.projection);
        }
        Viewer.glideLiveCamera(camera, 0.22, { fromSession: true });
        // The view the others gave: a load's fly-in that starts after it
        // must not take it back (stepLiveSession). Each fly-in has its own
        // token; the glide stopped the one before.
        session.remoteCamera = camera;
        session.remoteCameraToken = core.cameraTweenToken;
      }
      if (Number.isFinite(remote.year) && remote.year !== known.year && Viewer.hasTimeline?.()) {
        known.year = remote.year;
        Viewer.setTimelineYear(remote.year, { immediate: true });
      }
      if (remote.blocks && typeof remote.blocks === "object") {
        const only = new Set();
        const next = {};
        // Blocks the sender left out (too large) stay as they are here.
        const skipped = new Set(Array.isArray(remote.skipped) ? remote.skipped : []);
        let look = null;
        let background = null;
        let comments = null;
        const parts = [];
        SESSION_KEYS.forEach((key) => {
          if (skipped.has(key)) return;
          const text = remote.blocks[key] === undefined ? undefined : JSON.stringify(remote.blocks[key]);
          if (text === known.blocks[key] || (key in session.shown && text === session.shown[key])) return;
          known.blocks[key] = text;
          session.shown[key] = text;
          if (key === "look") {
            look = remote.blocks.look;
            return;
          }
          if (key === "background") {
            background = normalizeSessionBackground(remote.blocks.background);
            return;
          }
          if (key === "comments") {
            comments = Array.isArray(remote.blocks.comments) ? remote.blocks.comments : [];
            return;
          }
          if (OWN_PARTS.includes(key)) {
            parts.push(key);
            return;
          }
          only.add(key);
          if (remote.blocks[key] !== undefined) next[key] = remote.blocks[key];
        });
        if (only.size || look || background || comments || parts.length) {
          try {
            const base = Viewer.build3IFManifest();
            // The year is not the session's to set here.
            if (next.timeline) next.timeline = { ...next.timeline, year: base.AIM3DViewer?.timeline?.year ?? next.timeline.year };
            if (only.has("location")) only.add("sun");
            if (only.has("compare")) only.add("variants");
            // Read along: as the others have them.
            ["sun", "variants"].forEach((key) => {
              if (only.has(key) && !(key in next) && !skipped.has(key)) next[key] = remote.blocks[key];
            });
            // Of the look, what differs from the one shown - with this
            // viewer's own section, which that block is read with.
            const changedLook = changedSessionLook(look, sessionLook(base.AIM3DViewer?.viewer));
            if (Object.keys(changedLook).length) {
              only.add("viewer");
              next.viewer = { ...changedLook, ...(base.AIM3DViewer?.viewer?.clipping ? { clipping: base.AIM3DViewer.viewer.clipping } : {}) };
            }
            // The surroundings follow this viewer's timeline, where they do.
            if (next.surroundings?.followTimeline && Number.isFinite(Viewer.surroundings?.year)) next.surroundings = { ...next.surroundings, year: Viewer.surroundings.year };
            const blockKeys = [...only];
            // The comments, in the place of the scene's own.
            const items = !comments ? base.items : base.items.map((item) => (item?.type === "Scene"
              ? { ...item, annotations: [{ id: `${item.id}/page/annotations`, type: "AnnotationPage", items: comments }] }
              : item));
            if (comments) only.add("annotations");
            // Their windows open with a manifest; here they stay as they are.
            const windows = [["photos", "isPhotosPanelOpen", "togglePhotosPanel"], ["sounds", "isSoundsPanelOpen", "toggleSoundsPanel"]]
              .filter(([key, isOpen]) => only.has(key) && Viewer[isOpen]?.() !== true);
            if (only.size) {
              const imported = Viewer.import3IFManifest({ ...base, items, AIM3DViewer: { ...base.AIM3DViewer, ...Object.fromEntries(blockKeys.map((key) => [key, next[key]])) } }, { only, quiet: true });
              if (!imported) console.warn("Live session: a state was not valid", [...only]);
            }
            windows.forEach(([, , toggle]) => Viewer[toggle]?.(false));
            // The Level of Certainty view goes on with the comments' import;
            // here it may be the only thing that changed.
            if (only.has("certainty") && next.certainty && (next.certainty.visible === true) !== (Viewer.certaintyView === true)) {
              Viewer.setCertaintyView?.(next.certainty.visible === true);
            }
            // After the blocks: a photo is opened from the list they bring.
            Viewer.liveSessionParts ??= liveSessionParts(Viewer);
            parts.forEach((key) => {
              try {
                Viewer.liveSessionParts[key].show(remote.blocks[key]);
              } catch (error) {
                console.warn(`Live session: ${key} could not be shown`, error);
              }
            });
            // After the ground, which may bring a background of its own.
            if (background && background !== readBackground()) core.mainCanvas?.style?.setProperty("background", background);
            // The lights are set anew: the camera's own one back at the camera.
            if (only.has("lights")) core.cameraLight?.position?.copy?.(core.camera.position);
          } catch (error) {
            console.warn("Live session: a state could not be shown", error);
          }
          // What the scene writes out after it is what this viewer knows:
          // read with the next frame, so that a change made here right
          // after it is one to send.
          session.absorb = true;
          session.lastBlockSample = 0;
          const written = Viewer.readLiveSessionBlocks();
          session.settled = written ? blockTexts(written) : null;
        }
      }
    },

    // Each frame: what changed here goes to the others.
    stepLiveSession(now) {
      const state = Viewer.liveLinkState;
      const session = state?.session;
      if (!session || !session.ready || session.loading || state.busy || !modelLoaded()) return;
      // Not let in yet, or closed: nothing goes out.
      if (session.status !== "active" || session.closed) return;
      const { known } = session;

      // The model's fly-in starts at the end of loading - after a viewer
      // that joined took the session's view: back to that view, instead of
      // sending the fly-in's to everyone.
      if (session.remoteCamera && core.cameraTweenToken !== session.remoteCameraToken && window.viewer?.isCameraAnimating?.()) {
        Viewer.glideLiveCamera(session.remoteCamera, 0.22, { fromSession: true });
        session.remoteCameraToken = core.cameraTweenToken;
        return;
      }
      let changed = false;

      // The camera: while it is this viewer's hand that moves it.
      if (session.absorbCamera && !state.glide) {
        session.absorbCamera = false;
        const camera = readCamera();
        // The projection switched here while the camera was on its way.
        if (camera && known.camera?.projection && camera.projection !== known.camera.projection) changed = true;
        known.camera = camera;
      } else if (!state.glide && now - session.lastCameraSent >= CAMERA_SEND_MS) {
        const camera = readCamera();
        if (camera && !sameSessionCamera(camera, known.camera)) {
          known.camera = camera;
          session.lastCameraSent = now;
          changed = true;
        }
      }

      if (Viewer.hasTimeline?.()) {
        const year = Math.round(Viewer.getTimelineYear() * 100) / 100;
        if (year !== known.year) {
          if (known.year !== null || session.sent > 0) changed = true;
          known.year = year;
        }
      }

      if (now - session.lastBlockSample >= BLOCK_SAMPLE_MS) {
        session.lastBlockSample = now;
        const blocks = Viewer.readLiveSessionBlocks();
        if (blocks) {
          const texts = blockTexts(blocks);
          // A block left out as too large is not one taken away.
          (blocks.skipped || []).forEach((key) => { texts[key] = known.blocks[key]; });
          const differs = SESSION_KEYS.some((key) => texts[key] !== known.blocks[key]);
          if (differs) {
            // After a state from the others the scene's own writing of it
            // is taken in, not sent back - but for what was changed here
            // since.
            const settled = session.absorb ? session.settled : null;
            const mine = !session.absorb
              ? SESSION_KEYS.filter((key) => texts[key] !== known.blocks[key])
              : settled ? SETTLED_KEYS.filter((key) => texts[key] !== settled[key]) : [];
            mine.forEach((key) => delete session.shown[key]);
            known.blocks = texts;
            session.blocks = blocks;
            if (mine.length) changed = true;
          } else session.blocks ??= blocks;
          session.absorb = false;
          session.settled = null;
          const scene = JSON.stringify(Viewer.readLiveSessionScene());
          if (scene !== known.scene) {
            known.scene = scene;
            changed = true;
          }
        }
      }

      // The first state of a session nobody has spoken in yet.
      if (!changed && session.sent === 0 && session.received === 0 && session.blocks && !session.greeted) {
        session.greeted = true;
        changed = true;
      }
      if (changed && session.send) Viewer.publishLiveSession();
    },

    publishLiveSession() {
      const state = Viewer.getLiveLinkState();
      const session = state.session;
      if (!session) return;
      const message = {
        camera: session.known.camera || readCamera(),
        ...(session.known.year !== null ? { year: session.known.year } : {}),
        blocks: session.blocks || {},
        ...(session.blocks?.skipped ? { skipped: session.blocks.skipped } : {}),
        scene: Viewer.readLiveSessionScene(),
      };
      session.last = message;
      session.sent += 1;
      Viewer.noteLiveSessionLeader(session, session.you);
      if (session.mode === "browser") {
        session.channel?.postMessage({ client: state.client, state: message });
        return;
      }
      // One request at a time: the newest state waits for the one before.
      session.pending = message;
      if (session.posting) return;
      session.posting = true;
      (async () => {
        while (state.session === session && session.pending) {
          const body = session.pending;
          session.pending = null;
          try {
            const response = await fetch(apiUrl(`/api/live/${session.id}`), {
              method: "POST",
              headers: { "Content-Type": "application/json", ...appRequestHeaders() },
              body: JSON.stringify({ client: state.client, state: body }),
              signal: session.abort.signal,
            });
            const answer = await response.json().catch(() => null);
            if (response.ok) Viewer.applyLiveSessionPeople(session, answer);
            else if (answer?.closed) Viewer.applyLiveSessionPeople(session, { closed: true });
            else if (answer?.rejoin) await Viewer.joinLiveSessionServer(session);
          } catch {
            // The next state is sent with the next change.
          }
        }
        session.posting = false;
      })();
    },

    setLiveSessionOptions({ send, receive } = {}) {
      const session = Viewer.liveLinkState?.session;
      if (!session) return;
      if (typeof send === "boolean") session.send = send;
      if (typeof receive === "boolean") session.receive = receive;
      Viewer.syncLiveLinkPanel();
    },

    leaveLiveSession() {
      const state = Viewer.liveLinkState;
      const session = state?.session;
      if (!session) return;
      state.session = null;
      session.abort.abort();
      clearInterval(session.heartbeat);
      clearTimeout(session.leaderTimer);
      session.channel?.close();
      Viewer.renderLiveLinkPanel();
      Viewer.updateEditorToolbarState?.();
      Viewer.updateLiveSessionBadge();
    },

    // ---- the frame, the scene's end ----

    updateLiveLink(delta) {
      const state = Viewer.liveLinkState;
      if (!state) {
        // A link with ?session=...: joined once the model is there.
        if (Viewer.liveLinkJoinChecked || !modelLoaded()) return;
        // Signed in, the account's name is the nickname: a moment for the
        // account to be known.
        Viewer.liveLinkJoinWait ??= performance.now();
        if (Viewer.authState === undefined && hasRemote() && performance.now() - Viewer.liveLinkJoinWait < 3000) return;
        Viewer.liveLinkJoinChecked = true;
        const id = new URLSearchParams(window.location.search).get("session");
        if (id && SESSION_ID_PATTERN.test(id)) Viewer.startLiveSession(id);
        return;
      }
      if (state.glide) Viewer.stepLiveGlide(Number.isFinite(delta) ? Math.min(delta, 0.25) : 0);
      if (state.session) Viewer.stepLiveSession(performance.now());
    },

    // Another scene was opened: what followed the old one stops (not when
    // the reload is the live link's own). The session stays.
    disposeLiveLink() {
      const state = Viewer.liveLinkState;
      if (!state || state.busy) return;
      state.glide = null;
      state.applied = null;
      Viewer.stopLiveManifest();
      Viewer.stopLiveModel();
      if (state.session) {
        // A scene opened here: its own fly-in is this viewer's to share.
        state.session.remoteCamera = null;
        state.session.absorb = true;
        state.session.absorbCamera = true;
      }
    },

    // ---- the window ----

    isLiveLinkPanelOpen() {
      const state = Viewer.liveLinkState;
      return Boolean(state?.open && state.ui && !(isPhone() && isToolPanelMinimized(state.ui.root)));
    },

    toggleLiveLinkPanel(open) {
      const state = Viewer.getLiveLinkState();
      const next = typeof open === "boolean" ? open : !Viewer.isLiveLinkPanelOpen();
      state.open = next;
      if (next && !state.ui) Viewer.createLiveLinkPanel();
      if (state.ui) {
        state.ui.root.hidden = !next;
        if (next && isPhone()) setToolPanelMinimized(state.ui.root, false);
      }
      if (next) Viewer.renderLiveLinkPanel();
      Viewer.updateEditorToolbarState?.();
    },

    createLiveLinkPanel() {
      const state = Viewer.getLiveLinkState();
      const stack = getViewerSideStack();
      if (state.ui || !stack || core.PRESENTATION_MODE || Viewer.urlOptions?.hideUi === true) return;
      const root = document.createElement("section");
      root.id = "viewerLiveLinkPanel";
      root.className = "viewer-pointcloud-panel viewer-volume-panel viewer-livedata-panel viewer-livelink-panel";
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
        Viewer.syncLiveLinkPanel();
      });
      header.append(title, collapse);
      attachToolPanelChrome(root, header, {
        icon: PANEL_ICONS.liveLink,
        label: () => t("liveLink.title", "Live link"),
        modal: isPhone,
        onClose: () => Viewer.toggleLiveLinkPanel(false),
      });
      const body = document.createElement("div");
      body.className = "viewer-pointcloud-panel_body";
      root.append(header, body);
      stack.appendChild(root);
      state.ui = { root, title, collapse, body };
      new MutationObserver(() => Viewer.updateEditorToolbarState?.()).observe(root, { attributes: true, attributeFilter: ["class"] });
    },

    renderLiveLinkPanel() {
      const state = Viewer.liveLinkState;
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
      const button = (className, text, onClick) => {
        const element = el("button", `viewer-pointcloud-panel_button ${className}`);
        element.type = "button";
        element.addEventListener("click", onClick);
        labels.push([element, text]);
        return element;
      };
      const status = (key) => {
        const line = el("p", "viewer-livedata-panel_status");
        line.setAttribute("role", "status");
        const text = el("span");
        line.append(el("span", "viewer-livedata-panel_dot"), text);
        ui[key] = { line, text };
        return line;
      };
      const intervalSelect = (item, restart) => {
        const select = el("select");
        INTERVALS.forEach((seconds) => {
          const option = new Option("", String(seconds));
          labels.push([option, () => t("liveData.everySeconds", { seconds }, "every {seconds} s")]);
          select.appendChild(option);
        });
        select.value = String(INTERVALS.includes(item?.interval) ? item.interval : 2);
        select.addEventListener("change", () => {
          state.interval = Number(select.value);
          if (item?.kind === "url") restart(Number(select.value));
        });
        labels.push([select, () => t("liveData.refresh", "Read again")]);
        return select;
      };
      const section = (id, text, open, children) => {
        const details = el("details", "viewer-livedata-panel_section viewer-livelink-panel_section");
        details.open = state.sections[id] ?? open;
        details.dataset.section = id;
        details.addEventListener("toggle", () => {
          state.sections[id] = details.open;
        });
        const summary = el("summary");
        labels.push([summary, text]);
        const box = el("div", "viewer-volume-panel_channel");
        box.append(...children);
        details.append(summary, box);
        ui.body.appendChild(details);
        return details;
      };
      const actions = (...children) => {
        const row = el("div", "viewer-livedata-panel_actions");
        row.append(...children);
        return row;
      };
      const check = (text, checked, onChange) => {
        const label = el("label", "viewer-audio-panel_check");
        const input = el("input");
        input.type = "checkbox";
        input.checked = checked;
        input.addEventListener("change", () => onChange(input.checked));
        const span = el("span");
        label.append(input, span);
        labels.push([span, text]);
        return label;
      };
      const hasPicker = typeof window.showOpenFilePicker === "function";
      const fileInput = (accept, onFile) => {
        const input = el("input");
        input.type = "file";
        if (accept) input.accept = accept;
        input.hidden = true;
        input.addEventListener("change", () => {
          const file = input.files?.[0];
          if (file) onFile(file);
          input.value = "";
        });
        return input;
      };

      // The session first: the one most people come for.
      const session = state.session;
      const sessionChildren = [status("sessionStatus")];
      if (session) {
        const link = el("input", "viewer-livelink-panel_link");
        link.type = "text";
        link.readOnly = true;
        link.value = Viewer.liveSessionLink();
        link.addEventListener("focus", () => link.select());
        labels.push([link, () => t("liveLink.session.link", "The session's link")]);
        const copy = button("viewer-livelink-panel_copy", () => t("liveLink.session.copy", "Copy the link"), async () => {
          try {
            await navigator.clipboard.writeText(link.value);
            copy.dataset.done = "1";
            Viewer.syncLiveLinkPanel();
            setTimeout(() => {
              delete copy.dataset.done;
              Viewer.syncLiveLinkPanel();
            }, 1800);
          } catch {
            link.focus();
          }
        });
        labels[labels.length - 1][1] = () => (copy.dataset.done ? t("liveLink.session.copied", "Copied") : t("liveLink.session.copy", "Copy the link"));
        const leave = button("viewer-livelink-panel_leave", () => t("liveLink.session.leave", "Leave"), () => Viewer.leaveLiveSession());
        sessionChildren.push(
          ...Viewer.buildLiveSessionPeople({ el, labels, button, actions, check }),
          link,
          actions(copy, leave),
          check(() => t("liveLink.session.send", "The others see what I do"), session.send, (on) => Viewer.setLiveSessionOptions({ send: on })),
          check(() => t("liveLink.session.receive", "I see what the others do"), session.receive, (on) => Viewer.setLiveSessionOptions({ receive: on })),
        );
        const note = el("p", "viewer-pointcloud-panel_note");
        labels.push([note, () => (session.mode === "browser"
          ? t("liveLink.session.browserOnly", "No server relays sessions here: the link works in the other tabs and windows of this browser.")
          : t("liveLink.session.hint", "Open the link on another screen or a phone: the camera, the year, the section and the weather move together."))]);
        sessionChildren.push(note);
      } else {
        sessionChildren.push(...Viewer.buildLiveSessionStart({ el, labels, button, actions }));
      }
      section("session", () => t("liveLink.session.title", "Cooperation mode"), true, sessionChildren);

      // A signed-in host's sessions: closed, resumed, joined again.
      if (Viewer.authState?.user && hasRemote()) {
        section("history", () => t("liveLink.history.title", "My sessions"), false, Viewer.buildLiveSessionHistory({ el, labels, button, actions }));
      }

      // The manifest.
      const manifest = state.manifest;
      const loadedUrl = Viewer.currentManifest?.type !== "text" && typeof Viewer.currentManifest?.source === "string";
      const manifestInput = fileInput(".json,application/json", (file) => Viewer.openLiveManifestFile(file));
      const manifestActions = [];
      if (manifest) manifestActions.push(button("viewer-livelink-panel_stop-manifest", () => t("liveLink.stop", "Stop following"), () => Viewer.stopLiveManifest()));
      else if (loadedUrl) manifestActions.push(button("viewer-livelink-panel_follow-manifest", () => t("liveLink.manifest.follow", "Follow the manifest"), () => Viewer.followLiveManifest({ interval: state.interval || 2 })));
      manifestActions.push(button("viewer-livelink-panel_open-manifest", () => t("liveLink.manifest.open", "Open a manifest file…"), () => {
        if (hasPicker) Viewer.openLiveManifestFile();
        else manifestInput.click();
      }), manifestInput);
      const editor = el("textarea", "viewer-livelink-panel_editor");
      editor.spellcheck = false;
      editor.rows = 9;
      let timer = null;
      editor.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => Viewer.applyLiveManifestText(editor.value), EDIT_DEBOUNCE_MS);
      });
      labels.push([editor, () => t("liveLink.manifest.editor", "The scene's settings (AIM3DViewer), applied as you type")]);
      ui.editor = editor;
      ui.editorNote = el("p", "viewer-pointcloud-panel_note viewer-livelink-panel_editor-note");
      const editorLabel = el("p", "viewer-pointcloud-panel_note");
      labels.push([editorLabel, () => t("liveLink.manifest.editor", "The scene's settings (AIM3DViewer), applied as you type")]);
      const refill = button("viewer-livelink-panel_refill", () => t("liveLink.manifest.refill", "Read the scene again"), () => {
        state.applied = null;
        Viewer.fillLiveManifestEditor({ force: true });
      });
      section("manifest", () => t("liveLink.manifest.title", "The manifest, followed"), Boolean(manifest), [
        status("manifestStatus"),
        actions(...manifestActions, ...(manifest?.kind === "url" ? [intervalSelect(manifest, (interval) => Viewer.followLiveManifest({ url: manifest.url, interval }))] : [])),
        editorLabel,
        editor,
        ui.editorNote,
        actions(refill),
      ]);

      // The model's file.
      const model = state.model;
      const modelInput = fileInput("", (file) => Viewer.openLiveModelFile(file));
      const modelActions = [];
      if (model) modelActions.push(button("viewer-livelink-panel_stop-model", () => t("liveLink.stop", "Stop following"), () => Viewer.stopLiveModel()));
      else if (Viewer.shownModelUrl) modelActions.push(button("viewer-livelink-panel_follow-model", () => t("liveLink.model.follow", "Follow the model's file"), () => Viewer.followLiveModel({ interval: state.interval || 2 })));
      modelActions.push(button("viewer-livelink-panel_open-model", () => t("liveLink.model.open", "Open a model file…"), () => {
        if (hasPicker) Viewer.openLiveModelFile();
        else modelInput.click();
      }), modelInput);
      const modelNote = el("p", "viewer-pointcloud-panel_note");
      labels.push([modelNote, () => (hasPicker
        ? t("liveLink.model.hint", "Save the model again in the program it is made in: the new one takes its place, with the camera, the comments and the section kept.")
        : t("liveLink.fileOnce", "This browser reads a file once. In Chrome or Edge the file stays connected: save it and the viewer follows."))]);
      section("model", () => t("liveLink.model.title", "The model's file, followed"), Boolean(model), [
        status("modelStatus"),
        actions(...modelActions, ...(model?.kind === "url" ? [intervalSelect(model, (interval) => Viewer.followLiveModel({ url: model.url, interval }))] : [])),
        modelNote,
      ]);

      Viewer.fillLiveManifestEditor({ force: true });
      Viewer.syncLiveLinkPanel();
    },

    syncLiveLinkPanel() {
      const state = Viewer.liveLinkState;
      const ui = state?.ui;
      if (!ui) return;
      const title = t("liveLink.title", "Live link");
      ui.root.setAttribute("aria-label", title);
      ui.title.textContent = title;
      ui.root.hidden = !state.open;
      ui.body.hidden = state.collapsed && !isPhone();
      ui.collapse.textContent = state.collapsed ? "+" : "–";
      const collapseLabel = state.collapsed ? t("liveData.expand", "Show settings") : t("liveData.collapse", "Hide settings");
      ui.collapse.title = collapseLabel;
      ui.collapse.setAttribute("aria-label", collapseLabel);

      const follow = (slot, item, idle) => {
        if (!slot) return;
        slot.line.classList.toggle("is-live", Boolean(item) && !item.error && (item.kind === "url" || Boolean(item.handle)));
        slot.line.classList.toggle("is-error", Boolean(item?.error));
        let text = idle;
        if (item?.error) text = t("liveLink.status.error", { error: item.error }, "Could not read it: {error}");
        else if (item) {
          const mode = item.kind === "url"
            ? t("liveData.status.live", { name: item.name, seconds: item.interval }, "Live: {name}, every {seconds} s")
            : item.handle ? t("liveData.status.watching", { name: item.name }, "Live: {name}, read again when it is saved") : t("liveData.status.static", { name: item.name }, "Table: {name}");
          const when = item.updatedAt
            ? t("liveLink.status.updated", { time: clockTime(item.updatedAt), what: item.changed?.length ? item.changed.join(", ") : t("liveLink.status.model", "the model") }, "Last change {time}: {what}")
            : "";
          text = [mode, when].filter(Boolean).join(" · ");
        }
        slot.text.textContent = text;
      };
      follow(ui.manifestStatus, state.manifest, t("liveLink.manifest.idle", "Not followed."));
      follow(ui.modelStatus, state.model, t("liveLink.model.idle", "Not followed."));
      if (ui.sessionStatus) {
        const session = state.session;
        ui.sessionStatus.line.classList.toggle("is-live", Boolean(session) && !session.error && session.status === "active" && !session.closed);
        ui.sessionStatus.line.classList.toggle("is-error", Boolean(session?.error));
        ui.sessionStatus.line.classList.toggle("is-waiting", Boolean(session) && (session.status === "pending" || session.closed));
        ui.sessionStatus.text.textContent = !session
          ? state.joining ? t("liveLink.session.joinIdle", "Not in the session yet.") : t("liveLink.session.idle", "No session.")
          : Viewer.liveSessionStatusText(session);
      }
      Viewer.syncLiveSessionPeople();
      Viewer.syncLiveSessionHistory();
      (ui.labels || []).forEach(([element, text]) => {
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) element.setAttribute("aria-label", text());
        else element.textContent = text();
      });
    },
  });
}

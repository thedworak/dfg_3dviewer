import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { loadedModelsBox } from "../viewer-utils.js";
import { MODEL_UNITS } from "./model-units.js";
import {
  computeRoomAcoustics,
  FLOOR_COVER_NAMES,
  materialFromName,
  ROOM_MATERIAL_NAMES,
  sendGain,
} from "../room-acoustics.js";

// The room's acoustics in the Sounds window (auralization): the scene's
// sounds heard as they would be in the reconstructed building, with its
// reverberation worked out from the model's geometry (room-acoustics.js,
// in a Web Worker) at a listening point - where the camera was.
//
// The impulse response goes into one ConvolverNode. Each source sends its
// sound to it before the panner, so the reverberation does not fade with
// the distance as the direct sound does: a source at full volume up to
// `distance` sends sendGain(result, distance), the reverberant field
// against its direct sound. Ambient sources stay dry unless set otherwise
// (wind is outside); with the room they send as much as the room gives
// back at its critical distance.
//
// Kept in the manifest as AIM3DViewer.sounds.acoustics ({ on, position,
// material, floor, amount }); the result is worked out again when the
// sounds play.

export const DEFAULT_ACOUSTICS = { on: false, position: null, material: "plaster", floor: "material", amount: 1 };
const MAX_TRIANGLES = 3_000_000;
const RAYS = 3000;
// The worker gives up some rays rather than take longer than this.
const BUDGET_MS = 20_000;
const MAIN_THREAD_BUDGET_MS = 4_000;
const RAMP = 0.08;

const round = (value, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;

export function normalizeAcoustics(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const position = Array.isArray(value.position) && value.position.length >= 3 && value.position.slice(0, 3).every((n) => Number.isFinite(Number(n)))
    ? value.position.slice(0, 3).map(Number)
    : null;
  const amount = Number(value.amount);
  return {
    on: value.on === true,
    position,
    material: ROOM_MATERIAL_NAMES.includes(value.material) ? value.material : DEFAULT_ACOUSTICS.material,
    floor: FLOOR_COVER_NAMES.includes(value.floor) ? value.floor : DEFAULT_ACOUSTICS.floor,
    amount: Number.isFinite(amount) ? Math.min(2, Math.max(0, amount)) : 1,
  };
}

// Whether a source is heard in the room: its own `acoustics`, or by its
// kind (placed sources yes, ambient ones no).
export function soundInRoom(source) {
  return typeof source?.acoustics === "boolean" ? source.acoustics : source?.type !== "ambient";
}

// The visible meshes of the loaded models, as world-space triangles with a
// material each (an index into ROOM_MATERIAL_NAMES, 255: the default).
export function collectRoomGeometry(roots = (core.mainObject || []).flat()) {
  const meshes = [];
  let count = 0;
  roots.filter((root) => root?.isObject3D).forEach((root) => {
    root.updateMatrixWorld(true);
    root.traverseVisible((object) => {
      if (!object.isMesh || object.userData?.isHelper || !object.geometry?.attributes?.position) return;
      const geometry = object.geometry;
      const triangles = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
      const instances = object.isInstancedMesh ? object.count : 1;
      count += Math.floor(triangles) * instances;
      meshes.push(object);
    });
  });
  if (count > MAX_TRIANGLES) return { tooLarge: true, count };
  const positions = new Float32Array(count * 9);
  const materials = new Uint8Array(count).fill(255);
  const vertex = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const instanceMatrix = new THREE.Matrix4();
  const indexOf = new Map();
  const materialIndex = (material, object) => {
    if (indexOf.has(material)) return indexOf.get(material);
    const name = materialFromName(material?.name) || materialFromName(material?.map?.name) || materialFromName(object.name);
    const index = name ? ROOM_MATERIAL_NAMES.indexOf(name) : 255;
    indexOf.set(material, index);
    return index;
  };
  let written = 0;
  meshes.forEach((object) => {
    const geometry = object.geometry;
    const position = geometry.attributes.position;
    const index = geometry.index;
    const total = index ? index.count : position.count;
    const materialList = Array.isArray(object.material) ? object.material : null;
    const groups = materialList && geometry.groups.length ? geometry.groups : [{ start: 0, count: total, materialIndex: 0 }];
    const instances = object.isInstancedMesh ? object.count : 1;
    for (let instance = 0; instance < instances; instance += 1) {
      matrix.copy(object.matrixWorld);
      if (object.isInstancedMesh) {
        object.getMatrixAt(instance, instanceMatrix);
        matrix.multiply(instanceMatrix);
      }
      groups.forEach((group) => {
        const material = materialList ? materialList[group.materialIndex] : object.material;
        const kind = materialIndex(material, object);
        const end = Math.min(total, group.start + group.count);
        for (let i = group.start; i + 2 < end; i += 3) {
          for (let corner = 0; corner < 3; corner += 1) {
            const vertexIndex = index ? index.getX(i + corner) : i + corner;
            vertex.fromBufferAttribute(position, vertexIndex).applyMatrix4(matrix);
            positions[written * 9 + corner * 3] = vertex.x;
            positions[written * 9 + corner * 3 + 1] = vertex.y;
            positions[written * 9 + corner * 3 + 2] = vertex.z;
          }
          materials[written] = kind;
          written += 1;
        }
      });
    }
  });
  const box = loadedModelsBox();
  return {
    positions: written * 9 === positions.length ? positions : positions.slice(0, written * 9),
    materials: written === materials.length ? materials : materials.slice(0, written),
    size: box.isEmpty() ? 1 : box.getSize(new THREE.Vector3()).length(),
    count: written,
  };
}

function runAcoustics(geometry, options, onProgress) {
  const onMainThread = () => new Promise((resolve, reject) => {
    try {
      resolve(computeRoomAcoustics(geometry, { ...options, budget: Math.min(options.budget, MAIN_THREAD_BUDGET_MS), onProgress }));
    } catch (error) {
      reject(error);
    }
  });
  let worker;
  const promise = new Promise((resolve, reject) => {
    try {
      worker = new Worker(new URL("../room-acoustics-worker.js", import.meta.url), { type: "module" });
    } catch {
      onMainThread().then(resolve, reject);
      return;
    }
    let started = false;
    worker.onmessage = ({ data }) => {
      if (data?.type === "ready") {
        started = true;
        // Copies: the triangles stay here for the main thread should the
        // worker fail.
        const copy = { positions: geometry.positions.slice(), materials: geometry.materials.slice(), size: geometry.size };
        worker.postMessage({ geometry: copy, options }, [copy.positions.buffer, copy.materials.buffer]);
      } else if (data?.type === "progress") {
        onProgress?.(data.progress);
      } else if (data?.type === "done") {
        worker.terminate();
        resolve({ result: data.result, response: data.response });
      } else if (data?.type === "error") {
        worker.terminate();
        reject(new Error(data.message));
      }
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      worker.terminate();
      if (!started) onMainThread().then(resolve, reject);
      else reject(new Error(event.message || "Room acoustics failed"));
    };
  });
  return { promise, cancel: () => worker?.terminate() };
}

export function attachSceneAcoustics(Viewer) {
  Object.assign(Viewer, {
    getSceneAcoustics() {
      const state = Viewer.getSoundsState();
      state.acoustics ??= { ...normalizeAcoustics(null), result: null, buffer: null, computing: false, progress: 0, error: null, job: null, nodes: null };
      return state.acoustics;
    },

    // The manifest's settings (AIM3DViewer.sounds.acoustics), or none.
    setSceneAcoustics(config) {
      const acoustics = Viewer.getSceneAcoustics();
      acoustics.job?.cancel();
      Object.assign(acoustics, normalizeAcoustics(config), { result: null, buffer: null, computing: false, progress: 0, error: null, job: null });
      if (acoustics.nodes) acoustics.nodes.convolver.buffer = null;
      Viewer.updateAcousticsSends?.();
      return acoustics;
    },

    // Changes the settings ({ on, material, floor, amount }); a new
    // material or floor works the room out again.
    updateSceneAcoustics(change = {}) {
      const acoustics = Viewer.getSceneAcoustics();
      const next = normalizeAcoustics({ ...acoustics, ...change });
      const stale = next.material !== acoustics.material || next.floor !== acoustics.floor;
      Object.assign(acoustics, next);
      if (stale && (acoustics.result || acoustics.computing) && acoustics.position) Viewer.computeSceneAcoustics({ position: acoustics.position });
      else if (acoustics.on && !acoustics.result && !acoustics.computing && Viewer.isSceneSoundPlaying?.()) Viewer.computeSceneAcoustics();
      Viewer.updateAcousticsSends();
      Viewer.syncSoundsPanel?.();
      return acoustics;
    },

    // Works the room out at `position` (default: the stored one, else where
    // the camera is). Resolves to the result, or null.
    async computeSceneAcoustics({ position } = {}) {
      const acoustics = Viewer.getSceneAcoustics();
      acoustics.job?.cancel();
      const point = position || acoustics.position || core.camera?.position?.toArray?.();
      if (!point) return null;
      acoustics.position = point.map((value) => round(value));
      acoustics.computing = true;
      acoustics.progress = 0;
      acoustics.error = null;
      Viewer.syncSoundsPanel?.();
      Viewer.updateSoundMarkers?.();
      const geometry = collectRoomGeometry();
      if (geometry.tooLarge || !geometry.count) {
        acoustics.computing = false;
        acoustics.error = geometry.tooLarge ? "tooLarge" : "noSurfaces";
        Viewer.syncSoundsPanel?.();
        return null;
      }
      // The size of a scene unit: the model's, or - when that makes it
      // implausibly large or small (a model in centimeters with no unit
      // said) - the unit its size suggests, as the measurement panel does.
      const unit = Viewer.resolveModelUnit?.() || { meters: 1, key: "m", source: "default" };
      const suggested = Viewer.getModelUnitWarning?.()?.suggestions?.[0];
      const metersPerUnit = suggested && MODEL_UNITS[suggested] ? MODEL_UNITS[suggested] : unit.meters || 1;
      acoustics.assumedUnit = suggested && MODEL_UNITS[suggested] ? suggested : null;
      acoustics.metersPerUnit = metersPerUnit;
      const listener = Viewer.ensureSoundListener();
      const sampleRate = listener?.context?.sampleRate || 48000;
      const job = runAcoustics(geometry, {
        position: acoustics.position,
        material: acoustics.material,
        floor: acoustics.floor,
        metersPerUnit,
        rays: RAYS,
        budget: BUDGET_MS,
        sampleRate,
      }, (progress) => {
        if (acoustics.job !== job) return;
        acoustics.progress = progress;
        Viewer.syncAcousticsStatus?.();
      });
      acoustics.job = job;
      try {
        const { result, response } = await job.promise;
        if (acoustics.job !== job) return null;
        acoustics.result = result;
        acoustics.computing = false;
        acoustics.job = null;
        if (listener) {
          const buffer = listener.context.createBuffer(2, response.channels[0].length, response.sampleRate);
          response.channels.forEach((channel, index) => buffer.copyToChannel(channel, index));
          acoustics.buffer = buffer;
          const nodes = Viewer.ensureAcousticsChain();
          // A new convolver: one's buffer is set once (and not normalised:
          // the response's energy is 1, the sends say how loud).
          if (nodes) {
            const convolver = listener.context.createConvolver();
            convolver.normalize = false;
            convolver.buffer = buffer;
            nodes.input.disconnect();
            nodes.convolver.disconnect();
            nodes.input.connect(convolver);
            convolver.connect(nodes.output);
            nodes.convolver = convolver;
          }
        }
        Viewer.updateAcousticsSends();
        Viewer.renderSoundsPanel?.();
        return result;
      } catch (error) {
        if (acoustics.job !== job) return null;
        console.warn("Could not work out the room's acoustics", error);
        acoustics.computing = false;
        acoustics.job = null;
        acoustics.error = "failed";
        Viewer.syncSoundsPanel?.();
        return null;
      }
    },

    // input -> convolver -> output -> the listener (its master volume).
    ensureAcousticsChain() {
      const acoustics = Viewer.getSceneAcoustics();
      if (acoustics.nodes) return acoustics.nodes;
      const listener = Viewer.ensureSoundListener();
      if (!listener) return null;
      const context = listener.context;
      const input = context.createGain();
      const convolver = context.createConvolver();
      convolver.normalize = false;
      if (acoustics.buffer) convolver.buffer = acoustics.buffer;
      const output = context.createGain();
      input.connect(convolver);
      convolver.connect(output);
      output.connect(listener.getInput());
      acoustics.nodes = { input, convolver, output };
      return acoustics.nodes;
    },

    // A source's send to the room (editor/scene-sounds.js soundNode).
    connectAcousticsSend(node) {
      const nodes = Viewer.ensureAcousticsChain();
      const from = node?.audio?.source;
      if (!nodes || !from || node.send) return;
      node.send = from.context.createGain();
      node.send.gain.value = 0;
      from.connect(node.send);
      node.send.connect(nodes.input);
      node.sendLevel = 0;
    },

    disconnectAcousticsSend(node) {
      if (!node?.send) return;
      try { node.audio.source?.disconnect(node.send); } catch { /* not connected */ }
      node.send.disconnect();
      node.send = null;
    },

    // How much of a source goes to the room now.
    acousticsSendLevel(source, node) {
      const acoustics = Viewer.soundsState?.acoustics;
      if (!acoustics?.on || !acoustics.result || !acoustics.buffer || !soundInRoom(source)) return 0;
      const level = source.type === "ambient"
        ? 1
        : sendGain(acoustics.result, source.distance || Viewer.soundRefDistance?.(source) || 1);
      return level * acoustics.amount * source.volume * (node?.fade ?? 1);
    },

    // Each frame and on changes: the sends at their levels, ramped.
    updateAcousticsSends() {
      const state = Viewer.soundsState;
      if (!state?.nodes) return;
      state.sources.forEach((source) => {
        const node = state.nodes.get(source.id);
        if (!node?.send) return;
        const level = Viewer.acousticsSendLevel(source, node);
        if (Math.abs(level - (node.sendLevel ?? 0)) < 1e-4) return;
        node.sendLevel = level;
        node.send.gain.setTargetAtTime(level, node.send.context.currentTime, RAMP);
      });
    },

    // What the panel and an export say about the room ({ on, position,
    // material, floor, amount }), or undefined when it was never set.
    getAcousticsForExport() {
      const acoustics = Viewer.soundsState?.acoustics;
      if (!acoustics || (!acoustics.on && !acoustics.position)) return undefined;
      return {
        on: acoustics.on,
        ...(acoustics.position ? { position: acoustics.position.map((value) => round(value)) } : {}),
        material: acoustics.material,
        floor: acoustics.floor,
        ...(acoustics.amount !== 1 ? { amount: round(acoustics.amount, 2) } : {}),
      };
    },

    // ---- the window's part ----

    renderAcousticsSection(parent, { el, button, row, select, slider, check }) {
      const state = Viewer.soundsState;
      const ui = state.ui;
      const acoustics = Viewer.getSceneAcoustics();
      const group = el("div", "viewer-volume-panel_channel viewer-sounds-panel_acoustics");
      const heading = el("strong", "viewer-sounds-panel_heading");
      ui.labels.push([heading, () => t("sounds.acoustics.title", "Room acoustics")]);
      group.appendChild(heading);
      check(() => t("sounds.acoustics.on", "Hear the sounds in the room (its reverberation, from the model)"), acoustics.on, (on) => Viewer.updateSceneAcoustics({ on }), group);
      row(
        () => t("sounds.acoustics.material", "Walls (where the material's name does not say)"),
        select(ROOM_MATERIAL_NAMES, acoustics.material, (name) => t(`sounds.acoustics.materials.${name}`, name), (material) => Viewer.updateSceneAcoustics({ material })),
        group,
      );
      row(
        () => t("sounds.acoustics.floor", "Floors"),
        select(FLOOR_COVER_NAMES, acoustics.floor, (name) => t(`sounds.acoustics.floors.${name}`, name), (floor) => Viewer.updateSceneAcoustics({ floor })),
        group,
      );
      row(
        () => t("sounds.acoustics.amount", { value: `${Math.round(acoustics.amount * 100)}%` }, "Reverberation {value}"),
        slider(0, 200, 5, Math.round(acoustics.amount * 100), (value) => Viewer.updateSceneAcoustics({ amount: value / 100 })),
        group,
      );
      const actions = el("div", "viewer-sounds-panel_placing");
      const here = button("viewer-sounds-panel_acoustics-here", () => {
        acoustics.on = true;
        Viewer.computeSceneAcoustics({ position: core.camera?.position?.toArray?.() });
        Viewer.renderSoundsPanel();
      });
      ui.labels.push([here, () => t("sounds.acoustics.here", "Work out here (where the camera is)")]);
      actions.appendChild(here);
      group.appendChild(actions);
      ui.acousticsStatus = el("p", "viewer-pointcloud-panel_note viewer-sounds-panel_acoustics-status");
      ui.acousticsStatus.setAttribute("aria-live", "polite");
      group.appendChild(ui.acousticsStatus);
      ui.acousticsBands = el("div", "viewer-sounds-panel_bands");
      group.appendChild(ui.acousticsBands);
      parent.appendChild(group);
    },

    syncAcousticsStatus() {
      const ui = Viewer.soundsState?.ui;
      const acoustics = Viewer.soundsState?.acoustics;
      if (!ui?.acousticsStatus || !acoustics) return;
      const status = ui.acousticsStatus;
      const result = acoustics.result;
      const length = (meters) => (meters >= 10 ? `${Math.round(meters)} m` : `${meters.toFixed(1)} m`);
      ui.acousticsBands.replaceChildren();
      if (acoustics.computing) {
        status.textContent = t("sounds.acoustics.computing", { value: `${Math.round(acoustics.progress * 100)}%` }, "Tracing the sound through the model… {value}");
        return;
      }
      if (acoustics.error) {
        status.textContent = t(`sounds.acoustics.errors.${acoustics.error}`, "The room's acoustics could not be worked out.");
        return;
      }
      if (!result) {
        status.textContent = t("sounds.acoustics.none", "Not worked out yet: go into the building and press the button (the sounds work it out when they play).");
        return;
      }
      const volume = result.volume;
      const parts = [
        t("sounds.acoustics.rt", { value: `${result.rtMid.toFixed(1)} s` }, "Reverberation {value}"),
        t("sounds.acoustics.volume", { value: volume >= 10 ? `${Math.round(volume).toLocaleString()} m³` : `${volume.toFixed(1)} m³` }, "space ≈ {value}"),
        t("sounds.acoustics.open", { value: `${Math.round(result.openness * 100)}%` }, "open {value}"),
      ];
      if (Number.isFinite(result.c80)) parts.push(t("sounds.acoustics.c80", { value: `${result.c80 > 0 ? "+" : ""}${result.c80.toFixed(1)} dB` }, "clarity C80 {value}"));
      if (Number.isFinite(result.criticalDistance)) {
        const meters = result.criticalDistance * (acoustics.metersPerUnit || 1);
        parts.push(t("sounds.acoustics.critical", { value: length(meters) }, "the room as loud as the source at {value}"));
      }
      if (acoustics.assumedUnit) parts.push(t("sounds.acoustics.assumedUnit", { unit: acoustics.assumedUnit }, "(the model taken to be in {unit}, as its size suggests: its unit is set in the measurement panel)"));
      status.textContent = parts.join(" · ");
      status.title = t("sounds.acoustics.detail", { rays: result.rays, triangles: result.triangles.toLocaleString(), seconds: (result.milliseconds / 1000).toFixed(1) }, "{rays} rays, {triangles} triangles, {seconds} s");
      result.bands.forEach((frequency, index) => {
        const cell = el("span", "viewer-sounds-panel_band");
        const label = frequency >= 1000 ? `${frequency / 1000} kHz` : `${frequency} Hz`;
        cell.textContent = `${label}: ${result.rt[index].toFixed(1)} s`;
        ui.acousticsBands.appendChild(cell);
      });
      function el(tag, className) {
        const element = document.createElement(tag);
        element.className = className;
        return element;
      }
    },
  });
}

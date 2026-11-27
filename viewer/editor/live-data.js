import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { canvasFont, paintCanvasText } from "../ui/canvas-font.js";
import { getViewerSideStack } from "../ui/side-stack.js";
import { attachToolPanelChrome, isToolPanelMinimized, PANEL_ICONS, isPhoneLayout, setToolPanelMinimized, undockToolPanel } from "../ui/tool-panel-chrome.js";
import { isPanelDockActive } from "../ui/panel-dock.js";
import { getUpAxisPivot } from "../up-axis.js";
import {
  dataAlert,
  dataColorScale,
  dataColumnKind,
  dataNumber,
  dataTableToCsv,
  dataTruthy,
  diffDataRows,
  guessKeyColumn,
  LIVE_DATA_RAMP_NAMES,
  LIVE_DATA_REFRESH,
  normalizeDataKey,
  normalizeLiveData,
  parseDataTable,
  tableFromObjects,
} from "../live-data-table.js";

// Live data: a table drives the model. Each row of a table (CSV, TSV, JSON)
// belongs to a part of the model - the row's key cell is the part's name -
// and its other cells set how the part looks:
//
//   colour   a numeric column along a colour ramp, a text column a colour
//            per value;
//   label    a cell shown above the part;
//   alert    the part pulses while its cell is above (below, equal to) a
//            limit;
//   visible  the part is hidden while its cell says no.
//
// The table stays connected. Its URL is read again every few seconds, a
// file opened from the device is watched for being saved (browsers with the
// File System Access API), the cells can be edited in the window, and a
// page can push rows (Viewer.updateLiveDataRow, a `aim3d-data` message to
// an embedded viewer). Whatever changed moves to its new look - colours
// blend, numbers count, the changed parts flash - without the model or the
// page being loaded again.
//
// The colours are overlays, as the Level of Certainty view's
// (editor/certainty.js): a see-through copy of each mesh sharing its
// geometry, so the model's own materials stay untouched.
//
// Kept in the manifest as AIM3DViewer.data (manifesto/AIM3DViewer-schema.md).

const FILE_POLL_MS = 1000;
const PULSE_SECONDS = 1.6;
const LABEL_HEIGHT = 0.03;
const LABEL_CANVAS = [512, 112];
const MAX_TABLE_ROWS = 300;
const NO_COLOR = "#8a8a8a";
// The menus' phone layout (bar or rail), as the sheets go by.
const isPhone = () => isPhoneLayout();
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2);

function modelRoots() {
  return (Array.isArray(core.mainObject) ? core.mainObject : [core.mainObject]).flat().filter((item) => item?.isObject3D);
}

// Which models are in the scene: another answer means the parts have to be
// found again (a preview replaced by the full model, a model loaded later).
function modelSignature() {
  return modelRoots().map((root) => root.uuid).join("|");
}

function isOverlay(object) {
  return object.userData?.isLiveDataOverlay === true || object.userData?.isCertaintyOverlay === true || object.userData?.isPickingOverlay === true;
}

// Every name an object goes by -> the object, outermost first (a row naming
// a group paints all of it).
function indexModel() {
  const index = new Map();
  const add = (name, object) => {
    const id = normalizeDataKey(name);
    if (id && !index.has(id)) index.set(id, object);
  };
  modelRoots().forEach((root) => {
    (getUpAxisPivot(root) ?? root).traverse((object) => {
      if (isOverlay(object) || object.userData?.isHelper) return;
      add(object.name, object);
      // The name as the file has it (loaders tidy `object.name`), an IFC
      // element's GlobalId and express id.
      add(object.userData?.name, object);
      add(object.userData?.GlobalId ?? object.userData?.globalId, object);
      if (object.userData?.expressID !== undefined) add(object.userData.expressID, object);
    });
  });
  return index;
}

// The model's parts a table can name, in the Hierarchy's order: every named
// object, without the wrappers that hold all the others (a file's scene, the
// model's root) and without the pieces a loader split an object into. A
// glTF's nodes keep the file's name in `userData.name` (`object.name` is
// tidied, and the meshes' primitives are named `mesh_1_2`): where the model
// has such names, only they count.
function modelPartNames(limit = 5000) {
  const objects = [];
  modelRoots().forEach((root) => {
    (getUpAxisPivot(root) ?? root).traverse((object) => {
      if (isOverlay(object) || object.userData?.isHelper || object.isLight || object.isCamera) return;
      objects.push(object);
    });
  });
  const fileNames = objects.some((object) => typeof object.userData?.name === "string" && object.userData.name.trim());
  const nameOf = (object) => String((fileNames ? object.userData?.name : object.name || object.userData?.name) ?? "").trim();
  const found = [];
  const seen = new Set();
  objects.forEach((object) => {
    const name = nameOf(object);
    const id = normalizeDataKey(name);
    if (!id || seen.has(id)) return;
    // `Roof_1`, `Roof_2` under `Roof`: one object, split.
    const parent = object.parent && nameOf(object.parent);
    if (parent && normalizeDataKey(name.replace(/[_.\s-]*\d+$/, "")) === normalizeDataKey(parent)) return;
    seen.add(id);
    found.push(object);
  });
  const inside = (object, ancestor) => {
    for (let current = object.parent; current; current = current.parent) if (current === ancestor) return true;
    return false;
  };
  while (found.length > 1 && found.slice(1).every((object) => inside(object, found[0]))) found.shift();
  return found.slice(0, limit).map(nameOf);
}

function depthOf(object) {
  let depth = 0;
  for (let current = object; current.parent; current = current.parent) depth += 1;
  return depth;
}

function shownInScene(object) {
  for (let current = object; current; current = current.parent) {
    if (!current.visible) return false;
  }
  return true;
}

function formatCell(value, unit = "") {
  const number = typeof value === "number" ? value : NaN;
  const text = Number.isNaN(number)
    ? String(value ?? "")
    : number.toLocaleString(core.currentLanguage || "en", { maximumFractionDigits: Math.abs(number) >= 100 ? 0 : 1 });
  return unit && text ? `${text}${/^[%°]/.test(unit) ? "" : " "}${unit}` : text;
}

function clockTime(date) {
  return date.toLocaleTimeString(core.currentLanguage || "en", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function attachLiveData(Viewer) {
  Object.assign(Viewer, {
    liveDataState: null,

    getLiveDataState() {
      Viewer.liveDataState ??= {
        config: normalizeLiveData(null),
        columns: [],
        rows: [],
        // Where the table comes from: "none" | "url" | "file" | "inline"
        // (the manifest's rows, the window's cells) | "push" (the API).
        source: { kind: "none", name: "", handle: null, lastText: null, stamp: null, timer: null, error: null, updatedAt: null, changed: 0, loads: 0 },
        // key -> part (see bindLiveData).
        parts: new Map(),
        scale: { kind: "none", colorOf: () => null },
        unmatched: new Set(),
        group: null,
        clock: 0,
        boxClock: 0,
        active: false,
        open: false,
        // Opened once as a window of its own (floatLiveDataPanel).
        floated: false,
        // The window's folding parts the user opened or closed.
        sections: {},
        ui: null,
        generation: 0,
      };
      return Viewer.liveDataState;
    },

    hasLiveData() {
      return Boolean(Viewer.liveDataState?.rows.length);
    },

    // The settings, the table and what it is bound to.
    getLiveData() {
      const state = Viewer.liveDataState;
      if (!state) return null;
      return {
        config: structuredClone({ ...state.config, rows: null }),
        columns: [...state.columns],
        rows: state.rows.map((row) => ({ ...row })),
        source: { kind: state.source.kind, name: state.source.name, error: state.source.error, updatedAt: state.source.updatedAt, changed: state.source.changed, loads: state.source.loads },
        parts: [...state.parts.values()].map((part) => ({
          key: part.key,
          name: part.node.name,
          color: part.targetHex,
          shown: part.alphaTo > 0,
          alert: part.alert,
          label: part.label?.text || "",
          visible: part.node.visible,
          meshes: part.meshes.length,
        })),
        unmatched: [...state.unmatched],
      };
    },

    // ---- the settings and the table ----

    // Replaces the settings and connects the table: `config` as
    // AIM3DViewer.data ({ src, refresh, rows, key, color, label, alert,
    // visible, strength, transition }), a URL, or an array of rows.
    setLiveData(config) {
      const state = Viewer.getLiveDataState();
      Viewer.stopLiveDataSource();
      Viewer.unbindLiveData();
      state.config = normalizeLiveData(config);
      state.columns = [];
      state.rows = [];
      state.source = { kind: "none", name: "", handle: null, lastText: null, stamp: null, timer: null, error: null, updatedAt: null, changed: 0, loads: 0 };
      const { rows, src } = state.config;
      state.config.rows = null;
      if (rows?.length) {
        const table = tableFromObjects(rows);
        state.source.kind = "inline";
        Viewer.applyLiveDataTable(table.columns, table.rows);
      }
      if (src) {
        state.source.kind = "url";
        state.source.name = src;
        Viewer.loadLiveDataUrl();
      }
      Viewer.renderLiveDataPanel();
      Viewer.updateEditorToolbarState?.();
      return Viewer.getLiveData();
    },

    // Changes some of the settings (`patch`: as AIM3DViewer.data, a channel
    // set to null is switched off) and repaints; the table stays.
    updateLiveDataConfig(patch = {}) {
      const state = Viewer.getLiveDataState();
      const { rows: _rows, ...current } = state.config;
      const next = normalizeLiveData({ ...current, ...patch });
      const sourceChanged = next.src !== state.config.src || next.refresh !== state.config.refresh;
      next.rows = null;
      state.config = next;
      if (sourceChanged && (next.src || state.source.kind === "url")) {
        Viewer.stopLiveDataSource();
        state.source.kind = next.src ? "url" : state.rows.length ? "inline" : "none";
        state.source.name = next.src || "";
        state.source.lastText = null;
        state.source.error = null;
        if (next.src) Viewer.loadLiveDataUrl();
      }
      Viewer.bindLiveData();
      Viewer.renderLiveDataPanel();
      return Viewer.getLiveData();
    },

    // A new table. What differs from the one before flashes (`quiet`: not
    // this time), everything moves to its new look.
    applyLiveDataTable(columns, rows, { quiet = false } = {}) {
      const state = Viewer.getLiveDataState();
      const first = state.source.loads === 0;
      const before = state.rows;
      state.columns = columns;
      state.rows = rows;
      const names = new Set(indexModel().keys());
      if (!state.config.key || !columns.includes(state.config.key)) state.config.key = guessKeyColumn(columns, rows, names) || null;
      // A table without settings: its first numeric column gives the colour.
      if (first && !state.config.color && !state.config.label && !state.config.alert && !state.config.visible) {
        const numeric = columns.find((column) => column !== state.config.key && dataColumnKind(rows, column) === "number");
        if (numeric) state.config.color = normalizeLiveData({ color: numeric }).color;
      }
      const changed = first ? new Set() : diffDataRows(before, rows, state.config.key);
      state.source.loads += 1;
      state.source.updatedAt = new Date();
      state.source.changed = changed.size;
      state.source.error = null;
      Viewer.bindLiveData({ flash: quiet ? null : changed });
      return changed;
    },

    // Rows pushed by the page: an array of objects replaces the table.
    setLiveDataRows(rows) {
      const state = Viewer.getLiveDataState();
      const table = tableFromObjects(rows);
      Viewer.stopLiveDataSource();
      state.source.kind = "push";
      state.source.name = "";
      const changed = Viewer.applyLiveDataTable(table.columns, table.rows);
      Viewer.renderLiveDataPanel();
      return changed.size;
    },

    // One row changed (or added): `values` are merged into the row of the
    // part named `key`. The quickest way for a sensor feed.
    updateLiveDataRow(key, values = {}, { fromTable = false } = {}) {
      const state = Viewer.getLiveDataState();
      if (!values || typeof values !== "object") return false;
      const keyColumn = state.config.key || state.columns[0] || "part";
      if (!state.config.key) state.config.key = keyColumn;
      const id = normalizeDataKey(key);
      if (!id) return false;
      const columns = [...state.columns];
      if (!columns.includes(keyColumn)) columns.unshift(keyColumn);
      Object.keys(values).forEach((column) => {
        if (!columns.includes(column)) columns.push(column);
      });
      let found = false;
      const rows = state.rows.map((row) => {
        if (normalizeDataKey(row[keyColumn]) !== id) return row;
        found = true;
        return { ...row, ...values };
      });
      if (!found) rows.push({ ...Object.fromEntries(columns.map((column) => [column, ""])), [keyColumn]: key, ...values });
      rows.forEach((row) => columns.forEach((column) => {
        if (!(column in row)) row[column] = "";
      }));
      if (state.source.kind === "none") state.source.kind = "push";
      const structure = columns.length !== state.columns.length || rows.length !== state.rows.length;
      const changed = Viewer.applyLiveDataTable(columns, rows);
      if (structure || !fromTable) {
        if (structure) Viewer.renderLiveDataPanel();
        else Viewer.renderLiveDataTable();
      }
      Viewer.syncLiveDataPanel();
      return changed.size > 0;
    },

    // A table to fill in: a row for each part of the model (modelPartNames),
    // its name in the key column. A table already there keeps its rows and
    // columns and gets the parts it does not name yet. The table is then the
    // window's own: a URL or a file is no longer followed. Returns how many
    // rows were added.
    generateLiveDataTable({ columns: fresh = ["part", "value", "note"] } = {}) {
      const state = Viewer.getLiveDataState();
      const names = modelPartNames();
      if (!names.length) return 0;
      const keyColumn = state.config.key && state.columns.includes(state.config.key) ? state.config.key : state.columns.length ? "part" : fresh[0];
      const columns = state.columns.length ? [...state.columns] : [...fresh];
      if (!columns.includes(keyColumn)) columns.unshift(keyColumn);
      const blank = Object.fromEntries(columns.map((column) => [column, ""]));
      const named = new Set(state.rows.map((row) => normalizeDataKey(row[keyColumn])));
      const added = names.filter((name) => !named.has(normalizeDataKey(name))).map((name) => ({ ...blank, [keyColumn]: name }));
      if (!added.length) return 0;
      Viewer.stopLiveDataSource();
      Object.assign(state.source, { kind: "inline", name: "", lastText: null, error: null, edited: true });
      state.config.src = null;
      state.config.key = keyColumn;
      Viewer.applyLiveDataTable(columns, [...state.rows.map((row) => ({ ...blank, ...row })), ...added], { quiet: true });
      Viewer.renderLiveDataPanel();
      Viewer.updateEditorToolbarState?.();
      return added.length;
    },

    // ---- the sources ----

    stopLiveDataSource() {
      const state = Viewer.liveDataState;
      if (!state) return;
      state.generation += 1;
      clearTimeout(state.source.timer);
      state.source.timer = null;
      state.source.handle = null;
    },

    // Reads the table's URL, and again after `refresh` seconds. The answer
    // is compared as text: an unchanged table costs nothing.
    async loadLiveDataUrl() {
      const state = Viewer.getLiveDataState();
      const generation = state.generation;
      const { src, refresh } = state.config;
      if (!src) return false;
      clearTimeout(state.source.timer);
      let applied = false;
      try {
        if (!document.hidden || state.source.lastText === null) {
          const response = await fetch(src, { cache: "no-store" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const text = await response.text();
          if (generation !== state.generation) return false;
          if (text !== state.source.lastText) {
            state.source.lastText = text;
            const table = parseDataTable(text);
            if (!table.columns.length) throw new Error(t("liveData.errors.empty", "no table in the file"));
            const structure = table.columns.join("\u0001") !== state.columns.join("\u0001") || table.rows.length !== state.rows.length;
            Viewer.applyLiveDataTable(table.columns, table.rows);
            if (structure) Viewer.renderLiveDataPanel();
            else Viewer.renderLiveDataTable();
            applied = true;
          } else {
            state.source.error = null;
          }
        }
      } catch (error) {
        if (generation !== state.generation) return false;
        state.source.error = error?.message || String(error);
        if (state.source.lastText === null) console.warn("Live data: could not read", src, error);
      }
      if (generation !== state.generation) return applied;
      Viewer.syncLiveDataPanel();
      if (refresh > 0) state.source.timer = setTimeout(() => Viewer.loadLiveDataUrl(), refresh * 1000);
      return applied;
    },

    // A table from the device. With the File System Access API the file
    // stays connected: saved again in a spreadsheet or an editor, it is read
    // again. Elsewhere it is read once.
    async openLiveDataFile(fileOrHandle) {
      const state = Viewer.getLiveDataState();
      let handle = null;
      let file = fileOrHandle || null;
      if (!file && typeof window.showOpenFilePicker === "function") {
        try {
          [handle] = await window.showOpenFilePicker({
            types: [{ description: "CSV, TSV, JSON", accept: { "text/csv": [".csv", ".tsv", ".txt"], "application/json": [".json"] } }],
          });
        } catch {
          return false;
        }
      } else if (file && typeof file.getFile === "function") {
        handle = file;
      }
      if (handle) file = await handle.getFile();
      if (!file) return false;
      Viewer.stopLiveDataSource();
      const generation = state.generation;
      state.config.src = null;
      state.source = { ...state.source, kind: "file", name: file.name, handle, lastText: null, stamp: null, error: null };
      const read = async () => {
        if (generation !== state.generation) return;
        try {
          const current = handle ? await handle.getFile() : file;
          const stamp = `${current.lastModified}:${current.size}`;
          if (stamp !== state.source.stamp) {
            const text = await current.text();
            if (generation !== state.generation) return;
            state.source.stamp = stamp;
            if (text !== state.source.lastText) {
              state.source.lastText = text;
              const table = parseDataTable(text);
              if (!table.columns.length) throw new Error(t("liveData.errors.empty", "no table in the file"));
              const structure = table.columns.join("\u0001") !== state.columns.join("\u0001") || table.rows.length !== state.rows.length;
              Viewer.applyLiveDataTable(table.columns, table.rows);
              if (structure) Viewer.renderLiveDataPanel();
              else Viewer.renderLiveDataTable();
            }
          }
          state.source.error = null;
        } catch (error) {
          state.source.error = error?.message || String(error);
        }
        Viewer.syncLiveDataPanel();
        if (handle && generation === state.generation) state.source.timer = setTimeout(read, FILE_POLL_MS);
      };
      await read();
      Viewer.renderLiveDataPanel();
      Viewer.updateEditorToolbarState?.();
      return true;
    },

    // Whether the table is still followed: a URL read again, a watched file.
    isLiveDataFollowing() {
      const state = Viewer.liveDataState;
      if (!state) return false;
      return (state.source.kind === "url" && state.config.refresh > 0) || (state.source.kind === "file" && Boolean(state.source.handle));
    },

    // A page that embeds the viewer pushes rows with
    //   frame.contentWindow.postMessage({ type: "aim3d-data", rows: [...] }, origin)
    //   ... { type: "aim3d-data", key: "Column_1", values: { moisture: 31 } }
    // Read only once the scene has live data (its manifest, the window).
    handleLiveDataMessage(event) {
      const message = event?.data;
      if (!message || typeof message !== "object" || message.type !== "aim3d-data") return;
      const state = Viewer.liveDataState;
      if (!state || state.source.kind === "none") return;
      if (Array.isArray(message.rows)) Viewer.setLiveDataRows(message.rows);
      else if (message.key !== undefined && message.values && typeof message.values === "object") {
        Viewer.updateLiveDataRow(String(message.key), tableFromObjects([message.values]).rows[0] || {});
      }
    },

    // ---- the model ----

    // Rows -> parts of the model, and each part's look to move to. `flash`:
    // the keys that changed.
    bindLiveData({ flash = null } = {}) {
      const state = Viewer.getLiveDataState();
      const { config, rows } = state;
      state.scale = dataColorScale(config.color, rows);
      state.unmatched = new Set();
      const index = rows.length && config.key ? indexModel() : new Map();
      state.modelSignature = modelSignature();
      const seen = new Set();
      let structure = false;

      rows.forEach((row) => {
        const raw = row[config.key];
        const id = normalizeDataKey(raw);
        if (!id || seen.has(id)) return;
        const node = index.get(id);
        if (!node) {
          state.unmatched.add(id);
          return;
        }
        seen.add(id);
        let part = state.parts.get(id);
        if (!part || part.node !== node) {
          if (part) Viewer.releaseLiveDataPart(part);
          part = {
            id,
            key: String(raw),
            node,
            depth: depthOf(node),
            meshes: [],
            material: null,
            color: new THREE.Color(NO_COLOR),
            from: new THREE.Color(NO_COLOR),
            to: new THREE.Color(NO_COLOR),
            targetHex: null,
            alpha: 0,
            alphaFrom: 0,
            alphaTo: 0,
            progress: 1,
            pulse: 0,
            alert: false,
            label: null,
            originalVisible: node.visible,
            hidden: false,
            leaving: false,
          };
          state.parts.set(id, part);
          structure = true;
        }
        part.key = String(raw);
        part.row = row;
        part.leaving = false;

        const hex = state.scale.colorOf(row[config.color?.column]);
        if (hex !== part.targetHex || (part.alphaTo > 0) !== Boolean(hex)) {
          part.from.copy(part.color);
          // Fading in from nothing: straight in the new colour.
          if (hex) {
            part.to.set(hex);
            if (part.alpha <= 0.001) part.from.set(hex);
          }
          part.alphaFrom = part.alpha;
          part.alphaTo = hex ? 1 : 0;
          part.targetHex = hex;
          part.progress = config.transition > 0 ? 0 : 1;
        }
        part.alert = dataAlert(config.alert, row);

        const hide = config.visible ? !dataTruthy(row[config.visible.column]) : false;
        if (hide !== part.hidden) {
          part.hidden = hide;
          node.visible = hide ? false : part.originalVisible;
        }

        Viewer.setLiveDataLabel(part, config.label ? row[config.label.column] : undefined);
        if (flash?.has(id)) part.pulse = 1;
      });

      // Rows that are gone: their parts fade to the model's own look.
      state.parts.forEach((part, id) => {
        if (seen.has(id)) return;
        if (!part.leaving) {
          part.leaving = true;
          part.from.copy(part.color);
          part.alphaFrom = part.alpha;
          part.alphaTo = 0;
          part.targetHex = null;
          part.progress = config.transition > 0 ? 0 : 1;
          part.alert = false;
          if (part.hidden) {
            part.hidden = false;
            part.node.visible = part.originalVisible;
          }
          Viewer.setLiveDataLabel(part, undefined);
        }
      });

      if (structure) Viewer.rebuildLiveDataOverlays();
      state.active = state.parts.size > 0;
      Viewer.updateLiveData(0);
      Viewer.renderLiveDataLegend();
      Viewer.syncLiveDataPanel();
      Viewer.updateEditorToolbarState?.();
    },

    // Each mesh gets the overlay of the innermost part it belongs to.
    rebuildLiveDataOverlays() {
      const state = Viewer.getLiveDataState();
      state.parts.forEach((part) => Viewer.releaseLiveDataOverlays(part));
      const owner = new Map();
      [...state.parts.values()].sort((a, b) => a.depth - b.depth).forEach((part) => {
        part.node.traverse((child) => {
          if (!child.isMesh || !child.geometry || isOverlay(child) || child.userData?.isHelper) return;
          owner.set(child, part);
        });
      });
      owner.forEach((part, mesh) => {
        const own = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (!part.material) {
          part.material = new THREE.MeshStandardMaterial({
            color: part.color,
            emissive: part.color,
            emissiveIntensity: 0,
            roughness: 0.8,
            metalness: 0,
            side: own?.side ?? THREE.FrontSide,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            clippingPlanes: own?.clippingPlanes || null,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
          });
        }
        const overlay = mesh.isSkinnedMesh
          ? new THREE.SkinnedMesh(mesh.geometry, part.material)
          : new THREE.Mesh(mesh.geometry, part.material);
        if (mesh.isSkinnedMesh) overlay.bind(mesh.skeleton, mesh.bindMatrix);
        overlay.name = "live-data-overlay";
        overlay.userData.isLiveDataOverlay = true;
        // Left out wherever the certainty view's overlays are (materials,
        // shading, the publish check) and never picked.
        overlay.userData.isCertaintyOverlay = true;
        overlay.userData.isPickingOverlay = true;
        overlay.raycast = () => {};
        overlay.visible = false;
        mesh.add(overlay);
        part.meshes.push({ mesh, overlay });
      });
    },

    releaseLiveDataOverlays(part) {
      part.meshes.forEach(({ overlay }) => overlay.removeFromParent());
      part.meshes = [];
      part.material?.dispose();
      part.material = null;
    },

    releaseLiveDataPart(part) {
      Viewer.releaseLiveDataOverlays(part);
      if (part.hidden) part.node.visible = part.originalVisible;
      part.hidden = false;
      if (part.label) {
        part.label.sprite.removeFromParent();
        part.label.sprite.material.map?.dispose();
        part.label.sprite.material.dispose();
        part.label = null;
      }
    },

    // The model as it was, the table kept.
    unbindLiveData() {
      const state = Viewer.liveDataState;
      if (!state) return;
      state.parts.forEach((part) => Viewer.releaseLiveDataPart(part));
      state.parts.clear();
      state.unmatched = new Set();
      state.active = false;
      if (state.group) {
        state.group.removeFromParent();
        state.group = null;
      }
    },

    // The cell above the part: `value` undefined takes the label away.
    setLiveDataLabel(part, value) {
      const state = Viewer.getLiveDataState();
      const config = state.config.label;
      if (value === undefined || value === "" || !config) {
        if (part.label) {
          part.label.sprite.removeFromParent();
          part.label.sprite.material.map?.dispose();
          part.label.sprite.material.dispose();
          part.label = null;
        }
        return;
      }
      const number = dataNumber(typeof value === "boolean" ? String(value) : value);
      if (!part.label) {
        const canvas = document.createElement("canvas");
        [canvas.width, canvas.height] = LABEL_CANVAS;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, sizeAttenuation: false, transparent: true }));
        sprite.center.set(0.5, 0);
        sprite.renderOrder = 1000;
        sprite.raycast = () => {};
        sprite.userData.liveDataKey = part.id;
        if (!state.group) {
          state.group = new THREE.Group();
          state.group.name = "live-data-labels";
          state.group.userData.isHelper = true;
          core.scene?.add(state.group);
        }
        state.group.add(sprite);
        part.label = { sprite, texture, text: null, drawn: null, number: NaN, from: NaN, to: NaN };
        Viewer.placeLiveDataLabel(part);
      }
      const label = part.label;
      label.from = Number.isNaN(label.number) ? number : label.number;
      label.to = number;
      label.raw = value;
      // The text it ends on (getLiveData).
      label.text = (config.name ? `${part.key}  ` : "") + formatCell(Number.isNaN(number) ? value : number, config.unit);
    },

    placeLiveDataLabel(part) {
      if (!part.label) return;
      const box = new THREE.Box3().setFromObject(part.node);
      if (box.isEmpty()) return;
      const up = core.camera?.up?.lengthSq?.() ? core.camera.up : new THREE.Vector3(0, 1, 0);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      // The top of the box along the scene's up.
      const reach = (Math.abs(up.x) * size.x + Math.abs(up.y) * size.y + Math.abs(up.z) * size.z) / 2;
      part.label.sprite.position.copy(center).addScaledVector(up, reach);
    },

    drawLiveDataLabel(part, text, hex) {
      const label = part.label;
      const key = `${text}|${hex}|${part.alert}`;
      if (label.drawn === key) return;
      label.drawn = key;
      paintCanvasText(label.texture, (ctx, width, height) => {
        ctx.clearRect(0, 0, width, height);
        ctx.font = canvasFont(600, 46);
        const textWidth = Math.min(width - 110, ctx.measureText(text).width);
        const pill = textWidth + 96;
        const left = (width - pill) / 2;
        const radius = 40;
        ctx.beginPath();
        ctx.roundRect(left, 12, pill, 80, radius);
        ctx.fillStyle = "rgba(20, 17, 14, 0.86)";
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = part.alert ? "#ff5a4f" : "rgba(255, 255, 255, 0.22)";
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(left + 36, 52, 13, 0, Math.PI * 2);
        ctx.fillStyle = hex || NO_COLOR;
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";
        ctx.fillText(text, left + 62, 54, width - 110);
      });
      label.texture.needsUpdate = true;
    },

    // Each frame: colours, flashes, alerts and counting numbers on their way.
    updateLiveData(delta) {
      const state = Viewer.liveDataState;
      if (!state || (!state.active && !state.rows.length)) return;
      const { config } = state;
      const step = Number.isFinite(delta) ? Math.min(delta, 0.25) : 0;
      state.clock += step;
      state.boxClock += step;
      const replace = state.boxClock > 1;
      if (replace) {
        state.boxClock = 0;
        // Other models than the parts were found in: found again.
        if (modelSignature() !== state.modelSignature) {
          Viewer.unbindLiveData();
          Viewer.bindLiveData();
          return;
        }
      }
      if (!state.active) return;
      const wave = 0.5 + 0.5 * Math.sin(state.clock * 5.2);
      let gone = null;

      state.parts.forEach((part, id) => {
        if (part.progress < 1) part.progress = config.transition > 0 ? Math.min(1, part.progress + step / config.transition) : 1;
        const mix = ease(part.progress);
        part.color.copy(part.from).lerp(part.to, mix);
        part.alpha = part.alphaFrom + (part.alphaTo - part.alphaFrom) * mix;
        if (part.pulse > 0) part.pulse = Math.max(0, part.pulse - step / PULSE_SECONDS);
        const glow = Math.max(part.pulse * part.pulse, part.alert ? wave * 0.75 : 0);

        if (part.material) {
          const opacity = Math.min(1, part.alpha * (config.strength + (1 - config.strength) * glow));
          part.material.color.copy(part.color);
          part.material.emissive.copy(part.color);
          part.material.emissiveIntensity = glow * 0.9;
          part.material.opacity = opacity;
          const visible = opacity > 0.004;
          part.meshes.forEach(({ overlay }) => {
            overlay.visible = visible;
          });
        }

        if (part.label) {
          const label = part.label;
          const sprite = label.sprite;
          sprite.visible = shownInScene(part.node);
          if (sprite.visible) {
            if (replace) Viewer.placeLiveDataLabel(part);
            const counting = part.progress < 1 && !Number.isNaN(label.from) && !Number.isNaN(label.to);
            label.number = counting ? label.from + (label.to - label.from) * mix : label.to;
            const shownValue = Number.isNaN(label.to) ? label.raw : label.number;
            const text = (config.label?.name ? `${part.key}  ` : "") + formatCell(shownValue, config.label?.unit);
            Viewer.drawLiveDataLabel(part, text, part.alphaTo > 0 ? `#${part.color.getHexString()}` : null);
            const grow = 1 + 0.28 * part.pulse * part.pulse;
            sprite.scale.set(LABEL_HEIGHT * (LABEL_CANVAS[0] / LABEL_CANVAS[1]) * grow, LABEL_HEIGHT * grow, 1);
          }
        }

        if (part.leaving && part.progress >= 1 && part.pulse <= 0) (gone ??= []).push(id);
      });

      if (gone) {
        gone.forEach((id) => {
          Viewer.releaseLiveDataPart(state.parts.get(id));
          state.parts.delete(id);
        });
        state.active = state.parts.size > 0;
      }
    },

    // Flashes a part (a click on its row).
    flashLiveDataPart(key) {
      const part = Viewer.liveDataState?.parts.get(normalizeDataKey(key));
      if (!part) return false;
      part.pulse = 1;
      return true;
    },

    // ---- manifests ----

    // AIM3DViewer.data of an exported manifest. A table that has a URL is
    // saved as the URL; one from a file, from the window or pushed by the
    // page is saved as its rows.
    getLiveDataForExport() {
      const state = Viewer.liveDataState;
      if (!state || !state.rows.length) return undefined;
      const { config } = state;
      const fromUrl = state.source.kind === "url" && config.src && !config.src.startsWith("blob:");
      const clean = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== null && value !== "" && value !== false));
      return {
        ...(fromUrl ? { src: config.src, ...(config.refresh ? { refresh: config.refresh } : {}) } : { rows: state.rows.map((row) => ({ ...row })) }),
        ...(config.key ? { key: config.key } : {}),
        ...(config.color ? { color: clean({ ...config.color, ramp: config.color.categories ? null : config.color.ramp }) } : {}),
        ...(config.label ? { label: clean(config.label) } : {}),
        ...(config.alert ? { alert: clean(config.alert) } : {}),
        ...(config.visible ? { visible: config.visible } : {}),
        ...(config.strength !== 0.75 ? { strength: config.strength } : {}),
        ...(config.transition !== 0.9 ? { transition: config.transition } : {}),
        ...(state.open ? {} : { open: false }),
      };
    },

    apply3IFManifestLiveData(config) {
      const had = Viewer.hasLiveData() || Viewer.liveDataState?.source.kind === "url";
      if (!config) {
        if (had) Viewer.disposeLiveData();
        return false;
      }
      Viewer.setLiveData(config);
      const state = Viewer.getLiveDataState();
      if (state.config.open && Viewer.urlOptions?.hideUi !== true) Viewer.toggleLiveDataPanel(true);
      return true;
    },

    disposeLiveData() {
      const state = Viewer.liveDataState;
      if (!state) return;
      Viewer.stopLiveDataSource();
      Viewer.unbindLiveData();
      state.config = normalizeLiveData(null);
      state.columns = [];
      state.rows = [];
      state.source = { kind: "none", name: "", handle: null, lastText: null, stamp: null, timer: null, error: null, updatedAt: null, changed: 0, loads: 0 };
      Viewer.toggleLiveDataPanel(false);
    },

    // ---- the window ----

    isLiveDataPanelOpen() {
      const state = Viewer.liveDataState;
      return Boolean(state?.open && state.ui && !(isPhone() && isToolPanelMinimized(state.ui.root)));
    },

    toggleLiveDataPanel(open) {
      const state = Viewer.getLiveDataState();
      const next = typeof open === "boolean" ? open : !Viewer.isLiveDataPanelOpen();
      state.open = next;
      if (next && !state.ui) Viewer.createLiveDataPanel();
      if (state.ui) {
        state.ui.root.hidden = !next;
        if (next && isPhone()) setToolPanelMinimized(state.ui.root, false);
      }
      if (next) Viewer.renderLiveDataPanel();
      Viewer.updateEditorToolbarState?.();
    },

    // The window opens as a window of its own over the viewer (once: docked
    // again by a double tap on its grip, it stays docked): moved by its grip,
    // resized by its corner (what it gains goes to the table,
    // viewer-tools.css), minimized to its icon.
    floatLiveDataPanel() {
      const state = Viewer.liveDataState;
      const root = state?.ui?.root;
      // In the panel dock it is one of the panels there.
      if (!root || state.floated || !state.open || isPhone() || isPanelDockActive()) return false;
      if (!undockToolPanel(root)) return false;
      state.floated = true;
      return true;
    },

    createLiveDataPanel() {
      const state = Viewer.getLiveDataState();
      const stack = getViewerSideStack();
      if (state.ui || !stack || core.PRESENTATION_MODE || Viewer.urlOptions?.hideUi === true) return;
      const root = document.createElement("section");
      root.id = "viewerLiveDataPanel";
      root.className = "viewer-pointcloud-panel viewer-volume-panel viewer-livedata-panel";
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        root.addEventListener(type, (event) => event.stopPropagation());
      });
      const header = document.createElement("div");
      header.className = "viewer-pointcloud-panel_header";
      // No "hide settings" button of its own: the shared fold button rolls
      // the window up to its header, minimize turns it into its icon.
      const title = document.createElement("strong");
      header.append(title);
      attachToolPanelChrome(root, header, {
        icon: PANEL_ICONS.liveData,
        label: () => t("liveData.title", "Live data"),
        modal: isPhone,
        resizable: true,
        minimizeToCorner: true,
        onClose: () => Viewer.toggleLiveDataPanel(false),
      });
      const body = document.createElement("div");
      body.className = "viewer-pointcloud-panel_body";
      root.append(header, body);
      stack.appendChild(root);
      state.ui = { root, title, body };
      new MutationObserver(() => Viewer.updateEditorToolbarState?.()).observe(root, { attributes: true, attributeFilter: ["class"] });
    },

    // The window's contents, built again when the settings or the table's
    // columns change.
    renderLiveDataPanel() {
      const state = Viewer.liveDataState;
      const ui = state?.ui;
      if (!ui) return;
      const { config } = state;
      // Laid out only now (a manifest opens the window before its model).
      if (!state.floated && state.open && !isPhone()) queueMicrotask(() => Viewer.floatLiveDataPanel());
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
      const select = (options, current, onChange) => {
        const element = el("select");
        options.forEach(([value, label]) => {
          const option = new Option(typeof label === "function" ? label() : label, String(value));
          element.appendChild(option);
          if (typeof label === "function") labels.push([option, label]);
        });
        element.value = String(current ?? "");
        element.addEventListener("change", () => onChange(element.value));
        return element;
      };
      const numberInput = (value, placeholder, onChange) => {
        const input = el("input");
        input.type = "number";
        input.step = "any";
        input.value = value ?? "";
        if (placeholder !== undefined && placeholder !== null && Number.isFinite(placeholder)) input.placeholder = String(Math.round(placeholder * 100) / 100);
        input.addEventListener("change", () => onChange(input.value === "" ? null : Number(input.value)));
        return input;
      };

      // A part of the window that folds: its settings, below the table.
      const section = (id, text, content, open) => {
        const details = el("details", "viewer-livedata-panel_section");
        details.open = state.sections[id] ?? open;
        // Kept as the user left it (not as it opens for want of a table).
        details.addEventListener("toggle", () => {
          if (state.columns.length) state.sections[id] = details.open;
        });
        const summary = el("summary");
        labels.push([summary, text]);
        details.append(summary, content);
        return details;
      };

      // Whether it is followed, and what changed last.
      ui.status = el("p", "viewer-livedata-panel_status");
      ui.status.setAttribute("role", "status");
      ui.dot = el("span", "viewer-livedata-panel_dot");
      ui.statusText = el("span");
      ui.status.append(ui.dot, ui.statusText);
      ui.body.appendChild(ui.status);

      // Where the table comes from.
      const source = el("div", "viewer-volume-panel_channel viewer-livedata-panel_source");
      const url = el("input");
      url.type = "url";
      url.placeholder = "https://…/table.csv";
      url.value = state.source.kind === "url" ? config.src || "" : "";
      url.addEventListener("change", () => {
        const value = url.value.trim();
        if (value) Viewer.updateLiveDataConfig({ src: value, refresh: config.refresh || 5 });
        else if (state.source.kind === "url") Viewer.updateLiveDataConfig({ src: null });
      });
      row(() => t("liveData.url", "Table URL (CSV, JSON)"), url, source);
      const refresh = select(
        LIVE_DATA_REFRESH.map((seconds) => [seconds, () => (seconds ? t("liveData.everySeconds", { seconds }, "every {seconds} s") : t("liveData.refreshOff", "once"))]),
        LIVE_DATA_REFRESH.includes(config.refresh) ? config.refresh : 5,
        (value) => Viewer.updateLiveDataConfig({ refresh: Number(value) }),
      );
      refresh.disabled = state.source.kind !== "url";
      row(() => t("liveData.refresh", "Read again"), refresh, source);
      const actions = el("div", "viewer-livedata-panel_actions");
      const fileInput = el("input");
      fileInput.type = "file";
      fileInput.accept = ".csv,.tsv,.txt,.json,text/csv,application/json";
      fileInput.hidden = true;
      fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (file) Viewer.openLiveDataFile(file);
        fileInput.value = "";
      });
      const open = button("viewer-livedata-panel_open", () => {
        if (typeof window.showOpenFilePicker === "function") Viewer.openLiveDataFile();
        else fileInput.click();
      });
      labels.push([open, () => t("liveData.openFile", "Open a file…")]);
      const save = button("viewer-livedata-panel_save", () => Viewer.downloadLiveDataTable());
      save.disabled = !state.rows.length;
      labels.push([save, () => t("liveData.saveCsv", "Save as CSV")]);
      const generate = button("viewer-livedata-panel_generate", () => Viewer.generateLiveDataTable());
      generate.disabled = !modelRoots().length;
      labels.push([generate, () => t("liveData.generate", "Generate from the model")]);
      generate.addEventListener("pointerenter", () => {
        generate.title = t("liveData.generateHint", "A row for each part of the model, ready to fill in. A table already open gets the parts it does not name yet.");
      });
      actions.append(generate, open, save, fileInput);
      source.appendChild(actions);
      if (typeof window.showOpenFilePicker !== "function") {
        const note = el("p", "viewer-pointcloud-panel_note");
        labels.push([note, () => t("liveData.fileOnce", "This browser reads a file once. In Chrome or Edge the file stays connected: save it and the model follows.")]);
        source.appendChild(note);
      }
      const sourceSection = section("source", () => t("liveData.sectionSource", "Where the table comes from"), source, !state.columns.length);

      if (!state.columns.length) {
        sourceSection.open = true;
        ui.body.appendChild(sourceSection);
        const empty = el("p", "viewer-pointcloud-panel_note");
        labels.push([empty, () => t("liveData.empty", "No table yet. Give a table's URL or open a file: one row for each part of the model, the part's name in one of the columns.")]);
        ui.body.appendChild(empty);
        ui.legend = null;
        ui.table = null;
        ui.matched = null;
        Viewer.syncLiveDataPanel();
        return;
      }

      // What the columns do.
      const columns = state.columns.map((column) => [column, column]);
      const none = [["", () => t("liveData.none", "—")]];
      const mapping = el("div", "viewer-volume-panel_channel viewer-livedata-panel_mapping");
      row(() => t("liveData.key", "Part's name in"), select(columns, config.key, (value) => Viewer.updateLiveDataConfig({ key: value })), mapping);
      row(() => t("liveData.color", "Colour from"), select([...none, ...columns], config.color?.column, (value) => {
        Viewer.updateLiveDataConfig({ color: value ? { ...(config.color || {}), column: value, min: null, max: null, categories: null } : null });
      }), mapping);
      if (state.scale.kind === "number") {
        const ramp = select(LIVE_DATA_RAMP_NAMES.map((name) => [name, () => t(`liveData.ramps.${name}`, name)]), Array.isArray(config.color.ramp) ? "" : config.color.ramp, (value) => {
          Viewer.updateLiveDataConfig({ color: { ...config.color, ramp: value } });
        });
        row(() => t("liveData.ramp", "Colours"), ramp, mapping);
        const range = el("div", "viewer-livedata-panel_range");
        const min = numberInput(config.color.min, state.scale.min, (value) => Viewer.updateLiveDataConfig({ color: { ...config.color, min: value } }));
        const max = numberInput(config.color.max, state.scale.max, (value) => Viewer.updateLiveDataConfig({ color: { ...config.color, max: value } }));
        labels.push([min, () => t("liveData.min", "Lowest value")]);
        labels.push([max, () => t("liveData.max", "Highest value")]);
        range.append(min, el("span", "", "–"), max);
        row(() => t("liveData.range", "From – to"), range, mapping);
      }
      row(() => t("liveData.label", "Label from"), select([...none, ...columns], config.label?.column, (value) => {
        Viewer.updateLiveDataConfig({ label: value ? { ...(config.label || {}), column: value } : null });
      }), mapping);
      if (config.label) {
        const unit = el("input");
        unit.type = "text";
        unit.maxLength = 12;
        unit.value = config.label.unit;
        unit.addEventListener("change", () => Viewer.updateLiveDataConfig({ label: { ...config.label, unit: unit.value.trim() } }));
        row(() => t("liveData.unit", "Unit"), unit, mapping);
      }
      row(() => t("liveData.alert", "Alert from"), select([...none, ...columns], config.alert?.column, (value) => {
        Viewer.updateLiveDataConfig({ alert: value ? { column: value, above: config.alert?.above ?? null, below: config.alert?.below ?? null } : null });
      }), mapping);
      if (config.alert) {
        if (dataColumnKind(state.rows, config.alert.column) === "number") {
          const limits = el("div", "viewer-livedata-panel_range");
          const below = numberInput(config.alert.below, null, (value) => Viewer.updateLiveDataConfig({ alert: { ...config.alert, equals: null, below: value } }));
          const above = numberInput(config.alert.above, null, (value) => Viewer.updateLiveDataConfig({ alert: { ...config.alert, equals: null, above: value } }));
          labels.push([below, () => t("liveData.alertBelow", "Alert below")]);
          labels.push([above, () => t("liveData.alertAbove", "Alert above")]);
          limits.append(below, el("span", "", "< >"), above);
          row(() => t("liveData.alertLimits", "Below / above"), limits, mapping);
        } else {
          const equals = el("input");
          equals.type = "text";
          equals.value = config.alert.equals ?? "";
          equals.addEventListener("change", () => Viewer.updateLiveDataConfig({ alert: { column: config.alert.column, equals: equals.value.trim() } }));
          row(() => t("liveData.alertEquals", "When it says"), equals, mapping);
        }
      }
      row(() => t("liveData.visible", "Shown when"), select([...none, ...columns], config.visible?.column, (value) => {
        Viewer.updateLiveDataConfig({ visible: value ? { column: value } : null });
      }), mapping);
      const strength = el("input");
      strength.type = "range";
      Object.assign(strength, { min: "10", max: "100", step: "5", value: String(Math.round(config.strength * 100)) });
      strength.addEventListener("input", () => {
        config.strength = Number(strength.value) / 100;
        Viewer.syncLiveDataPanel();
      });
      row(() => t("liveData.strength", { value: `${Math.round(config.strength * 100)}%` }, "Colour strength {value}"), strength, mapping);

      // The table first: a cell changed there is a part changed in the model.
      ui.legend = el("div", "viewer-livedata-panel_legend");
      ui.table = el("div", "viewer-livedata-panel_table");
      ui.matched = el("p", "viewer-pointcloud-panel_note viewer-livedata-panel_matched");
      const hint = el("p", "viewer-pointcloud-panel_note");
      labels.push([hint, () => t("liveData.hint", "Change a cell (arrow keys nudge a number): the model follows.")]);
      ui.body.append(
        ui.legend,
        ui.table,
        ui.matched,
        hint,
        section("columns", () => t("liveData.sectionColumns", "What the columns do"), mapping, false),
        sourceSection,
      );
      Viewer.renderLiveDataLegend();
      Viewer.renderLiveDataTable();
      Viewer.syncLiveDataPanel();
    },

    // The scale: a ramp with its ends, or a colour for each value.
    renderLiveDataLegend() {
      const state = Viewer.liveDataState;
      const legend = state?.ui?.legend;
      if (!legend) return;
      legend.replaceChildren();
      const { scale, config } = state;
      legend.hidden = scale.kind === "none";
      if (scale.kind === "number") {
        const bar = document.createElement("div");
        bar.className = "viewer-livedata-panel_ramp";
        bar.style.background = `linear-gradient(90deg, ${scale.stops.join(", ")})`;
        const ends = document.createElement("div");
        ends.className = "viewer-livedata-panel_ends";
        const unit = config.label?.column === config.color?.column ? config.label.unit : "";
        const low = document.createElement("span");
        low.textContent = formatCell(scale.min, unit);
        const name = document.createElement("strong");
        name.textContent = config.color.column;
        const high = document.createElement("span");
        high.textContent = formatCell(scale.max, unit);
        ends.append(low, name, high);
        legend.append(bar, ends);
      } else if (scale.kind === "category") {
        scale.categories.forEach(({ value, color }) => {
          const item = document.createElement("span");
          item.className = "viewer-livedata-panel_category";
          const swatch = document.createElement("i");
          swatch.style.background = color;
          item.append(swatch, document.createTextNode(String(value)));
          legend.appendChild(item);
        });
      }
    },

    // The table, its cells open to editing: a changed cell changes the model
    // at once.
    renderLiveDataTable() {
      const state = Viewer.liveDataState;
      const holder = state?.ui?.table;
      if (!holder) return;
      const { config, columns } = state;
      const rows = state.rows.slice(0, MAX_TABLE_ROWS);
      // Being typed in: only the other cells are brought up to date.
      const active = holder.contains(document.activeElement) ? document.activeElement : null;
      const signature = `${columns.join("\u0001")}|${rows.length}|${config.key}`;
      if (holder.dataset.signature === signature) {
        holder.querySelectorAll("input[data-row]").forEach((input) => {
          const value = String(rows[Number(input.dataset.row)]?.[input.dataset.column] ?? "");
          if (input !== active && input.value !== value) {
            input.value = value;
            input.classList.remove("is-changed");
            // The class set again restarts the highlight.
            void input.offsetWidth;
            input.classList.add("is-changed");
          }
        });
        Viewer.syncLiveDataTable();
        return;
      }
      holder.dataset.signature = signature;
      const table = document.createElement("table");
      const head = table.createTHead().insertRow();
      columns.forEach((column) => {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = column;
        if (column === config.key) th.classList.add("is-key");
        head.appendChild(th);
      });
      const body = table.createTBody();
      rows.forEach((row, rowIndex) => {
        const tr = body.insertRow();
        tr.dataset.key = normalizeDataKey(row[config.key]);
        tr.addEventListener("click", () => Viewer.flashLiveDataPart(tr.dataset.key));
        columns.forEach((column) => {
          const td = tr.insertCell();
          const input = document.createElement("input");
          input.type = "text";
          input.value = String(row[column] ?? "");
          input.dataset.row = String(rowIndex);
          input.dataset.column = column;
          input.setAttribute("aria-label", `${row[config.key] ?? rowIndex + 1}: ${column}`);
          if (column === config.key) input.classList.add("is-key");
          const commit = () => {
            const current = state.rows[rowIndex];
            if (!current || String(current[column] ?? "") === input.value) return;
            Viewer.editLiveDataCell(rowIndex, column, input.value);
          };
          // Typed numbers follow at once; texts when the cell is left.
          input.addEventListener("input", () => {
            if (column !== config.key && (input.value === "" || !Number.isNaN(dataNumber(input.value)))) commit();
          });
          input.addEventListener("change", commit);
          input.addEventListener("keydown", (event) => {
            const step = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
            const number = dataNumber(input.value);
            if (step && !Number.isNaN(number) && column !== config.key) {
              // Arrow keys nudge a number: the quickest way to see it live.
              event.preventDefault();
              input.value = String(Math.round((number + step * (event.shiftKey ? 10 : 1)) * 100) / 100);
              commit();
            } else if (event.key === "Enter") {
              commit();
              body.rows[rowIndex + 1]?.cells[columns.indexOf(column)]?.querySelector("input")?.focus();
            }
          });
          td.appendChild(input);
        });
      });
      holder.replaceChildren(table);
      if (state.rows.length > MAX_TABLE_ROWS) {
        const more = document.createElement("p");
        more.className = "viewer-pointcloud-panel_note";
        more.textContent = t("liveData.moreRows", { shown: MAX_TABLE_ROWS, total: state.rows.length }, "The first {shown} of {total} rows; all of them drive the model.");
        holder.appendChild(more);
      }
      Viewer.syncLiveDataTable();
    },

    // A cell typed in the window.
    editLiveDataCell(rowIndex, column, text) {
      const state = Viewer.getLiveDataState();
      const row = state.rows[rowIndex];
      if (!row) return false;
      const rows = state.rows.map((item, index) => (index === rowIndex ? { ...item, [column]: text } : item));
      // No longer the file's or the URL's table alone: saved as rows unless
      // the source is still followed.
      if (state.source.kind === "none") state.source.kind = "inline";
      state.source.edited = true;
      Viewer.applyLiveDataTable(state.columns, rows);
      Viewer.renderLiveDataTable();
      Viewer.syncLiveDataPanel();
      return true;
    },

    // Rows marked with their part's colour, or as not found in the model.
    syncLiveDataTable() {
      const state = Viewer.liveDataState;
      const holder = state?.ui?.table;
      if (!holder) return;
      holder.querySelectorAll("tbody tr").forEach((tr, index) => {
        const row = state.rows[index];
        const id = normalizeDataKey(row?.[state.config.key]);
        tr.dataset.key = id;
        const part = state.parts.get(id);
        tr.classList.toggle("is-unmatched", !part || part.leaving);
        tr.classList.toggle("is-alert", Boolean(part?.alert));
        tr.style.setProperty("--livedata-row", part?.targetHex || "transparent");
      });
    },

    syncLiveDataPanel() {
      const state = Viewer.liveDataState;
      const ui = state?.ui;
      if (!ui) return;
      const title = t("liveData.title", "Live data");
      ui.root.setAttribute("aria-label", title);
      ui.title.textContent = title;
      ui.root.hidden = !state.open;

      if (ui.status) {
        const { source } = state;
        const following = Viewer.isLiveDataFollowing();
        ui.status.classList.toggle("is-live", following && !source.error);
        ui.status.classList.toggle("is-error", Boolean(source.error));
        let text;
        if (source.error) text = t("liveData.status.error", { error: source.error }, "Could not read the table: {error}");
        else if (!state.rows.length) text = source.kind === "url" ? t("liveData.status.loading", "Reading the table…") : t("liveData.status.none", "No table");
        else {
          const where = source.kind === "file"
            ? source.name
            : source.kind === "url" ? (state.config.src || "").split(/[?#]/)[0].split("/").pop() : t("liveData.status.here", "this window");
          const mode = following
            ? (source.kind === "file" ? t("liveData.status.watching", { name: where }, "Live: {name}, read again when it is saved") : t("liveData.status.live", { name: where, seconds: state.config.refresh }, "Live: {name}, every {seconds} s"))
            : t("liveData.status.static", { name: where }, "Table: {name}");
          const when = source.updatedAt ? t("liveData.status.updated", { time: clockTime(source.updatedAt), count: source.changed }, "Last change {time} ({count})") : "";
          text = [mode, source.loads > 1 ? when : ""].filter(Boolean).join(" · ");
        }
        ui.statusText.textContent = text;
      }
      if (ui.matched) {
        const total = new Set(state.rows.map((row) => normalizeDataKey(row[state.config.key])).filter(Boolean)).size;
        const found = [...state.parts.values()].filter((part) => !part.leaving).length;
        ui.matched.textContent = t("liveData.matched", { found, total }, "{found} of {total} rows found in the model.");
        ui.matched.classList.toggle("is-warning", found < total);
      }
      Viewer.syncLiveDataTable();
      (ui.labels || []).forEach(([element, text]) => {
        if (element instanceof HTMLInputElement) element.setAttribute("aria-label", text());
        else element.textContent = text();
      });
    },

    downloadLiveDataTable() {
      const state = Viewer.liveDataState;
      if (!state?.rows.length) return false;
      const blob = new Blob([dataTableToCsv(state.columns, state.rows)], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = (state.source.name || "data").split(/[?#]/)[0].split("/").pop().replace(/\.[a-z0-9]+$/i, "") + ".csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      return true;
    },
  });

  window.addEventListener("message", (event) => Viewer.handleLiveDataMessage(event));
}

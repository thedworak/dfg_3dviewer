import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { getViewerSideStack } from "../ui/side-stack.js";
import { attachToolPanelChrome, PANEL_ICONS } from "../ui/tool-panel-chrome.js";
import { PHONE_TOOLBAR_QUERY } from "../editor-toolbar.js";
import { toastHelper } from "../viewer-utils.js";

// Volume display controls, shown when the loaded model is a volume (image
// stacks converted by the worker, drawn by volume.js):
//
//   the stack shown (a .lif holds several), the rendering - maximum
//   intensity projection, emission/absorption or isosurface - and per
//   channel: shown or not, its colour and its window (low/high); the
//   isosurface's channel and threshold, the density, brightness and
//   sampling; below, what the stack is: voxels, voxel size, objective,
//   microscope, lasers, when it was taken.
//
// The settings live on the volume mesh (userData.volume) and are pushed into
// its shader by applyVolumeSettings(). Like the point cloud window, it opens
// by itself except on phones; the toolbar's volume button toggles it.

const DENSITY_MIN = 0.002;
const DENSITY_MAX = 1;

function sliderToDensity(value) {
  return DENSITY_MIN * Math.pow(DENSITY_MAX / DENSITY_MIN, Number(value) / 100);
}

function densityToSlider(density) {
  return Math.round((Math.log(density / DENSITY_MIN) / Math.log(DENSITY_MAX / DENSITY_MIN)) * 100);
}

const SAMPLING = [0.5, 1, 2];
// Radiology's usual CT windows (Hounsfield units), offered with the ones a
// DICOM file suggests.
const CT_WINDOWS = [
  { id: "soft", center: 40, width: 400 },
  { id: "bone", center: 400, width: 1800 },
  { id: "lung", center: -600, width: 1500 },
  { id: "brain", center: 40, width: 80 },
];

const percent = (value) => `${Math.round(value * 100)}%`;

export function attachVolumePanel(Viewer) {
  Object.assign(Viewer, {
    volumeState: null,

    // Called after a model is added to the scene (loaders.js).
    setupVolumeControls(root) {
      Viewer.disposeVolumeControls();
      let mesh = null;
      root?.traverse?.((child) => {
        if (!mesh && child.isMesh && child.userData?.isVolume) mesh = child;
      });
      if (!mesh) return false;
      const state = {
        root,
        mesh,
        api: null,
        loading: false,
        collapsed: false,
        hidden: window.matchMedia(PHONE_TOOLBAR_QUERY).matches,
        ui: null,
      };
      Viewer.volumeState = state;
      // volume.js is loaded already (loaders.js); this only fetches the module.
      import("../volume.js").then((api) => {
        if (Viewer.volumeState !== state) return;
        state.api = api;
        Viewer.createVolumePanel();
        Viewer.updateEditorToolbarState?.();
      });
      return true;
    },

    disposeVolumeControls() {
      const hadState = Boolean(Viewer.volumeState);
      Viewer.volumeState?.ui?.root.remove();
      Viewer.volumeState = null;
      if (hadState) Viewer.updateEditorToolbarState?.();
    },

    isVolumeActive() {
      return Boolean(Viewer.volumeState?.ui);
    },

    isVolumePanelVisible() {
      const state = Viewer.volumeState;
      return Boolean(state?.ui && !state.hidden);
    },

    toggleVolumePanel() {
      const state = Viewer.volumeState;
      if (!state?.ui) return;
      state.hidden = !state.hidden;
      if (!state.hidden) state.collapsed = false;
      Viewer.syncVolumePanel();
      Viewer.updateEditorToolbarState?.();
    },

    // Changes the settings (mesh.userData.volume) and redraws.
    updateVolumeSettings(change, { rebuild = false } = {}) {
      const state = Viewer.volumeState;
      if (!state?.api) return;
      change(state.mesh.userData.volume);
      state.api.applyVolumeSettings(state.root);
      if (rebuild) Viewer.buildVolumePanelBody();
      else Viewer.syncVolumePanel();
    },

    async showVolumeSeries(index) {
      const state = Viewer.volumeState;
      if (!state?.api || state.loading) return;
      state.loading = true;
      Viewer.syncVolumePanel();
      try {
        await state.api.loadVolumeSeries(state.root, index);
      } catch (error) {
        console.error("Could not load the image stack", error);
        toastHelper("volumeSeriesError", "error");
      } finally {
        state.loading = false;
        if (Viewer.volumeState === state) Viewer.buildVolumePanelBody();
      }
    },

    createVolumePanel() {
      const state = Viewer.volumeState;
      const stack = getViewerSideStack();
      if (!state || !stack || core.PRESENTATION_MODE || Viewer.urlOptions?.hideUi === true) return;

      const root = document.createElement("section");
      root.id = "viewerVolumePanel";
      root.className = "viewer-pointcloud-panel viewer-volume-panel";
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
        Viewer.syncVolumePanel();
      });
      header.append(title, collapse);
      attachToolPanelChrome(root, header, {
        icon: PANEL_ICONS.volume,
        onClose: () => Viewer.toggleVolumePanel(),
      });

      const body = document.createElement("div");
      body.className = "viewer-pointcloud-panel_body";
      root.append(header, body);
      stack.appendChild(root);
      state.ui = { root, title, collapse, body, labels: [] };
      Viewer.buildVolumePanelBody();
    },

    // The controls, built again when the stack or the rendering changes
    // (they differ per mode and per number of channels).
    buildVolumePanelBody() {
      const state = Viewer.volumeState;
      const ui = state?.ui;
      if (!ui) return;
      const settings = state.mesh.userData.volume;
      const { manifest } = settings;
      const series = manifest.series[settings.seriesIndex];
      ui.body.replaceChildren();
      // [label element, () => text] pairs, refreshed by syncVolumePanel().
      ui.labels = [];

      const row = (text, control, parent = ui.body) => {
        const element = document.createElement("label");
        element.className = "viewer-pointcloud-panel_row";
        const label = document.createElement("span");
        element.append(label, control);
        parent.appendChild(element);
        ui.labels.push([label, text]);
        return element;
      };
      const select = (values, current, labelOf, onChange) => {
        const element = document.createElement("select");
        values.forEach((value) => element.appendChild(new Option(labelOf(value), String(value))));
        element.value = String(current);
        element.addEventListener("change", () => onChange(element.value));
        return element;
      };
      const slider = (value, onInput) => {
        const element = document.createElement("input");
        element.type = "range";
        element.min = "0";
        element.max = "100";
        element.value = String(Math.round(value));
        element.addEventListener("input", () => onInput(Number(element.value)));
        return element;
      };

      if (manifest.series.length > 1) {
        const seriesSelect = select(
          manifest.series.map((_s, i) => i),
          settings.seriesIndex,
          (i) => `${manifest.series[i].name} (${manifest.series[i].dims.join("×")})`,
          (value) => Viewer.showVolumeSeries(Number(value)),
        );
        seriesSelect.disabled = state.loading;
        row(() => t("volume.series", "Image stack"), seriesSelect);
      }

      row(() => t("volume.mode", "Rendering"), select(
        state.api.VOLUME_MODES,
        settings.mode,
        (mode) => t(`volume.modes.${mode}`, mode),
        (mode) => Viewer.updateVolumeSettings((s) => { s.mode = mode; }, { rebuild: true }),
      ));

      settings.channels.forEach((channel, index) => {
        const group = document.createElement("div");
        group.className = "viewer-volume-panel_channel";
        const head = document.createElement("div");
        head.className = "viewer-volume-panel_channel-head";
        const on = document.createElement("input");
        on.type = "checkbox";
        on.checked = channel.on;
        on.addEventListener("change", () => Viewer.updateVolumeSettings((s) => { s.channels[index].on = on.checked; }));
        const name = document.createElement("span");
        name.textContent = channel.name;
        name.title = channel.name;
        const color = document.createElement("input");
        color.type = "color";
        color.value = channel.color;
        color.addEventListener("input", () => Viewer.updateVolumeSettings((s) => { s.channels[index].color = color.value; }));
        head.append(on, name, color);
        ui.labels.push([on, () => t("volume.channelShown", "Show channel")]);
        ui.labels.push([color, () => t("volume.channelColor", "Channel colour")]);
        group.appendChild(head);
        // In the channel's unit when it has one (CT: HU), else in percent.
        const meta = series.channels[index] || {};
        const inUnits = Boolean(meta.unit) && Array.isArray(meta.range);
        const toUnits = (fraction) => meta.range[0] + fraction * (meta.range[1] - meta.range[0]);
        const level = (fraction) => (inUnits ? `${Math.round(toUnits(fraction))} ${meta.unit}` : percent(fraction));
        const windows = [
          ...(meta.windows || []).map((w, i) => ({ ...w, id: `file-${i}` })),
          ...(meta.unit === "HU" ? CT_WINDOWS : []),
        ];
        if (windows.length && inUnits) {
          const fraction = (value) => Math.min(1, Math.max(0, (value - meta.range[0]) / (meta.range[1] - meta.range[0])));
          const choice = select(
            ["", ...windows.map((w) => w.id), "full"],
            channel.window || "",
            (id) => {
              if (!id) return "–";
              if (id === "full") return t("volume.windows.full", "Full range");
              const w = windows.find((item) => item.id === id);
              const label = id.startsWith("file-") ? w.name : t(`volume.windows.${id}`, id);
              return `${label} (${w.center} / ${w.width})`;
            },
            (id) => Viewer.updateVolumeSettings((s) => {
              const target = s.channels[index];
              target.window = id;
              if (id === "full") {
                target.low = 0;
                target.high = 1;
              } else if (id) {
                const w = windows.find((item) => item.id === id);
                target.low = fraction(w.center - w.width / 2);
                target.high = Math.max(fraction(w.center + w.width / 2), target.low + 0.004);
              }
            }, { rebuild: true }),
          );
          row(() => t("volume.window", "Window (centre / width)"), choice, group);
        }
        row(
          () => t("volume.low", { value: level(Viewer.volumeState.mesh.userData.volume.channels[index].low) }, "Black below {value}"),
          slider(channel.low * 100, (value) => Viewer.updateVolumeSettings((s) => {
            s.channels[index].low = value / 100;
            s.channels[index].window = "";
          })),
          group,
        );
        row(
          () => t("volume.high", { value: level(Viewer.volumeState.mesh.userData.volume.channels[index].high) }, "Full above {value}"),
          slider(channel.high * 100, (value) => Viewer.updateVolumeSettings((s) => {
            s.channels[index].high = Math.max(value / 100, 0.01);
            s.channels[index].window = "";
          })),
          group,
        );
        ui.body.appendChild(group);
      });

      // The threshold in the surface channel's unit (CT: HU), else in percent.
      const isoLevel = () => {
        const current = Viewer.volumeState.mesh.userData.volume;
        const channel = current.channels[current.isoChannel];
        const meta = series.channels[current.isoChannel] || {};
        if (!meta.unit || !Array.isArray(meta.range) || !channel) return percent(current.iso);
        const fraction = channel.low + current.iso * (channel.high - channel.low);
        return `${Math.round(meta.range[0] + fraction * (meta.range[1] - meta.range[0]))} ${meta.unit}`;
      };
      if (settings.mode === "iso") {
        if (settings.channels.length > 1) {
          row(() => t("volume.isoChannel", "Surface of"), select(
            settings.channels.map((_c, i) => i),
            settings.isoChannel,
            (i) => settings.channels[i].name,
            (value) => Viewer.updateVolumeSettings((s) => { s.isoChannel = Number(value); }),
          ));
        }
        row(
          () => t("volume.iso", { value: isoLevel() }, "Threshold {value}"),
          slider(settings.iso * 100, (value) => Viewer.updateVolumeSettings((s) => { s.iso = Math.max(value / 100, 0.01); })),
        );
      }
      if (settings.mode === "dvr") {
        row(
          () => t("volume.density", { value: Viewer.volumeState.mesh.userData.volume.density.toPrecision(2) }, "Density {value}"),
          slider(densityToSlider(settings.density), (value) => Viewer.updateVolumeSettings((s) => { s.density = sliderToDensity(value); })),
        );
      }
      row(
        () => t("volume.brightness", { value: percent(Viewer.volumeState.mesh.userData.volume.brightness) }, "Brightness {value}"),
        slider(settings.brightness * 25, (value) => Viewer.updateVolumeSettings((s) => { s.brightness = Math.max(value / 25, 0.04); })),
      );
      row(() => t("volume.sampling", "Quality"), select(
        SAMPLING,
        settings.sampling,
        (value) => t(`volume.samplings.${value}`, `×${value}`),
        (value) => Viewer.updateVolumeSettings((s) => { s.sampling = Number(value); }),
      ));

      const summary = document.createElement("dl");
      summary.className = "viewer-volume-panel_summary";
      const fact = (term, value) => {
        if (value === undefined || value === null || value === "") return;
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dd.textContent = value;
        summary.append(dt, dd);
        ui.labels.push([dt, term]);
      };
      // Micrometres, millimetres from 1 mm on (CT, MRI).
      const length = (value) => {
        const unit = series.unit || "µm";
        if (unit === "µm" && value >= 1000) return `${Number((value / 1000).toPrecision(3))} mm`;
        // Electron microscopy (MRC): nanometres, and ångströms below one.
        if (unit === "µm" && value > 0 && value < 0.001) return `${Number((value * 1e4).toPrecision(3))} Å`;
        if (unit === "µm" && value > 0 && value < 0.1) return `${Number((value * 1000).toPrecision(3))} nm`;
        return `${Number(value.toPrecision(3))} ${unit}`;
      };
      const [nx, ny, nz] = series.dims;
      const reduced = series.sourceDims && series.sourceDims.join() !== series.dims.join();
      fact(() => t("volume.voxels", "Voxels"), `${nx}×${ny}×${nz}${reduced ? ` (${series.sourceDims.join("×")})` : ""}`);
      fact(() => t("volume.voxelSize", "Voxel size"), series.voxelSize.map(length).join(" × "));
      fact(() => t("volume.size", "Size"), series.voxelSize.map((v, i) => length(v * series.dims[i])).join(" × "));
      const acquisition = series.acquisition || {};
      fact(() => t("volume.modality", "Modality"), acquisition.modality);
      fact(() => t("volume.bodyPart", "Body part"), acquisition.bodyPart);
      fact(() => t("volume.objective", "Objective"), acquisition.objective);
      fact(() => t("volume.microscope", "Instrument"), [acquisition.system, acquisition.stand].filter(Boolean).join(", "));
      fact(() => t("volume.lasers", "Lasers"), acquisition.laserLinesNm?.map((nm) => `${nm} nm`).join(", "));
      fact(() => t("volume.acquired", "Acquired"), acquisition.acquired ? new Date(acquisition.acquired).toLocaleString() : "");
      if (series.frames > 1) fact(() => t("volume.frames", "Time points"), t("volume.firstFrame", { total: series.frames }, "first of {total}"));
      if (manifest.skipped?.length) fact(() => t("volume.skipped", "Not shown"), manifest.skipped.map((s) => s.name).join(", "));
      ui.body.appendChild(summary);
      Viewer.syncVolumePanel();
    },

    syncVolumePanel() {
      const state = Viewer.volumeState;
      const ui = state?.ui;
      if (!ui) return;
      const title = t("volume.title", "Volume");
      ui.root.setAttribute("aria-label", title);
      ui.title.textContent = state.loading ? t("volume.loading", "Loading the stack…") : title;
      ui.root.hidden = state.hidden;
      ui.body.hidden = state.collapsed;
      ui.collapse.textContent = state.collapsed ? "+" : "–";
      const collapseLabel = state.collapsed ? t("volume.expand", "Show settings") : t("volume.collapse", "Hide settings");
      ui.collapse.title = collapseLabel;
      ui.collapse.setAttribute("aria-label", collapseLabel);
      ui.collapse.setAttribute("aria-expanded", state.collapsed ? "false" : "true");
      ui.labels.forEach(([element, text]) => {
        if (element instanceof HTMLInputElement) element.setAttribute("aria-label", text());
        else element.textContent = text();
      });
    },
  });
}

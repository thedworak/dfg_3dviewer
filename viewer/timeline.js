import THREE from "./init.js";
import { core } from "./core.js";
import { t } from "./i18n-utils.js";
import { getViewerSideStack } from "./ui/side-stack.js";

// 4D timeline: a model shown in time. Each stage is a point on the time axis
// (a year) with the nodes that show the object at that point; any year can be
// chosen and the stages around it are faded into each other.
//
// Stages come from the model (glTF scene extras `timeline`, or nodes whose
// extras carry a `year`) and/or from the manifest (AIM3DViewer.timeline),
// which may relabel them, describe them and set the playback. The model's own
// clip that switches the stages (e.g. a STEP scale animation) is left out of
// the animation player (animations.js), the timeline drives those nodes.
//
// Fading: the earlier stage is drawn as it is, the later one over it,
// transparent, without writing depth. Stages that share the geometry (same
// building, other textures/vertex colours) blend without z-fighting; stages
// with different geometry still cross over, the earlier one goes at the end.

const TIMELINE_DEFAULTS = Object.freeze({
  transition: "interpolate",
  transitionDuration: 0.8,
  autoplay: false,
  loop: false,
  pauseAtEvents: 1.5,
  showPanel: true,
});
export const TIMELINE_TRANSITIONS = ["interpolate", "step"];
export const TIMELINE_STAGE_TYPES = ["documented", "modelled"];
// Whole axis in this many seconds when the manifest sets no yearsPerSecond.
const PLAY_SPAN_SECONDS = 24;
// Clicks this close (px) to a point land on it.
const SNAP_PIXELS = 8;
// Axis labels closer than this (share of the axis) are left out.
const LABEL_MIN_GAP = 0.1;
const EPSILON = 1e-4;
// Playback speeds offered in the panel (multiples of yearsPerSecond).
export const TIMELINE_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];

// Control icons: glyphs like ⏮ render differently (or as emoji) per font.
const svgIcon = (body) => `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">${body}</svg>`;
const ICONS = {
  previous: svgIcon('<rect x="5" y="5" width="2.5" height="14" rx="1"/><path d="M19 5.8v12.4a.8.8 0 0 1-1.24.67L9.2 12.67a.8.8 0 0 1 0-1.34l8.56-6.2A.8.8 0 0 1 19 5.8Z"/>'),
  next: svgIcon('<rect x="16.5" y="5" width="2.5" height="14" rx="1"/><path d="M5 5.8v12.4a.8.8 0 0 0 1.24.67l8.56-6.2a.8.8 0 0 0 0-1.34L6.24 5.13A.8.8 0 0 0 5 5.8Z"/>'),
  play: svgIcon('<path d="M7 4.9v14.2a.9.9 0 0 0 1.37.77l11.2-7.1a.9.9 0 0 0 0-1.54L8.37 4.13A.9.9 0 0 0 7 4.9Z"/>'),
  pause: svgIcon('<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'),
};

// Original material state while a material is drawn as the fading stage.
const savedMaterials = new WeakMap();

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function toArray(value) {
  if (value == null || value === "") return [];
  return (Array.isArray(value) ? value : [value]).map(String).filter(Boolean);
}

// IIIF language map ({ "pl": ["..."] }) or a plain string, in the viewer's language.
function readText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(readText).filter(Boolean).join("\n");
  if (isPlainObject(value)) {
    const lang = core.currentLanguage || "en";
    return readText(value[lang] ?? value.en ?? value.none ?? Object.values(value)[0]);
  }
  return String(value);
}

function materialsOf(mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function setFading(mesh, alpha) {
  materialsOf(mesh).forEach((material) => {
    if (!material) return;
    if (!savedMaterials.has(material)) {
      savedMaterials.set(material, {
        transparent: material.transparent,
        opacity: material.opacity,
        depthWrite: material.depthWrite,
        polygonOffset: material.polygonOffset,
        polygonOffsetFactor: material.polygonOffsetFactor,
        polygonOffsetUnits: material.polygonOffsetUnits,
      });
    }
    const saved = savedMaterials.get(material);
    if (!material.transparent) {
      material.transparent = true;
      material.needsUpdate = true;
    }
    material.opacity = saved.opacity * alpha;
    material.depthWrite = false;
    // Pulled towards the camera: coplanar with the stage under it, it wins
    // the depth test on any GPU.
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -1;
  });
}

function restoreMaterials(mesh) {
  materialsOf(mesh).forEach((material) => {
    const saved = material && savedMaterials.get(material);
    if (!saved) return;
    if (material.transparent !== saved.transparent) material.needsUpdate = true;
    Object.assign(material, saved);
    savedMaterials.delete(material);
  });
}

// "ok. 1730 – budowa: …" (labels written into a model) → approximate, "budowa: …".
function splitYearPrefix(label, year) {
  if (typeof label !== "string") return { label, approximate: false };
  const match = label.match(/^\s*(ok\.|ca\.|c\.|um)?\s*(-?\d{1,4})\s*(?:[–—-]\s*|$)/i);
  if (!match || Number(match[2]) !== year) return { label, approximate: false };
  return { label: label.slice(match[0].length).trim(), approximate: Boolean(match[1]) };
}

// The timeline written into the model: glTF scene extras `timeline`, else the
// nodes whose extras carry a `year`.
function readModelTimeline(roots) {
  let found = null;
  roots.forEach((root) => root.traverse((object) => {
    if (!found && isPlainObject(object.userData?.timeline)) found = object.userData.timeline;
  }));
  if (found) {
    return {
      ...found,
      stages: (Array.isArray(found.stages) ? found.stages : []).map((stage) => {
        const { label, approximate } = splitYearPrefix(stage?.label, Number(stage?.year));
        return { ...stage, label, approximate: stage?.approximate ?? approximate };
      }),
    };
  }
  const stages = [];
  roots.forEach((root) => root.traverse((object) => {
    const year = Number(object.userData?.year);
    if (object === root || !object.name || !Number.isFinite(year)) return;
    const { label, approximate } = splitYearPrefix(object.userData.label, year);
    stages.push({ ...object.userData, year, label, approximate: object.userData.approximate ?? approximate, node: object.name });
  }));
  return stages.length >= 2 ? { stages } : null;
}

function findObject(roots, name) {
  const sanitized = THREE.PropertyBinding.sanitizeNodeName(name);
  for (const root of roots) {
    const object = root.getObjectByName(name) || root.getObjectByName(sanitized);
    if (object) return object;
  }
  return null;
}

// Model and manifest merged into the stages shown. Manifest stages replace
// the model's list; a manifest stage without nodes takes those of the
// model's stage of the same year.
function buildTimeline(roots, manifestConfig) {
  const model = readModelTimeline(roots);
  const config = isPlainObject(manifestConfig) ? manifestConfig : {};
  if (config.enabled === false) return null;

  const modelStages = (model?.stages || []).filter((stage) => Number.isFinite(Number(stage?.year)));
  const modelByYear = new Map(modelStages.map((stage) => [Number(stage.year), stage]));
  const rawStages = Array.isArray(config.stages) && config.stages.length ? config.stages : modelStages;

  const stages = rawStages
    .map((raw) => {
      const year = Number(raw?.year);
      if (!Number.isFinite(year)) return null;
      const inherited = modelByYear.get(year) || {};
      const nodes = toArray(raw.nodes ?? raw.node ?? inherited.nodes ?? inherited.node);
      const objects = nodes.map((name) => findObject(roots, name)).filter(Boolean);
      const meshes = [];
      objects.forEach((object) => object.traverse((child) => {
        if (child.isMesh) meshes.push(child);
      }));
      return {
        year,
        yearLabel: raw.yearLabel ?? inherited.yearLabel ?? null,
        approximate: (raw.approximate ?? inherited.approximate) === true,
        type: TIMELINE_STAGE_TYPES.includes(raw.type) ? raw.type : (TIMELINE_STAGE_TYPES.includes(inherited.type) ? inherited.type : null),
        label: raw.label ?? inherited.label ?? "",
        description: raw.description ?? inherited.description ?? "",
        source: raw.source ?? inherited.source ?? null,
        nodes,
        objects,
        meshes,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.year - b.year);

  if (!stages.length) return null;

  const playback = isPlainObject(config.playback) ? config.playback : {};
  const startYear = Number.isFinite(config.startYear) ? config.startYear
    : Number.isFinite(model?.startYear) ? model.startYear : stages[0].year;
  const endYear = Number.isFinite(config.endYear) ? config.endYear
    : Number.isFinite(model?.endYear) ? model.endYear : stages[stages.length - 1].year;
  const span = Math.max(endYear - startYear, EPSILON);
  const transitionDuration = Number(config.transitionDuration);

  return {
    roots,
    stages,
    // The stages that change what is drawn.
    visualStages: stages.filter((stage) => stage.objects.length),
    startYear: Math.min(startYear, endYear),
    endYear: Math.max(startYear, endYear),
    label: config.label ?? model?.label ?? null,
    description: config.description ?? model?.description ?? null,
    transition: TIMELINE_TRANSITIONS.includes(config.transition) ? config.transition : TIMELINE_DEFAULTS.transition,
    transitionDuration: Number.isFinite(transitionDuration) && transitionDuration >= 0 ? transitionDuration : TIMELINE_DEFAULTS.transitionDuration,
    yearsPerSecond: Number(playback.yearsPerSecond) > 0 ? Number(playback.yearsPerSecond) : span / PLAY_SPAN_SECONDS,
    speed: Number(playback.speed) > 0 ? Number(playback.speed) : 1,
    pauseAtEvents: Number(playback.pauseAtEvents) >= 0 ? Number(playback.pauseAtEvents) : TIMELINE_DEFAULTS.pauseAtEvents,
    loop: typeof playback.loop === "boolean" ? playback.loop : TIMELINE_DEFAULTS.loop,
    autoplay: typeof playback.autoplay === "boolean" ? playback.autoplay : TIMELINE_DEFAULTS.autoplay,
    showPanel: typeof config.showPanel === "boolean" ? config.showPanel : TIMELINE_DEFAULTS.showPanel,
    initialYear: Number.isFinite(config.year) ? config.year : null,
    fromManifest: Boolean(manifestConfig && Array.isArray(config.stages) && config.stages.length),
  };
}

function clampYear(state, year) {
  return Math.min(Math.max(year, state.startYear), state.endYear);
}

function formatYear(year) {
  const rounded = Math.round(year);
  return rounded < 0 ? t("timeline.bce", { year: -rounded }, "{year} BCE") : String(rounded);
}

function stageYearText(stage) {
  if (stage.yearLabel) return readText(stage.yearLabel);
  return stage.approximate ? t("timeline.circa", { year: formatYear(stage.year) }, "c. {year}") : formatYear(stage.year);
}

export function attachTimeline(Viewer) {
  Object.assign(Viewer, {
    timelineState: null,
    // AIM3DViewer.timeline of the manifest shown (kept while the same model
    // is swapped, e.g. a progressive preview for the full model).
    timelineManifestConfig: null,
    // The model roots last given to setupTimeline.
    timelineRoots: null,

    // From setupModelAnimations, before the clips are bound.
    setupTimeline(object) {
      const roots = (Array.isArray(object) ? object.flat() : [object]).filter((root) => root?.isObject3D);
      const previous = Viewer.timelineState;
      const previousYear = previous ? previous.targetYear : null;
      const wasPlaying = previous?.playing === true;
      const previousSpeed = previous?.speed;
      Viewer.disposeTimeline({ keepConfig: true });
      Viewer.timelineRoots = roots;
      if (!roots.length) return null;

      const timeline = buildTimeline(roots, Viewer.timelineManifestConfig);
      if (!timeline) return null;

      const state = {
        ...timeline,
        year: 0,
        targetYear: 0,
        playing: false,
        hold: 0,
        scrubbing: false,
        // Step mode: the stage shown and a fade under way.
        stepIndex: -1,
        fade: null,
        shownKey: "",
        // Stage nodes hidden by a zero scale (a glTF way to switch them).
        scales: new Map(),
        nodeNames: new Set(),
        ui: null,
      };
      state.visualStages.forEach((stage) => stage.objects.forEach((stageObject) => {
        state.nodeNames.add(stageObject.name);
        const { scale } = stageObject;
        if (scale.x === 0 || scale.y === 0 || scale.z === 0) {
          state.scales.set(stageObject, scale.clone());
          scale.set(1, 1, 1);
        }
      }));

      const startAt = previousYear ?? state.initialYear ?? state.startYear;
      state.year = state.targetYear = clampYear(state, startAt);
      if (previousSpeed) state.speed = previousSpeed;
      Viewer.timelineState = state;
      Viewer.renderTimelineStages(0, { force: true });

      const hidePanel = !state.showPanel || Viewer.urlOptions?.hideUi === true;
      if (!hidePanel) Viewer.createTimelinePanel();
      if (wasPlaying || (!previous && state.autoplay)) Viewer.playTimeline();
      Viewer.syncTimelinePanel(true);
      return state;
    },

    // A clip that only switches the timeline's stages (animations.js leaves it out).
    isTimelineClip(clip) {
      const names = Viewer.timelineState?.nodeNames;
      if (!names?.size || !clip?.tracks?.length) return false;
      return clip.tracks.every((track) => names.has(THREE.PropertyBinding.parseTrackName(track.name).nodeName));
    },

    hasTimeline() {
      return Boolean(Viewer.timelineState);
    },

    getTimelineYear() {
      return Viewer.timelineState?.year ?? null;
    },

    // Goes to a year; the stages fade over (smoothly, unless `immediate`).
    setTimelineYear(year, { immediate = false } = {}) {
      const state = Viewer.timelineState;
      if (!state || !Number.isFinite(Number(year))) return;
      state.targetYear = clampYear(state, Number(year));
      state.hold = 0;
      if (immediate) state.year = state.targetYear;
      Viewer.syncTimelinePanel();
    },

    // The point before / after the year shown.
    stepTimeline(direction) {
      const state = Viewer.timelineState;
      if (!state) return;
      Viewer.pauseTimeline();
      const current = state.targetYear;
      const target = direction < 0
        ? [...state.stages].reverse().find((stage) => stage.year < current - EPSILON)
        : state.stages.find((stage) => stage.year > current + EPSILON);
      Viewer.setTimelineYear(target ? target.year : (direction < 0 ? state.startYear : state.endYear));
    },

    playTimeline() {
      const state = Viewer.timelineState;
      if (!state) return;
      if (state.targetYear >= state.endYear - EPSILON) state.year = state.targetYear = state.startYear;
      state.year = state.targetYear;
      state.playing = true;
      state.hold = 0;
      Viewer.syncTimelinePanel();
    },

    pauseTimeline() {
      const state = Viewer.timelineState;
      if (!state) return;
      state.playing = false;
      state.hold = 0;
      Viewer.syncTimelinePanel();
    },

    // Multiple of the manifest's yearsPerSecond.
    setTimelineSpeed(speed) {
      const state = Viewer.timelineState;
      if (!state || !(Number(speed) > 0)) return;
      state.speed = Number(speed);
      if (state.ui) state.ui.speedSelect.value = String(state.speed);
    },

    toggleTimelinePlayback() {
      const state = Viewer.timelineState;
      if (!state) return false;
      if (state.playing) Viewer.pauseTimeline();
      else Viewer.playTimeline();
      return true;
    },

    // Every frame (main.js animate).
    updateTimeline(delta = 0) {
      const state = Viewer.timelineState;
      if (!state) return;

      if (state.playing && !state.scrubbing && delta > 0) {
        if (state.hold > 0) {
          state.hold -= delta;
          // The pause at the end of a loop is over: back to the start.
          if (state.hold <= 0 && state.loop && state.year >= state.endYear - EPSILON) {
            state.year = state.targetYear = state.startYear;
          }
        } else {
          let next = state.year + state.yearsPerSecond * state.speed * delta;
          // Held a moment on each documented event.
          const event = state.pauseAtEvents > 0 && state.stages.find(
            (stage) => stage.type === "documented" && stage.year > state.year + EPSILON && stage.year <= next
          );
          if (event) {
            next = event.year;
            state.hold = state.pauseAtEvents;
          }
          if (next >= state.endYear) {
            next = state.endYear;
            if (state.loop) state.hold = Math.max(state.hold, state.pauseAtEvents, EPSILON);
            else state.playing = false;
          }
          state.year = state.targetYear = next;
        }
      } else if (Math.abs(state.targetYear - state.year) > EPSILON) {
        // Eased towards the chosen year: a jump plays as a short time-lapse.
        const tau = Math.max(state.transitionDuration, 0.001) / 4;
        const k = delta > 0 ? 1 - Math.exp(-delta / tau) : 0;
        state.year += (state.targetYear - state.year) * k;
        if (Math.abs(state.targetYear - state.year) < 0.01 || state.transitionDuration === 0) state.year = state.targetYear;
      }

      Viewer.renderTimelineStages(delta);
      Viewer.syncTimelinePanel();
    },

    // The stage under (base) and the one fading in over it (overlay, alpha).
    getTimelineBlend(delta) {
      const state = Viewer.timelineState;
      const stages = state.visualStages;
      if (!stages.length) return { base: -1, overlay: -1, alpha: 0 };
      let index = 0;
      for (let i = 0; i < stages.length; i += 1) {
        if (stages[i].year <= state.year + EPSILON) index = i;
      }

      if (state.transition === "step") {
        if (state.stepIndex < 0) state.stepIndex = index;
        if (index !== state.stepIndex && state.fade?.to !== index) {
          // Fading already: continue from whichever of the two shows more.
          const from = state.fade ? (state.fade.progress >= 0.5 ? state.fade.to : state.fade.from) : state.stepIndex;
          state.fade = { from, to: index, progress: 0 };
          state.stepIndex = index;
        }
        if (state.fade) {
          state.fade.progress = state.transitionDuration > 0 ? state.fade.progress + delta / state.transitionDuration : 1;
          if (state.fade.progress >= 1 || state.fade.from === state.fade.to) state.fade = null;
        }
        if (!state.fade) return { base: state.stepIndex, overlay: -1, alpha: 0 };
        const p = Math.min(Math.max(state.fade.progress, 0), 1);
        return { base: state.fade.from, overlay: state.fade.to, alpha: p * p * (3 - 2 * p) };
      }

      const next = stages[index + 1];
      if (!next || state.year <= stages[0].year) return { base: index, overlay: -1, alpha: 0 };
      const alpha = (state.year - stages[index].year) / Math.max(next.year - stages[index].year, EPSILON);
      return { base: index, overlay: index + 1, alpha: Math.min(Math.max(alpha, 0), 1) };
    },

    renderTimelineStages(delta = 0, { force = false } = {}) {
      const state = Viewer.timelineState;
      if (!state || !state.visualStages.length) return;
      let { base, overlay, alpha } = Viewer.getTimelineBlend(delta);
      if (overlay >= 0 && alpha >= 1 - EPSILON) {
        base = overlay;
        overlay = -1;
      }
      if (alpha <= EPSILON) overlay = -1;
      const key = `${base}|${overlay}|${overlay >= 0 ? alpha.toFixed(4) : 0}`;
      // While fading the materials are set every frame: a shading mode may
      // have swapped them meanwhile.
      if (!force && key === state.shownKey && overlay < 0) return;
      state.shownKey = key;

      // A node in several stages takes the strongest role: base, overlay, hidden.
      const objectRoles = new Map();
      const meshRoles = new Map();
      const rank = { hidden: 0, overlay: 1, base: 2 };
      const assign = (map, item, role) => {
        if (!map.has(item) || rank[role] > rank[map.get(item)]) map.set(item, role);
      };
      state.visualStages.forEach((stage, index) => {
        const role = index === base ? "base" : index === overlay ? "overlay" : "hidden";
        stage.objects.forEach((object) => assign(objectRoles, object, role));
        stage.meshes.forEach((mesh) => assign(meshRoles, mesh, role));
      });
      objectRoles.forEach((role, object) => {
        object.visible = role !== "hidden";
      });
      meshRoles.forEach((role, mesh) => {
        if (role === "overlay") setFading(mesh, alpha);
        else restoreMaterials(mesh);
      });
    },

    // The point shown in the card: the last one reached.
    getTimelineCurrentStage() {
      const state = Viewer.timelineState;
      if (!state) return null;
      let current = state.stages[0];
      state.stages.forEach((stage) => {
        if (stage.year <= state.year + 0.5) current = stage;
      });
      return current;
    },

    createTimelinePanel() {
      const state = Viewer.timelineState;
      if (!state || !core.container) return;

      const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
      };

      const panel = el("section", "viewer-timeline");
      panel.id = "viewerTimeline";
      panel.setAttribute("role", "group");

      const header = el("div", "viewer-timeline_header");
      const title = el("span", "viewer-timeline_title");
      const year = el("output", "viewer-timeline_year");
      year.setAttribute("aria-live", "polite");
      const infoButton = el("button", "viewer-timeline_icon-button viewer-timeline_info-toggle", "i");
      infoButton.type = "button";
      infoButton.hidden = !readText(state.description);
      const collapseButton = el("button", "viewer-timeline_icon-button viewer-timeline_collapse");
      collapseButton.type = "button";
      header.append(title, year, infoButton, collapseButton);

      const body = el("div", "viewer-timeline_body");
      const info = el("p", "viewer-timeline_info");
      info.hidden = true;

      const axis = el("div", "viewer-timeline_axis");
      const track = el("div", "viewer-timeline_track");
      const progress = el("div", "viewer-timeline_progress");
      track.append(progress);
      const markers = el("div", "viewer-timeline_markers");
      const span = Math.max(state.endYear - state.startYear, EPSILON);
      const position = (stageYear) => ((stageYear - state.startYear) / span) * 100;
      const markerNodes = state.stages.map((stage) => {
        const marker = el("span", `viewer-timeline_marker${stage.type ? ` is-${stage.type}` : ""}`);
        marker.style.left = `${position(stage.year)}%`;
        markers.append(marker);
        return marker;
      });
      const range = el("input", "viewer-timeline_range");
      range.type = "range";
      range.min = String(state.startYear);
      range.max = String(state.endYear);
      range.step = state.stages.every((stage) => Number.isInteger(stage.year)) ? "1" : "any";
      axis.append(track, markers, range);

      // Year labels under the axis: the ends, documented events, then the
      // rest, as long as they do not crowd.
      const labels = el("div", "viewer-timeline_labels");
      const priority = (stage, index) => (index === 0 || index === state.stages.length - 1 ? 0 : stage.type === "documented" ? 1 : 2);
      const shown = [];
      state.stages
        .map((stage, index) => ({ stage, index, at: position(stage.year) / 100, rank: priority(stage, index) }))
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .forEach((candidate) => {
          if (shown.some((other) => Math.abs(other.at - candidate.at) < LABEL_MIN_GAP)) return;
          shown.push(candidate);
        });
      shown.forEach(({ stage, at }) => {
        const label = el("button", `viewer-timeline_label${stage.type ? ` is-${stage.type}` : ""}`, formatYear(stage.year));
        label.type = "button";
        label.style.left = `${at * 100}%`;
        // The ends stay inside the panel.
        if (at < 0.05) label.style.transform = "translateX(-15%)";
        else if (at > 0.95) label.style.transform = "translateX(-85%)";
        label.addEventListener("click", () => {
          Viewer.pauseTimeline();
          Viewer.setTimelineYear(stage.year);
        });
        labels.append(label);
      });

      const controls = el("div", "viewer-timeline_controls");
      const prevButton = el("button", "viewer-timeline_step");
      prevButton.type = "button";
      prevButton.innerHTML = ICONS.previous;
      const playButton = el("button", "viewer-timeline_play");
      playButton.type = "button";
      const nextButton = el("button", "viewer-timeline_step");
      nextButton.type = "button";
      nextButton.innerHTML = ICONS.next;
      const speedSelect = el("select", "viewer-timeline_speed");
      const speeds = TIMELINE_SPEEDS.includes(state.speed) ? TIMELINE_SPEEDS : [...TIMELINE_SPEEDS, state.speed].sort((a, b) => a - b);
      speeds.forEach((speed) => {
        const option = el("option", null, `${speed}×`);
        option.value = String(speed);
        speedSelect.append(option);
      });
      speedSelect.value = String(state.speed);
      const legend = el("span", "viewer-timeline_legend");
      legend.hidden = !state.stages.some((stage) => stage.type);
      controls.append(prevButton, playButton, nextButton, speedSelect, legend);

      const card = el("div", "viewer-timeline_card");
      const cardHead = el("div", "viewer-timeline_card-head");
      const badge = el("span", "viewer-timeline_badge");
      const stageYear = el("strong", "viewer-timeline_stage-year");
      cardHead.append(stageYear, badge);
      const stageLabel = el("p", "viewer-timeline_stage-label");
      const stageDescription = el("p", "viewer-timeline_stage-description");
      const stageSource = el("p", "viewer-timeline_stage-source");
      card.append(cardHead, stageLabel, stageDescription, stageSource);

      body.append(info, axis, labels, controls, card);
      panel.append(header, body);

      // Input on the panel stays away from the orbit controls and shortcuts.
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        panel.addEventListener(type, (event) => event.stopPropagation());
      });

      const snap = (value) => {
        const width = axis.clientWidth || 1;
        const tolerance = (SNAP_PIXELS / width) * span;
        const nearest = state.stages.reduce(
          (best, stage) => (Math.abs(stage.year - value) < Math.abs(best - value) ? stage.year : best),
          Infinity
        );
        return Math.abs(nearest - value) <= tolerance ? nearest : value;
      };
      range.addEventListener("pointerdown", () => {
        state.resumeAfterScrub = state.playing;
        state.scrubbing = true;
        Viewer.pauseTimeline();
      });
      range.addEventListener("input", () => {
        Viewer.setTimelineYear(snap(Number.parseFloat(range.value)));
      });
      range.addEventListener("change", () => {
        state.scrubbing = false;
        if (state.resumeAfterScrub) Viewer.playTimeline();
        state.resumeAfterScrub = false;
      });
      playButton.addEventListener("click", () => Viewer.toggleTimelinePlayback());
      prevButton.addEventListener("click", () => Viewer.stepTimeline(-1));
      nextButton.addEventListener("click", () => Viewer.stepTimeline(1));
      speedSelect.addEventListener("change", () => Viewer.setTimelineSpeed(speedSelect.value));
      infoButton.addEventListener("click", () => {
        info.hidden = !info.hidden;
        infoButton.setAttribute("aria-expanded", info.hidden ? "false" : "true");
      });
      collapseButton.addEventListener("click", () => {
        panel.classList.toggle("is-collapsed");
        Viewer.updateTimelineLabels();
      });

      getViewerSideStack()?.append(panel);
      state.ui = {
        panel, title, year, info, infoButton, collapseButton, range, progress, markerNodes,
        prevButton, playButton, nextButton, speedSelect, legend, badge, stageYear, stageLabel, stageDescription, stageSource,
        shownYear: null, shownStage: null, shownPlaying: null,
      };
      Viewer.updateTimelineLabels();
    },

    // Static texts (language switch, ui/localization-theme.js).
    updateTimelineLabels() {
      const state = Viewer.timelineState;
      const ui = state?.ui;
      if (!ui) return;
      const title = readText(state.label) || t("timeline.title", "Timeline");
      ui.panel.setAttribute("aria-label", title);
      ui.title.textContent = title;
      ui.info.textContent = readText(state.description);
      ui.infoButton.title = t("timeline.about", "About this timeline");
      ui.infoButton.setAttribute("aria-label", ui.infoButton.title);
      const collapsed = ui.panel.classList.contains("is-collapsed");
      ui.collapseButton.textContent = collapsed ? "▾" : "▴";
      ui.collapseButton.title = collapsed ? t("timeline.expand", "Show timeline") : t("timeline.collapse", "Hide timeline");
      ui.collapseButton.setAttribute("aria-label", ui.collapseButton.title);
      ui.collapseButton.setAttribute("aria-expanded", collapsed ? "false" : "true");
      ui.range.setAttribute("aria-label", t("timeline.year", "Year"));
      ui.prevButton.title = t("timeline.previous", "Previous point");
      ui.prevButton.setAttribute("aria-label", ui.prevButton.title);
      ui.nextButton.title = t("timeline.next", "Next point");
      ui.nextButton.setAttribute("aria-label", ui.nextButton.title);
      ui.speedSelect.title = t("timeline.speed", "Playback speed");
      ui.speedSelect.setAttribute("aria-label", ui.speedSelect.title);
      ui.legend.innerHTML = "";
      [["documented", t("timeline.documented", "Documented")], ["modelled", t("timeline.modelled", "Modelled")]].forEach(([type, text]) => {
        const item = document.createElement("span");
        item.className = `viewer-timeline_legend-item is-${type}`;
        item.textContent = text;
        ui.legend.append(item);
      });
      state.stages.forEach((stage, index) => {
        const marker = ui.markerNodes[index];
        const text = [stageYearText(stage), readText(stage.label)].filter(Boolean).join(" – ");
        marker.title = text;
      });
      Viewer.syncTimelinePanel(true);
    },

    // Values that follow the year; only touches the DOM when they changed.
    syncTimelinePanel(force = false) {
      const state = Viewer.timelineState;
      const ui = state?.ui;
      if (!ui) return;

      if (force || ui.shownPlaying !== state.playing) {
        ui.shownPlaying = state.playing;
        const playLabel = state.playing ? t("timeline.pause", "Pause (K)") : t("timeline.play", "Play (K)");
        ui.playButton.innerHTML = state.playing ? ICONS.pause : ICONS.play;
        ui.playButton.title = playLabel;
        ui.playButton.setAttribute("aria-label", playLabel);
      }

      const shownYear = state.year.toFixed(2);
      if (force || ui.shownYear !== shownYear) {
        ui.shownYear = shownYear;
        const span = Math.max(state.endYear - state.startYear, EPSILON);
        ui.progress.style.width = `${((state.year - state.startYear) / span) * 100}%`;
        if (!state.scrubbing) ui.range.value = String(state.playing ? state.year : state.targetYear);
        const stage = Viewer.getTimelineCurrentStage();
        const onStage = stage && Math.abs(stage.year - state.year) < 0.5;
        ui.year.textContent = onStage ? stageYearText(stage) : formatYear(state.year);
        ui.range.setAttribute("aria-valuetext", ui.year.textContent);
        ui.markerNodes.forEach((marker, index) => {
          marker.classList.toggle("is-passed", state.stages[index].year <= state.year + EPSILON);
          marker.classList.toggle("is-current", state.stages[index] === stage);
        });
      }

      const stage = Viewer.getTimelineCurrentStage();
      if (force || ui.shownStage !== stage) {
        ui.shownStage = stage;
        ui.stageYear.textContent = stage ? stageYearText(stage) : "";
        ui.badge.hidden = !stage?.type;
        ui.badge.className = `viewer-timeline_badge${stage?.type ? ` is-${stage.type}` : ""}`;
        ui.badge.textContent = stage?.type === "documented"
          ? t("timeline.documented", "Documented")
          : stage?.type === "modelled" ? t("timeline.modelled", "Modelled") : "";
        ui.stageLabel.textContent = readText(stage?.label);
        ui.stageLabel.hidden = !ui.stageLabel.textContent;
        ui.stageDescription.textContent = readText(stage?.description);
        ui.stageDescription.hidden = !ui.stageDescription.textContent;
        const source = readText(stage?.source);
        ui.stageSource.textContent = source ? t("timeline.source", { source }, "Source: {source}") : "";
        ui.stageSource.hidden = !source;
      }
    },

    // AIM3DViewer.timeline of an exported manifest.
    getTimelineForExport() {
      const state = Viewer.timelineState;
      if (!state) return Viewer.timelineManifestConfig?.enabled === false ? { enabled: false } : undefined;
      const round = (value) => Math.round(value * 100) / 100;
      return {
        enabled: true,
        year: round(state.targetYear),
        startYear: state.startYear,
        endYear: state.endYear,
        ...(state.label ? { label: state.label } : {}),
        ...(state.description ? { description: state.description } : {}),
        transition: state.transition,
        transitionDuration: state.transitionDuration,
        ...(state.showPanel ? {} : { showPanel: false }),
        playback: {
          autoplay: state.autoplay,
          loop: state.loop,
          yearsPerSecond: round(state.yearsPerSecond),
          ...(state.speed !== 1 ? { speed: state.speed } : {}),
          pauseAtEvents: state.pauseAtEvents,
        },
        stages: state.stages.map((stage) => ({
          year: stage.year,
          ...(stage.yearLabel ? { yearLabel: stage.yearLabel } : {}),
          ...(stage.approximate ? { approximate: true } : {}),
          ...(stage.type ? { type: stage.type } : {}),
          ...(stage.label ? { label: stage.label } : {}),
          ...(stage.description ? { description: stage.description } : {}),
          ...(stage.source ? { source: stage.source } : {}),
          ...(stage.nodes.length ? { nodes: stage.nodes } : {}),
        })),
      };
    },

    // A manifest's timeline (absent: the model's own, if it has one). The
    // animations are set up again: the stages' clip may change hands.
    apply3IFManifestTimeline(config) {
      const hadConfig = Viewer.timelineManifestConfig != null;
      Viewer.timelineManifestConfig = isPlainObject(config) ? config : null;
      const roots = Viewer.timelineRoots;
      if (!roots?.length) return false;
      // Nothing to change: the model's animations are left playing.
      if (!Viewer.timelineManifestConfig && !hadConfig) return false;
      // Built anew: the manifest's year and autoplay win over what is shown.
      Viewer.disposeTimeline({ keepConfig: true });
      Viewer.setupModelAnimations(roots.length === 1 ? roots[0] : roots);
      return Boolean(config) && Boolean(Viewer.timelineState);
    },

    // Stages back as the model had them.
    disposeTimeline({ keepConfig = false } = {}) {
      const state = Viewer.timelineState;
      if (state) {
        state.visualStages.forEach((stage) => {
          stage.meshes.forEach((mesh) => restoreMaterials(mesh));
          stage.objects.forEach((object) => {
            object.visible = true;
          });
        });
        state.scales.forEach((scale, object) => object.scale.copy(scale));
        state.ui?.panel.remove();
      }
      Viewer.timelineState = null;
      if (!keepConfig) {
        Viewer.timelineManifestConfig = null;
        Viewer.timelineRoots = null;
      }
    },
  });
}

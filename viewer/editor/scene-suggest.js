import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { applyRenderingSettings, getRenderingSettings } from "../rendering.js";
import { apiUrl, appRequestHeaders, hasRemote } from "../remote.js";
import { hasIfcProperties } from "../ifc-properties.js";
import { getViewerSideStack } from "../ui/side-stack.js";
import { attachToolPanelChrome, PANEL_ICONS, refreshToolPanelChrome } from "../ui/tool-panel-chrome.js";
import { suggestScene } from "./scene-rules.js";
import { computeSceneShape } from "./scene-shape.js";
import { analyzeSceneText, getSemanticSettings, setSceneEmbedder } from "./scene-semantic.js";
import { formatSunTime, sunriseSunset } from "./sun-study.js";

// Suggested scene (Look > Suggested scene): a lighting, a weather and a
// rendering picked for the model by rules (editor/scene-rules.js) from what
// the viewer knows of it - the file name, the metadata shown, the
// manifest's texts, the place and the timeline, the model's size in metres,
// its kind (mesh, point cloud, splats) and materials. The window lists each
// suggestion with how sure it is and why; the confident ones that change
// something are ticked. Nothing changes until "Apply", and "Undo" puts
// back what was there before.
//
// Where no place is set, the texts are sent to the worker's place search
// (POST /api/geo/places, worker/geonames.py: GeoNames, offline) once per
// model when the window opens; a town they name puts the sun there. A
// worker without it (or no worker) leaves the place unknown.
//
// Where the rules are unsure, a small language model can read the texts
// too (editor/scene-semantic.js, in the browser): the first time on the
// user's click (it downloads about 120 MB), after that by itself whenever
// the setting is unsure - the browser remembers the consent.
//
// The purpose decides most: documentation (even light, raking light for
// relief, no weather that hides the geometry) or presentation (the sun of
// the place and time, the sky, a weather the texts name). The rules pick
// one; the window lets the user pick the other.

// Text read from the metadata and the manifest, at most.
const TEXT_LIMIT = 12000;
// Keys of a manifest whose strings describe the object.
const MANIFEST_TEXT_KEYS = new Set(["label", "summary", "metadata", "value", "description", "title", "body", "navDate", "variants", "timeline", "requiredStatement"]);

const PHONE = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
// Set once the language model has been used: later models get it by
// themselves where the setting is unsure.
const SEMANTIC_CONSENT_KEY = "dfg3dviewer.sceneSemantic";
// The setting below this confidence asks the language model (once consented).
const SEMANTIC_AUTO_BELOW = 0.6;

function semanticSettings() {
  return getSemanticSettings(core.CONFIG?.viewer?.sceneSuggest?.semantic);
}

function readConsent() {
  try {
    return window.localStorage.getItem(SEMANTIC_CONSENT_KEY) === "1";
  } catch (_error) {
    return false;
  }
}

function writeConsent() {
  try {
    window.localStorage.setItem(SEMANTIC_CONSENT_KEY, "1");
  } catch (_error) {
    // Private mode: asked again next time.
  }
}

// The strings of a manifest under its describing keys (language maps and
// metadata pairs included), depth-limited.
function manifestText(json) {
  const out = [];
  let length = 0;
  const walk = (value, depth, describing) => {
    if (length > TEXT_LIMIT || depth > 12 || value == null) return;
    if (typeof value === "string") {
      if (describing && !/^https?:\/\//.test(value)) {
        out.push(value);
        length += value.length;
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, depth + 1, describing));
      return;
    }
    if (typeof value === "object") {
      Object.entries(value).forEach(([key, item]) => walk(item, depth + 1, describing || MANIFEST_TEXT_KEYS.has(key)));
    }
  };
  walk(json, 0, false);
  return out.join(" \n");
}

export function attachSceneSuggest(Viewer) {
  Object.assign(Viewer, {
    sceneSuggestion: {
      // The purpose the user picked; null: the rules'.
      purpose: null,
      result: null,
      // Keys of the suggestions ticked.
      selected: new Set(),
      // What was there before the last "Apply".
      undo: null,
      // The place the texts name (worker/geonames.py), once looked up:
      // { name, country, latitude, longitude, confidence } or null.
      place: null,
      placeLookup: null,
      placeToken: null,
      // What the language model read ({ model, setting, purpose, relief }),
      // and its state: "idle" | "loading" | "reading" | "done" | "failed".
      // The shape's measures (scene-shape.js), once measured; undefined
      // until then.
      shape: undefined,
      semantic: null,
      semanticState: "idle",
      semanticProgress: 0,
      semanticToken: null,
    },
    sceneSuggestPanel: null,

    // ---- the facts --------------------------------------------------------------

    gatherSceneFacts() {
      const roots = Viewer.getSunModelRoots?.() || [];
      const box = new THREE.Box3();
      let kind = "mesh";
      let triangles = 0;
      let textured = false;
      let vertexColors = false;
      let normals = null;
      let meshes = 0;
      let unlitMeshes = 0;
      const materials = new Set();
      roots.forEach((root) => {
        try {
          box.expandByObject(root);
        } catch (_error) {
          // Some streamed or splat objects have no plain geometry to measure.
        }
        root.traverse((object) => {
          if (object.userData?.isGaussianSplats) kind = "splats";
          if (object.isPoints && kind !== "splats") kind = "pointcloud";
          const geometry = object.geometry;
          if (object.isPoints && geometry?.attributes) {
            normals = (normals ?? true) && Boolean(geometry.attributes.normal);
          }
          if (!object.isMesh || !geometry?.attributes?.position) return;
          meshes += 1;
          const count = geometry.index ? geometry.index.count : geometry.attributes.position.count;
          triangles += count / 3;
          if (geometry.attributes.color) vertexColors = true;
          normals = (normals ?? true) && Boolean(geometry.attributes.normal);
          const list = Array.isArray(object.material) ? object.material : [object.material];
          if (list.every((material) => material?.isMeshBasicMaterial)) unlitMeshes += 1;
          list.forEach((material) => {
            if (!material) return;
            materials.add(material);
            if (material.map) textured = true;
          });
        });
      });
      if (Viewer.isPointCloudActive?.() && kind === "mesh" && meshes === 0) kind = "pointcloud";

      // The shape's measures (scene-shape.js): once per model, meshes only.
      const state = Viewer.sceneSuggestion;
      if (state.shape === undefined) {
        try {
          state.shape = kind === "mesh" ? Viewer.measureSceneShape(roots) : null;
        } catch (error) {
          console.warn("The model's shape could not be measured", error);
          state.shape = null;
        }
      }
      const unit = Viewer.resolveModelUnit?.() || { meters: 1, source: "default" };
      const size = box.isEmpty() ? null : box.getSize(new THREE.Vector3()).multiplyScalar(unit.meters);

      const file = core.fileObject || {};
      const extension = String(file.orgExtension || file.extension || "").toLowerCase();
      const metadataText = (core.metadataContainer?.textContent || "").slice(0, TEXT_LIMIT);
      const manifest = Viewer.currentManifest?.json;
      const text = [file.basename || file.filename || "", metadataText, manifest ? manifestText(manifest) : ""]
        .join(" \n")
        .slice(0, TEXT_LIMIT * 2);

      const sun = Viewer.sunStudy;
      const settings = getRenderingSettings();
      return {
        kind,
        ifc: extension === "ifc" || hasIfcProperties(),
        size: size ? { x: size.x, y: size.y, z: size.z } : null,
        unitSource: unit.source,
        textured,
        vertexColors,
        normals,
        shape: state.shape,
        // Inside the box: an interior seen as such; outside it, only a
        // manifest's camera says so (the viewer frames every model from
        // outside).
        cameraInside: !size ? null
          : core.camera && box.containsPoint(core.camera.position) ? true
            : Viewer.manifestCameraPosition ? box.containsPoint(Viewer.manifestCameraPosition) : null,
        unlit: meshes > 0 && unlitMeshes === meshes,
        triangles: Math.round(triangles),
        materials: materials.size,
        phone: PHONE,
        location: sun?.locationSet
          ? { latitude: sun.latitude, longitude: sun.longitude, source: "manifest" }
          : Viewer.sceneSuggestion.place ? { ...Viewer.sceneSuggestion.place, source: "geonames" } : null,
        timelineYear: Viewer.hasTimeline?.() ? Viewer.getTimelineYear?.() : null,
        text,
        semantic: Viewer.sceneSuggestion.semantic,
        current: {
          sun: sun?.enabled === true,
          weather: Viewer.weather?.enabled ? Viewer.weather.type : null,
          rakingLight: Viewer.rakingLight?.enabled === true,
          toneMapping: settings.toneMapping,
          ao: settings.postprocessing.ao === true,
        },
      };
    },

    // The place the texts name, from the worker's GeoNames search: once per
    // model, and only where the manifest sets none. Resolves to the place
    // or null; the window is updated when it comes.
    lookupScenePlace(facts) {
      const state = Viewer.sceneSuggestion;
      if (state.placeLookup) return state.placeLookup;
      if (facts.location || !hasRemote() || !facts.text.trim()) return Promise.resolve(null);
      const token = {};
      state.placeToken = token;
      state.placeLookup = fetch(apiUrl("/api/geo/places"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...appRequestHeaders() },
        body: JSON.stringify({ text: facts.text }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null)
        .then((answer) => {
          const place = Array.isArray(answer?.places) ? answer.places[0] : null;
          // A new model meanwhile: the answer was for the old one.
          if (state.placeToken !== token) return null;
          const valid = place && Number.isFinite(place.latitude) && Number.isFinite(place.longitude);
          state.place = valid
            ? {
              name: String(place.name || ""),
              country: String(place.country || ""),
              latitude: place.latitude,
              longitude: place.longitude,
              confidence: Number.isFinite(place.confidence) ? place.confidence : 0.5,
            }
            : null;
          if (state.place && state.result) Viewer.computeSceneSuggestion();
          return state.place;
        });
      return state.placeLookup;
    },

    // The language model reads the texts (editor/scene-semantic.js); the
    // suggestion is computed again with what it read.
    async readSceneTextWithModel() {
      const state = Viewer.sceneSuggestion;
      const settings = semanticSettings();
      if (!settings.enabled || state.semanticState === "loading" || state.semanticState === "reading") return null;
      const token = {};
      state.semanticToken = token;
      state.semanticState = "loading";
      state.semanticProgress = 0;
      Viewer.syncSceneSemantic();
      try {
        const facts = Viewer.gatherSceneFacts();
        const result = await analyzeSceneText(facts.text, {
          settings,
          onProgress: (progress) => {
            if (state.semanticToken !== token) return;
            state.semanticProgress = progress;
            if (progress >= 1) state.semanticState = "reading";
            Viewer.syncSceneSemantic();
          },
        });
        if (state.semanticToken !== token) return null;
        writeConsent();
        state.semantic = result;
        state.semanticState = "done";
        Viewer.computeSceneSuggestion();
        Viewer.syncSceneSemantic();
        return result;
      } catch (error) {
        if (state.semanticToken !== token) return null;
        console.warn("The language model could not be used", error);
        state.semanticState = "failed";
        Viewer.syncSceneSemantic();
        return null;
      }
    },

    // For tests: an embedder instead of the model ((texts) => vectors).
    setSceneEmbedder(embed) {
      setSceneEmbedder(embed);
    },

    syncSceneSemantic() {
      const ui = Viewer.sceneSuggestPanel;
      if (!ui) return;
      const state = Viewer.sceneSuggestion;
      const settings = semanticSettings();
      const busy = state.semanticState === "loading" || state.semanticState === "reading";
      ui.semanticButton.hidden = !settings.enabled || state.semanticState === "done";
      ui.semanticButton.disabled = busy;
      ui.semanticButton.textContent = state.semanticState === "failed"
        ? t("scene.semantic.retry", "Try the language model again")
        : t("scene.semantic.button", { size: settings.sizeMb }, "Read the texts with a language model (about {size} MB, downloaded once)");
      const messages = {
        loading: state.semanticProgress > 0
          ? t("scene.semantic.loading", { percent: Math.round(state.semanticProgress * 100) }, "Loading the language model… {percent}%")
          : t("scene.semantic.starting", "Loading the language model…"),
        reading: t("scene.semantic.reading", "Reading the texts…"),
        failed: t("scene.semantic.failed", "The language model could not be loaded."),
        done: state.semantic
          ? t("scene.semantic.done", { passages: state.semantic.passages }, "The language model read {passages} passages of the texts.")
          : t("scene.semantic.nothing", "There is no text for the language model to read."),
      };
      ui.semanticStatus.textContent = messages[state.semanticState] || "";
      ui.semanticStatus.hidden = !ui.semanticStatus.textContent;
    },

    // The shape's measures of `roots` (scene-shape.js; the model's by
    // default).
    measureSceneShape(roots = Viewer.getSunModelRoots?.() || []) {
      const box = new THREE.Box3();
      roots.forEach((root) => box.expandByObject(root));
      return computeSceneShape(roots, box);
    },

    // The suggestion for the model shown, for `purpose` (null: the rules').
    computeSceneSuggestion(purpose = Viewer.sceneSuggestion.purpose) {
      const state = Viewer.sceneSuggestion;
      state.purpose = purpose === "documentation" || purpose === "presentation" ? purpose : null;
      const facts = Viewer.gatherSceneFacts();
      if (Viewer.sceneSuggestPanel) Viewer.lookupScenePlace(facts);
      state.result = suggestScene(facts, state.purpose);
      // Consented before: the language model where the rules are unsure.
      if (Viewer.sceneSuggestPanel && state.semanticState === "idle" && state.result.setting.confidence < SEMANTIC_AUTO_BELOW
        && semanticSettings().enabled && readConsent()) {
        Viewer.readSceneTextWithModel();
      }
      state.selected = new Set(state.result.items.filter((item) => item.preselected).map((item) => item.key));
      Viewer.syncSceneSuggestPanel();
      return state.result;
    },

    // ---- applying ---------------------------------------------------------------

    snapshotScene() {
      const sun = Viewer.sunStudy;
      return {
        sun: sun ? { ...sun, playing: false } : null,
        weather: Viewer.weather ? { ...Viewer.weather } : null,
        rakingLight: Viewer.rakingLight?.enabled === true,
        rendering: getRenderingSettings(),
      };
    },

    restoreScene(snapshot) {
      if (!snapshot) return;
      applyRenderingSettings(snapshot.rendering);
      if (snapshot.weather) {
        if (snapshot.weather.enabled) Viewer.setWeatherOptions(snapshot.weather);
        else Viewer.setWeather(false);
      }
      if (snapshot.sun) {
        const { enabled, ...rest } = snapshot.sun;
        Viewer.setSunStudy(false);
        Object.assign(Viewer.sunStudy, rest);
        if (enabled) Viewer.setSunStudy(true);
      }
      // After the sun, which turns the raking light off.
      Viewer.setRakingLight?.(snapshot.rakingLight);
    },

    // The minutes of the day of a suggested time (by sunrise or sunset at
    // the sun's place and day).
    resolveSceneSunMinutes(time) {
      if (!time || time.anchor === "clock") return Number.isFinite(time?.minutes) ? time.minutes : 960;
      const state = Viewer.sunStudy;
      const { sunrise, sunset } = sunriseSunset({
        year: Viewer.getSunYear(),
        month: state.month,
        day: state.day,
        utcOffset: Viewer.getSunUtcOffset(),
        latitude: state.latitude,
        longitude: state.longitude,
      });
      const anchor = time.anchor === "sunrise" ? sunrise : sunset;
      if (anchor == null) return time.anchor === "sunrise" ? 540 : 960;
      return Math.min(Math.max(Math.round(anchor + (time.offset || 0)), 0), 1439);
    },

    applySceneSuggestion(keys = [...Viewer.sceneSuggestion.selected]) {
      const result = Viewer.sceneSuggestion.result;
      if (!result) return false;
      const items = result.items.filter((item) => keys.includes(item.key));
      if (!items.length) return false;
      Viewer.sceneSuggestion.undo = Viewer.snapshotScene();
      const byKey = Object.fromEntries(items.map((item) => [item.key, item.value]));

      if (byKey.toneMapping) applyRenderingSettings({ toneMapping: byKey.toneMapping.toneMapping });
      if (byKey.ao) applyRenderingSettings({ postprocessing: { ao: byKey.ao.ao } });
      const sun = byKey.sun;
      if (sun) {
        if (sun.enabled) {
          const { time, enabled: _enabled, ...options } = sun;
          Viewer.setSunOptions(options);
          Viewer.setSunOptions({ minutes: Viewer.resolveSceneSunMinutes(time) });
          Viewer.setSunStudy(true);
        } else {
          Viewer.setSunStudy(false);
        }
      }
      const weather = byKey.weather;
      if (weather) {
        if (weather.enabled) {
          const { enabled: _enabled, ...options } = weather;
          Viewer.setWeatherOptions(options);
        } else {
          Viewer.setWeather(false);
        }
      }
      // After the sun, which turns the raking light off.
      if (byKey.rakingLight) Viewer.setRakingLight?.(byKey.rakingLight.enabled);

      Viewer.updateEditorToolbarState?.();
      Viewer.computeSceneSuggestion();
      if (Viewer.sceneSuggestPanel) Viewer.sceneSuggestPanel.status.textContent = t("scene.applied", "Applied. Undo puts back what was there before.");
      return true;
    },

    undoSceneSuggestion() {
      const snapshot = Viewer.sceneSuggestion.undo;
      if (!snapshot) return false;
      Viewer.sceneSuggestion.undo = null;
      Viewer.restoreScene(snapshot);
      Viewer.updateEditorToolbarState?.();
      Viewer.computeSceneSuggestion();
      if (Viewer.sceneSuggestPanel) Viewer.sceneSuggestPanel.status.textContent = t("scene.undone", "Put back as it was.");
      return true;
    },

    // ---- window -----------------------------------------------------------------

    isSceneSuggestPanelOpen() {
      return Boolean(Viewer.sceneSuggestPanel);
    },

    toggleSceneSuggestPanel(open = !Viewer.sceneSuggestPanel) {
      if (open) Viewer.createSceneSuggestPanel();
      else Viewer.removeSceneSuggestPanel();
      Viewer.updateEditorToolbarState?.();
    },

    createSceneSuggestPanel() {
      if (Viewer.sceneSuggestPanel || !core.container || Viewer.urlOptions?.hideUi === true) return;
      const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
      };
      const panel = el("section", "viewer-scene");
      panel.id = "viewerScene";
      panel.setAttribute("role", "group");
      const header = el("div", "viewer-scene_header");
      const title = el("span", "viewer-scene_title");
      const closeButton = el("button", "viewer-scene_icon", "×");
      closeButton.type = "button";
      header.append(title, closeButton);

      const intro = el("p", "viewer-scene_intro");
      const purposes = el("div", "viewer-scene_purposes");
      purposes.setAttribute("role", "radiogroup");
      const purposeButtons = {};
      ["documentation", "presentation"].forEach((purpose) => {
        const button = el("button", "viewer-scene_purpose");
        button.type = "button";
        button.dataset.purpose = purpose;
        button.setAttribute("role", "radio");
        button.addEventListener("click", () => Viewer.computeSceneSuggestion(purpose));
        purposes.append(button);
        purposeButtons[purpose] = button;
      });
      const list = el("ul", "viewer-scene_items");
      const uncertain = el("p", "viewer-scene_uncertain");
      const basisDetails = el("details", "viewer-scene_basis");
      const basisSummary = el("summary");
      const basisList = el("ul");
      basisDetails.append(basisSummary, basisList);
      const actions = el("div", "viewer-scene_actions");
      const applyButton = el("button", "viewer-scene_apply");
      applyButton.type = "button";
      applyButton.addEventListener("click", () => Viewer.applySceneSuggestion());
      const undoButton = el("button", "viewer-scene_undo");
      undoButton.type = "button";
      undoButton.addEventListener("click", () => Viewer.undoSceneSuggestion());
      actions.append(applyButton, undoButton);
      const status = el("p", "viewer-scene_status");
      status.setAttribute("role", "status");
      const semantic = el("div", "viewer-scene_semantic");
      const semanticButton = el("button", "viewer-scene_semantic-button");
      semanticButton.type = "button";
      semanticButton.addEventListener("click", () => Viewer.readSceneTextWithModel());
      const semanticStatus = el("p", "viewer-scene_semantic-status");
      semanticStatus.setAttribute("role", "status");
      semantic.append(semanticButton, semanticStatus);

      panel.append(header, intro, purposes, list, uncertain, actions, status, semantic, basisDetails);
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        panel.addEventListener(type, (event) => event.stopPropagation());
      });
      closeButton.addEventListener("click", () => Viewer.toggleSceneSuggestPanel(false));
      attachToolPanelChrome(panel, header, {
        before: closeButton,
        icon: PANEL_ICONS.scene,
        label: () => t("scene.title", "Suggested scene"),
      });
      getViewerSideStack()?.append(panel);
      Viewer.sceneSuggestPanel = { panel, title, closeButton, intro, purposeButtons, list, uncertain, basisSummary, basisList, applyButton, undoButton, status, semanticButton, semanticStatus };
      Viewer.computeSceneSuggestion();
      Viewer.updateSceneSuggestLabels();
    },

    removeSceneSuggestPanel() {
      Viewer.sceneSuggestPanel?.panel.remove();
      Viewer.sceneSuggestPanel = null;
    },

    updateSceneSuggestLabels() {
      const ui = Viewer.sceneSuggestPanel;
      if (!ui) return;
      const name = t("scene.title", "Suggested scene");
      ui.panel.setAttribute("aria-label", name);
      ui.title.textContent = name;
      refreshToolPanelChrome(ui.panel);
      ui.closeButton.title = t("scene.close", "Close");
      ui.closeButton.setAttribute("aria-label", ui.closeButton.title);
      ui.intro.textContent = t("scene.intro", "Picked by rules from the file name, the metadata, the manifest and the model's size and materials. Nothing changes until you apply it.");
      ui.basisSummary.textContent = t("scene.basis", "What it is based on");
      ui.applyButton.textContent = t("scene.apply", "Apply the ticked");
      ui.undoButton.textContent = t("scene.undo", "Undo");
      ui.status.textContent = "";
      Viewer.syncSceneSuggestPanel();
      Viewer.syncSceneSemantic();
    },

    // A reason or a fact, in words.
    describeSceneReason(reason) {
      const words = (list) => (list || []).map((word) => `„${word}”`).join(", ");
      const settingName = (setting) => t(`scene.setting.${setting}`, setting);
      const sourceName = (source) => t(`scene.source.${source}`, source);
      const placeName = (place) => [place.name, place.country].filter(Boolean).join(", ");
      switch (reason.key) {
        case "keywords": return t("scene.reason.keywords", { words: words(reason.words) }, "the texts say {words}");
        case "size": return t("scene.reason.size", { size: t(`scene.size.${reason.size}`, reason.size) }, "its size: {size}");
        case "notOutdoor": return t("scene.reason.notOutdoor", { setting: settingName(reason.setting) }, "not outdoors: {setting}");
        case "place": return t("scene.reason.place", { source: sourceName(reason.source) }, "the place from {source}");
        case "semantic": return t("scene.reason.semantic", { setting: settingName(reason.setting), percent: reason.percent }, "the language model reads {setting} ({percent}%)");
        case "enclosed": return t("scene.reason.enclosed", { percent: reason.percent }, "walls all round, seen from inside ({percent}% of directions)");
        case "ceiling": return t("scene.reason.ceiling", { percent: reason.percent }, "a ceiling over a floor");
        case "ground": return t("scene.reason.ground", { percent: reason.percent }, "an open ground ({percent}% of the footprint)");
        case "semanticPurpose": return t("scene.reason.semanticPurpose", { purpose: t(`scene.purpose.${reason.purpose}`, reason.purpose), percent: reason.percent }, "the language model reads: {purpose} ({percent}%)");
        case "semanticRelief": return t("scene.reason.semanticRelief", { percent: reason.percent }, "the language model reads relief to read ({percent}%)");
        case "placeNamed": return t("scene.reason.placeNamed", { name: placeName(reason) }, "the texts name {name} (GeoNames)");
        case "year": return t("scene.reason.year", { year: reason.year, source: sourceName(reason.source) }, "the year {year}, from {source}");
        case "season": return t("scene.reason.season", { season: t(`scene.season.${reason.season}`, reason.season) }, "season: {season}");
        case "weatherNamed": return t("scene.reason.weatherNamed", { words: words(reason.words) }, "the texts say {words}");
        case "relief": return t("scene.reason.relief", { words: words(reason.words) }, "relief to read: {words}");
        default: return t(`scene.reason.${reason.key}`, reason.key);
      }
    },

    describeSceneFact(fact) {
      switch (fact.key) {
        case "kind": {
          const kind = t(`scene.kind.${fact.kind}`, fact.kind);
          return fact.ifc ? `${kind} (IFC)` : kind;
        }
        case "size": {
          const { x, y, z } = fact.size;
          const size = [x, y, z].map((value) => Viewer.formatSceneMeters(value)).join(" × ");
          return t("scene.fact.size", { size, unit: t(`scene.unit.${fact.unitSource}`, fact.unitSource) }, "Size: {size} ({unit})");
        }
        case "baked": return t("scene.fact.baked", "Lighting already in the textures or colours (a scan or splats)");
        case "location": {
          const coordinates = `${fact.latitude.toFixed(4)}, ${fact.longitude.toFixed(4)}`;
          const place = fact.name ? `${[fact.name, fact.country].filter(Boolean).join(", ")} (${coordinates})` : coordinates;
          return t("scene.fact.location", { place, source: t(`scene.source.${fact.source}`, fact.source) }, "Place: {place} (from {source})");
        }
        case "year": return t("scene.fact.year", { year: fact.year, source: t(`scene.source.${fact.source}`, fact.source) }, "Year: {year} (from {source})");
        case "shape": {
          const percent = (value) => (Number.isFinite(value) ? `${Math.round(value * 100)}%` : "–");
          return t("scene.fact.shape", {
            up: percent(fact.up),
            down: percent(fact.down),
            sideways: percent(fact.sideways),
            ground: percent(fact.groundCover),
            enclosure: percent(fact.enclosure),
          }, "Geometry: faces up {up}, down {down}, sideways {sideways}; ground {ground} of the footprint; walls seen from inside {enclosure} of directions");
        }
        case "semantic": return t("scene.fact.semantic", { model: fact.model }, "Texts read by a language model ({model}, in the browser)");
        case "keywords": return t("scene.fact.keywords", { words: fact.words.map((word) => `„${word}”`).join(", ") }, "Words found: {words}");
        case "setting": return t("scene.fact.setting", {
          setting: t(`scene.setting.${fact.setting}`, fact.setting),
          confidence: Viewer.describeSceneConfidence(fact.confidence),
        }, "Setting: {setting} ({confidence})");
        default: return fact.key;
      }
    },

    formatSceneMeters(meters) {
      if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
      if (meters >= 1) return `${meters.toFixed(1)} m`;
      if (meters >= 0.01) return `${(meters * 100).toFixed(1)} cm`;
      return `${(meters * 1000).toFixed(1)} mm`;
    },

    describeSceneConfidence(confidence) {
      if (confidence >= 0.75) return t("scene.confidence.high", "sure");
      if (confidence >= 0.5) return t("scene.confidence.medium", "fairly sure");
      return t("scene.confidence.low", "unsure");
    },

    // What an item sets, in words.
    describeSceneValue(item) {
      const off = t("scene.off", "off");
      const value = item.value;
      switch (item.key) {
        case "sun": {
          if (!value.enabled) return off;
          const parts = [];
          const time = value.time;
          if (time?.anchor === "clock") parts.push(formatSunTime(time.minutes));
          else if (time) {
            const hours = Math.abs(time.offset || 0) / 60;
            const amount = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
            parts.push(t(`scene.sunTime.${time.anchor}${(time.offset || 0) < 0 ? "Before" : "After"}`, { hours: amount }, `{hours} h ${(time.offset || 0) < 0 ? "before" : "after"} ${time.anchor}`));
          }
          parts.push(t(`scene.season.${["winter", "spring", "summer", "autumn"][[1, 4, 7, 10].indexOf(value.month)] || "summer"}`, ""));
          if (value.followTimeline) parts.push(t("scene.sunYearTimeline", "the timeline's year"));
          else if (value.year != null) parts.push(String(value.year));
          return parts.filter(Boolean).join(", ");
        }
        case "weather": {
          if (!value.enabled) return off;
          const type = t(`weather.${value.type}`, value.type);
          return value.type === "clear" ? type : `${type}, ${Math.round(value.intensity * 100)}%`;
        }
        case "rakingLight": return value.enabled ? t("scene.on", "on") : off;
        case "toneMapping": return value.toneMapping === "agx" ? "AgX" : t("gui.toneMappingNeutral", "Neutral");
        case "ao": return value.ao ? t("scene.on", "on") : off;
        default: return "";
      }
    },

    syncSceneSuggestPanel() {
      const ui = Viewer.sceneSuggestPanel;
      const state = Viewer.sceneSuggestion;
      if (!ui || !state.result) return;
      const result = state.result;
      Object.entries(ui.purposeButtons).forEach(([purpose, button]) => {
        const active = purpose === result.purpose;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-checked", active ? "true" : "false");
        const name = t(`scene.purpose.${purpose}`, purpose);
        button.textContent = purpose === result.autoPurpose ? `${name} ${t("scene.suggested", "(suggested)")}` : name;
      });

      const itemNames = {
        sun: t("sun.title", "Sun and shadows"),
        weather: t("weather.title", "Weather"),
        rakingLight: t("gui.rakingLight", "Raking light"),
        toneMapping: t("gui.toneMapping", "Tone mapping"),
        ao: t("gui.ambientOcclusion", "Ambient occlusion"),
      };
      ui.list.replaceChildren(...result.items.map((item) => {
        const row = document.createElement("li");
        row.className = "viewer-scene_item";
        row.dataset.item = item.key;
        row.classList.toggle("is-unchanged", !item.changes);
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = state.selected.has(item.key);
        input.disabled = !item.changes;
        input.addEventListener("change", () => {
          if (input.checked) state.selected.add(item.key);
          else state.selected.delete(item.key);
          Viewer.syncSceneSuggestActions();
        });
        const name = document.createElement("span");
        name.className = "viewer-scene_item-name";
        name.textContent = itemNames[item.key] || item.key;
        const value = document.createElement("span");
        value.className = "viewer-scene_item-value";
        value.textContent = Viewer.describeSceneValue(item);
        const confidence = document.createElement("span");
        confidence.className = "viewer-scene_confidence";
        confidence.dataset.level = item.confidence >= 0.75 ? "high" : item.confidence >= 0.5 ? "medium" : "low";
        confidence.textContent = item.changes ? Viewer.describeSceneConfidence(item.confidence) : t("scene.unchanged", "as it is");
        label.append(input, name, value, confidence);
        const why = document.createElement("span");
        why.className = "viewer-scene_reasons";
        why.textContent = item.reasons.map((reason) => Viewer.describeSceneReason(reason)).join("; ");
        row.append(label, why);
        return row;
      }));

      const notes = result.uncertain.map((note) => t(`scene.uncertain.${note.key}`, {
        name: [note.name, note.country].filter(Boolean).join(", "),
      }, note.key));
      ui.uncertain.textContent = notes.join(" ");
      ui.uncertain.hidden = notes.length === 0;
      ui.basisList.replaceChildren(...result.basis.map((fact) => {
        const row = document.createElement("li");
        row.textContent = Viewer.describeSceneFact(fact);
        return row;
      }));
      Viewer.syncSceneSuggestActions();
    },

    syncSceneSuggestActions() {
      const ui = Viewer.sceneSuggestPanel;
      if (!ui) return;
      ui.applyButton.disabled = Viewer.sceneSuggestion.selected.size === 0;
      ui.undoButton.hidden = !Viewer.sceneSuggestion.undo;
    },

    // Before a new model: what was suggested was for the old one.
    disposeSceneSuggest() {
      Viewer.removeSceneSuggestPanel();
      Object.assign(Viewer.sceneSuggestion, {
        purpose: null, result: null, selected: new Set(), undo: null, place: null, placeLookup: null, placeToken: null,
        semantic: null, semanticState: "idle", semanticProgress: 0, semanticToken: null, shape: undefined,
      });
    },
  });
}

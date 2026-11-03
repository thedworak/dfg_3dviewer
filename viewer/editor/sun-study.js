import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { getViewerSideStack } from "../ui/side-stack.js";
import { attachToolPanelChrome, PANEL_ICONS, refreshToolPanelChrome } from "../ui/tool-panel-chrome.js";
import { HORIZON, RAD, formatSunTime, solarPosition, sunTimestamp, sunriseSunset } from "../sun-position.js";

// Sun and shadows (Lights > Sun and shadows): the sun where it stood at a
// place on a day and hour, casting shadows on the model and the ground. With
// a 4D timeline (timeline.js) the year is the timeline's, so a building can
// be seen lit as it was in its own time.
//
// The place is AIM3DViewer.location (latitude, longitude, the direction of
// north in the scene, the time zone); the day and hour AIM3DViewer.sun. North
// is -Z of the scene turned clockwise (seen from above) by `north` degrees;
// the model's up is +Y. The solar position follows the Astronomical
// Almanac's low-precision formulas, good to a fraction of a degree, which is
// plenty for shadows; dates before 1582 are taken as proleptic Gregorian.
//
// While the sun is on, the viewer's other lights and the environment are
// dimmed to a sky light, and the renderer's shadow map is switched on.

// Full strength above this elevation; fades out towards the horizon.
const FULL_ELEVATION = 12;
const SUN_INTENSITY = 3;
// What the other lights and the environment keep: by day, by night.
const DAY_DIM = 0.3;
const NIGHT_DIM = 0.06;
// Minutes of the day per second while the day plays.
const PLAY_SPEED = 60;
const SHADOW_MAP_SIZE = 2048;

export const DEFAULT_LOCATION = Object.freeze({ latitude: 50, longitude: 10, north: 0 });
export const SUN_DEFAULTS = Object.freeze({ followTimeline: true });

// The astronomy itself (no three.js, no viewer): sun-position.js, shared
// with the intro page.
export { formatSunTime, solarPosition, sunTimestamp, sunriseSunset };

const pad = (value) => String(value).padStart(2, "0");

// The day and hour now at a place `utcOffset` hours ahead of UTC: the sun's
// default, unless a manifest or the panel gives another.
export function sunNow(utcOffset = 0, now = Date.now()) {
  const local = new Date(now + utcOffset * 3600000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

const horizonColor = new THREE.Color(0xffb36b);
const noonColor = new THREE.Color(0xfff6e8);

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function finite(value, fallback = null) {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : fallback;
}

// "14:30" -> 870; null when unreadable.
export function parseSunTime(value) {
  const match = String(value ?? "").match(/^\s*(\d{1,2}):(\d{2})\s*$/);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes >= 0 && minutes <= 1440 ? minutes : null;
}

// "06-21" or "1783-06-21" -> { year?, month, day }; null when unreadable.
export function parseSunDate(value) {
  const match = String(value ?? "").match(/^\s*(?:(-?\d{1,4})-)?(\d{1,2})-(\d{1,2})\s*$/);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { ...(match[1] != null ? { year: Number(match[1]) } : {}), month, day };
}

// Unit vector towards the sun in the scene.
export function sunDirection({ elevation, azimuth }, north = 0, target = new THREE.Vector3()) {
  const bearing = (azimuth + north) * RAD;
  const height = elevation * RAD;
  return target.set(Math.cos(height) * Math.sin(bearing), Math.sin(height), -Math.cos(height) * Math.cos(bearing));
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function attachSunStudy(Viewer) {
  Object.assign(Viewer, {
    sunStudy: {
      enabled: false,
      latitude: DEFAULT_LOCATION.latitude,
      longitude: DEFAULT_LOCATION.longitude,
      north: DEFAULT_LOCATION.north,
      utcOffset: null,
      ...sunNow(Math.round(DEFAULT_LOCATION.longitude / 15)),
      followTimeline: SUN_DEFAULTS.followTimeline,
      playing: false,
      // A place set by a manifest or by hand (exported).
      locationSet: false,
      // A day or hour set by a manifest, by hand or by playing the day;
      // until then the sun is switched on at the time it is at the place.
      dateSet: false,
    },
    sunObjects: null,

    // The time zone: the manifest's, else the longitude's (15° an hour).
    getSunUtcOffset() {
      const state = Viewer.sunStudy;
      return state.utcOffset != null ? state.utcOffset : Math.round(state.longitude / 15);
    },

    // The year the sun is computed for: the timeline's while it follows it.
    getSunYear() {
      const state = Viewer.sunStudy;
      const year = state.followTimeline ? Viewer.getTimelineYear?.() : null;
      return Number.isFinite(year) ? Math.round(year) : state.year;
    },

    getSunPosition() {
      const state = Viewer.sunStudy;
      const timestamp = sunTimestamp({
        year: Viewer.getSunYear(),
        month: state.month,
        day: state.day,
        minutes: state.minutes,
        utcOffset: Viewer.getSunUtcOffset(),
      });
      return solarPosition(timestamp, state.latitude, state.longitude);
    },

    setSunStudy(enabled) {
      const on = enabled === true;
      if (on === Viewer.sunStudy.enabled) return on;
      if (on) Viewer.enableSunStudy();
      else Viewer.disableSunStudy();
      Viewer.updateLightsSubmenuState?.();
      return on;
    },

    // Any of the date, time and place; the rest stays.
    setSunOptions(options = {}) {
      const state = Viewer.sunStudy;
      const date = typeof options.date === "string" ? parseSunDate(options.date) : null;
      if (date) {
        state.month = date.month;
        state.day = date.day;
        if (date.year != null) state.year = date.year;
        state.dateSet = true;
      }
      ["year", "month", "day"].forEach((key) => {
        const value = finite(options[key]);
        if (value != null) {
          state[key] = Math.round(value);
          state.dateSet = true;
        }
      });
      state.month = Math.min(Math.max(state.month, 1), 12);
      state.day = Math.min(Math.max(state.day, 1), 31);
      const minutes = typeof options.time === "string" ? parseSunTime(options.time) : finite(options.minutes);
      if (minutes != null) {
        state.minutes = Math.min(Math.max(minutes, 0), 1440);
        state.dateSet = true;
      }
      const latitude = finite(options.latitude);
      const longitude = finite(options.longitude);
      if (latitude != null) {
        state.latitude = Math.min(Math.max(latitude, -90), 90);
        state.locationSet = true;
      }
      if (longitude != null) {
        state.longitude = ((longitude + 540) % 360) - 180;
        state.locationSet = true;
      }
      const north = finite(options.north);
      if (north != null) state.north = ((north % 360) + 360) % 360;
      if (options.utcOffset === null) state.utcOffset = null;
      else if (finite(options.utcOffset) != null) state.utcOffset = finite(options.utcOffset);
      if (typeof options.followTimeline === "boolean") state.followTimeline = options.followTimeline;
      Viewer.updateSunStudy(0, { force: true });
      Viewer.syncSunPanel(true);
    },

    playSunDay(playing = !Viewer.sunStudy.playing) {
      Viewer.sunStudy.playing = playing === true && Viewer.sunStudy.enabled;
      if (Viewer.sunStudy.playing) Viewer.sunStudy.dateSet = true;
      Viewer.syncSunPanel(true);
    },

    enableSunStudy() {
      if (!core.scene) return;
      const state = Viewer.sunStudy;
      if (!state.dateSet) Object.assign(state, sunNow(Viewer.getSunUtcOffset()));
      // Both dim the other lights: one at a time.
      Viewer.setRakingLight?.(false);
      const dimmed = [];
      core.scene.traverse((object) => {
        if (!object.isLight || object.userData?.isSunLight) return;
        dimmed.push({ light: object, intensity: object.intensity });
      });
      const light = new THREE.DirectionalLight(0xffffff, SUN_INTENSITY);
      light.name = "sun-light";
      light.userData.isSunLight = true;
      light.castShadow = true;
      light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
      light.shadow.bias = -0.0005;
      light.shadow.normalBias = 0.02;
      const target = new THREE.Object3D();
      target.name = "sun-light-target";
      light.target = target;
      core.scene.add(light, target);

      const renderer = core.renderer;
      const shadowMap = renderer ? { enabled: renderer.shadowMap.enabled, type: renderer.shadowMap.type } : null;
      if (renderer) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.shadowMap.needsUpdate = true;
      }
      // Every mesh of the model casts and takes shadows (the loaders set
      // this only for some formats).
      const shadowFlags = [];
      Viewer.getSunModelRoots().forEach((root) => root.traverse((object) => {
        if (!object.isMesh) return;
        shadowFlags.push({ object, castShadow: object.castShadow, receiveShadow: object.receiveShadow });
        object.castShadow = true;
        object.receiveShadow = true;
      }));
      Viewer.sunObjects = {
        light,
        target,
        dimmed,
        shadowMap,
        shadowFlags,
        environmentIntensity: core.scene.environmentIntensity,
        appliedEnvironment: null,
        shownKey: "",
      };
      Viewer.sunStudy.enabled = true;
      Viewer.updateSunStudy(0, { force: true });
      if (Viewer.urlOptions?.hideUi !== true) Viewer.createSunPanel();
    },

    disableSunStudy() {
      const objects = Viewer.sunObjects;
      Viewer.sunStudy.enabled = false;
      Viewer.sunStudy.playing = false;
      Viewer.sunObjects = null;
      Viewer.removeSunPanel();
      if (!objects) return;
      objects.light.removeFromParent();
      objects.target.removeFromParent();
      objects.light.dispose();
      objects.dimmed.forEach(({ light, intensity }) => {
        if (light.parent) light.intensity = intensity;
      });
      objects.shadowFlags.forEach(({ object, castShadow, receiveShadow }) => {
        object.castShadow = castShadow;
        object.receiveShadow = receiveShadow;
      });
      if (core.scene) core.scene.environmentIntensity = objects.environmentIntensity;
      if (core.renderer && objects.shadowMap) {
        core.renderer.shadowMap.enabled = objects.shadowMap.enabled;
        core.renderer.shadowMap.type = objects.shadowMap.type;
        core.renderer.shadowMap.needsUpdate = true;
      }
    },

    getSunModelRoots() {
      const slots = Array.isArray(core.mainObject) ? core.mainObject : [core.mainObject];
      return slots.flat().filter((item) => item?.isObject3D);
    },

    // Every frame (main.js animate): the day playing, the timeline's year,
    // a light or environment set meanwhile.
    updateSunStudy(delta = 0, { force = false } = {}) {
      const objects = Viewer.sunObjects;
      const state = Viewer.sunStudy;
      if (!objects || !core.scene) return;
      if (state.playing && delta > 0) {
        state.minutes = (state.minutes + PLAY_SPEED * delta) % 1440;
      }
      const position = Viewer.getSunPosition();
      const key = [position.elevation.toFixed(3), position.azimuth.toFixed(3), state.north, core.gridSize].join("|");
      // The environment changed by someone else: kept as the one to restore.
      if (objects.appliedEnvironment != null && core.scene.environmentIntensity !== objects.appliedEnvironment) {
        objects.environmentIntensity = core.scene.environmentIntensity;
        force = true;
      }
      if (!force && key === objects.shownKey) {
        if (state.playing) Viewer.syncSunPanel();
        return;
      }
      objects.shownKey = key;

      // Lights added meanwhile (a manifest's) are dimmed too.
      core.scene.traverse((object) => {
        if (!object.isLight || object.userData?.isSunLight) return;
        if (!objects.dimmed.some((entry) => entry.light === object)) objects.dimmed.push({ light: object, intensity: object.intensity });
      });
      const daylight = THREE.MathUtils.clamp((position.elevation - HORIZON) / (FULL_ELEVATION - HORIZON), 0, 1);
      const dim = NIGHT_DIM + (DAY_DIM - NIGHT_DIM) * daylight;
      objects.dimmed.forEach(({ light, intensity }) => {
        light.intensity = intensity * dim;
      });
      core.scene.environmentIntensity = objects.environmentIntensity * dim;
      objects.appliedEnvironment = core.scene.environmentIntensity;

      const light = objects.light;
      light.intensity = SUN_INTENSITY * daylight;
      light.color.copy(horizonColor).lerp(noonColor, THREE.MathUtils.clamp(position.elevation / 30, 0, 1));
      light.visible = daylight > 0;

      // Aimed at the model; the shadow camera wraps its bounding sphere.
      const box = new THREE.Box3();
      Viewer.getSunModelRoots().forEach((root) => box.expandByObject(root));
      const sphere = box.isEmpty() ? new THREE.Sphere(new THREE.Vector3(), core.gridSize || 1) : box.getBoundingSphere(new THREE.Sphere());
      // The ground (viewer-utils.js) reaches out to 1.25 grid sizes.
      const radius = Math.max(sphere.radius * 1.6, 0.001);
      const direction = sunDirection(position, state.north);
      objects.target.position.copy(sphere.center);
      light.position.copy(sphere.center).addScaledVector(direction, radius * 3);
      objects.target.updateMatrixWorld();
      const camera = light.shadow.camera;
      camera.left = -radius;
      camera.right = radius;
      camera.top = radius;
      camera.bottom = -radius;
      camera.near = radius * 0.5;
      camera.far = radius * 6;
      camera.updateProjectionMatrix();
      light.shadow.needsUpdate = true;
      Viewer.syncSunPanel();
    },

    // ---- panel ----------------------------------------------------------------

    createSunPanel() {
      if (Viewer.sunPanel || !core.container) return;
      const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
      };
      const panel = el("section", "viewer-sun");
      panel.id = "viewerSun";
      panel.setAttribute("role", "group");
      const header = el("div", "viewer-sun_header");
      const title = el("span", "viewer-sun_title");
      const clock = el("output", "viewer-sun_clock");
      const closeButton = el("button", "viewer-sun_icon", "×");
      closeButton.type = "button";
      header.append(title, clock, closeButton);

      const timeRow = el("div", "viewer-sun_row");
      const playButton = el("button", "viewer-sun_play");
      playButton.type = "button";
      const time = el("input", "viewer-sun_time");
      time.type = "range";
      time.min = "0";
      time.max = "1440";
      time.step = "5";
      timeRow.append(playButton, time);

      const dateRow = el("div", "viewer-sun_row");
      const dateLabel = el("label", "viewer-sun_field");
      const dateText = el("span");
      const date = el("input");
      date.type = "date";
      dateLabel.append(dateText, date);
      const followLabel = el("label", "viewer-sun_field viewer-sun_check");
      const follow = el("input");
      follow.type = "checkbox";
      const followText = el("span");
      followLabel.append(follow, followText);
      dateRow.append(dateLabel, followLabel);

      const placeRow = el("div", "viewer-sun_row");
      const field = (step, min, max) => {
        const label = el("label", "viewer-sun_field");
        const text = el("span");
        const input = el("input");
        input.type = "number";
        input.step = step;
        input.min = min;
        input.max = max;
        label.append(text, input);
        placeRow.append(label);
        return { label, text, input };
      };
      const latitude = field("0.0001", "-90", "90");
      const longitude = field("0.0001", "-180", "180");
      const north = field("1", "0", "359");
      const readout = el("p", "viewer-sun_readout");
      panel.append(header, timeRow, dateRow, placeRow, readout);

      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        panel.addEventListener(type, (event) => event.stopPropagation());
      });
      closeButton.addEventListener("click", () => Viewer.setSunStudy(false));
      playButton.addEventListener("click", () => Viewer.playSunDay());
      time.addEventListener("input", () => {
        Viewer.playSunDay(false);
        Viewer.setSunOptions({ minutes: Number(time.value) });
      });
      date.addEventListener("change", () => {
        const parsed = parseSunDate(date.value);
        if (parsed) Viewer.setSunOptions(parsed);
      });
      follow.addEventListener("change", () => Viewer.setSunOptions({ followTimeline: follow.checked }));
      latitude.input.addEventListener("change", () => Viewer.setSunOptions({ latitude: latitude.input.value }));
      longitude.input.addEventListener("change", () => Viewer.setSunOptions({ longitude: longitude.input.value }));
      north.input.addEventListener("change", () => Viewer.setSunOptions({ north: north.input.value }));

      attachToolPanelChrome(panel, header, {
        before: closeButton,
        icon: PANEL_ICONS.sun,
        label: () => t("sun.title", "Sun and shadows"),
      });
      getViewerSideStack()?.append(panel);
      Viewer.sunPanel = {
        panel, title, clock, closeButton, playButton, time, dateText, date, follow, followLabel, followText,
        latitude, longitude, north, readout, shown: "",
      };
      Viewer.updateSunLabels();
    },

    removeSunPanel() {
      Viewer.sunPanel?.panel.remove();
      Viewer.sunPanel = null;
    },

    updateSunLabels() {
      const ui = Viewer.sunPanel;
      if (!ui) return;
      ui.panel.setAttribute("aria-label", t("sun.title", "Sun and shadows"));
      ui.title.textContent = t("sun.title", "Sun and shadows");
      refreshToolPanelChrome(ui.panel);
      ui.closeButton.title = t("sun.close", "Switch the sun off");
      ui.closeButton.setAttribute("aria-label", ui.closeButton.title);
      ui.time.setAttribute("aria-label", t("sun.time", "Time of day"));
      ui.dateText.textContent = t("sun.date", "Day");
      ui.followText.textContent = t("sun.followTimeline", "Year of the timeline");
      ui.latitude.text.textContent = t("sun.latitude", "Latitude");
      ui.longitude.text.textContent = t("sun.longitude", "Longitude");
      ui.north.text.textContent = t("sun.north", "North (°)");
      ui.north.label.title = t("sun.northHint", "Where north lies in the scene: degrees clockwise from -Z, seen from above");
      Viewer.syncSunPanel(true);
    },

    syncSunPanel(force = false) {
      const ui = Viewer.sunPanel;
      const state = Viewer.sunStudy;
      if (!ui) return;
      const year = Viewer.getSunYear();
      const hasTimeline = Viewer.hasTimeline?.() === true;
      const key = [state.minutes.toFixed(1), year, state.month, state.day, state.latitude, state.longitude, state.north, state.playing, state.followTimeline, hasTimeline, core.currentLanguage].join("|");
      if (!force && key === ui.shown) return;
      ui.shown = key;
      const position = Viewer.getSunPosition();
      ui.clock.textContent = formatSunTime(state.minutes);
      if (document.activeElement !== ui.time) ui.time.value = String(Math.round(state.minutes));
      ui.time.setAttribute("aria-valuetext", ui.clock.textContent);
      const playLabel = state.playing ? t("sun.pause", "Pause the day") : t("sun.play", "Play the day");
      ui.playButton.textContent = state.playing ? "❚❚" : "▶";
      ui.playButton.title = playLabel;
      ui.playButton.setAttribute("aria-label", playLabel);
      // <input type="date"> takes years 0001-9999 only.
      const shownYear = Math.min(Math.max(year, 1), 9999);
      const dateValue = `${String(shownYear).padStart(4, "0")}-${pad(state.month)}-${pad(state.day)}`;
      if (document.activeElement !== ui.date) ui.date.value = dateValue;
      ui.followLabel.hidden = !hasTimeline;
      ui.follow.checked = state.followTimeline;
      if (document.activeElement !== ui.latitude.input) ui.latitude.input.value = String(Math.round(state.latitude * 10000) / 10000);
      if (document.activeElement !== ui.longitude.input) ui.longitude.input.value = String(Math.round(state.longitude * 10000) / 10000);
      if (document.activeElement !== ui.north.input) ui.north.input.value = String(Math.round(state.north));
      const { sunrise, sunset } = sunriseSunset({
        year, month: state.month, day: state.day, utcOffset: Viewer.getSunUtcOffset(), latitude: state.latitude, longitude: state.longitude,
      });
      const compass = COMPASS[Math.round(position.azimuth / 45) % 8];
      const parts = [
        t("sun.position", { azimuth: Math.round(position.azimuth), compass, elevation: Math.round(position.elevation) }, "Sun {azimuth}° {compass}, {elevation}° above the horizon"),
      ];
      if (position.elevation < HORIZON) parts[0] = t("sun.night", "The sun is below the horizon");
      if (sunrise != null || sunset != null) {
        parts.push(t("sun.riseSet", { sunrise: sunrise != null ? formatSunTime(sunrise) : "–", sunset: sunset != null ? formatSunTime(sunset) : "–" }, "sunrise {sunrise}, sunset {sunset}"));
      }
      const offset = Viewer.getSunUtcOffset();
      parts.push(`UTC${offset >= 0 ? "+" : "−"}${Math.abs(offset)}`);
      ui.readout.textContent = parts.join(" · ");
    },

    // ---- manifests ------------------------------------------------------------

    // AIM3DViewer.location of an exported manifest, when a place is set.
    getLocationForExport() {
      const state = Viewer.sunStudy;
      if (!state.locationSet) return undefined;
      return {
        latitude: Math.round(state.latitude * 1e6) / 1e6,
        longitude: Math.round(state.longitude * 1e6) / 1e6,
        ...(state.north ? { north: Math.round(state.north * 100) / 100 } : {}),
        ...(state.utcOffset != null ? { utcOffset: state.utcOffset } : {}),
      };
    },

    // AIM3DViewer.sun of an exported manifest: only while it is on.
    getSunForExport() {
      const state = Viewer.sunStudy;
      if (!state.enabled) return undefined;
      return {
        enabled: true,
        date: state.followTimeline && Viewer.hasTimeline?.()
          ? `${pad(state.month)}-${pad(state.day)}`
          : `${state.year}-${pad(state.month)}-${pad(state.day)}`,
        time: formatSunTime(state.minutes),
        ...(state.followTimeline ? {} : { followTimeline: false }),
      };
    },

    // A manifest's location and sun (absent: the default place, sun off).
    apply3IFManifestSun(location, sun) {
      const state = Viewer.sunStudy;
      Object.assign(state, { ...DEFAULT_LOCATION, utcOffset: null, locationSet: false });
      if (isPlainObject(location)) {
        Viewer.setSunOptions({
          latitude: location.latitude,
          longitude: location.longitude,
          north: location.north,
          utcOffset: location.utcOffset ?? null,
        });
      }
      if (!isPlainObject(sun) || sun.enabled === false) {
        Viewer.setSunStudy(false);
        return isPlainObject(location);
      }
      // What the manifest leaves out is now, at its place.
      Object.assign(state, sunNow(Viewer.getSunUtcOffset()), { dateSet: false });
      state.followTimeline = sun.followTimeline !== false;
      Viewer.setSunOptions({ date: sun.date, time: sun.time });
      Viewer.setSunStudy(true);
      if (sun.animate === true) Viewer.playSunDay(true);
      return true;
    },

    // Before a new model: its lights are rebuilt, the sun goes with them.
    disposeSunStudy() {
      Viewer.setSunStudy(false);
    },
  });
}

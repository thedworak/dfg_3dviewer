import { core } from "../core.js";
import { reportViewerError } from "../viewer-utils.js";
import { WEATHER_DEFAULTS, WEATHER_TYPES } from "./weather-config.js";

// The weather (editor/weather.js) is downloaded only when it is first used:
// its window opened, a manifest or a scene suggestion turning it on, or
// ?weather=... in the URL. Until then this stub stands in for its part of
// the Viewer: the state the toolbar, publish check and scene suggestions
// read, and methods that either do nothing (the weather can't be on yet) or
// load the weather and then call the real method. Calls made while it is
// downloading are run in the order they came, once it is there.
//
// attachWeather() replaces every one of these with the real thing.

export function attachWeatherLazy(Viewer) {
  const urlType = (() => {
    try {
      return new URL(window.location.href).searchParams.get("weather");
    } catch (_error) {
      return null;
    }
  })();
  const pending = WEATHER_TYPES.includes(urlType) ? urlType : null;

  let loading = null;
  const load = () => {
    loading ??= import("./weather.js")
      .then(({ attachWeather }) => {
        attachWeather(Viewer);
        Viewer.updateEditorToolbarState?.();
      })
      .catch((error) => {
        // Offline or a failed download: tried again on the next use.
        loading = null;
        reportViewerError(error, { context: "Weather", consoleLabel: "Weather failed to load" });
        throw error;
      });
    return loading;
  };
  // The real method, once loaded.
  const deferred = (name) => (...args) => {
    load().then(() => Viewer[name](...args), () => {});
    return false;
  };

  Object.assign(Viewer, {
    weather: { enabled: false, ...WEATHER_DEFAULTS, pending },
    weatherObjects: null,
    weatherPanel: null,

    // Starts the download ahead of a click (hovering the toolbar button).
    preloadWeather() {
      return load().catch(() => {});
    },

    // As in weather.js: with WebGPU, once its TSL side is loaded
    // (renderer-backend.js).
    isWeatherAvailable() {
      return core.rendererBackend !== "webgpu" || Boolean(core.weatherWebGPU);
    },

    setWeather(enabled) {
      // Off is already so, unless calls are waiting for the download.
      if (enabled !== true && !loading) return false;
      return deferred("setWeather")(enabled);
    },
    setWeatherOptions: deferred("setWeatherOptions"),
    toggleWeatherPanel: deferred("toggleWeatherPanel"),

    apply3IFManifestWeather(weather) {
      const valid = weather && typeof weather === "object" && !Array.isArray(weather) && WEATHER_TYPES.includes(weather.type);
      if (!valid) {
        Viewer.setWeather(false);
        return false;
      }
      deferred("apply3IFManifestWeather")(weather);
      return true;
    },

    // Nothing to do while the weather has never been on.
    isWeatherPanelOpen: () => false,
    getWeatherForExport: () => undefined,
    updateWeather() {},
    updateWeatherLabels() {},
    syncWeatherPanel() {},
    disposeWeather() {
      Viewer.setWeather(false);
    },
  });

  // ?weather=rain: right away, so it is there when the first model is.
  if (pending) load().catch(() => {});
}

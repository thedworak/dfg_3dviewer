// The weather's types and defaults: shared by the always-loaded stub
// (editor/weather-lazy.js) and the weather itself (editor/weather.js), which
// is only downloaded when the weather is first used.

export const WEATHER_TYPES = ["clear", "fog", "rain", "snow", "storm"];
export const WEATHER_DEFAULTS = Object.freeze({
  type: "rain",
  intensity: 0.6,
  wind: 0.2,
  windDirection: 230,
  sky: true,
  surfaces: true,
  sound: false,
  // The mist's height (0..1: 0.15 to 1.15 model sizes) and density.
  mistHeight: 0.4,
  mistDensity: 0.5,
  // 0: clumps with gaps (low clouds); 1: an even blanket thinning upwards.
  mistSpread: 0.6,
});

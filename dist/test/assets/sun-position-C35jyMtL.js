// The sun's position for a place, day and hour - the astronomy of the
// viewer's sun study (editor/sun-study.js), on its own so that pages without
// the viewer (the intro, viewer/intro/feature-tour.js) can use it too.
//
// The Astronomical Almanac's low-precision formulas, good to a fraction of a
// degree; dates before 1582 are taken as proleptic Gregorian.

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
// The sun's centre this far below the horizon at sunrise and sunset
// (refraction and its radius).
const HORIZON = -0.833;

const pad = (value) => String(value).padStart(2, "0");

function formatSunTime(minutes) {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

// Milliseconds since 1970 (UTC) of a local date and time, `utcOffset` hours
// ahead of UTC. Years below 100 stay themselves (Date.UTC would add 1900).
function sunTimestamp({ year, month, day, minutes, utcOffset = 0 }) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime() + (minutes - utcOffset * 60) * 60000;
}

// Sun position at `timestamp` (ms, UTC) seen from latitude / longitude
// (degrees): elevation above the horizon and azimuth from north, clockwise,
// both in degrees. The Astronomical Almanac's low-precision formulas: the
// mean longitude runs at the tropical rate, so the seasons stay right
// centuries away from J2000.
function solarPosition(timestamp, latitude, longitude) {
  const days = timestamp / DAY_MS - 0.5 + J1970 - J2000;
  const meanLongitude = RAD * (280.46 + 0.9856474 * days);
  const meanAnomaly = RAD * (357.528 + 0.9856003 * days);
  const eclipticLongitude = meanLongitude + RAD * (1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly));
  const obliquity = RAD * (23.439 - 0.0000004 * days);
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude));
  const sidereal = RAD * (280.46061837 + 360.98564736629 * days) + RAD * longitude;
  const hourAngle = sidereal - rightAscension;
  const phi = RAD * latitude;
  const elevation = Math.asin(Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle));
  // From south, westwards; turned to a compass bearing.
  const fromSouth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi));
  const azimuth = ((fromSouth / RAD + 180) % 360 + 360) % 360;
  return { elevation: elevation / RAD, azimuth };
}

// Sunrise and sunset (minutes of the local day), or null for polar day / night.
function sunriseSunset({ year, month, day, utcOffset, latitude, longitude }) {
  const start = sunTimestamp({ year, month, day, minutes: 0, utcOffset });
  let sunrise = null;
  let sunset = null;
  let previous = solarPosition(start, latitude, longitude).elevation - HORIZON;
  for (let minutes = 2; minutes <= 1440; minutes += 2) {
    const current = solarPosition(start + minutes * 60000, latitude, longitude).elevation - HORIZON;
    if (previous < 0 && current >= 0 && sunrise == null) sunrise = minutes - 2 * (current / (current - previous));
    if (previous >= 0 && current < 0) sunset = minutes - 2 * (current / (current - previous));
    previous = current;
  }
  return { sunrise, sunset };
}

export { HORIZON as H, RAD as R, solarPosition as a, sunTimestamp as b, formatSunTime as f, sunriseSunset as s };
//# sourceMappingURL=sun-position-DGWhgYI_.js.map

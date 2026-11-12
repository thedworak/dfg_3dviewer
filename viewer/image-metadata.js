// What an image file says about itself (image2d.js): its size, its
// resolution - from which its size on paper or on the object, for the ruler -
// and its descriptive tags, read from the header without decoding it.
//
//   JPEG  JFIF density; EXIF (camera, lens, exposure, date, GPS, artist,
//         copyright, description, orientation, resolution)
//   PNG   IHDR (size, bit depth), pHYs (pixels per metre), tEXt / iTXt
//         (Title, Author, Description, Copyright, Creation Time, Software),
//         eXIf (EXIF as in a JPEG)
//   WebP  VP8X / VP8 / VP8L size, EXIF chunk
//   GIF, BMP, AVIF: the size the browser decodes (image2d.js)
//
// Nothing here throws on a damaged header: what could be read is returned.

export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif", "gif", "bmp"];

export const isImageExtension = (extension) => IMAGE_EXTENSIONS.includes(String(extension || "").toLowerCase());

export const isImageFileName = (name) => isImageExtension(String(name || "").split(/[?#]/)[0].split(".").pop());

const ascii = (bytes, start, length) => {
  let text = "";
  for (let i = start; i < start + length && i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
  return text;
};
const latin1 = new TextDecoder("latin1");
const utf8 = new TextDecoder("utf-8");
const clean = (text) => String(text || "").replace(/\0+$/, "").trim();

// ---- EXIF (a TIFF structure) ----

const TYPE_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function readIfd(view, tiff, offset, little) {
  const entries = new Map();
  if (offset + 2 > view.byteLength) return { entries, next: 0 };
  const count = view.getUint16(offset, little);
  for (let i = 0; i < count; i++) {
    const at = offset + 2 + i * 12;
    if (at + 12 > view.byteLength) break;
    const tag = view.getUint16(at, little);
    const type = view.getUint16(at + 2, little);
    const n = view.getUint32(at + 4, little);
    const size = (TYPE_SIZES[type] || 1) * n;
    const valueAt = size > 4 ? tiff + view.getUint32(at + 8, little) : at + 8;
    if (valueAt + size > view.byteLength) continue;
    let value;
    if (type === 2) {
      value = clean(latin1.decode(new Uint8Array(view.buffer, view.byteOffset + valueAt, n)));
    } else if (type === 3) {
      value = Array.from({ length: n }, (_v, k) => view.getUint16(valueAt + k * 2, little));
    } else if (type === 4 || type === 9) {
      value = Array.from({ length: n }, (_v, k) => (type === 4 ? view.getUint32(valueAt + k * 4, little) : view.getInt32(valueAt + k * 4, little)));
    } else if (type === 5 || type === 10) {
      value = Array.from({ length: n }, (_v, k) => {
        const numerator = type === 5 ? view.getUint32(valueAt + k * 8, little) : view.getInt32(valueAt + k * 8, little);
        const denominator = type === 5 ? view.getUint32(valueAt + k * 8 + 4, little) : view.getInt32(valueAt + k * 8 + 4, little);
        return denominator ? numerator / denominator : 0;
      });
    } else {
      value = Array.from(new Uint8Array(view.buffer, view.byteOffset + valueAt, n));
    }
    entries.set(tag, Array.isArray(value) && value.length === 1 ? value[0] : value);
  }
  const nextAt = offset + 2 + count * 12;
  return { entries, next: nextAt + 4 <= view.byteLength ? view.getUint32(nextAt, little) : 0 };
}

const gpsDegrees = (value, ref) => {
  if (!Array.isArray(value) || value.length < 3) return null;
  const degrees = value[0] + value[1] / 60 + value[2] / 3600;
  return ref === "S" || ref === "W" ? -degrees : degrees;
};

// EXIF from a TIFF structure at bytes[start..] into info.
export function readExif(bytes, start, info) {
  const view = new DataView(bytes.buffer, bytes.byteOffset + start, bytes.byteLength - start);
  const order = ascii(bytes, start, 2);
  if (order !== "II" && order !== "MM") return;
  const little = order === "II";
  const first = view.getUint32(4, little);
  const ifd0 = readIfd(view, 0, first, little).entries;
  const exifAt = ifd0.get(0x8769);
  const gpsAt = ifd0.get(0x8825);
  const exif = exifAt ? readIfd(view, 0, exifAt, little).entries : new Map();
  const gps = gpsAt ? readIfd(view, 0, gpsAt, little).entries : new Map();
  const tags = info.tags;
  const set = (key, value) => {
    if (value !== undefined && value !== null && value !== "" && tags[key] === undefined) tags[key] = value;
  };
  set("description", ifd0.get(0x010e));
  set("camera", [ifd0.get(0x010f), ifd0.get(0x0110)].filter(Boolean).join(" ").replace(/^(\S+) \1 /, "$1 "));
  set("software", ifd0.get(0x0131));
  set("artist", ifd0.get(0x013b));
  set("copyright", ifd0.get(0x8298));
  set("date", exif.get(0x9003) || ifd0.get(0x0132));
  set("lens", exif.get(0xa434));
  const exposure = exif.get(0x829a);
  if (exposure) set("exposure", exposure >= 1 ? `${exposure} s` : `1/${Math.round(1 / exposure)} s`);
  const aperture = exif.get(0x829d);
  if (aperture) set("aperture", `f/${Number(aperture.toFixed(1))}`);
  const iso = exif.get(0x8827);
  if (iso) set("iso", `ISO ${Array.isArray(iso) ? iso[0] : iso}`);
  const focal = exif.get(0x920a);
  if (focal) set("focalLength", `${Number(focal.toFixed(1))} mm`);
  const orientation = ifd0.get(0x0112);
  if (orientation) info.orientation = orientation;
  const resolution = ifd0.get(0x011a);
  const unit = ifd0.get(0x0128) ?? 2;
  if (resolution > 1 && !info.dpi && (unit === 2 || unit === 3)) info.dpi = unit === 3 ? resolution * 2.54 : resolution;
  const latitude = gpsDegrees(gps.get(2), gps.get(1));
  const longitude = gpsDegrees(gps.get(4), gps.get(3));
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    info.gps = { latitude, longitude };
    const altitude = gps.get(6);
    if (Number.isFinite(altitude)) info.gps.altitude = gps.get(5) === 1 ? -altitude : altitude;
  }
}

// ---- formats ----

function readJpeg(bytes, info) {
  info.format = "JPEG";
  let at = 2;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) break;
    const marker = bytes[at + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    const body = at + 4;
    if (marker === 0xe0 && ascii(bytes, body, 5) === "JFIF\0") {
      const units = bytes[body + 7];
      const density = (bytes[body + 8] << 8) | bytes[body + 9];
      // 1: dots per inch, 2: per centimetre; 0 is only an aspect ratio.
      if (density > 1 && units === 1) info.dpi = density;
      if (density > 1 && units === 2) info.dpi = density * 2.54;
    } else if (marker === 0xe1 && ascii(bytes, body, 6) === "Exif\0\0") {
      readExif(bytes, body + 6, info);
    } else if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      info.bitDepth = bytes[body];
      info.height = (bytes[body + 1] << 8) | bytes[body + 2];
      info.width = (bytes[body + 3] << 8) | bytes[body + 4];
      info.channels = bytes[body + 5];
    }
    at = body + length - 2;
  }
}

const PNG_TEXT_KEYS = { Title: "title", Author: "artist", Description: "description", Copyright: "copyright", "Creation Time": "date", Software: "software", Comment: "comment", Source: "camera" };

function readPng(bytes, info) {
  info.format = "PNG";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 8;
  while (at + 12 <= bytes.length) {
    const length = view.getUint32(at);
    const type = ascii(bytes, at + 4, 4);
    const body = at + 8;
    if (body + length > bytes.length) break;
    if (type === "IHDR") {
      info.width = view.getUint32(body);
      info.height = view.getUint32(body + 4);
      info.bitDepth = bytes[body + 8];
      info.channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[bytes[body + 9]] ?? null;
    } else if (type === "pHYs" && bytes[body + 8] === 1) {
      // Pixels per metre.
      const perMetre = view.getUint32(body);
      if (perMetre > 1) info.dpi = perMetre * 0.0254;
    } else if (type === "tEXt" || type === "iTXt") {
      const chunk = bytes.subarray(body, body + length);
      const keyEnd = chunk.indexOf(0);
      const key = latin1.decode(chunk.subarray(0, keyEnd));
      let text = "";
      if (type === "tEXt") {
        text = latin1.decode(chunk.subarray(keyEnd + 1));
      } else if (chunk[keyEnd + 1] === 0) {
        // Uncompressed iTXt: flag, method, language\0, translated key\0, text.
        let rest = keyEnd + 3;
        rest = chunk.indexOf(0, rest) + 1;
        rest = chunk.indexOf(0, rest) + 1;
        if (rest > 0) text = utf8.decode(chunk.subarray(rest));
      }
      const name = PNG_TEXT_KEYS[key];
      if (name && clean(text) && info.tags[name] === undefined) info.tags[name] = clean(text);
    } else if (type === "eXIf") {
      readExif(bytes.subarray(body, body + length), 0, info);
    } else if (type === "IEND") {
      break;
    }
    at = body + length + 4;
  }
}

function readWebp(bytes, info) {
  info.format = "WebP";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 12;
  while (at + 8 <= bytes.length) {
    const type = ascii(bytes, at, 4);
    const size = view.getUint32(at + 4, true);
    const body = at + 8;
    if (type === "VP8X" && body + 10 <= bytes.length) {
      info.width = 1 + (bytes[body + 4] | (bytes[body + 5] << 8) | (bytes[body + 6] << 16));
      info.height = 1 + (bytes[body + 7] | (bytes[body + 8] << 8) | (bytes[body + 9] << 16));
    } else if (type === "VP8 " && !info.width && body + 10 <= bytes.length) {
      info.width = view.getUint16(body + 6, true) & 0x3fff;
      info.height = view.getUint16(body + 8, true) & 0x3fff;
    } else if (type === "VP8L" && !info.width && body + 5 <= bytes.length) {
      const bits = view.getUint32(body + 1, true);
      info.width = (bits & 0x3fff) + 1;
      info.height = ((bits >> 14) & 0x3fff) + 1;
    } else if (type === "EXIF") {
      const exif = bytes.subarray(body, body + size);
      readExif(exif, ascii(exif, 0, 6) === "Exif\0\0" ? 6 : 0, info);
    }
    at = body + size + (size % 2);
  }
}

// The header of `bytes` (an ArrayBuffer or Uint8Array of the file).
export function readImageMetadata(bytes, extension = "") {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const info = { format: String(extension || "").toUpperCase() || "Image", tags: {} };
  try {
    if (data[0] === 0xff && data[1] === 0xd8) readJpeg(data, info);
    else if (ascii(data, 1, 3) === "PNG") readPng(data, info);
    else if (ascii(data, 0, 4) === "RIFF" && ascii(data, 8, 4) === "WEBP") readWebp(data, info);
    else if (ascii(data, 0, 3) === "GIF") info.format = "GIF";
    else if (ascii(data, 0, 2) === "BM") info.format = "BMP";
    else if (ascii(data, 4, 4) === "ftyp" && /avi[fs]/.test(ascii(data, 8, 4))) info.format = "AVIF";
  } catch (error) {
    console.warn("Could not read the image file's header", error);
  }
  if (info.dpi) info.dpi = Math.round(info.dpi * 100) / 100;
  return info;
}

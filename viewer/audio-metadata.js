// What an audio file says about itself, read from its header (audio.js):
// the format, sample rate, channels and bit depth, its tags (title, artist,
// date...) and its markers - the points an archive or an editor set in it.
//
//   WAV / BWF   the fmt chunk; LIST INFO tags; the Broadcast Wave bext
//               chunk (description, originator, date); cue points with
//               their labels (LIST adtl labl) as markers.
//   FLAC        STREAMINFO; Vorbis comments, CHAPTERxxx as markers.
//   MP3         ID3v2 text frames and comments, CHAP frames as markers;
//               the sample rate and channels from the first frame.
//   Ogg         Vorbis or Opus: the identification header, then the
//               comments as in FLAC.
//
// Anything else (M4A/AAC, WebM...) gives what the browser's decoder tells:
// the duration, rate and channels (audio.js). Nothing here throws on a
// damaged header: what could be read is returned.

export const AUDIO_EXTENSIONS = ["wav", "wave", "bwf", "mp3", "ogg", "oga", "opus", "flac", "m4a", "aac", "weba"];

export const AUDIO_MIME_TYPES = {
  wav: "audio/wav",
  wave: "audio/wav",
  bwf: "audio/wav",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
  weba: "audio/webm",
};

export const isAudioExtension = (extension) => AUDIO_EXTENSIONS.includes(String(extension || "").toLowerCase());

const ascii = (bytes, start, length) => {
  let text = "";
  for (let i = start; i < start + length && i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
  return text;
};

const latin1 = new TextDecoder("latin1");
const utf8 = new TextDecoder("utf-8");

// Text with its trailing NULs and spaces cut.
const clean = (text) => String(text || "").replace(/\0[\s\S]*$/, "").trim();

// Vorbis comment keys, ID3 frames and RIFF INFO ids, one name each.
const TAG_NAMES = {
  TITLE: "title", ARTIST: "artist", ALBUM: "album", DATE: "date", YEAR: "date",
  GENRE: "genre", COMMENT: "comment", DESCRIPTION: "description", COPYRIGHT: "copyright",
  ENCODER: "software", ORGANIZATION: "originator", LOCATION: "location", PERFORMER: "artist",
  TIT2: "title", TPE1: "artist", TALB: "album", TYER: "date", TDRC: "date", TCON: "genre",
  TCOP: "copyright", TSSE: "software", TENC: "software", TPUB: "originator",
  INAM: "title", IART: "artist", IPRD: "album", ICRD: "date", IGNR: "genre",
  ICMT: "comment", ICOP: "copyright", ISFT: "software", ISBJ: "description",
};

function addTag(tags, key, value) {
  const name = TAG_NAMES[String(key).toUpperCase()];
  const text = clean(value);
  if (name && text && !tags[name]) tags[name] = text;
}

// "00:01:02.500" (Vorbis chapters) -> 62.5 s.
function clockSeconds(text) {
  const parts = String(text).trim().split(":").map(Number);
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function sortedMarkers(markers) {
  return markers
    .filter((marker) => Number.isFinite(marker.time) && marker.time >= 0)
    .sort((a, b) => a.time - b.time);
}

// ---- WAV / Broadcast Wave ----

function readWav(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const info = { format: "WAV", tags: {}, markers: [] };
  const cues = new Map();
  const labels = new Map();
  let dataSize = null;
  let blockAlign = 0;
  let offset = 12;
  const readList = (start, end) => {
    const type = ascii(bytes, start, 4);
    let at = start + 4;
    while (at + 8 <= end) {
      const id = ascii(bytes, at, 4);
      const size = view.getUint32(at + 4, true);
      const body = at + 8;
      if (type === "INFO") addTag(info.tags, id, latin1.decode(bytes.subarray(body, Math.min(body + size, end))));
      if (type === "adtl" && (id === "labl" || id === "note") && size >= 4) {
        const cue = view.getUint32(body, true);
        if (!labels.has(cue)) labels.set(cue, clean(latin1.decode(bytes.subarray(body + 4, Math.min(body + size, end)))));
      }
      at = body + size + (size % 2);
    }
  };
  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    const end = Math.min(body + size, bytes.length);
    if (id === "fmt " && end - body >= 16) {
      const tag = view.getUint16(body, true);
      info.channels = view.getUint16(body + 2, true);
      info.sampleRate = view.getUint32(body + 4, true);
      blockAlign = view.getUint16(body + 12, true);
      info.bitsPerSample = view.getUint16(body + 14, true);
      info.codec = tag === 3 ? "PCM float" : tag === 1 || tag === 0xfffe ? "PCM" : `0x${tag.toString(16)}`;
    } else if (id === "data") {
      // An RF64 file says 0xFFFFFFFF here (its real size is in ds64).
      dataSize = size === 0xffffffff ? bytes.length - body : size;
      // The samples are not needed: what follows them (LIST, cue) is.
      offset = body + dataSize + (dataSize % 2);
      continue;
    } else if (id === "LIST" && end - body >= 4) {
      readList(body, end);
    } else if (id === "bext" && end - body >= 346) {
      info.format = "Broadcast Wave";
      addTag(info.tags, "DESCRIPTION", latin1.decode(bytes.subarray(body, body + 256)));
      addTag(info.tags, "ORGANIZATION", latin1.decode(bytes.subarray(body + 256, body + 288)));
      const date = clean(ascii(bytes, body + 320, 10));
      const time = clean(ascii(bytes, body + 330, 8));
      if (date) info.tags.date ??= time ? `${date} ${time}` : date;
    } else if (id === "cue " && end - body >= 4) {
      const count = view.getUint32(body, true);
      for (let i = 0; i < count && body + 4 + i * 24 + 24 <= end; i++) {
        const point = body + 4 + i * 24;
        cues.set(view.getUint32(point, true), view.getUint32(point + 20, true));
      }
    }
    offset = body + size + (size % 2);
  }
  if (dataSize !== null && blockAlign && info.sampleRate) info.duration = dataSize / blockAlign / info.sampleRate;
  if (info.sampleRate) {
    info.markers = sortedMarkers([...cues].map(([id, sample], index) => ({
      time: sample / info.sampleRate,
      label: labels.get(id) || `${index + 1}`,
    })));
  }
  return info;
}

// ---- Vorbis comments (FLAC, Ogg) ----

function readVorbisComments(bytes, start, end, info) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = start;
  if (at + 4 > end) return;
  const vendorLength = view.getUint32(at, true);
  at += 4;
  if (vendorLength && at + vendorLength <= end) info.tags.software ??= clean(utf8.decode(bytes.subarray(at, at + vendorLength)));
  at += vendorLength;
  if (at + 4 > end) return;
  const count = view.getUint32(at, true);
  at += 4;
  const chapters = new Map();
  for (let i = 0; i < count && at + 4 <= end; i++) {
    const length = view.getUint32(at, true);
    at += 4;
    if (at + length > end) break;
    const comment = utf8.decode(bytes.subarray(at, at + length));
    at += length;
    const split = comment.indexOf("=");
    if (split < 1) continue;
    const key = comment.slice(0, split).toUpperCase();
    const value = comment.slice(split + 1);
    const chapter = /^CHAPTER(\d+)(NAME)?$/.exec(key);
    if (chapter) {
      const entry = chapters.get(chapter[1]) || {};
      if (chapter[2]) entry.label = clean(value);
      else entry.time = clockSeconds(value);
      chapters.set(chapter[1], entry);
    } else {
      addTag(info.tags, key, value);
    }
  }
  info.markers = sortedMarkers([...chapters.values()].map((entry, index) => ({
    time: entry.time,
    label: entry.label || `${index + 1}`,
  })));
}

function readFlac(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const info = { format: "FLAC", codec: "FLAC", tags: {}, markers: [] };
  let at = 4;
  while (at + 4 <= bytes.length) {
    const header = bytes[at];
    const type = header & 0x7f;
    const length = (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3];
    const body = at + 4;
    if (type === 0 && body + 18 <= bytes.length) {
      info.sampleRate = (bytes[body + 10] << 12) | (bytes[body + 11] << 4) | (bytes[body + 12] >> 4);
      info.channels = ((bytes[body + 12] >> 1) & 0x07) + 1;
      info.bitsPerSample = (((bytes[body + 12] & 0x01) << 4) | (bytes[body + 13] >> 4)) + 1;
      const samples = (bytes[body + 13] & 0x0f) * 2 ** 32 + view.getUint32(body + 14);
      if (samples && info.sampleRate) info.duration = samples / info.sampleRate;
    } else if (type === 4) {
      readVorbisComments(bytes, body, Math.min(body + length, bytes.length), info);
    }
    if (header & 0x80) break;
    at = body + length;
  }
  return info;
}

// ---- Ogg (Vorbis, Opus) ----

// The first packets of the stream, put together from its pages.
function oggPackets(bytes, wanted) {
  const packets = [];
  let current = [];
  let at = 0;
  while (at + 27 <= bytes.length && packets.length < wanted) {
    if (ascii(bytes, at, 4) !== "OggS") break;
    const segments = bytes[at + 26];
    let body = at + 27 + segments;
    for (let i = 0; i < segments; i++) {
      const lace = bytes[at + 27 + i];
      current.push(bytes.subarray(body, body + lace));
      body += lace;
      if (lace < 255) {
        const length = current.reduce((n, part) => n + part.length, 0);
        const packet = new Uint8Array(length);
        let fill = 0;
        current.forEach((part) => { packet.set(part, fill); fill += part.length; });
        packets.push(packet);
        current = [];
        if (packets.length >= wanted) break;
      }
    }
    at = body;
  }
  return packets;
}

function readOgg(bytes) {
  const info = { format: "Ogg", tags: {}, markers: [] };
  const [head, comments] = oggPackets(bytes, 2);
  if (head && ascii(head, 1, 6) === "vorbis") {
    const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
    info.codec = "Vorbis";
    info.channels = head[11];
    info.sampleRate = view.getUint32(12, true);
    if (comments && ascii(comments, 1, 6) === "vorbis") readVorbisComments(comments, 7, comments.length, info);
  } else if (head && ascii(head, 0, 8) === "OpusHead") {
    const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
    info.codec = "Opus";
    info.channels = head[9];
    // The rate it was made at; Opus itself always plays at 48 kHz.
    info.sampleRate = view.getUint32(12, true) || 48000;
    if (comments && ascii(comments, 0, 8) === "OpusTags") readVorbisComments(comments, 8, comments.length, info);
  }
  return info;
}

// ---- MP3 (ID3v2, the first MPEG frame) ----

const syncsafe = (bytes, at) => (bytes[at] << 21) | (bytes[at + 1] << 14) | (bytes[at + 2] << 7) | bytes[at + 3];

// An ID3 text: the first byte says its encoding.
function id3Text(bytes) {
  if (!bytes.length) return "";
  const body = bytes.subarray(1);
  switch (bytes[0]) {
    case 1: return new TextDecoder("utf-16").decode(body);
    case 2: return new TextDecoder("utf-16be").decode(body);
    case 3: return utf8.decode(body);
    default: return latin1.decode(body);
  }
}

// Where an encoded, NUL-terminated string ends (two NULs in UTF-16).
function id3StringEnd(bytes, at, encoding) {
  const wide = encoding === 1 || encoding === 2;
  for (let i = at; i < bytes.length; i += wide ? 2 : 1) {
    if (bytes[i] === 0 && (!wide || bytes[i + 1] === 0)) return i;
  }
  return bytes.length;
}

function readId3Frames(bytes, start, end, version, info) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = start;
  while (at + 10 <= end) {
    const id = ascii(bytes, at, 4);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = version >= 4 ? syncsafe(bytes, at + 4) : view.getUint32(at + 4);
    const body = bytes.subarray(at + 10, Math.min(at + 10 + size, end));
    if (id[0] === "T" && id !== "TXXX") {
      addTag(info.tags, id, id3Text(body));
    } else if (id === "TXXX" && body.length > 1) {
      // A user-defined text: its description, then its value.
      const encoding = body[0];
      const descriptionEnd = id3StringEnd(body, 1, encoding);
      const valueStart = descriptionEnd + (encoding === 1 || encoding === 2 ? 2 : 1);
      addTag(info.tags, clean(id3Text(body.subarray(0, descriptionEnd))), id3Text(Uint8Array.of(encoding, ...body.subarray(valueStart))));
    } else if (id === "COMM" && body.length > 4) {
      const encoding = body[0];
      const descriptionEnd = id3StringEnd(body, 4, encoding);
      const textStart = descriptionEnd + (encoding === 1 || encoding === 2 ? 2 : 1);
      addTag(info.tags, "COMMENT", id3Text(Uint8Array.of(encoding, ...body.subarray(textStart))));
    } else if (id === "CHAP") {
      const idEnd = body.indexOf(0);
      if (idEnd >= 0 && idEnd + 17 <= body.length) {
        const chapterView = new DataView(body.buffer, body.byteOffset, body.byteLength);
        const chapter = { time: chapterView.getUint32(idEnd + 1) / 1000, tags: {} };
        readId3Frames(body, idEnd + 17, body.length, version, chapter);
        info.markers.push({ time: chapter.time, label: chapter.tags.title || ascii(body, 0, idEnd) });
      }
    }
    at += 10 + size;
  }
}

const MPEG_RATES = [44100, 48000, 32000];
const MPEG1_L3_KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MPEG2_L3_KBPS = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

function readMp3(bytes) {
  const info = { format: "MP3", codec: "MPEG audio", tags: {}, markers: [] };
  let at = 0;
  if (ascii(bytes, 0, 3) === "ID3") {
    const version = bytes[3];
    const size = syncsafe(bytes, 6);
    if (version >= 3) readId3Frames(bytes, 10, Math.min(10 + size, bytes.length), version, info);
    at = 10 + size;
  }
  for (let i = at; i + 4 <= bytes.length && i < at + 65536; i++) {
    if (bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) continue;
    const versionBits = (bytes[i + 1] >> 3) & 0x03;
    const layerBits = (bytes[i + 1] >> 1) & 0x03;
    const rateIndex = (bytes[i + 2] >> 2) & 0x03;
    const bitrateIndex = bytes[i + 2] >> 4;
    if (versionBits === 1 || layerBits === 0 || rateIndex === 3 || bitrateIndex === 15) continue;
    const divisor = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 4;
    info.sampleRate = MPEG_RATES[rateIndex] / divisor;
    info.channels = (bytes[i + 3] >> 6) === 3 ? 1 : 2;
    if (layerBits === 1) {
      const kbps = (versionBits === 3 ? MPEG1_L3_KBPS : MPEG2_L3_KBPS)[bitrateIndex];
      if (kbps) info.bitrate = kbps * 1000;
    }
    break;
  }
  info.markers = sortedMarkers(info.markers);
  return info;
}

// The header of `bytes` (the start of the file is enough for MP3, FLAC and
// Ogg; a WAV's tags and cue points may follow its samples, so the whole file).
export function readAudioMetadata(bytes, extension = "") {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    const magic = ascii(data, 0, 4);
    if ((magic === "RIFF" || magic === "RF64") && ascii(data, 8, 4) === "WAVE") return readWav(data);
    if (magic === "fLaC") return readFlac(data);
    if (magic === "OggS") return readOgg(data);
    if (ascii(data, 0, 3) === "ID3" || String(extension).toLowerCase() === "mp3") return readMp3(data);
    if (ascii(data, 4, 4) === "ftyp") return { format: "MPEG-4 audio", tags: {}, markers: [] };
    if (data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) return { format: "WebM", tags: {}, markers: [] };
    if (data[0] === 0xff && (data[1] & 0xf6) === 0xf0) return { format: "AAC (ADTS)", tags: {}, markers: [] };
  } catch (error) {
    console.warn("Could not read the audio file's header", error);
  }
  return { format: String(extension || "").toUpperCase() || "Audio", tags: {}, markers: [] };
}

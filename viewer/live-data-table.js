// Live data (editor/live-data.js): the table behind it - read from CSV, TSV
// or JSON, compared with the one before, and turned into colours. No DOM and
// no three.js here: this also runs in Node (the tests).

// Sequential ramps, light to dark, and one diverging. Each is a list of
// stops the value's place between min and max is interpolated through.
export const LIVE_DATA_RAMPS = {
  heat: ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"],
  viridis: ["#fde725", "#5ec962", "#21918c", "#3b528b", "#440154"],
  blue: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"],
  green: ["#edf8e9", "#bae4b3", "#74c476", "#31a354", "#006d2c"],
  traffic: ["#1a9850", "#a6d96a", "#fee08b", "#f46d43", "#d73027"],
  diverging: ["#2166ac", "#92c5de", "#f7f7f7", "#f4a582", "#b2182b"],
};
export const LIVE_DATA_RAMP_NAMES = Object.keys(LIVE_DATA_RAMPS);
// Okabe-Ito: told apart with the common colour vision deficiencies.
export const LIVE_DATA_CATEGORY_COLORS = ["#0072b2", "#e69f00", "#009e73", "#d55e00", "#cc79a7", "#56b4e9", "#f0e442", "#999999"];
export const LIVE_DATA_REFRESH = [0, 1, 2, 5, 15, 60];
export const LIVE_DATA_MAX_ROWS = 5000;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const FALSE_WORDS = new Set(["0", "false", "no", "n", "off", "nie", "nein", "hidden"]);

// "Column_1", "column 1", "Column.1" -> "column1": how a row's key and an
// object's name are compared.
export function normalizeDataKey(value) {
  return String(value ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// A cell as a number: 23, "23", "23.5", "23,5", "23 %", "1 250,5"; else NaN.
export function dataNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value !== "string") return NaN;
  let text = value.trim().replace(/[\s ]/g, "").replace(/(%|°c|°|m|cm|mm)$/i, "");
  if (!text) return NaN;
  // A decimal comma, with or without dots between the thousands.
  if (/^-?\d+,\d+$/.test(text)) text = text.replace(",", ".");
  else if (/^-?\d{1,3}(?:\.\d{3})+,\d+$/.test(text)) text = text.replace(/\./g, "").replace(",", ".");
  return /^-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(text) ? Number(text) : NaN;
}

// A cell as yes or no (the `visible` channel): no only when it says so - an
// empty cell hides nothing.
export function dataTruthy(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return !FALSE_WORDS.has(String(value ?? "").trim().toLowerCase());
}

function splitDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === "\"") {
        if (text[index + 1] === "\"") {
          cell += "\"";
          index += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === "\"" && cell === "") quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ""));
}

// The delimiter of the header line: the one that splits it into most cells
// (a tab, a semicolon - spreadsheets where the comma is the decimal sign -
// or a comma).
function sniffDelimiter(text) {
  const header = text.split(/\r?\n/, 1)[0] || "";
  let best = ",";
  let most = 0;
  ["\t", ";", ","].forEach((delimiter) => {
    const count = splitDelimited(header, delimiter)[0]?.length || 0;
    if (count > most) {
      most = count;
      best = delimiter;
    }
  });
  return best;
}

function uniqueColumns(names) {
  const seen = new Map();
  return names.map((raw, index) => {
    const name = String(raw ?? "").trim() || `column ${index + 1}`;
    const count = seen.get(name) || 0;
    seen.set(name, count + 1);
    return count ? `${name} (${count + 1})` : name;
  });
}

// Rows given as objects (JSON, the manifest's `rows`, the API) -> a table.
// Cells are kept as strings, numbers or booleans; anything else is written
// out as JSON.
export function tableFromObjects(list) {
  const columns = [];
  const rows = [];
  (Array.isArray(list) ? list : []).slice(0, LIVE_DATA_MAX_ROWS).forEach((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const row = {};
    Object.entries(item).forEach(([key, value]) => {
      if (!columns.includes(key)) columns.push(key);
      row[key] = value === null || value === undefined
        ? ""
        : ["string", "number", "boolean"].includes(typeof value) ? value : JSON.stringify(value);
    });
    rows.push(row);
  });
  rows.forEach((row) => columns.forEach((column) => {
    if (!(column in row)) row[column] = "";
  }));
  return { columns, rows };
}

// The text of a CSV / TSV file (first line: the column names) or of a JSON
// one (an array of objects, or { rows | data | items: [...] }, or an object
// of objects keyed by the part's name) -> { columns, rows }.
export function parseDataTable(text) {
  const source = String(text ?? "").replace(/^﻿/, "");
  const trimmed = source.trim();
  if (!trimmed) return { columns: [], rows: [] };
  if (trimmed[0] === "[" || trimmed[0] === "{") {
    try {
      const json = JSON.parse(trimmed);
      if (Array.isArray(json)) return tableFromObjects(json);
      const list = [json.rows, json.data, json.items, json.values].find(Array.isArray);
      if (list) return tableFromObjects(list);
      const entries = Object.entries(json).filter(([, value]) => value && typeof value === "object" && !Array.isArray(value));
      if (entries.length) return tableFromObjects(entries.map(([key, value]) => ({ key, ...value })));
      return { columns: [], rows: [] };
    } catch {
      // Not JSON after all: read as delimited text.
    }
  }
  const lines = splitDelimited(source, sniffDelimiter(source));
  if (!lines.length) return { columns: [], rows: [] };
  const columns = uniqueColumns(lines[0]);
  const rows = lines.slice(1, LIVE_DATA_MAX_ROWS + 1).map((cells) => Object.fromEntries(columns.map((column, index) => [column, (cells[index] ?? "").trim()])));
  return { columns, rows };
}

// The table as CSV (saved from the window).
export function dataTableToCsv(columns, rows) {
  const cell = (value) => {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
  };
  return [columns, ...rows.map((row) => columns.map((column) => row[column]))]
    .map((cells) => cells.map(cell).join(","))
    .join("\n") + "\n";
}

// Whether a column holds numbers (every filled cell is one) or texts.
export function dataColumnKind(rows, column) {
  let numbers = 0;
  for (const row of rows) {
    const value = row?.[column];
    if (value === "" || value === null || value === undefined) continue;
    if (Number.isNaN(dataNumber(typeof value === "boolean" ? String(value) : value))) return "text";
    numbers += 1;
  }
  return numbers ? "number" : "text";
}

// The keys of the rows that differ from the table before: changed, new or
// gone. `key`: the key column.
export function diffDataRows(before, after, key) {
  const signature = (row) => JSON.stringify(row);
  const old = new Map((before || []).map((row) => [normalizeDataKey(row?.[key]), signature(row)]));
  const changed = new Set();
  (after || []).forEach((row) => {
    const id = normalizeDataKey(row?.[key]);
    if (!id) return;
    if (old.get(id) !== signature(row)) changed.add(id);
    old.delete(id);
  });
  old.forEach((_, id) => id && changed.add(id));
  return changed;
}

// The column whose cells name most of `names` (the model's objects, already
// normalised), or the first one.
export function guessKeyColumn(columns, rows, names) {
  let best = columns[0] || "";
  let most = 0;
  columns.forEach((column) => {
    const seen = new Set();
    rows.forEach((row) => {
      const id = normalizeDataKey(row?.[column]);
      if (id && names.has(id)) seen.add(id);
    });
    if (seen.size > most) {
      most = seen.size;
      best = column;
    }
  });
  return best;
}

function hexToRgb(hex) {
  const value = hex.length === 4 ? hex.replace(/[0-9a-f]/gi, (char) => char + char) : hex;
  return [1, 3, 5].map((start) => parseInt(value.slice(start, start + 2), 16));
}

function rgbToHex(rgb) {
  return `#${rgb.map((value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0")).join("")}`;
}

// The colour at `position` (0-1) along the stops.
export function rampColor(stops, position) {
  const list = stops.length ? stops : LIVE_DATA_RAMPS.heat;
  if (list.length === 1) return list[0];
  const scaled = Math.min(1, Math.max(0, Number.isFinite(position) ? position : 0)) * (list.length - 1);
  const index = Math.min(list.length - 2, Math.floor(scaled));
  const from = hexToRgb(list[index]);
  const to = hexToRgb(list[index + 1]);
  const mix = scaled - index;
  return rgbToHex(from.map((value, channel) => value + (to[channel] - value) * mix));
}

// The stops of a `ramp` setting: a name, or a list of colours.
export function rampStops(ramp) {
  if (Array.isArray(ramp)) {
    const stops = ramp.filter((value) => typeof value === "string" && HEX.test(value));
    if (stops.length >= 2) return stops;
  }
  return LIVE_DATA_RAMPS[ramp] || LIVE_DATA_RAMPS.heat;
}

// How the `color` setting paints the rows:
//   { kind: "none" }
//   { kind: "number", min, max, stops, colorOf(value) }
//   { kind: "category", categories: [{ value, color }], colorOf(value) }
// A numeric column runs along the ramp between `min` and `max` (the
// column's own lowest and highest when not set). A text column gets a colour
// per value: the `categories` given, then the palette in order of first
// appearance; a cell that is itself a colour ("#c0392b") is used as it is.
export function dataColorScale(color, rows) {
  const column = color?.column;
  if (!column || !rows.some((row) => column in row)) return { kind: "none", colorOf: () => null };
  if (dataColumnKind(rows, column) === "number" && !color.categories) {
    const values = rows.map((row) => dataNumber(row[column])).filter((value) => !Number.isNaN(value));
    const low = Number.isFinite(color.min) ? color.min : Math.min(...values);
    const high = Number.isFinite(color.max) ? color.max : Math.max(...values);
    const stops = rampStops(color.ramp);
    const list = color.reverse ? [...stops].reverse() : stops;
    return {
      kind: "number",
      min: low,
      max: high,
      stops: list,
      colorOf(value) {
        const number = dataNumber(value);
        if (Number.isNaN(number)) return null;
        return rampColor(list, high > low ? (number - low) / (high - low) : 0.5);
      },
    };
  }
  const given = color.categories && typeof color.categories === "object" ? color.categories : {};
  const byValue = new Map();
  Object.entries(given).forEach(([value, hex]) => {
    if (typeof hex === "string" && HEX.test(hex)) byValue.set(String(value).trim().toLowerCase(), { value, color: hex });
  });
  let next = 0;
  rows.forEach((row) => {
    const value = String(row[column] ?? "").trim();
    const id = value.toLowerCase();
    if (!value || byValue.has(id) || HEX.test(value)) return;
    byValue.set(id, { value, color: LIVE_DATA_CATEGORY_COLORS[next % LIVE_DATA_CATEGORY_COLORS.length] });
    next += 1;
  });
  return {
    kind: "category",
    categories: [...byValue.values()],
    colorOf(value) {
      const text = String(value ?? "").trim();
      if (!text) return null;
      if (HEX.test(text)) return text;
      return byValue.get(text.toLowerCase())?.color || null;
    },
  };
}

// Whether a row's cell sets off the alert: a number above `above` or below
// `below`, or a text equal to `equals`.
export function dataAlert(alert, row) {
  if (!alert?.column || !row || !(alert.column in row)) return false;
  const value = row[alert.column];
  if (alert.equals !== undefined && alert.equals !== null && alert.equals !== "") {
    return String(value ?? "").trim().toLowerCase() === String(alert.equals).trim().toLowerCase();
  }
  const number = dataNumber(value);
  if (Number.isNaN(number)) return false;
  return (Number.isFinite(alert.above) && number > alert.above) || (Number.isFinite(alert.below) && number < alert.below);
}

const optionalNumber = (value) => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value));
const columnOf = (value) => {
  const column = typeof value === "string" ? value : value?.column;
  return typeof column === "string" && column.trim() ? column.trim() : null;
};

// AIM3DViewer.data as the manifest, the window or the API gives it -> the
// settings the viewer keeps. A string is the table's URL.
export function normalizeLiveData(raw) {
  const config = typeof raw === "string" ? { src: raw } : raw && typeof raw === "object" && !Array.isArray(raw) ? raw : Array.isArray(raw) ? { rows: raw } : {};
  const refresh = Number(config.refresh);
  const strength = Number(config.strength);
  const transition = Number(config.transition);
  const colorColumn = columnOf(config.color);
  const labelColumn = columnOf(config.label);
  const alertColumn = columnOf(config.alert);
  const visibleColumn = columnOf(config.visible);
  const color = typeof config.color === "object" && config.color ? config.color : {};
  const label = typeof config.label === "object" && config.label ? config.label : {};
  const alert = typeof config.alert === "object" && config.alert ? config.alert : {};
  return {
    src: typeof config.src === "string" && config.src.trim() ? config.src.trim() : null,
    refresh: Number.isFinite(refresh) && refresh > 0 ? Math.min(3600, Math.max(0.5, refresh)) : 0,
    rows: Array.isArray(config.rows) ? config.rows : null,
    key: typeof config.key === "string" && config.key.trim() ? config.key.trim() : null,
    color: colorColumn ? {
      column: colorColumn,
      ramp: Array.isArray(color.ramp) ? rampStops(color.ramp) : LIVE_DATA_RAMP_NAMES.includes(color.ramp) ? color.ramp : "heat",
      reverse: color.reverse === true,
      min: optionalNumber(color.min),
      max: optionalNumber(color.max),
      categories: color.categories && typeof color.categories === "object" && !Array.isArray(color.categories) ? { ...color.categories } : null,
    } : null,
    label: labelColumn ? {
      column: labelColumn,
      unit: typeof label.unit === "string" ? label.unit.slice(0, 12) : "",
      name: label.name === true,
    } : null,
    alert: alertColumn ? {
      column: alertColumn,
      above: optionalNumber(alert.above),
      below: optionalNumber(alert.below),
      equals: typeof alert.equals === "string" || typeof alert.equals === "number" ? String(alert.equals) : null,
    } : null,
    visible: visibleColumn ? { column: visibleColumn } : null,
    strength: Number.isFinite(strength) ? Math.min(1, Math.max(0.1, strength)) : 0.75,
    transition: Number.isFinite(transition) ? Math.min(10, Math.max(0, transition)) : 0.9,
    open: config.open !== false,
  };
}
